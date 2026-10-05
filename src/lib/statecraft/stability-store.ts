/**
 * Persisted internal stability: formula values plus the deltas events applied on top.
 *
 * Each `InternalStabilityMetrics` row stores the formula values it was last computed from
 * (`formulaSnapshot`); the gap between a stored field and its snapshot value is the accumulated
 * event delta (national issues and other events through the CountryEventSpine), which is
 * carried onto every new formula value. A legacy row without a snapshot keeps its stored values
 * once, then tracks the formula from there.
 *
 * Reads never write (MC-13): `security.getInternalStability` computes the current values on the
 * fly (`computeInternalStability`). Rows are persisted by the issue path
 * (`ensureInternalStabilityMetrics`, before a delta is applied) and refreshed by the
 * stat-progression job (`refreshStoredInternalStability`).
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
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

const DAY_MS = 24 * 60 * 60 * 1000;
/** The formula only weighs policies passed in the last 90 days. */
const RECENT_POLICY_DAYS = 90;

function clampImpact(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

/** Decretal policies record their stability effect in `calculatedEffects`; others have none. */
function policyStabilityEffect(calculatedEffects: string | null): number {
  if (!calculatedEffects) return 0;
  try {
    const parsed = JSON.parse(calculatedEffects) as { stabilityEffect?: unknown };
    return typeof parsed.stabilityEffect === "number" && Number.isFinite(parsed.stabilityEffect)
      ? parsed.stabilityEffect
      : 0;
  } catch {
    return 0;
  }
}

/**
 * Active policies enacted in the last 90 IxTime days (most recent 50), for the protest term of the formula.
 * Policies carry no popularity figure, so popularity is the decretal's stability effect (a few
 * points either way) scaled ×10 onto the formula's -100..100 range, and the economic impact is
 * the GDP effect (percent) scaled the same way. Policies without either count as neutral.
 */
async function loadRecentPolicies(db: PrismaClient, countryId: string): Promise<RecentPolicy[]> {
  const now = IxTime.getCurrentIxTime();
  // Bills record when they passed as a real `effectiveDate`; `effectiveIxTime` wins when set.
  const policies = await db.policy.findMany({
    where: { countryId, status: "active", effectiveDate: { not: null } },
    select: {
      category: true,
      gdpEffect: true,
      calculatedEffects: true,
      effectiveDate: true,
      effectiveIxTime: true,
    },
    orderBy: { effectiveDate: "desc" },
    take: 50,
  });
  return policies.flatMap((p) => {
    const passedIxTime = p.effectiveIxTime ?? IxTime.convertToIxTime(p.effectiveDate!.getTime());
    const timeSincePassed = Math.max(0, (now - passedIxTime) / DAY_MS);
    if (timeSincePassed >= RECENT_POLICY_DAYS) return [];
    return [
      {
        type: p.category,
        popularityImpact: clampImpact(policyStabilityEffect(p.calculatedEffects) * 10),
        economicImpact: clampImpact((p.gdpEffect ?? 0) * 10),
        timeSincePassed,
      },
    ];
  });
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

  const recentPolicies = await loadRecentPolicies(db, countryId);

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

type StoredStability = StabilityValues & { formulaSnapshot: string | null };

/** The formula plus the stored row's carried event deltas. Null when the country is missing. */
async function currentStabilityData(db: PrismaClient, countryId: string) {
  const formula = await computeFormulaStability(db, countryId);
  if (!formula) return null;
  const stored = (await db.internalStabilityMetrics.findUnique({
    where: { countryId },
    select: { ...STORED_SELECT, id: true, createdAt: true },
  })) as (StoredStability & { id: string; createdAt: Date }) | null;
  return { stored, data: stabilityRowData(formula, stored) };
}

/**
 * A country's current stability, computed without writing: the same values a recalculation
 * would store, shaped like the row. Null when the country does not exist.
 */
export async function computeInternalStability(db: PrismaClient, countryId: string) {
  const current = await currentStabilityData(db, countryId);
  if (!current) return null;
  const { stored, data } = current;
  return {
    id: stored?.id ?? null,
    countryId,
    ...data,
    createdAt: stored?.createdAt ?? data.lastCalculated,
    updatedAt: data.lastCalculated,
  };
}

/**
 * Recalculate and persist a country's stability, keeping event deltas. Null when the country
 * does not exist.
 */
export async function recalculateInternalStability(db: PrismaClient, countryId: string) {
  const current = await currentStabilityData(db, countryId);
  if (!current) return null;
  return db.internalStabilityMetrics.upsert({
    where: { countryId },
    create: { countryId, ...current.data },
    update: current.data,
  });
}

/**
 * Re-persist every stored stability row from the current formula (stat-progression job), so
 * readers of the stored row see fresh values now that viewing no longer writes. Never throws.
 */
export async function refreshStoredInternalStability(
  db: PrismaClient
): Promise<{ refreshed: number; failed: number }> {
  const result = { refreshed: 0, failed: 0 };
  const rows = await db.internalStabilityMetrics.findMany({ select: { countryId: true } });
  for (const { countryId } of rows) {
    try {
      if (await recalculateInternalStability(db, countryId)) result.refreshed++;
    } catch (err) {
      result.failed++;
      console.error(`[stability] Failed to refresh ${countryId}:`, err);
    }
  }
  return result;
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
