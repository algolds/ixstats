/**
 * Intelligence Metrics Calculator
 *
 * Calculates vitality metrics and country metrics for the intelligence briefing system.
 */

import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import type { VitalityMetric, CountryMetric, ClassificationLevel } from "~/types/intelligence-briefing";
import {
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiRidingLine,
  RiBarChartLine,
  RiLineChartLine,
  RiTvLine,
  RiBuildingLine,
  RiSettings3Line,
  RiMapLine,
  RiGlobalLine,
} from "react-icons/ri";

/**
 * Determines status from a percentage value
 */
export const getStatusFromValue = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
  if (value >= 80) return 'excellent';
  if (value >= 60) return 'good';
  if (value >= 40) return 'fair';
  return 'poor';
};

/**
 * Calculates vitality metrics for a country
 */
export const calculateVitalityMetrics = (
  country: {
    currentGdpPerCapita: number;
    populationGrowthRate: number;
    economicTier: string;
    adjustedGdpGrowth: number;
  },
  flagColors: {
    primary: string;
    secondary: string;
    accent: string;
  },
  viewerClearanceLevel: ClassificationLevel
): VitalityMetric[] => {
  const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
  const populationGrowth = Math.min(100, Math.max(0, (country.populationGrowthRate * 100 + 2) * 25));
  const developmentIndex = (() => {
    const tierScores: Record<string, number> = {
      "Extravagant": 100, "Very Strong": 85, "Strong": 70,
      "Healthy": 55, "Developed": 40, "Developing": 25
    };
    return tierScores[country.economicTier] || 10;
  })();

  return [
    {
      id: 'economic',
      label: 'Economic Health',
      value: economicHealth,
      color: flagColors.primary,
      icon: RiMoneyDollarCircleLine,
      trend: country.adjustedGdpGrowth > 0.02 ? 'up' : country.adjustedGdpGrowth < -0.01 ? 'down' : 'stable',
      status: getStatusFromValue(economicHealth),
      classification: 'PUBLIC'
    },
    {
      id: 'population',
      label: 'Population Vitality',
      value: populationGrowth,
      color: flagColors.secondary,
      icon: RiTeamLine,
      trend: country.populationGrowthRate > 0.01 ? 'up' : country.populationGrowthRate < 0 ? 'down' : 'stable',
      status: getStatusFromValue(populationGrowth),
      classification: 'PUBLIC'
    },
    {
      id: 'development',
      label: 'Development Index',
      value: developmentIndex,
      color: flagColors.accent,
      icon: RiRidingLine,
      trend: 'stable',
      status: getStatusFromValue(developmentIndex),
      classification: viewerClearanceLevel !== 'PUBLIC' ? 'RESTRICTED' : 'PUBLIC'
    }
  ];
};

/**
 * Calculates comprehensive country metrics
 */
