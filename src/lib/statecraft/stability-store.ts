/**
 * Persisted internal stability: formula values plus the deltas events applied on top.
 *
 * `security.getInternalStability` recalculates the stability formula on every view. It used to
 * upsert the raw formula result, wiping any delta a national issue (or other event through the
 * CountryEventSpine) had written to `InternalStabilityMetrics`. Each row now also stores the
 * formula values it was last computed from (`formulaSnapshot`); on recalculation the gap between
 * a stored field and its snapshot value (the accumulated event delta) is carried onto the new
 * formula value. A legacy row without a snapshot keeps its stored values once, then tracks the
 * formula from there.
 */

import type { PrismaClient } from "@prisma/client";
import {
  calculateStabilityMetrics,
  type DemographicData,
  type EconomicData,
  type GovernmentData,
  type PoliticalData,
  type RecentPolicy,
  type StabilityMetrics,
} from "./stability-formulas";

export const STABILITY_NUMERIC_FIELDS = [
  "stabilityScore",
  "crimeRate",
  "violentCrimeRate",
  "propertyCrimeRate",
  "organizedCrimeLevel",
  "policingEffectiveness",
  "justiceSystemEfficiency",
  "protestFrequency",
  "riotRisk",
  "civilDisobedience",
  "socialCohesion",
  "ethnicTension",
  "politicalPolarization",
  "trustInGovernment",
  "trustInPolice",
  "fearOfCrime",
] as const;

type StabilityNumericField = (typeof STABILITY_NUMERIC_FIELDS)[number];
type StabilityValues = Record<StabilityNumericField, number>;

/** Per-100k / per-year rates: floored at 0 only. Everything else is a 0-100 percentage. */
const RATE_FIELDS = new Set<StabilityNumericField>([
  "crimeRate",
  "violentCrimeRate",
  "propertyCrimeRate",
  "protestFrequency",
]);

function bound(field: StabilityNumericField, value: number): number {
  if (RATE_FIELDS.has(field)) return Math.max(0, value);
  return Math.max(0, Math.min(100, value));
}

function parseSnapshot(raw: string | null | undefined): Partial<StabilityValues> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Partial<StabilityValues>) : null;
  } catch {
    return null;
  }
}

/**
 * The formula stability metrics for a country (inputs as security.getInternalStability has
 * always assembled them). Null when the country does not exist.
 */
async function computeFormulaStability(
  db: PrismaClient,
  countryId: string
): Promise<StabilityMetrics | null> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: {
      realGDPGrowthRate: true,
      adjustedGdpGrowth: true,
      unemploymentRate: true,
      incomeInequalityGini: true,
      inflationRate: true,
      currentGdpPerCapita: true,
      povertyRate: true,
      currentPopulation: true,
      urbanPopulationPercent: true,
      populationDensity: true,
    },
  });
  if (!country) return null;

  const [economicProfile, demographics, government] = await Promise.all([
    db.economicProfile.findUnique({
      where: { countryId },
      select: { corruptionIndex: true },
    }),
    db.demographics.findUnique({
      where: { countryId },
      select: { ethnicDiversity: true, religiousDiversity: true },
    }),
    db.governmentStructure.findUnique({
      where: { countryId },
      select: {
        politicalStability: true,
        politicalPolarization: true,
        democracyIndex: true,
        electionCycle: true,
      },
    }),
  ]);

  const economicData: EconomicData = {
    gdpGrowth: country.realGDPGrowthRate ?? country.adjustedGdpGrowth ?? 2.5,
    unemploymentRate: country.unemploymentRate ?? 5.0,
    giniIndex: country.incomeInequalityGini ?? 35,
    inflationRate: country.inflationRate ?? 2.0,
    gdpPerCapita: country.currentGdpPerCapita ?? 35000,
    povertyRate: country.povertyRate ?? 12,
  };

  // TODO: integrate with government ministry when available
  const governmentData: GovernmentData = {
    policingBudget: country.currentPopulation * 200,
    educationBudget: country.currentPopulation * 1500,
    socialServicesBudget: country.currentPopulation * 800,
    totalBudget: country.currentPopulation * 5000,
    corruptionIndex: economicProfile?.corruptionIndex ?? 30,
  };

  const demographicData: DemographicData = {
    population: country.currentPopulation,
    ethnicDiversity: demographics?.ethnicDiversity ?? 50,
    religiousDiversity: demographics?.religiousDiversity ?? 50,
    urbanizationRate: country.urbanPopulationPercent ?? 75,
    youthUnemployment: (country.unemploymentRate ?? 5) * 2, // Youth unemployment is typically 2x general
    populationDensity: country.populationDensity ?? 100,
  };

  const politicalData: PoliticalData = {
    politicalStability: government?.politicalStability ?? 0.5,
    politicalPolarization: government?.politicalPolarization ?? 50,
    electionCycle: government?.electionCycle ?? 4,
    democracyIndex: government?.democracyIndex ?? 50,
    protestFrequency: 8, // Will be overwritten by calculation
  };

  // TODO: Get recent policies from database
  const recentPolicies: RecentPolicy[] = [];

  return calculateStabilityMetrics(
    economicData,
    governmentData,
    demographicData,
    politicalData,
    recentPolicies
  );
}

