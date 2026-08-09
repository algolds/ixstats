/**
 * Grounded snapshot context for the National Issues engine (plan 002, Phase 3).
 *
 * Adds real-world grounding to issue generation: country geography, identity
 * (capital/language/religion), ruling + opposition parties, ministers, labor
 * and fiscal headline numbers, top economic sector, diplomatic partners,
 * embassies, active world events/crises, and real neighbor names (live PostGIS).
 *
 * Focused-first: only fields the grounded templates + variable resolvers use.
 * Everything is optional — a country missing a profile simply yields null, and
 * templates referencing those fields won't trigger.
 */

import type { PrismaClient } from "@prisma/client";

export interface GroundedSnapshot {
  geo: {
    isLandlocked: boolean;
    isIsland: boolean;
    dominantClimate: string | null;
    terrainRoughness: number | null;
    arableLandPercent: number;
    coastlineKm: number;
    neighborCount: number;
  } | null;
  identity: {
    capitalCity: string | null;
    largestCity: string | null;
    languages: string | null;
    religion: string | null;
  } | null;
  party: { name: string; ideology: string; support: number } | null;
  oppositionParty: { name: string; ideology: string; support: number } | null;
  minister: { name: string; title: string } | null;
  official: { name: string; title: string } | null;
  labor: {
    minimumWage: number | null;
    youthUnemploymentRate: number | null;
    informalEmploymentRate: number | null;
  } | null;
  fiscal: {
    salesTaxRate: number | null;
    corporateTaxRate: number | null;
  } | null;
  economy: {
    topSector: string | null;
    exportsGDPPercent: number | null;
    economicComplexity: number | null;
  } | null;
  partners: Array<{ name: string; band: string; strength: number }>;
  embassyPartners: string[];
  worldEvents: string[];
  crises: string[];
  neighbors: Array<{ name: string; countryId: string | null }>;
}

/** Map a diplomatic relation string to a coarse band (like the canon context). */
function bandFor(relationship: string): string {
  const r = relationship.toLowerCase();
  if (["ally", "allied", "alliance", "friendly", "friends"].some((k) => r.includes(k)))
    return "ALLY";
  if (["hostile", "enemy", "embargo", "war", "sanction"].some((k) => r.includes(k)))
    return "HOSTILE";
  if (["tense", "strained", "cold", "rival"].some((k) => r.includes(k))) return "TENSE";
  return "NEUTRAL";
}

const SECTOR_ORDER = [
  "agriculture",
  "mining",
  "manufacturing",
  "services",
  "technology",
  "energy",
  "financial services",
  "healthcare",
  "transportation",
  "telecommunications",
];

/** Pick the dominant sector from a parsed sectorBreakdown JSON ({ sector: pct, ... }). */
function topSectorFrom(breakdown: unknown): string | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const entries = Object.entries(breakdown as Record<string, number>);
  if (entries.length === 0) return null;
  // Prefer the human-readable ordering; else the numerically largest key.
  const byName = entries.find(([k]) => SECTOR_ORDER.includes(k));
  if (byName) return byName[0];
  const [top] = entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return top?.[0] ?? null;
}

