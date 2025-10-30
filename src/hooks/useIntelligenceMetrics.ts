/**
 * useIntelligenceMetrics Hook
 *
 * Calculates and memoizes vitality metrics and country metrics for intelligence briefings.
 */

import { useMemo } from "react";
import { calculateVitalityMetrics, calculateCountryMetrics } from "~/lib/intelligence-metrics-calculator";
import type { VitalityMetric, CountryMetric, ClassificationLevel } from "~/types/intelligence-briefing";

interface UseIntelligenceMetricsProps {
  country: {
    id: string;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    populationGrowthRate: number;
    adjustedGdpGrowth: number;
    currentPopulation: number;
    populationTier: string;
    governmentType?: string;
    capital?: string;
    continent?: string;
    region?: string;
    populationDensity?: number;
    landArea?: number;
  };
  flagColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  viewerClearanceLevel: ClassificationLevel;
}

export const useIntelligenceMetrics = ({
  country,
  flagColors,
  viewerClearanceLevel,
}: UseIntelligenceMetricsProps) => {
  const vitalityMetrics: VitalityMetric[] = useMemo(() => {
    return calculateVitalityMetrics(country, flagColors, viewerClearanceLevel);
  }, [country, flagColors, viewerClearanceLevel]);

  const countryMetrics: CountryMetric[] = useMemo(() => {
    return calculateCountryMetrics(country);
  }, [country]);

  return {
    vitalityMetrics,
    countryMetrics,
  };
};
