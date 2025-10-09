// Live data transformers for connecting real tRPC API data to intelligence components
// Replaces mock data transformers with real database-driven intelligence

import type { 
  VitalityIntelligence,
  ExecutiveIntelligence,
  IntelligenceMetric,
  CriticalAlert,
  ActionableRecommendation,
  TrendingInsight,
  ForwardIntelligence
} from '../types/intelligence';
import { 
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  DollarSign,
  Users,
  Building,
  Globe
} from 'lucide-react';

// Real country data interface (from tRPC API)
interface ApiCountryData {
  id: string;
  name: string;
  leader: string;
  flag: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
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
  region?: string;
  continent?: string;
  governmentType?: string;
  landArea?: number;
  populationDensity?: number;
}

// Real intelligence items from API
interface ApiIntelligenceItem {
  id: string;
  type: 'alert' | 'opportunity' | 'update' | 'achievement';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  category: 'economic' | 'population' | 'diplomatic' | 'governance' | 'security';
  timestamp: number;
  actionable: boolean;
  source: string;
  affectedRegions: string[];
  confidence: number;
  priority?: number;
  impact?: {
    magnitude: 'low' | 'medium' | 'high' | 'severe';
    areas: string[];
  };
  relatedMetrics?: string[];
  actions?: string[];
}

/**
 * Transform real country data to VitalityIntelligence format
 * Uses actual vitality scores from API instead of mock calculations
 */
