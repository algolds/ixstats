/**
 * Demographics Calculation Utilities
 *
 * Provides calculation functions for deriving demographic metrics and
 * utility functions for UI color theming. Extracted from DemographicsPopulationTab
 * to maintain separation of concerns between UI and business logic.
 */

import type { DemographicsConfiguration } from "~/types/economy-builder";

/**
 * Derived demographic metrics calculated from base population data
 */
export interface DerivedDemographicMetrics {
  /** Working age population (15-64 years) */
  workingAge: number;
  /** Youth population (under 15 years) */
  youthPop: number;
  /** Elderly population (65+ years) */
  elderlyPop: number;
  /** Urban population */
  urbanPop: number;
  /** Rural population */
  ruralPop: number;
  /** Total dependency ratio */
  dependencyRatio: number;
  /** Percentage of population in working age */
  workingAgeShare: number;
  /** Percentage of population in urban areas */
  urbanShare: number;
}

/**
 * Calculate derived demographic metrics from base demographics configuration
 *
 * Computes absolute population counts for different age groups and urban/rural
 * splits based on percentage distributions and total population.
 *
 * @param demographics - Base demographics configuration with percentages
 * @returns Calculated absolute population metrics
 *
 * @example
 * ```ts
 * const demographics = {
 *   totalPopulation: 10000000,
 *   ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
 *   urbanRuralSplit: { urban: 70, rural: 30 },
 *   totalDependencyRatio: 53.8
 * };
 * const metrics = calculateDerivedDemographics(demographics);
 * // metrics.workingAge = 6500000
 * // metrics.urbanPop = 7000000
 * ```
 */
export function calculateDerivedDemographics(
  demographics: DemographicsConfiguration
): DerivedDemographicMetrics {
  const totalPop = demographics.totalPopulation;
  const workingAge = Math.round(totalPop * (demographics.ageDistribution.age15to64 / 100));
  const youthPop = Math.round(totalPop * (demographics.ageDistribution.under15 / 100));
  const elderlyPop = Math.round(totalPop * (demographics.ageDistribution.over65 / 100));
  const urbanPop = Math.round(totalPop * (demographics.urbanRuralSplit.urban / 100));
  const ruralPop = totalPop - urbanPop;

  return {
    workingAge,
    youthPop,
    elderlyPop,
    urbanPop,
    ruralPop,
    dependencyRatio: demographics.totalDependencyRatio,
    workingAgeShare: demographics.ageDistribution.age15to64,
    urbanShare: demographics.urbanRuralSplit.urban,
  };
}

/**
 * Get a color identifier for a region based on its index
 *
 * Returns a cyclical color from a predefined palette for consistent
 * region visualization in charts and maps.
 *
 * @param index - Zero-based region index
 * @returns Tailwind color name (e.g., 'blue', 'green')
 *
 * @example
 * ```ts
 * const color1 = getRegionColor(0); // 'blue'
 * const color2 = getRegionColor(10); // 'blue' (wraps around)
 * ```
 */
export function getRegionColor(index: number): string {
  const colors = [
    "blue",
    "green",
    "orange",
    "purple",
    "cyan",
    "pink",
    "yellow",
    "red",
    "indigo",
    "teal",
  ];
  return colors[((index % colors.length) + colors.length) % colors.length];
}

/**
 * Balance age distribution fields to ensure they sum to exactly 100%
 * while keeping values within their respective minimum/maximum boundaries.
 */
export function balanceAgeDistribution(
  current: { under15: number; age15to64: number; over65: number },
  changedField: "under15" | "age15to64" | "over65",
  newValue: number
): { under15: number; age15to64: number; over65: number } {
  const bounds = {
    under15: { min: 10, max: 50 },
    age15to64: { min: 40, max: 80 },
    over65: { min: 5, max: 35 },
  };

  // 1. Clamp the changed field's value to its own bounds
  const clampedNewValue = Math.min(
    bounds[changedField].max,
    Math.max(bounds[changedField].min, newValue)
  );

  const result = { ...current };
  result[changedField] = clampedNewValue;

  // Identify the other two fields
  const keys = ["under15", "age15to64", "over65"] as const;
  const otherKeys = keys.filter((k) => k !== changedField);
  const key1 = otherKeys[0];
  const key2 = otherKeys[1];

  const targetRemaining = 100 - clampedNewValue;
  const currentSumOthers = current[key1] + current[key2];

  let val1 = 0;
  let val2 = 0;

  if (currentSumOthers > 0) {
    val1 = (current[key1] / currentSumOthers) * targetRemaining;
    val2 = (current[key2] / currentSumOthers) * targetRemaining;
  } else {
    val1 = targetRemaining / 2;
    val2 = targetRemaining / 2;
  }

  // Clamp other fields to their respective bounds
  let clamped1 = Math.min(bounds[key1].max, Math.max(bounds[key1].min, val1));
  let clamped2 = Math.min(bounds[key2].max, Math.max(bounds[key2].min, val2));

  // If clamping caused the sum to deviate, adjust the values that have room
  const diff = targetRemaining - (clamped1 + clamped2);

  if (Math.abs(diff) > 0.001) {
    if (diff > 0) {
      const room1 = bounds[key1].max - clamped1;
      const room2 = bounds[key2].max - clamped2;
      const totalRoom = room1 + room2;
      if (totalRoom > 0) {
        clamped1 += diff * (room1 / totalRoom);
        clamped2 += diff * (room2 / totalRoom);
      }
    } else {
      const room1 = clamped1 - bounds[key1].min;
      const room2 = clamped2 - bounds[key2].min;
      const totalRoom = room1 + room2;
      if (totalRoom > 0) {
        clamped1 += diff * (room1 / totalRoom);
        clamped2 += diff * (room2 / totalRoom);
      }
    }
  }

  // Ensure absolute sum is exactly 100
  const finalSum = clampedNewValue + clamped1 + clamped2;
  const finalDiff = 100 - finalSum;
  clamped1 = Math.min(bounds[key1].max, Math.max(bounds[key1].min, clamped1 + finalDiff));

  // Round to 1 decimal place to align with 0.1 step
  const rChanged = Math.round(clampedNewValue * 10) / 10;
  const r1 = Math.round(clamped1 * 10) / 10;
  const r2 = Math.round((100 - rChanged - r1) * 10) / 10;

  result[changedField] = rChanged;
  result[key1] = r1;
  result[key2] = r2;

  // Final check to make sure remainder is strictly in bounds
  if (result[key2] < bounds[key2].min) {
    const correction = bounds[key2].min - result[key2];
    result[key2] = bounds[key2].min;
    if (result[key1] - correction >= bounds[key1].min) {
      result[key1] -= correction;
    } else {
      result[changedField] -= correction;
    }
  } else if (result[key2] > bounds[key2].max) {
    const correction = result[key2] - bounds[key2].max;
    result[key2] = bounds[key2].max;
    if (result[key1] + correction <= bounds[key1].max) {
      result[key1] += correction;
    } else {
      result[changedField] += correction;
    }
  }

  // final floating point rounding sync
  result[key2] = Math.round((100.0 - result[changedField] - result[key1]) * 10) / 10;

  return result;
}