export const calculateCountryMetrics = (
  country: {
    currentTotalGdp: number;
    currentGdpPerCapita: number;
    economicTier: string;
    adjustedGdpGrowth: number;
    currentPopulation: number;
    populationTier: string;
    populationGrowthRate: number;
    governmentType?: string;
    capital?: string;
    continent?: string;
    region?: string;
    populationDensity?: number;
    landArea?: number;
  }
): CountryMetric[] => {
  // Calculate derived metrics
  const laborForce = Math.round(country.currentPopulation * 0.65);
  const unemploymentRate = Math.max(2, Math.min(15, 8 - (country.adjustedGdpGrowth * 100)));
  const literacyRate = Math.min(99, 70 + (country.currentGdpPerCapita / 1000));
  const lifeExpectancy = Math.min(85, 65 + (country.currentGdpPerCapita / 2000));

  return [
    // Economy Section
    {
      id: 'total_gdp',
      label: 'Total GDP',
      value: formatCurrency(country.currentTotalGdp),
      icon: RiBarChartLine,
      trend: {
        direction: country.adjustedGdpGrowth > 0 ? 'up' : 'down',
        value: Math.abs(country.adjustedGdpGrowth * 100),
        period: 'annual'
      },
      classification: 'PUBLIC',
      importance: 'critical'
    },
    {
      id: 'gdp_per_capita',
      label: 'GDP per Capita',
      value: formatCurrency(country.currentGdpPerCapita),
      icon: RiMoneyDollarCircleLine,
      trend: {
        direction: country.adjustedGdpGrowth > 0.01 ? 'up' : country.adjustedGdpGrowth < -0.01 ? 'down' : 'stable',
        value: Math.abs(country.adjustedGdpGrowth * 100),
        period: 'annual'
      },
      classification: 'PUBLIC',
      importance: 'critical'
    },
    {
      id: 'economic_tier',
      label: 'Economic Classification',
      value: country.economicTier,
      icon: RiLineChartLine,
      classification: 'PUBLIC',
      importance: 'high'
    },

    // Demographics Section
    {
      id: 'population',
      label: 'Total Population',
      value: formatPopulation(country.currentPopulation),
      icon: RiTeamLine,
      trend: {
        direction: country.populationGrowthRate > 0 ? 'up' : 'down',
        value: Math.abs(country.populationGrowthRate * 100),
        period: 'annual'
      },
      classification: 'PUBLIC',
      importance: 'high'
    },
    {
      id: 'population_tier',
      label: 'Population Classification',
      value: `Tier ${country.populationTier}`,
      icon: RiTeamLine,
      classification: 'PUBLIC',
      importance: 'medium'
    },
    {
      id: 'life_expectancy',
      label: 'Life Expectancy',
      value: lifeExpectancy.toFixed(1),
      unit: 'years',
      icon: RiRidingLine,
      classification: 'PUBLIC',
      importance: 'medium'
    },
    {
      id: 'literacy_rate',
      label: 'Literacy Rate',
      value: literacyRate.toFixed(1),
      unit: '%',
      icon: RiTvLine,
      classification: 'PUBLIC',
      importance: 'medium'
    },

    // Labor Section
    {
      id: 'labor_force',
      label: 'Labor Force',
      value: formatPopulation(laborForce),
      icon: RiBuildingLine,
      classification: 'PUBLIC',
      importance: 'high'
    },
    {
      id: 'unemployment_rate',
      label: 'Unemployment Rate',
      value: unemploymentRate.toFixed(1),
      unit: '%',
      icon: RiSettings3Line,
      trend: {
        direction: country.adjustedGdpGrowth > 0 ? 'down' : 'up',
        value: Math.abs(country.adjustedGdpGrowth * 50),
        period: 'annual'
      },
      classification: 'PUBLIC',
      importance: 'high'
    },

    // Government Section
    {
      id: 'government_type',
      label: 'Government System',
      value: country.governmentType || 'Constitutional',
      icon: RiBuildingLine,
      classification: 'PUBLIC',
      importance: 'medium'
    },
    {
      id: 'capital_city',
      label: 'Capital',
      value: country.capital || 'Unknown',
      icon: RiMapLine,
      classification: 'PUBLIC',
      importance: 'low'
    },

    // Geographic Section
    ...(country.populationDensity ? [{
      id: 'density',
      label: 'Population Density',
      value: country.populationDensity.toFixed(1),
      unit: '/km²',
      icon: RiMapLine,
      classification: 'PUBLIC' as const,
      importance: 'medium' as const
    }] : []),
    ...(country.landArea ? [{
      id: 'land_area',
      label: 'Land Area',
      value: country.landArea.toLocaleString(),
      unit: 'km²',
      icon: RiGlobalLine,
      classification: 'PUBLIC' as const,
      importance: 'medium' as const
    }] : []),
    {
      id: 'continent',
      label: 'Continent',
      value: country.continent || 'Unknown',
      icon: RiGlobalLine,
      classification: 'PUBLIC',
      importance: 'low'
    },
    {
      id: 'region',
      label: 'Region',
      value: country.region || 'Unknown',
      icon: RiMapLine,
      classification: 'PUBLIC',
      importance: 'low'
    }
  ];
};
