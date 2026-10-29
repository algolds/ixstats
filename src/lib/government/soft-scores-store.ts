/**
 * Loads what the soft-score model (`./soft-scores`) reads and returns each nation's effective
 * scores: derived from its sim state plus the stored value's lasting offset. Reads only; nothing
 * here writes, so the stored columns keep their meaning for the writers (issue consequences,
 * directives, elections, component shifts) that move them.
 */

import type { PrismaClient } from "@prisma/client";
import { clockForCountry, clockForRealm } from "~/server/shared/realm-time";
import { currentBudgetYear } from "./budget-year";
import {
  ECONOMIC_FIGURE_SELECT,
  effectiveFiguresOfCountry,
  type EffectiveEconomicFigures,
} from "~/lib/economy/figure-estimates";
import { LATEST_GROWTH_SELECT, effectiveGrowthOf } from "~/lib/economy/effective-growth";
import {
  GOVERNANCE_FIELDS,
  effectiveSoftScores,
  type GovernanceField,
  type SoftScoreInputs,
  type SoftScores,
  type StoredSoftScores,
} from "./soft-scores";

type SoftScoreDb = Pick<
  PrismaClient,
  "country" | "governmentComponent" | "budgetAllocation" | "realm" | "systemConfig"
>;

const COUNTRY_SELECT = {
  id: true,
  realmId: true,
  currentPopulation: true,
  publicApproval: true,
  incomeInequalityGini: true,
  povertyRate: true,
  urbanPopulationPercent: true,
  populationDensity: true,
  governmentType: true,
  infrastructureRating: true,
  ...ECONOMIC_FIGURE_SELECT,
  ...LATEST_GROWTH_SELECT,
  governmentStructure: {
    select: {
      id: true,
      governmentType: true,
      totalBudget: true,
      electionCycle: true,
      politicalStability: true,
      democracyIndex: true,
      governmentEffectiveness: true,
      ruleOfLaw: true,
      corruptionIndex: true,
      politicalPolarization: true,
    },
  },
} as const;

type CountryRow = NonNullable<Awaited<ReturnType<typeof findCountries>>>[number];

function findCountries(db: SoftScoreDb, ids: string[]) {
  return db.country.findMany({ where: { id: { in: ids } }, select: COUNTRY_SELECT });
}

export interface SoftScoreState {
  country: CountryRow;
  inputs: SoftScoreInputs;
  stored: StoredSoftScores;
  effective: SoftScores;
  figures: EffectiveEconomicFigures;
  /** Realised growth, a decimal. */
  growthDecimal: number | null;
}

/**
 * Percent of the budget per department category for each structure id, from the latest budget
 * year at or before `year`.
 */
async function loadBudgetShares(db: SoftScoreDb, structureIds: string[], year: number) {
  const rows = await db.budgetAllocation.findMany({
    where: { governmentStructureId: { in: structureIds }, budgetYear: { lte: year } },
    select: {
      governmentStructureId: true,
      budgetYear: true,
      allocatedPercent: true,
      department: { select: { category: true } },
    },
  });
  const latest = new Map<string, number>();
  for (const r of rows) {
    const id = r.governmentStructureId;
    latest.set(id, Math.max(latest.get(id) ?? -Infinity, r.budgetYear));
  }
  const shares = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const id = r.governmentStructureId;
    if (r.budgetYear !== latest.get(id)) continue;
    const own = shares.get(id) ?? {};
    own[r.department.category] = (own[r.department.category] ?? 0) + r.allocatedPercent;
    shares.set(id, own);
  }
  return shares;
}

async function loadComponents(db: SoftScoreDb, ids: string[]) {
  const rows = await db.governmentComponent.findMany({
    where: { countryId: { in: ids }, isActive: true },
    select: { countryId: true, componentType: true, effectivenessScore: true },
  });
  const byCountry = new Map<string, Array<{ componentType: string; effectivenessScore: number }>>();
  for (const r of rows) {
    const own = byCountry.get(r.countryId) ?? [];
    own.push({ componentType: String(r.componentType), effectivenessScore: r.effectivenessScore });
    byCountry.set(r.countryId, own);
  }
  return byCountry;
}

