/**
 * Demographics Calculation Utilities
 *
 * Provides calculation functions for deriving demographic metrics and
 * utility functions for UI color theming. Extracted from DemographicsPopulationTab
 * to maintain separation of concerns between UI and business logic.
 */

import type { DemographicsConfiguration } from '~/types/economy-builder';

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
    urbanShare: demographics.urbanRuralSplit.urban
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
  const colors = ['blue', 'green', 'orange', 'purple', 'cyan', 'pink', 'yellow', 'red', 'indigo', 'teal'];
  return colors[index % colors.length];
}
