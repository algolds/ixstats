/**
 * Shared helpers for MyCountry routers.
 *
 * Extracted from dashboard.ts, intelligence.ts, and actions.ts (2026-06-14)
 * to eliminate ~900 lines of duplicated code across three files.
 *
 * Lives in src/server/shared/ so routers can import without cross-router
 * dependencies (follows the layer-cache.ts pattern).
 */

import { db } from "~/server/db";
import { globalCache } from "~/lib/cache";

import type {
  CountryWithEconomicData,
  Ranking,
  RankingCategory,
  VitalityScores,
} from "~/types/mycountry";

/**
 * Cache helper functions for MyCountry-specific data
 */
export async function getMyCountryCache<T = any>(key: string): Promise<T | null> {
  return globalCache.get<T>(key);
}

export async function setMyCountryCache(key: string, data: any, ttl = 60000): Promise<void> {
  await globalCache.set(key, data, { ttl: Math.round(ttl / 1000) });
}

// ==================== DIPLOMATIC STANDING ====================

/** The real diplomatic record a Diplomatic Standing score is computed from. */
interface DiplomaticStandingInputs {
  /** `DiplomaticRelation.strength` (0-100) of every relation the country is party to. */
  relationStrengths: number[];
  /** Active embassies the country hosts or keeps abroad. */
  activeEmbassies: number;
  /** Active alliance memberships. */
  allianceMemberships: number;
  /** Active or ratified treaties that name the country (by id) as a party. */
  activeTreaties: number;
  /** Active hostile foreign-policy actions (embargo, sanction, blockade) targeting the country. */
  hostileActionsReceived: number;
}

/**
 * Tunables for the Diplomatic Standing score. The base is the mean relation strength
 * (neutral when the country has no relations yet). Embassies, alliances and treaties add
 * capped bonuses, and hostile actions received subtract a capped penalty.
 */
export const DIPLOMATIC_STANDING_WEIGHTS = {
  neutralBase: 50,
  perEmbassy: 2,
  embassyCap: 20,
  perAlliance: 5,
  allianceCap: 15,
  perTreaty: 3,
  treatyCap: 15,
  perHostileAction: 8,
  hostileCap: 40,
} as const;

/** Foreign-policy action types that count as hostile when received. */
const HOSTILE_FOREIGN_POLICY_ACTIONS = ["embargo", "sanction", "blockade"];
const ACTIVE_TREATY_STATUSES = ["active", "ratified", "ACTIVE", "RATIFIED"];

export function emptyDiplomaticStandingInputs(): DiplomaticStandingInputs {
  return {
    relationStrengths: [],
    activeEmbassies: 0,
    allianceMemberships: 0,
    activeTreaties: 0,
    hostileActionsReceived: 0,
  };
}

/**
 * Score Diplomatic Standing (0-100) from the diplomatic record. Returns null when the
 * country has no diplomatic record at all, so the UI shows "—" instead of a made-up number.
 */