export function transformApiDataToVitalityIntelligence(
  country: ApiCountryData,
  previousCountry?: ApiCountryData
): VitalityIntelligence[] {
  const now = Date.now();
  
  return [
    // Economic Intelligence (using real API vitality score)
    {
      area: 'economic' as const,
      score: country.economicVitality, // Real score from API
      trend: calculateTrend(country.economicVitality, previousCountry?.economicVitality),
      change: {
        value: previousCountry ? country.economicVitality - previousCountry.economicVitality : 0,
        period: 'vs previous calculation',
        reason: 'Economic performance evaluation'
      },
      status: getVitalityStatus(country.economicVitality),
      keyMetrics: [
        {
          id: 'gdp-per-capita',
          label: 'GDP per Capita',
          value: Math.round(country.currentGdpPerCapita),
          unit: '',
          trend: calculateTrend(country.currentGdpPerCapita, previousCountry?.currentGdpPerCapita),
          changeValue: previousCountry ? country.currentGdpPerCapita - previousCountry.currentGdpPerCapita : 0,
          changePercent: previousCountry ? ((country.currentGdpPerCapita - previousCountry.currentGdpPerCapita) / previousCountry.currentGdpPerCapita) * 100 : 0,
          changePeriod: 'vs previous',
          status: getMetricStatus(country.currentGdpPerCapita, 'gdp')
        },
        {
          id: 'growth-rate',
          label: 'Growth Rate',
          value: Number((country.realGDPGrowthRate * 100).toFixed(1)),
          unit: '%',
          trend: country.realGDPGrowthRate > 0.02 ? 'up' : country.realGDPGrowthRate < 0 ? 'down' : 'stable',
          changeValue: previousCountry ? (country.realGDPGrowthRate - previousCountry.realGDPGrowthRate) * 100 : 0,
          changePercent: 0,
          changePeriod: 'current rate',
          status: country.realGDPGrowthRate > 0.03 ? 'excellent' : country.realGDPGrowthRate > 0 ? 'good' : 'concerning'
        },
        {
          id: 'economic-tier',
          label: 'Economic Tier',
          value: country.economicTier,
          unit: '',
          trend: 'stable',
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'current',
          status: 'good'
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: Math.min(100, country.economicVitality + (country.realGDPGrowthRate * 50)),
          confidence: 75,
          factors: ['GDP growth rate', 'Economic tier stability', 'Regional performance']
        },
        longTerm: {
          projected: Math.min(100, country.economicVitality + (country.realGDPGrowthRate * 200)),
          confidence: 65,
          factors: ['Long-term economic trends', 'Demographic changes', 'Global economic conditions']
        }
      },
      comparisons: {
        peerAverage: calculatePeerAverage(country, 'economic'),
        regionalAverage: calculateRegionalAverage(country, 'economic'),
        historicalBest: Math.max(country.economicVitality, 85),
        rank: calculateCountryRank(country.economicVitality, 'economic'),
        totalCountries: 180
      }
    },
    
    // Population Intelligence (using real API vitality score)
    {
      area: 'population' as const,
      score: country.populationWellbeing, // Real score from API
      trend: calculateTrend(country.populationWellbeing, previousCountry?.populationWellbeing),
      change: {
        value: previousCountry ? country.populationWellbeing - previousCountry.populationWellbeing : 0,
        period: 'vs previous calculation',
        reason: 'Population wellbeing assessment'
      },
      status: getVitalityStatus(country.populationWellbeing),
      keyMetrics: [
        {
          id: 'total-population',
          label: 'Population',
          value: formatLargeNumber(country.currentPopulation),
          unit: '',
          trend: calculateTrend(country.currentPopulation, previousCountry?.currentPopulation),
          changeValue: previousCountry ? country.currentPopulation - previousCountry.currentPopulation : 0,
          changePercent: previousCountry ? ((country.currentPopulation - previousCountry.currentPopulation) / previousCountry.currentPopulation) * 100 : 0,
          changePeriod: 'vs previous',
          status: 'good'
        },
        {
          id: 'population-growth',
          label: 'Growth Rate',
          value: Number((country.populationGrowthRate * 100).toFixed(2)),
          unit: '%',
          trend: country.populationGrowthRate > 0.01 ? 'up' : country.populationGrowthRate < 0 ? 'down' : 'stable',
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'annual',
          status: country.populationGrowthRate > 0.02 ? 'excellent' : country.populationGrowthRate > 0 ? 'good' : 'concerning'
        },
        {
          id: 'population-tier',
          label: 'Population Tier',
          value: country.populationTier,
          unit: '',
          trend: 'stable',
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'current',
          status: 'good'
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: Math.min(100, country.populationWellbeing + (country.populationGrowthRate * 100)),
          confidence: 80,
          factors: ['Population growth trends', 'Economic development', 'Quality of life indicators']
        },
        longTerm: {
          projected: Math.min(100, country.populationWellbeing + (country.populationGrowthRate * 400)),
          confidence: 70,
          factors: ['Demographic transition', 'Economic development', 'Social policy effectiveness']
        }
      },
      comparisons: {
        peerAverage: 70,
        regionalAverage: 75,
        historicalBest: Math.max(country.populationWellbeing, 90),
        rank: 1,
        totalCountries: 180
      }
    },

    // Diplomatic Intelligence (using real API vitality score)
    {
      area: 'diplomatic' as const,
      score: country.diplomaticStanding, // Real score from API
      trend: calculateTrend(country.diplomaticStanding, previousCountry?.diplomaticStanding),
      change: {
        value: previousCountry ? country.diplomaticStanding - previousCountry.diplomaticStanding : 0,
        period: 'vs previous calculation',
        reason: 'Diplomatic relations assessment'
      },
      status: getVitalityStatus(country.diplomaticStanding),
      keyMetrics: [
        {
          id: 'diplomatic-standing',
          label: 'Diplomatic Standing',
          value: country.diplomaticStanding,
          unit: '/100',
          trend: calculateTrend(country.diplomaticStanding, previousCountry?.diplomaticStanding),
          changeValue: previousCountry ? country.diplomaticStanding - previousCountry.diplomaticStanding : 0,
          changePercent: 0,
          changePeriod: 'vs previous',
          status: getVitalityStatus(country.diplomaticStanding)
        },
        {
          id: 'regional-influence',
          label: 'Regional Influence',
          value: country.region || 'Unknown',
          unit: '',
          trend: 'stable',
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'current',
          status: 'good'
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: Math.min(100, Math.max(0,
            country.diplomaticStanding + (country.economicVitality * 0.1) - (100 - country.governmentalEfficiency) * 0.05
          )),
          confidence: 60,
          factors: ['Regional stability', 'Bilateral relations', 'International engagement']
        },
        longTerm: {
          projected: Math.min(100, Math.max(0,
            country.diplomaticStanding + (country.economicVitality * 0.2) + (country.populationWellbeing * 0.1) - (100 - country.governmentalEfficiency) * 0.1
          )),
          confidence: 50,
          factors: ['Long-term strategic partnerships', 'Global influence trends', 'Regional dynamics']
        }
      },
      comparisons: {
        peerAverage: 65,
        regionalAverage: 70,
        historicalBest: Math.max(country.diplomaticStanding, 85),
        rank: 1,
        totalCountries: 180
      }
    },

    // Governance Intelligence (using real API vitality score)
    {
      area: 'governance' as const,
      score: country.governmentalEfficiency, // Real score from API
      trend: calculateTrend(country.governmentalEfficiency, previousCountry?.governmentalEfficiency),
      change: {
        value: previousCountry ? country.governmentalEfficiency - previousCountry.governmentalEfficiency : 0,
        period: 'vs previous calculation',
        reason: 'Governmental efficiency assessment'
      },
      status: getVitalityStatus(country.governmentalEfficiency),
      keyMetrics: [
        {
          id: 'government-efficiency',
          label: 'Government Efficiency',
          value: country.governmentalEfficiency,
          unit: '/100',
          trend: calculateTrend(country.governmentalEfficiency, previousCountry?.governmentalEfficiency),
          changeValue: previousCountry ? country.governmentalEfficiency - previousCountry.governmentalEfficiency : 0,
          changePercent: 0,
          changePeriod: 'vs previous',
          status: getVitalityStatus(country.governmentalEfficiency)
        },
        {
          id: 'government-type',
          label: 'Government Type',
          value: country.governmentType || 'Unknown',
          unit: '',
          trend: 'stable',
          changeValue: 0,
          changePercent: 0,
          changePeriod: 'current',
          status: 'good'
        }
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: Math.min(100, country.governmentalEfficiency + (country.economicVitality * 0.1)),
          confidence: 70,
          factors: ['Economic performance', 'Administrative efficiency', 'Policy effectiveness']
        },
        longTerm: {
          projected: Math.min(100, country.governmentalEfficiency + (country.economicVitality * 0.3)),
          confidence: 60,
          factors: ['Long-term governance trends', 'Institutional development', 'Economic stability']
        }
      },
      comparisons: {
        peerAverage: 68,
        regionalAverage: 72,
        historicalBest: Math.max(country.governmentalEfficiency, 88),
        rank: 1,
        totalCountries: 180
      }
    }
  ];
}

