import type { CombatSide, EngagementSetup, Theatre } from "~/lib/military/combat";
import type { BranchDomain } from "~/lib/military/model";

/** A side with one branch per domain given, each at `power` combat power and `personnel` people. */
export function side(
  id: string,
  branches: Partial<Record<BranchDomain, { power: number; personnel: number; capital?: number }>>,
  overrides: Partial<CombatSide> = {}
): CombatSide {
  return {
    countryId: id,
    branches: Object.entries(branches).map(([domain, b]) => ({
      id: `${id}_${domain}`,
      domain: domain as BranchDomain,
      combatPower: b.power,
      personnel: b.personnel,
      capital: b.capital ?? b.personnel * 100_000,
    })),
    cev: 1,
    readiness: 0.85,
    doctrine: "balanced",
    alert: "peacetime",
    maintenanceFunding: 1,
    infrastructureStock: 0,
    gdp: 1e12,
    ...overrides,
  };
}

/** Neighbours on open ground with a short border (full front density for a 100k defender). */
export const openBorder: Theatre = {
  source: "map",
  neighbours: true,
  campaign: "land",
  borderKm: 100,
  distanceKm: 0,
  frontKm: 100,
  terrain: 1,
  terrainClass: "open",
  riverLine: false,
};

/** A land engagement: attacker land power `ratio` × the defender's, defender prepared (Elevated) on open ground. */
export function landSetup(ratio: number, overrides: Partial<EngagementSetup> = {}): EngagementSetup {
  return {
    mode: "strike",
    attacker: side("att", { land: { power: 100_000 * ratio, personnel: 100_000 * ratio } }),
    defender: side("def", { land: { power: 100_000, personnel: 100_000 } }, { alert: "elevated" }),
    theatre: openBorder,
    commitment: 1,
    days: 3,
    surprise: "none",
    ...overrides,
  };
}