export function scoreDiplomaticStanding(inputs: DiplomaticStandingInputs): number | null {
  const w = DIPLOMATIC_STANDING_WEIGHTS;
  const strengths = inputs.relationStrengths.filter((s) => Number.isFinite(s));
  const hasRecord =
    strengths.length > 0 ||
    inputs.activeEmbassies > 0 ||
    inputs.allianceMemberships > 0 ||
    inputs.activeTreaties > 0 ||
    inputs.hostileActionsReceived > 0;
  if (!hasRecord) return null;

  const base =
    strengths.length > 0
      ? strengths.reduce((sum, s) => sum + s, 0) / strengths.length
      : w.neutralBase;
  const score =
    base +
    Math.min(w.embassyCap, inputs.activeEmbassies * w.perEmbassy) +
    Math.min(w.allianceCap, inputs.allianceMemberships * w.perAlliance) +
    Math.min(w.treatyCap, inputs.activeTreaties * w.perTreaty) -
    Math.min(w.hostileCap, inputs.hostileActionsReceived * w.perHostileAction);

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** The Prisma delegates the diplomatic loader reads (a PrismaClient or a test double). */
type DiplomacyDb = Pick<
  typeof db,
  "diplomaticRelation" | "embassy" | "allianceMember" | "treaty" | "foreignPolicyAction"
>;

/** Load the diplomatic record of several countries at once (one query per table). */
export async function loadDiplomaticStandingInputs(
  countryIds: string[],
  prisma: DiplomacyDb = db
): Promise<Map<string, DiplomaticStandingInputs>> {
  const result = new Map<string, DiplomaticStandingInputs>();
  const ids = [...new Set(countryIds)];
  for (const id of ids) result.set(id, emptyDiplomaticStandingInputs());
  if (ids.length === 0) return result;

  const [relations, embassies, memberships, treaties, hostile] = await Promise.all([
    prisma.diplomaticRelation.findMany({
      where: { OR: [{ country1: { in: ids } }, { country2: { in: ids } }] },
      select: { country1: true, country2: true, strength: true },
    }),
    prisma.embassy.findMany({
      where: {
        status: "active",
        OR: [{ hostCountryId: { in: ids } }, { guestCountryId: { in: ids } }],
      },
      select: { hostCountryId: true, guestCountryId: true },
    }),
    prisma.allianceMember.findMany({
      where: { countryId: { in: ids }, status: "active", isActive: true },
      select: { countryId: true },
    }),
    prisma.treaty.findMany({
      where: { status: { in: ACTIVE_TREATY_STATUSES }, parties: { not: null } },
      select: { parties: true },
    }),
    prisma.foreignPolicyAction.findMany({
      where: {
        targetId: { in: ids },
        status: "active",
        actionType: { in: HOSTILE_FOREIGN_POLICY_ACTIONS },
      },
      select: { targetId: true },
    }),
  ]);

  for (const r of relations) {
    // A relation row names both parties; credit each side that was asked for.
    for (const party of new Set([r.country1, r.country2])) {
      result.get(party)?.relationStrengths.push(r.strength);
    }
  }
  for (const e of embassies) {
    for (const party of new Set([e.hostCountryId, e.guestCountryId])) {
      const entry = result.get(party);
      if (entry) entry.activeEmbassies++;
    }
  }
  for (const m of memberships) {
    const entry = result.get(m.countryId);
    if (entry) entry.allianceMemberships++;
  }
  for (const t of treaties) {
    const parties = t.parties ?? "";
    for (const id of ids) {
      if (parties.includes(id)) result.get(id)!.activeTreaties++;
    }
  }
  for (const h of hostile) {
    const entry = result.get(h.targetId);
    if (entry) entry.hostileActionsReceived++;
  }

  return result;
}

/** A country's Diplomatic Standing (0-100), or null when it has no diplomatic record. */
export async function computeDiplomaticStanding(
  countryId: string,
  prisma: DiplomacyDb = db
): Promise<{ score: number | null; inputs: DiplomaticStandingInputs }> {
  const inputs =
    (await loadDiplomaticStandingInputs([countryId], prisma)).get(countryId) ??
    emptyDiplomaticStandingInputs();
  return { score: scoreDiplomaticStanding(inputs), inputs };
}

// ==================== GOVERNMENTAL EFFICIENCY ====================

/**
 * Governmental Efficiency (0-100) is `GovernmentStructure.governmentEffectiveness`, which
 * national issues and the government builder move. Null when no government is set up.
 */
export function scoreGovernmentalEfficiency(
  governmentEffectiveness: number | null | undefined
): number | null {
  if (typeof governmentEffectiveness !== "number" || !Number.isFinite(governmentEffectiveness)) {
    return null;
  }
  return Math.round(Math.min(100, Math.max(0, governmentEffectiveness)));
}

/** Read a country's government effectiveness (null when it has no GovernmentStructure). */
async function loadGovernmentEffectiveness(
  countryId: string,
  prisma: Pick<typeof db, "governmentStructure"> = db
): Promise<number | null> {
  const structure = await prisma.governmentStructure.findUnique({
    where: { countryId },
    select: { governmentEffectiveness: true },
  });
  return structure?.governmentEffectiveness ?? null;
}

// ==================== VITALITY ====================

/** Data outside the Country row that some vitality scores need. */
interface VitalityExtras {
  /** From `computeDiplomaticStanding`; null or absent when there is no diplomatic record. */
  diplomaticStanding?: number | null;
  /** `GovernmentStructure.governmentEffectiveness`; null or absent when there is none. */
  governmentEffectiveness?: number | null;
}

/**
 * Calculate national vitality scores based on comprehensive country data.
 * Diplomatic Standing and Governmental Efficiency are null when their source data is missing,
 * and the overall score averages only the known scores.
 */
export function calculateVitalityScores(
  country: CountryWithEconomicData,
  extras: VitalityExtras = {}
): VitalityScores {
  // Economic Vitality — matches getActivityRingsData formula
  const gdpScore = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
  const growthBonus = Math.min(20, Math.max(-20, country.adjustedGdpGrowth * 400));
  const economicVitality = Math.min(100, Math.max(0, gdpScore * 0.7 + growthBonus + 30));

  // Population Wellbeing — matches getActivityRingsData formula
  const popGrowthRate = country.populationGrowthRate || 0;
  const growthHealth = popGrowthRate > 0 ? 70 : 40;
  const densityFactor = country.populationDensity
    ? Math.max(50, 100 - country.populationDensity / 500)
    : 60;
  const populationWellbeing = (growthHealth + densityFactor) / 2;

  const diplomaticStanding =
    typeof extras.diplomaticStanding === "number" && Number.isFinite(extras.diplomaticStanding)
      ? Math.round(extras.diplomaticStanding)
      : null;
  const governmentalEfficiency = scoreGovernmentalEfficiency(extras.governmentEffectiveness);

  const known = [
    economicVitality,
    populationWellbeing,
    diplomaticStanding,
    governmentalEfficiency,
  ].filter((v): v is number => v !== null);

  return {
    economicVitality: Math.round(economicVitality),
    populationWellbeing: Math.round(populationWellbeing),
    diplomaticStanding,
    governmentalEfficiency,
    overallScore: Math.round(known.reduce((sum, v) => sum + v, 0) / known.length),
  };
}

/** Load the extras `calculateVitalityScores` needs for one country. */
export async function loadVitalityExtras(
  countryId: string,
  prisma: DiplomacyDb & Pick<typeof db, "governmentStructure"> = db
): Promise<VitalityExtras & { diplomaticInputs: DiplomaticStandingInputs }> {
  const [diplomatic, governmentEffectiveness] = await Promise.all([
    computeDiplomaticStanding(countryId, prisma),
    loadGovernmentEffectiveness(countryId, prisma),
  ]);
  return {
    diplomaticStanding: diplomatic.score,
    governmentEffectiveness,
    diplomaticInputs: diplomatic.inputs,
  };
}

// ==================== WORLD CENSUS RANKINGS ====================

/** One realm country's census values (null = no data, so it is left out of that ranking). */
interface CensusRow {
  id: string;
  region: string | null;
  economicTier: string;
  populationTier: string;
  values: Partial<Record<RankingCategory, number | null>>;
}

interface CensusCategory {
  category: RankingCategory;
  lowerIsBetter?: boolean;
  /** Which tier the "tier" ranking groups by. */
  tierKey: "economicTier" | "populationTier";
}

/** The World Census categories, in display order. */
const CENSUS_CATEGORIES: CensusCategory[] = [
  { category: "GDP per Capita", tierKey: "economicTier" },
  { category: "Total GDP", tierKey: "economicTier" },
  { category: "GDP Growth", tierKey: "economicTier" },
  { category: "Population", tierKey: "populationTier" },
  { category: "Public Approval", tierKey: "economicTier" },
  { category: "Stability", tierKey: "economicTier" },
  { category: "Diplomatic Standing", tierKey: "economicTier" },
  { category: "Infrastructure", tierKey: "economicTier" },
  { category: "Debt to GDP", tierKey: "economicTier", lowerIsBetter: true },
  { category: "Income Equality", tierKey: "economicTier", lowerIsBetter: true },
];

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function growthTrend(rate: number | null | undefined, up: number, down: number) {
  const r = finiteOrNull(rate);
  if (r === null) return undefined;
  return r > up ? "improving" : r < down ? "declining" : "stable";
}

/**
 * Rank one country across the census categories. Pure: `rows` is the realm's countries.
 * A category is left out when the country has no value for it.
 */
export function rankCensus(
  countryId: string,
  rows: CensusRow[],
  trends: Partial<Record<RankingCategory, Ranking["trend"]>> = {}
): Ranking[] {
  const self = rows.find((r) => r.id === countryId);
  if (!self) return [];

  const rankings: Ranking[] = [];
  for (const def of CENSUS_CATEGORIES) {
    const own = finiteOrNull(self.values[def.category]);
    if (own === null) continue;

    const ranked = rows
      .map((r) => ({ row: r, value: finiteOrNull(r.values[def.category]) }))
      .filter((r): r is { row: CensusRow; value: number } => r.value !== null)
      // Stable tiebreak on id so equal values always rank the same way.
      .sort((a, b) =>
        a.value === b.value
          ? a.row.id.localeCompare(b.row.id)
          : def.lowerIsBetter
            ? a.value - b.value
            : b.value - a.value
      );

    const position = ranked.findIndex((r) => r.row.id === countryId) + 1;
    const regional = ranked.filter((r) => r.row.region === self.region);
    const tier = ranked.filter((r) => r.row[def.tierKey] === self[def.tierKey]);

    rankings.push({
      category: def.category,
      value: own,
      ...(def.lowerIsBetter ? { lowerIsBetter: true } : {}),
      global: { position, total: ranked.length },
      regional: {
        position: regional.findIndex((r) => r.row.id === countryId) + 1,
        total: regional.length,
        region: self.region || "Unknown",
      },
      tier: {
        position: tier.findIndex((r) => r.row.id === countryId) + 1,
        total: tier.length,
        tier: self[def.tierKey],
      },
      ...(trends[def.category] ? { trend: trends[def.category] } : {}),
      percentile: Math.round((1 - (position - 1) / ranked.length) * 100),
    });
  }
  return rankings;
}

/**
 * Generate World Census rankings for the country, ranked within its own realm.
 */
export async function generateRankings(countryId: string): Promise<Ranking[]> {
  const cacheKey = `rankings_${countryId}`;
  const cached = await getMyCountryCache<Ranking[]>(cacheKey);
  if (cached) return cached;

  try {
    const country = await db.country.findUnique({
      where: { id: countryId },
    });

    if (!country) return [];

    // Rank against the country's own realm (ruling E-h); the rankings cache is keyed by country id.
    const allCountries = await db.country.findMany({
      where: {
        realmId: country.realmId,
        currentPopulation: { gt: 0 },
        currentGdpPerCapita: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        currentTotalGdp: true,
        adjustedGdpGrowth: true,
        populationGrowthRate: true,
        publicApproval: true,
        totalDebtGDPRatio: true,
        incomeInequalityGini: true,
        infrastructureRating: true,
        region: true,
        economicTier: true,
        populationTier: true,
        stabilityMetrics: { select: { stabilityScore: true } },
      },
    });

    // Diplomatic Standing needs the diplomacy tables; if they cannot be read, that one
    // category is left out rather than failing the whole census.
    let diplomatic = new Map<string, DiplomaticStandingInputs>();
    try {
      diplomatic = await loadDiplomaticStandingInputs(allCountries.map((c) => c.id));
    } catch (error) {
      console.error("[MyCountry Rankings] Diplomatic standing unavailable:", error);
    }

    const rows: CensusRow[] = allCountries.map((c) => {
      const diplo = diplomatic.get(c.id);
      return {
        id: c.id,
        region: c.region,
        economicTier: c.economicTier,
        populationTier: c.populationTier,
        values: {
          "GDP per Capita": c.currentGdpPerCapita,
          "Total GDP": c.currentTotalGdp,
          "GDP Growth": c.adjustedGdpGrowth,
          Population: c.currentPopulation,
          "Public Approval": c.publicApproval,
          Stability: c.stabilityMetrics?.stabilityScore ?? null,
          "Diplomatic Standing": diplo ? scoreDiplomaticStanding(diplo) : null,
          Infrastructure: c.infrastructureRating,
          "Debt to GDP": c.totalDebtGDPRatio,
          "Income Equality": c.incomeInequalityGini,
        },
      };
    });

    const gdpTrend = growthTrend(country.adjustedGdpGrowth, 0.03, -0.01);
    const popTrend = growthTrend(country.populationGrowthRate, 0.005, 0);
    const result = rankCensus(countryId, rows, {
      "GDP per Capita": gdpTrend,
      "Total GDP": gdpTrend,
      Population: popTrend,
    });

    await setMyCountryCache(cacheKey, result, 600000); // Cache for 10 minutes
    return result;
  } catch (error) {
    console.error("[MyCountry Rankings] Error:", error);
    return [];
  }
}