/**
 * Map API categories to CriticalAlert categories
 */
function mapAlertCategory(category: string): 'economic' | 'population' | 'diplomatic' | 'governance' | 'crisis' {
  switch (category) {
    case 'security':
      return 'crisis';
    case 'social':
      return 'population';
    default:
      return category as 'economic' | 'population' | 'diplomatic' | 'governance' | 'crisis';
  }
}

/**
 * Transform real intelligence feed to critical alerts
 */
export function transformApiIntelligenceToAlerts(intelligenceItems: ApiIntelligenceItem[]): CriticalAlert[] {
  return intelligenceItems
    .filter(item => item.type === 'alert' && (item.severity === 'high' || item.severity === 'critical'))
    .slice(0, 5) // Limit to top 5 critical alerts
    .map(item => ({
      id: item.id,
      title: item.title,
      message: item.description,
      severity: mapSeverity(item.severity),
      category: mapAlertCategory(item.category),
      priority: item.priority ? mapPriority(item.priority) : 'high',
      actionRequired: item.actionable,
      timeframe: item.severity === 'critical' ? 'immediate' : 'short',
      estimatedImpact: item.impact || {
        magnitude: 'medium',
        areas: [item.category]
      },
      recommendedActions: item.actions || ['Review situation', 'Consult advisors', 'Monitor developments'],
      createdAt: item.timestamp,
      expiresAt: item.timestamp + (24 * 60 * 60 * 1000) // 24 hours
    }));
}

/**
 * Transform real intelligence feed to trending insights
 */
export function transformApiIntelligenceToInsights(intelligenceItems: ApiIntelligenceItem[]): TrendingInsight[] {
  return intelligenceItems
    .filter(item => item.type === 'opportunity' || item.type === 'update')
    .slice(0, 6) // Limit to top 6 insights
    .map((item, index) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.type === 'opportunity' ? 'opportunity' : 'performance',
      icon: getIconForCategory(item.category),
      trend: item.type === 'opportunity' ? 'up' : 'stable',
      significance: item.severity === 'high' ? 'major' : item.severity === 'medium' ? 'moderate' : 'minor',
      metrics: [], // TODO: Transform relatedMetrics to IntelligenceMetric[]
      context: {
        comparison: 'peer',
        timeframe: 'recent developments',
        confidence: Math.round(item.confidence * 100)
      },
      actionable: item.actionable,
      nextReview: item.timestamp + (7 * 24 * 60 * 60 * 1000) // 1 week
    }));
}