/**
 * Row data for a recalculation: each field is the new formula value plus the event delta the
 * stored row carries (stored − last snapshot). Without a snapshot the stored value is kept.
 */
export function stabilityRowData(
  formula: StabilityMetrics,
  stored: (StabilityValues & { formulaSnapshot: string | null }) | null
) {
  const snapshot = parseSnapshot(stored?.formulaSnapshot);
  const values = {} as StabilityValues;
  const formulaValues = {} as StabilityValues;
  for (const field of STABILITY_NUMERIC_FIELDS) {
    formulaValues[field] = formula[field];
    if (!stored) {
      values[field] = formula[field];
      continue;
    }
    const base = snapshot?.[field];
    const delta =
      typeof base === "number" && Number.isFinite(base)
        ? stored[field] - base
        : stored[field] - formula[field];
    values[field] = bound(field, formula[field] + delta);
  }
  return {
    ...values,
    stabilityTrend: formula.stabilityTrend,
    formulaSnapshot: JSON.stringify(formulaValues),
    lastCalculated: new Date(),
  };
}

const STORED_SELECT = {
  formulaSnapshot: true,
  ...Object.fromEntries(STABILITY_NUMERIC_FIELDS.map((f) => [f, true])),
} as Record<StabilityNumericField | "formulaSnapshot", true>;

/**
 * Recalculate and persist a country's stability, keeping event deltas. Null when the country
 * does not exist.
 */
export async function recalculateInternalStability(db: PrismaClient, countryId: string) {
  const formula = await computeFormulaStability(db, countryId);
  if (!formula) return null;
  const stored = (await db.internalStabilityMetrics.findUnique({
    where: { countryId },
    select: STORED_SELECT,
  })) as (StabilityValues & { formulaSnapshot: string | null }) | null;
  const data = stabilityRowData(formula, stored);
  return db.internalStabilityMetrics.upsert({
    where: { countryId },
    create: { countryId, ...data },
    update: data,
  });
}

/**
 * Make sure a country has an InternalStabilityMetrics row, creating it from the formula when
 * missing, so an event delta has a real value to move. Returns false when the country does not
 * exist.
 */
export async function ensureInternalStabilityMetrics(
  db: PrismaClient,
  countryId: string
): Promise<boolean> {
  const existing = await db.internalStabilityMetrics.findUnique({
    where: { countryId },
    select: { id: true },
  });
  if (existing) return true;
  const formula = await computeFormulaStability(db, countryId);
  if (!formula) return false;
  const data = stabilityRowData(formula, null);
  await db.internalStabilityMetrics.upsert({
    where: { countryId },
    create: { countryId, ...data },
    update: {},
  });
  return true;
}
