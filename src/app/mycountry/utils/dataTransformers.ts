// Data transformers to convert existing country data to intelligence format
// Optimized for performance and type safety

import type { 
  VitalityIntelligence,
  ExecutiveIntelligence,
  IntelligenceMetric,
  CriticalAlert,
  ActionableRecommendation
} from '../types/intelligence';
import type { StandardTrend } from '~/types/base';
import { 
  calculateTrend,
  determinePriority,
  generateRecommendations,
  predictFuture,
  compareToPercentile,
  generateCriticalAlerts,
  createExecutiveIntelligence
} from './intelligence';

// Type for existing country data structure
interface ExistingCountryData {
  id: string;
  name: string;
  leader: string;
  flag: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  realGDPGrowthRate: number;
  populationGrowthRate: number;
  economicTier: string;
  populationTier: string;
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  lastCalculated: number;
  baselineDate: number;
}

// Convert existing country data to VitalityIntelligence format
export function transformToVitalityIntelligence(
  country: ExistingCountryData,
  previousCountry?: ExistingCountryData,
  peerData?: ExistingCountryData[]
): VitalityIntelligence[] {
  const now = Date.now();
  const peerAverages = calculatePeerAverages(peerData || []);
  
  return [
    // Economic Intelligence
    {
      area: 'economic' as const,
      score: country.economicVitality,
      trend: previousCountry 
        ? calculateTrend(country.economicVitality, previousCountry.economicVitality)
        : 'stable' as StandardTrend,
      change: {
        value: previousCountry 
          ? country.economicVitality - previousCountry.economicVitality
          : 0,
        period: 'last calculation',
        reason: 'Economic policy impact'
      },
      status: getVitalityStatus(country.economicVitality),
      keyMetrics: [
        {
          id: 'gdp-per-capita',
          label: 'GDP per Capita',
          value: Math.round(country.currentGdpPerCapita),
          unit: '',
          trend: previousCountry 
            ? calculateTrend(country.currentGdpPerCapita, previousCountry.currentGdpPerCapita)
            : 'stable' as StandardTrend,
          changeValue: previousCountry 
            ? country.currentGdpPerCapita - previousCountry.currentGdpPerCapita
            : 0,
          changePercent: previousCountry 
            ? ((country.currentGdpPerCapita - previousCountry.currentGdpPerCapita) / previousCountry.currentGdpPerCapita) * 100
            : 0,
          changePeriod: 'vs previous',
          status: getMetricStatus(country.currentGdpPerCapita, 'gdp'),
          rank: peerData ? {
            global: calculateRank(country.currentGdpPerCapita, peerData.map(p => p.currentGdpPerCapita)),
            regional: calculateRank(country.currentGdpPerCapita, peerData.map(p => p.currentGdpPerCapita)),
            total: peerData.length
          } : undefined
        },
        {
          id: 'growth-rate',
          label: 'Growth Rate',
          value: Number((country.realGDPGrowthRate * 100).toFixed(1)),
          unit: '%',
          trend: (country.realGDPGrowthRate > 0.02 ? 'up' : country.realGDPGrowthRate < 0 ? 'down' : 'stable') as StandardTrend,
          changeValue: previousCountry 
            ? (country.realGDPGrowthRate - previousCountry.realGDPGrowthRate) * 100
            : 0,
          changePercent: previousCountry 
            ? ((country.realGDPGrowthRate - previousCountry.realGDPGrowthRate) / Math.abs(previousCountry.realGDPGrowthRate)) * 100
            : 0,
          changePeriod: 'vs previous',
          status: getMetricStatus(country.realGDPGrowthRate * 100, 'growth'),
        },
        {
          id: 'economic-tier',
          label: 'Economic Tier',
          value: country.economicTier,
          trend: 'stable' as StandardTrend,
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'current',
          status: 'good' as const
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: predictFuture([country.economicVitality], ['GDP growth', 'policy impact'], 'short'),
        longTerm: predictFuture([country.economicVitality], ['economic cycle', 'structural reforms'], 'long')
      },
      comparisons: {
        peerAverage: peerAverages.economic,
        regionalAverage: peerAverages.economic,
        historicalBest: Math.max(country.economicVitality, 95),
        rank: peerData ? calculateRank(country.economicVitality, peerData.map(p => p.economicVitality)) : 1,
        totalCountries: peerData?.length || 1
      }
    },

    // Population Intelligence
    {
      area: 'population' as const,
      score: country.populationWellbeing,
      trend: previousCountry 
        ? calculateTrend(country.populationWellbeing, previousCountry.populationWellbeing)
        : 'stable' as StandardTrend,
      change: {
        value: previousCountry 
          ? country.populationWellbeing - previousCountry.populationWellbeing
          : 0,
        period: 'last calculation',
        reason: 'Social policy effectiveness'
      },
      status: getVitalityStatus(country.populationWellbeing),
      keyMetrics: [
        {
          id: 'population',
          label: 'Population',
          value: `${(country.currentPopulation / 1000000).toFixed(1)}M`,
          trend: (country.populationGrowthRate > 0.01 ? 'up' : country.populationGrowthRate < 0 ? 'down' : 'stable') as StandardTrend,
          changeValue: previousCountry 
            ? country.currentPopulation - previousCountry.currentPopulation
            : 0,
          changePercent: previousCountry 
            ? ((country.currentPopulation - previousCountry.currentPopulation) / previousCountry.currentPopulation) * 100
            : 0,
          changePeriod: 'vs previous',
          status: 'good' as const
        },
        {
          id: 'population-growth',
          label: 'Growth Rate',
          value: Number((country.populationGrowthRate * 100).toFixed(1)),
          unit: '%',
          trend: (country.populationGrowthRate > 0.015 ? 'up' : country.populationGrowthRate < 0.005 ? 'down' : 'stable') as StandardTrend,
          changeValue: previousCountry 
            ? (country.populationGrowthRate - previousCountry.populationGrowthRate) * 100
            : 0,
          changePercent: 0,
          changePeriod: 'annual',
          status: getMetricStatus(country.populationGrowthRate * 100, 'growth')
        },
        {
          id: 'population-tier',
          label: 'Population Tier',
          value: country.populationTier,
          trend: 'stable' as StandardTrend,
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'current',
          status: 'good' as const
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: predictFuture([country.populationWellbeing], ['healthcare', 'education', 'social services'], 'short'),
        longTerm: predictFuture([country.populationWellbeing], ['demographic transition', 'social reforms'], 'long')
      },
      comparisons: {
        peerAverage: peerAverages.population,
        regionalAverage: peerAverages.population,
        historicalBest: Math.max(country.populationWellbeing, 95),
        rank: peerData ? calculateRank(country.populationWellbeing, peerData.map(p => p.populationWellbeing)) : 1,
        totalCountries: peerData?.length || 1
      }
    },

    // Diplomatic Intelligence
    {
      area: 'diplomatic' as const,
      score: country.diplomaticStanding,
      trend: previousCountry 
        ? calculateTrend(country.diplomaticStanding, previousCountry.diplomaticStanding)
        : 'stable' as StandardTrend,
      change: {
        value: previousCountry 
          ? country.diplomaticStanding - previousCountry.diplomaticStanding
          : 0,
        period: 'last calculation',
        reason: 'International relations'
      },
      status: getVitalityStatus(country.diplomaticStanding),
      keyMetrics: [
        {
          id: 'diplomatic-treaties',
          label: 'Active Treaties',
          value: 12, // Mock data - would come from actual diplomatic data
          trend: 'up' as StandardTrend,
          changeValue: 2,
          changePercent: 20,
          changePeriod: 'this year',
          status: 'good' as const
        },
        {
          id: 'trade-partners',
          label: 'Trade Partners',
          value: 34,
          trend: 'up' as StandardTrend,
          changeValue: 5,
          changePercent: 17,
          changePeriod: 'this year',
          status: 'good' as const
        },
        {
          id: 'diplomatic-reputation',
          label: 'Global Reputation',
          value: 'Rising',
          trend: 'up' as StandardTrend,
          changeValue: 0,
          changePercent: 8,
          changePeriod: 'recent',
          status: 'good' as const
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: predictFuture([country.diplomaticStanding], ['bilateral relations', 'trade agreements'], 'short'),
        longTerm: predictFuture([country.diplomaticStanding], ['regional stability', 'global partnerships'], 'long')
      },
      comparisons: {
        peerAverage: peerAverages.diplomatic,
        regionalAverage: peerAverages.diplomatic,
        historicalBest: Math.max(country.diplomaticStanding, 95),
        rank: peerData ? calculateRank(country.diplomaticStanding, peerData.map(p => p.diplomaticStanding)) : 1,
        totalCountries: peerData?.length || 1
      }
    },

    // Governance Intelligence
    {
      area: 'governance' as const,
      score: country.governmentalEfficiency,
      trend: previousCountry 
        ? calculateTrend(country.governmentalEfficiency, previousCountry.governmentalEfficiency)
        : 'stable' as StandardTrend,
      change: {
        value: previousCountry 
          ? country.governmentalEfficiency - previousCountry.governmentalEfficiency
          : 0,
        period: 'last calculation',
        reason: 'Administrative effectiveness'
      },
      status: getVitalityStatus(country.governmentalEfficiency),
      keyMetrics: [
        {
          id: 'public-approval',
          label: 'Public Approval',
          value: 72,
          unit: '%',
          trend: 'up' as StandardTrend,
          changeValue: 5,
          changePercent: 7.4,
          changePeriod: 'this month',
          status: 'good' as const
        },
        {
          id: 'policy-success',
          label: 'Policy Success Rate',
          value: 73,
          unit: '%',
          trend: 'up' as StandardTrend,
          changeValue: 3,
          changePercent: 4.3,
          changePeriod: 'recent',
          status: 'good' as const
        },
        {
          id: 'government-efficiency',
          label: 'Efficiency Rating',
          value: 'High',
          trend: 'stable' as StandardTrend,
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'current',
          status: 'good' as const
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: predictFuture([country.governmentalEfficiency], ['policy implementation', 'public support'], 'short'),
        longTerm: predictFuture([country.governmentalEfficiency], ['institutional reform', 'governance modernization'], 'long')
      },
      comparisons: {
        peerAverage: peerAverages.government,
        regionalAverage: peerAverages.government,
        historicalBest: Math.max(country.governmentalEfficiency, 95),
        rank: peerData ? calculateRank(country.governmentalEfficiency, peerData.map(p => p.governmentalEfficiency)) : 1,
        totalCountries: peerData?.length || 1
      }
    }
  ].map((vitality, vitalityIndex) => {
    const recommendations = generateRecommendations(vitality);
    const criticalAlerts = vitality.score < 40 ? generateCriticalAlerts([vitality]) : [];
    
    // Ensure all recommendations have valid IDs
    recommendations.forEach((rec, index) => {
      if (!rec.id || !rec.id.trim()) {
        rec.id = `${vitality.area}-recommendation-${Date.now()}-${index}`;
      }
    });
    
    // Ensure all alerts have valid IDs  
    criticalAlerts.forEach((alert, index) => {
      if (!alert.id || !alert.id.trim()) {
        alert.id = `${vitality.area}-alert-${Date.now()}-${index}`;
      }
    });
    
    return {
      ...vitality,
      recommendations,
      criticalAlerts
    };
  }) as VitalityIntelligence[];
}

// Transform to full ExecutiveIntelligence
export function transformToExecutiveIntelligence(
  country: ExistingCountryData,
  previousCountry?: ExistingCountryData,
  peerData?: ExistingCountryData[]
): ExecutiveIntelligence {
  const vitalityData = transformToVitalityIntelligence(country, previousCountry, peerData);
  return createExecutiveIntelligence(country.id, vitalityData);
}

// Helper functions
function getVitalityStatus(score: number): 'excellent' | 'good' | 'concerning' | 'critical' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'concerning';
  return 'critical';
}

function getMetricStatus(value: number, type: 'gdp' | 'growth'): 'excellent' | 'good' | 'concerning' | 'critical' {
  if (type === 'gdp') {
    if (value >= 50000) return 'excellent';
    if (value >= 25000) return 'good';
    if (value >= 10000) return 'concerning';
    return 'critical';
  }
  if (type === 'growth') {
    if (value >= 3) return 'excellent';
    if (value >= 1) return 'good';
    if (value >= -1) return 'concerning';
    return 'critical';
  }
  return 'good';
}

function calculateRank(value: number, allValues: number[]): number {
  const sorted = [...allValues].sort((a, b) => b - a); // Descending order
  const rank = sorted.findIndex(v => v <= value) + 1;
  return rank || sorted.length;
}

function calculatePeerAverages(peerData: ExistingCountryData[]): {
  economic: number;
  population: number;
  diplomatic: number;
  government: number;
} {
  if (peerData.length === 0) {
    return { economic: 50, population: 50, diplomatic: 50, government: 50 };
  }
  
  return {
    economic: peerData.reduce((sum, p) => sum + p.economicVitality, 0) / peerData.length,
    population: peerData.reduce((sum, p) => sum + p.populationWellbeing, 0) / peerData.length,
    diplomatic: peerData.reduce((sum, p) => sum + p.diplomaticStanding, 0) / peerData.length,
    government: peerData.reduce((sum, p) => sum + p.governmentalEfficiency, 0) / peerData.length
  };
}

// Create mock historical data for trends (in real implementation, this would come from database)
export function createMockHistoricalData(country: ExistingCountryData): ExistingCountryData {
  const variance = 0.1; // 10% variance for mock previous data
  
  return {
    ...country,
    economicVitality: Math.max(0, Math.min(100, country.economicVitality + (Math.random() - 0.5) * 20)),
    populationWellbeing: Math.max(0, Math.min(100, country.populationWellbeing + (Math.random() - 0.5) * 15)),
    diplomaticStanding: Math.max(0, Math.min(100, country.diplomaticStanding + (Math.random() - 0.5) * 12)),
    governmentalEfficiency: Math.max(0, Math.min(100, country.governmentalEfficiency + (Math.random() - 0.5) * 18)),
    currentGdpPerCapita: Math.max(1000, country.currentGdpPerCapita * (1 + (Math.random() - 0.5) * variance)),
    currentPopulation: Math.max(10000, country.currentPopulation * (1 + (Math.random() - 0.5) * variance * 0.5)),
    realGDPGrowthRate: Math.max(-0.1, Math.min(0.15, country.realGDPGrowthRate + (Math.random() - 0.5) * 0.02)),
    populationGrowthRate: Math.max(-0.05, Math.min(0.1, country.populationGrowthRate + (Math.random() - 0.5) * 0.01))
  };
}