/**
 * Map API categories to ActionableRecommendation categories
 */
function mapRecommendationCategory(category: string): 'economic' | 'population' | 'diplomatic' | 'governance' {
  switch (category) {
    case 'security':
    case 'social':
      return 'governance';
    default:
      return category as 'economic' | 'population' | 'diplomatic' | 'governance';
  }
}

/**
 * Transform real intelligence feed to actionable recommendations
 */
export function transformApiIntelligenceToRecommendations(intelligenceItems: ApiIntelligenceItem[]): ActionableRecommendation[] {
  return intelligenceItems
    .filter(item => item.actionable && item.actions && item.actions.length > 0)
    .slice(0, 4) // Limit to top 4 recommendations
    .map((item, index) => ({
      id: item.id,
      title: `Address ${item.title}`,
      description: item.actions?.[0] || item.description,
      category: mapRecommendationCategory(item.category),
      urgency: mapSeverityToUrgency(item.severity),
      difficulty: 'moderate',
      estimatedDuration: item.severity === 'critical' ? '1-2 days' : '1-2 weeks',
      estimatedCost: 'Medium',
      estimatedBenefit: item.severity === 'high' ? 'High' : 'Medium',
      prerequisites: ['Administrative approval', 'Resource allocation'],
      risks: ['Implementation complexity', 'Resource constraints'],
      successProbability: Math.round(item.confidence * 100),
      impact: {
        [item.category]: item.severity === 'critical' ? 15 : item.severity === 'high' ? 10 : 5
      }
    }));
}

/**
 * Main function to transform real API data to ExecutiveIntelligence
 * Replaces the mock transformToExecutiveIntelligence function
 */
export function transformApiDataToExecutiveIntelligence(
  country: ApiCountryData,
  intelligenceItems: ApiIntelligenceItem[] = [],
  previousCountry?: ApiCountryData
): ExecutiveIntelligence {
  const vitalityIntelligence = transformApiDataToVitalityIntelligence(country, previousCountry);
  const criticalAlerts = transformApiIntelligenceToAlerts(intelligenceItems);
  const trendingInsights = transformApiIntelligenceToInsights(intelligenceItems);
  const urgentActions = transformApiIntelligenceToRecommendations(intelligenceItems);
  
  // Calculate overall status from vitality scores
  const averageVitality = vitalityIntelligence.reduce((sum, v) => sum + v.score, 0) / vitalityIntelligence.length;
  const overallStatus: 'excellent' | 'good' | 'concerning' | 'critical' = 
    averageVitality >= 85 ? 'excellent' :
    averageVitality >= 70 ? 'good' :
    averageVitality >= 50 ? 'concerning' : 'critical';

  return {
    countryId: country.id,
    generatedAt: Date.now(),
    nextUpdate: Date.now() + (30 * 60 * 1000), // 30 minutes
    criticalAlerts,
    urgentActions,
    vitalityIntelligence,
    trendingInsights,
    forwardIntelligence: {
      predictions: generatePredictions(country, vitalityIntelligence),
      opportunities: transformOpportunities(intelligenceItems.filter(i => i.type === 'opportunity')),
      risks: transformRisks(intelligenceItems.filter(i => i.severity === 'high' || i.severity === 'critical')),
      competitiveIntelligence: generateCompetitiveIntelligence(country, vitalityIntelligence)
    },
    overallStatus,
    confidenceLevel: Math.round(intelligenceItems.reduce((sum, item) => sum + item.confidence, 0.8) / Math.max(intelligenceItems.length, 1) * 100),
    lastMajorChange: {
      date: country.lastCalculated,
      description: 'Economic vitality recalculated',
      impact: 'Economic metrics updated based on latest data'
    },
    viewMode: 'executive' as const,
    priorityThreshold: 'high' as const
  };
}

