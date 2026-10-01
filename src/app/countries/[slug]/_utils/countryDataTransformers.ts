/**
 * Country Data Transformers — transforms database models into formatted telemetry & economics structures
 */

import type { BaseCountryData, VitalityData } from "../_types";

/**
 * Map of economic tier strings to baseline vitality score
 */
const ECONOMIC_TIER_SCORES: Record<string, number> = {
  Extravagant: 95,
  "Very Strong": 85,
  Strong: 75,
  Healthy: 65,
  Developed: 50,
  Developing: 35,
};

/**
 * Calculate vitality metrics for country overview display
 */
export function calculateVitalityData(
  country: Pick<
    BaseCountryData,
    "economicTier" | "adjustedGdpGrowth" | "populationGrowthRate" | "populationDensity"
  >,
  /**
   * Server-computed Diplomatic Standing (`countries.getActivityRingsData`, from relations,
   * embassies, alliances, treaties and hostile actions). Null or absent = no diplomatic record.
   */
  diplomaticStanding: number | null = null
): VitalityData {
  // Economic Vitality (based on GDP per capita and growth)
  const economicTierScore = ECONOMIC_TIER_SCORES[country.economicTier] ?? 25;

  const gdpGrowthBonus = Math.min(20, Math.max(-20, (country.adjustedGdpGrowth ?? 0) * 400));
  const economicVitality = Math.min(100, Math.max(0, economicTierScore + gdpGrowthBonus));

  // Population Wellbeing (based on population growth and density)
  const popGrowthHealth = (country.populationGrowthRate ?? 0) > 0 ? 70 : 40;
  const densityFactor = country.populationDensity
    ? Math.max(50, 100 - country.populationDensity / 500)
    : 60;
  const populationWellbeing = (popGrowthHealth + densityFactor) / 2;

  // Governmental Efficiency (based on economic tier as proxy)
  const governmentalEfficiency = economicTierScore * 0.8;

  return {
    economicVitality,
    populationWellbeing,
    diplomaticStanding:
      typeof diplomaticStanding === "number" && Number.isFinite(diplomaticStanding)
        ? Math.min(100, Math.max(0, diplomaticStanding))
        : null,
    governmentalEfficiency,
  };
}