/** Fetch grounded context for a country (focused subset). Never throws. */
export async function buildGroundedContext(
  countryId: string,
  db: PrismaClient
): Promise<GroundedSnapshot> {
  const empty: GroundedSnapshot = {
    geo: null,
    identity: null,
    party: null,
    oppositionParty: null,
    minister: null,
    official: null,
    labor: null,
    fiscal: null,
    economy: null,
    partners: [],
    embassyPartners: [],
    worldEvents: [],
    crises: [],
    neighbors: [],
  };

  try {
    const [
      geoRow,
      identityRow,
      parties,
      departments,
      officials,
      laborRow,
      fiscalRow,
      economyRow,
      relations,
      embassies,
      worldEventRows,
      crisisRows,
    ] = await Promise.all([
      (db as any).countryGeoProfile.findUnique({
        where: { countryId },
      }),
      (db as any).nationalIdentity.findUnique({
        where: { countryId },
      }),
      (db as any).politicalParty.findMany({
        where: { countryId, isActive: true },
        orderBy: { currentSupport: "desc" },
        take: 2,
        select: { name: true, ideology: true, currentSupport: true },
      }),
      (db as any).governmentDepartment.findMany({
        where: {
          governmentStructure: { countryId },
          isActive: true,
          minister: { not: null },
        },
        orderBy: { priority: "asc" },
        take: 1,
        select: { minister: true, ministerTitle: true },
      }),
      (db as any).governmentOfficial.findMany({
        where: { governmentStructure: { countryId }, isActive: true },
        orderBy: { priority: "asc" },
        take: 1,
        select: { name: true, title: true },
      }),
      (db as any).laborMarket.findUnique({
        where: { countryId },
      }),
      (db as any).fiscalSystem.findUnique({
        where: { countryId },
      }),
      (db as any).economicProfile.findUnique({
        where: { countryId },
      }),
      (db as any).diplomaticRelation.findMany({
        where: { OR: [{ country1: countryId }, { country2: countryId }] },
        select: { country1: true, country2: true, relationship: true, strength: true },
        orderBy: { strength: "desc" },
        take: 30,
      }),
      (db as any).embassy.findMany({
        where: {
          OR: [{ hostCountryId: countryId }, { guestCountryId: countryId }],
          status: "active",
        },
        select: { hostCountryId: true, guestCountryId: true },
        take: 30,
      }),
      (db as any).worldEvent.findMany({
        where: { isActive: true },
        select: { id: true, name: true, affectedCountries: { select: { countryId: true } } },
        take: 20,
      }),
      (db as any).crisisEvent.findMany({
        where: { affectedCountries: { contains: countryId }, responseStatus: { not: "resolved" } },
        select: { title: true },
        take: 10,
      }),
    ]);

    // Resolve partner names via their Country records (diplomaticRelation stores ids).
    const otherIds = relations.map((r: any) =>
      r.country1 === countryId ? r.country2 : r.country1
    );
    const countryNames = otherIds.length
      ? await (db as any).country.findMany({
          where: { id: { in: otherIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(
      (countryNames as Array<{ id: string; name: string }>).map((c) => [c.id, c.name])
    );

    // Resolve embassy partners similarly.
    const embassyOtherIds = embassies.map((e: any) =>
      e.hostCountryId === countryId ? e.guestCountryId : e.hostCountryId
    );
    const embassyNames = embassyOtherIds.length
      ? await (db as any).country.findMany({
          where: { id: { in: embassyOtherIds } },
          select: { id: true, name: true },
        })
      : [];
    const embassyNameById = new Map(
      (embassyNames as Array<{ id: string; name: string }>).map((c) => [c.id, c.name])
    );

    // Active world events that involve this country.
    const worldEvents = (
      worldEventRows as Array<{ name: string; affectedCountries: Array<{ countryId: string }> }>
    )
      .filter((e) => e.affectedCountries.some((c) => c.countryId === countryId))
      .map((e) => e.name);

    const geo = geoRow
      ? {
          isLandlocked: Boolean(geoRow.isLandlocked),
          isIsland: Boolean(geoRow.isIsland),
          dominantClimate: geoRow.dominantClimate ?? null,
          terrainRoughness: geoRow.terrainRoughness ?? null,
          arableLandPercent: geoRow.arableLandPercent ?? 0,
          coastlineKm: geoRow.coastlineKm ?? 0,
          neighborCount: geoRow.neighborCount ?? 0,
        }
      : null;

    const sectorBreakdown = economyRow?.sectorBreakdown
      ? (() => {
          try {
            return JSON.parse(economyRow.sectorBreakdown) as Record<string, number>;
          } catch {
            return null;
          }
        })()
      : null;

    return {
      geo,
      identity: identityRow
        ? {
            capitalCity: identityRow.capitalCity ?? null,
            largestCity: identityRow.largestCity ?? null,
            languages: identityRow.officialLanguages ?? null,
            religion: identityRow.nationalReligion ?? null,
          }
        : null,
      party: parties[0]
        ? {
            name: parties[0].name,
            ideology: parties[0].ideology,
            support: parties[0].currentSupport ?? 0,
          }
        : null,
      oppositionParty: parties[1]
        ? {
            name: parties[1].name,
            ideology: parties[1].ideology,
            support: parties[1].currentSupport ?? 0,
          }
        : null,
      minister: departments[0]
        ? {
            name: departments[0].minister,
            title: departments[0].ministerTitle || "Minister",
          }
        : null,
      official: officials[0] ? { name: officials[0].name, title: officials[0].title } : null,
      labor: laborRow
        ? {
            minimumWage: laborRow.medianWage ?? null,
            youthUnemploymentRate: laborRow.youthUnemploymentRate ?? null,
            informalEmploymentRate: laborRow.informalEmploymentRate ?? null,
          }
        : null,
      fiscal: fiscalRow
        ? {
            salesTaxRate: fiscalRow.salesTaxRate ?? null,
            corporateTaxRate: fiscalRow.corporateTaxRate ?? null,
          }
        : null,
      economy: economyRow
        ? {
            topSector: topSectorFrom(sectorBreakdown),
            exportsGDPPercent: economyRow.exportsGDPPercent ?? null,
            economicComplexity: economyRow.economicComplexity ?? null,
          }
        : null,
      partners: relations
        .map((r: any) => {
          const otherId = r.country1 === countryId ? r.country2 : r.country1;
          const name = nameById.get(otherId);
          return name ? { name, band: bandFor(r.relationship), strength: r.strength ?? 0 } : null;
        })
        .filter(Boolean) as Array<{ name: string; band: string; strength: number }>,
      embassyPartners: embassies
        .map((e: any) => {
          const otherId = e.hostCountryId === countryId ? e.guestCountryId : e.hostCountryId;
          return embassyNameById.get(otherId) ?? null;
        })
        .filter((n: string | null): n is string => Boolean(n)),
      worldEvents,
      crises: crisisRows.map((c: any) => c.title).filter(Boolean),
      // Neighbors are resolved separately (gated PostGIS); leave empty here.
      neighbors: [],
    };
  } catch (err) {
    console.warn("[GroundedSnapshot] Failed to build grounded context:", err);
    return empty;
  }
}