// Helper functions
function calculateTrend(current?: number, previous?: number): 'up' | 'down' | 'stable' {
  if (!current || !previous) return 'stable';
  const change = current - previous;
  if (Math.abs(change) < 0.01) return 'stable';
  return change > 0 ? 'up' : 'down';
}

function getVitalityStatus(score: number): 'excellent' | 'good' | 'concerning' | 'critical' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'concerning';
  return 'critical';
}

function getMetricStatus(value: number, type: 'gdp'): 'excellent' | 'good' | 'concerning' | 'critical' {
  switch (type) {
    case 'gdp':
      if (value >= 65000) return 'excellent';
      if (value >= 35000) return 'good';
      if (value >= 15000) return 'concerning';
      return 'critical';
    default:
      return 'good';
  }
}

function formatLargeNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function mapSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): 'critical' | 'warning' | 'info' | 'success' {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'success';
  }
}

function mapPriority(priority: number): 'critical' | 'high' | 'medium' | 'low' {
  if (priority >= 8) return 'critical';
  if (priority >= 6) return 'high';
  if (priority >= 4) return 'medium';
  return 'low';
}

function mapSeverityToUrgency(severity: 'low' | 'medium' | 'high' | 'critical'): 'urgent' | 'important' | 'routine' | 'future' {
  switch (severity) {
    case 'critical': return 'urgent';
    case 'high': return 'important';
    case 'medium': return 'routine';
    case 'low': return 'future';
  }
}

function getIconForCategory(category: string) {
  switch (category) {
    case 'economic': return DollarSign;
    case 'population': return Users;
    case 'governance': return Building;
    case 'diplomatic': return Globe;
    default: return Activity;
  }
}

/**
 * Generate predictions based on vitality trends
 */
function generatePredictions(country: ApiCountryData, vitalityIntelligence: VitalityIntelligence[]): any[] {
  const predictions = [];

  for (const vitality of vitalityIntelligence) {
    if (vitality.forecast.shortTerm.confidence > 60) {
      predictions.push({
        id: `prediction-${vitality.area}-${Date.now()}`,
        category: vitality.area,
        metric: `${vitality.area} Score`,
        currentValue: vitality.score,
        predictedValue: vitality.forecast.shortTerm.projected,
        timeframe: '30 days',
        confidence: vitality.forecast.shortTerm.confidence,
        factors: vitality.forecast.shortTerm.factors,
        trend: vitality.trend
      });
    }
  }

  // Add GDP growth prediction
  const gdpGrowth = country.realGDPGrowthRate;
  if (gdpGrowth !== undefined) {
    predictions.push({
      id: `prediction-gdp-growth-${Date.now()}`,
      category: 'economic',
      metric: 'GDP Growth Rate',
      currentValue: gdpGrowth * 100,
      predictedValue: gdpGrowth * 100 * (1 + country.economicVitality / 500), // Slight improvement based on vitality
      timeframe: '1 quarter',
      confidence: 75,
      factors: ['Economic vitality', 'Global trends', 'Policy effectiveness'],
      trend: gdpGrowth > 0 ? 'up' : 'down'
    });
  }

  return predictions;
}

/**
 * Transform opportunity intelligence items
 */
function transformOpportunities(opportunityItems: ApiIntelligenceItem[]): any[] {
  return opportunityItems.slice(0, 5).map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    potentialImpact: {
      magnitude: item.impact?.magnitude || 'medium',
      areas: item.impact?.areas || [item.category],
      timeframe: '3-6 months'
    },
    requirements: item.actions || ['Strategic planning', 'Resource allocation'],
    confidence: Math.round(item.confidence * 100),
    priority: item.priority || 5,
    expirationDate: item.timestamp + (30 * 24 * 60 * 60 * 1000) // 30 days
  }));
}

/**
 * Transform risk intelligence items
 */
function transformRisks(riskItems: ApiIntelligenceItem[]): any[] {
  return riskItems.slice(0, 5).map(item => ({
    id: item.id,
    type: item.category,
    severity: item.severity,
    title: item.title,
    description: item.description,
    probability: item.confidence,
    impact: item.impact || {
      magnitude: 'medium',
      areas: [item.category]
    },
    mitigation: item.actions || ['Monitor situation', 'Prepare contingency plans'],
    timeline: item.severity === 'critical' ? 'immediate' : 'short-term',
    affectedRegions: item.affectedRegions || [],
    monitoringRequired: item.severity === 'high' || item.severity === 'critical'
  }));
}