function giniPoints(gini: number | null): number | null {
  if (gini == null || !(gini > 0)) return null;
  return gini <= 1 ? gini * 100 : gini;
}

function stateOf(
  country: CountryRow,
  components: SoftScoreInputs["components"],
  budgetShares: Record<string, number> | null
): SoftScoreState {
  const growthDecimal = effectiveGrowthOf(country);
  const growthPercent = growthDecimal == null ? null : growthDecimal * 100;
  const figures = effectiveFiguresOfCountry(country, growthPercent);
  const gs = country.governmentStructure;
  const inputs: SoftScoreInputs = {
    gdpPerCapita: country.currentGdpPerCapita,
    growthPercent,
    unemploymentRate: figures.unemploymentRate.value,
    inflationRate: figures.inflationRate.value,
    giniPoints: giniPoints(country.incomeInequalityGini),
    publicApproval: country.publicApproval,
    governmentType: country.governmentType?.trim()
      ? country.governmentType
      : (gs?.governmentType ?? null),
    components,
    budgetShares,
  };
  const stored: StoredSoftScores = { infrastructureRating: country.infrastructureRating };
  for (const field of GOVERNANCE_FIELDS) stored[field] = gs?.[field] ?? null;
  return {
    country,
    inputs,
    stored,
    effective: effectiveSoftScores(inputs, stored),
    figures,
    growthDecimal,
  };
}

/**
 * Effective soft scores for several nations of one realm; `budgetYear` is that realm's current
 * budget year. Missing ids are absent from the map.
 */
export async function loadSoftScoresMany(
  db: SoftScoreDb,
  ids: string[],
  budgetYear: number
): Promise<Map<string, SoftScoreState>> {
  if (ids.length === 0) return new Map();
  const countries = await findCountries(db, ids);
  const structureIds = countries.flatMap((c) =>
    c.governmentStructure ? [c.governmentStructure.id] : []
  );
  const [components, shares] = await Promise.all([
    loadComponents(db, ids),
    structureIds.length > 0
      ? loadBudgetShares(db, structureIds, budgetYear)
      : new Map<string, Record<string, number>>(),
  ]);
  return new Map(
    countries.map((c) => {
      const budget = c.governmentStructure ? shares.get(c.governmentStructure.id) : undefined;
      return [c.id, stateOf(c, components.get(c.id) ?? [], budget ?? null)];
    })
  );
}

/** One nation's effective soft scores (its budget year on its realm's clock); null when missing. */
export async function loadSoftScores(
  db: SoftScoreDb,
  countryId: string,
  nowMs?: number
): Promise<SoftScoreState | null> {
  const now = nowMs ?? (await clockForCountry(db, countryId)).now();
  const states = await loadSoftScoresMany(db, [countryId], currentBudgetYear(now));
  return states.get(countryId) ?? null;
}

/**
 * A government structure row with its six governance scores replaced by the effective ones, for
 * readers that display them. The stored values stay what writers move.
 */
export async function withEffectiveGovernance<T extends object>(
  db: SoftScoreDb,
  countryId: string,
  structure: T
): Promise<T> {
  const state = await loadSoftScores(db, countryId);
  if (!state) return structure;
  const scores = {} as Record<GovernanceField, number>;
  for (const field of GOVERNANCE_FIELDS) scores[field] = state.effective[field];
  return { ...structure, ...scores };
}

/** Effective infrastructure rating per nation of one realm, at that realm's budget year. */
export async function loadEffectiveInfrastructure(
  db: SoftScoreDb,
  realmId: string,
  ids: string[]
): Promise<Map<string, number>> {
  const budgetYear = currentBudgetYear((await clockForRealm(db, realmId)).now());
  const states = await loadSoftScoresMany(db, ids, budgetYear);
  return new Map([...states].map(([id, s]) => [id, s.effective.infrastructureRating]));
}