/**
 * Generate competitive intelligence based on vitality scores
 */
function generateCompetitiveIntelligence(country: ApiCountryData, vitalityIntelligence: VitalityIntelligence[]): any[] {
  const competitiveData = [];

  // Economic competitiveness
  const economicVitality = vitalityIntelligence.find(v => v.area === 'economic');
  if (economicVitality) {
    competitiveData.push({
      id: `competitive-economic-${Date.now()}`,
      category: 'economic',
      metric: 'Economic Competitiveness',
      countryScore: economicVitality.score,
      regionalAverage: economicVitality.comparisons.regionalAverage,
      globalAverage: economicVitality.comparisons.peerAverage,
      rank: economicVitality.comparisons.rank,
      totalCountries: economicVitality.comparisons.totalCountries,
      strengths: economicVitality.score > 75 ? ['Strong GDP growth', 'Stable economic policies'] : [],
      weaknesses: economicVitality.score < 50 ? ['Low growth rate', 'Economic instability'] : [],
      opportunities: ['Market diversification', 'Trade partnerships'],
      threats: ['Global economic uncertainty', 'Regional competition']
    });
  }

  // Population competitiveness
  const populationVitality = vitalityIntelligence.find(v => v.area === 'population');
  if (populationVitality) {
    competitiveData.push({
      id: `competitive-population-${Date.now()}`,
      category: 'population',
      metric: 'Human Capital Index',
      countryScore: populationVitality.score,
      regionalAverage: populationVitality.comparisons.regionalAverage,
      globalAverage: populationVitality.comparisons.peerAverage,
      rank: populationVitality.comparisons.rank,
      totalCountries: populationVitality.comparisons.totalCountries,
      strengths: populationVitality.score > 70 ? ['Growing population', 'Youth demographic'] : [],
      weaknesses: populationVitality.score < 50 ? ['Aging population', 'Brain drain'] : [],
      opportunities: ['Education investment', 'Skills development'],
      threats: ['Demographic transition', 'Migration challenges']
    });
  }

  return competitiveData;
}

/**
 * Calculate peer average for a specific metric
 */
function calculatePeerAverage(country: ApiCountryData, metric: 'economic' | 'population' | 'diplomatic' | 'governance'): number {
  // In production, this would fetch from actual peer country data
  // For now, return realistic averages based on the metric
  const baseAverages = {
    economic: 65,
    population: 70,
    diplomatic: 65,
    governance: 68
  };

  // Adjust based on country tier
  const tierAdjustment = country.economicTier === 'developed' ? 10 :
                         country.economicTier === 'emerging' ? 5 : 0;

  return Math.min(100, baseAverages[metric] + tierAdjustment);
}

/**
 * Calculate regional average for a specific metric
 */
function calculateRegionalAverage(country: ApiCountryData, metric: 'economic' | 'population' | 'diplomatic' | 'governance'): number {
  // In production, this would fetch from actual regional data
  // For now, return realistic regional averages
  const regionalAverages = {
    economic: 70,
    population: 75,
    diplomatic: 70,
    governance: 72
  };

  // Adjust based on region if available
  const regionAdjustment = country.region === 'North America' || country.region === 'Europe' ? 5 :
                           country.region === 'Asia' ? 3 : 0;

  return Math.min(100, regionalAverages[metric] + regionAdjustment);
}

/**
 * Calculate country rank based on vitality score
 */
function calculateCountryRank(score: number, metric: 'economic' | 'population' | 'diplomatic' | 'governance'): number {
  // Simple ranking algorithm based on score
  // In production, this would compare against actual country database
  const maxCountries = 180;

  // Higher scores get better (lower) rankings
  if (score >= 90) return Math.floor(maxCountries * 0.05) + 1; // Top 5%
  if (score >= 80) return Math.floor(maxCountries * 0.15) + 1; // Top 15%
  if (score >= 70) return Math.floor(maxCountries * 0.30) + 1; // Top 30%
  if (score >= 60) return Math.floor(maxCountries * 0.50) + 1; // Top 50%
  if (score >= 50) return Math.floor(maxCountries * 0.70) + 1; // Top 70%
  return Math.floor(maxCountries * 0.85) + 1; // Lower 30%
}