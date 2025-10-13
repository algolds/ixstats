// Enhanced Economic Intelligence Integration
// Transforms enhanced economic analysis into intelligence system format

import { getIntelligenceEconomicData, getQuickEconomicHealth } from '~/lib/enhanced-economic-service';
import type { CountryStats, HistoricalDataPoint } from '~/types/ixstats';
import type { EconomyData } from '~/types/economics';
import type { 
  ExecutiveIntelligence, 
  VitalityIntelligence, 
  CriticalAlert, 
  TrendingInsight,
  ActionableRecommendation,
  IntelligenceMetric
} from '../types/intelligence';

/**
 * Transform enhanced economic data into executive intelligence format
 */
export function transformToExecutiveIntelligence(
  countryStats: CountryStats,
  economyData: EconomyData,
  historicalData: HistoricalDataPoint[] = []
): ExecutiveIntelligence {
  try {
    const healthCheck = getQuickEconomicHealth(countryStats, economyData);
    const intelligenceData = getIntelligenceEconomicData(countryStats, economyData);
    const { executiveIntelligence } = intelligenceData;

    // Transform critical alerts
    const criticalAlerts: CriticalAlert[] = executiveIntelligence.criticalAlerts.map(alert => ({
      id: alert.id,
      title: alert.title,
      message: alert.description,
      severity: alert.severity as any,
      category: alert.category as any,
      priority: 'high' as any,
      actionRequired: alert.severity === 'critical',
      timeframe: 'immediate' as any,
      estimatedImpact: {
        magnitude: alert.severity === 'critical' ? 'high' : 'medium' as any,
        areas: ['Economic']
      },
      recommendedActions: [`Address ${alert.title.toLowerCase()}`],
      createdAt: Date.now()
    }));

    // Transform trending insights
    const trendingInsights: TrendingInsight[] = executiveIntelligence.trendingInsights.map(insight => ({
      id: insight.id,
      title: insight.title,
      description: insight.insight,
      category: 'performance' as any,
      icon: require('lucide-react').TrendingUp,
      trend: insight.trend as any,
      significance: (insight.impact as string) === 'high' ? 'major' as const : 'moderate' as const,
      metrics: [],
      context: {
        comparison: 'historical' as any,
        timeframe: '30 days',
        confidence: insight.confidence || 85
      },
      actionable: true,
      nextReview: Date.now() + 86400000
    }));

    // Transform actionable recommendations  
    const urgentActions: ActionableRecommendation[] = executiveIntelligence.actionableRecommendations.map(rec => ({
      id: `action_${rec.area.toLowerCase()}_${Date.now()}`,
      title: `${rec.area} Initiative`,
      description: rec.action,
      category: rec.area as any,
      urgency: rec.impact === 'high' ? 'urgent' as const : rec.impact === 'medium' ? 'important' as const : 'routine' as const,
      difficulty: rec.impact === 'high' ? 'complex' as const : 'moderate' as const,
      estimatedDuration: rec.timeframe === 'immediate' ? '1-3 months' : 
                        rec.timeframe === 'short_term' ? '3-6 months' :
                        rec.timeframe === 'medium_term' ? '6-12 months' : '1-2 years',
      estimatedCost: rec.impact === 'high' ? 'High' : 'Medium',
      estimatedBenefit: rec.impact === 'high' ? 'Significant improvement' : 'Moderate improvement',
      prerequisites: ['Policy coordination', 'Budget allocation'],
      risks: ['Implementation challenges', 'Political resistance'],
      successProbability: rec.impact === 'high' ? 75 : 60,
      impact: {
        economic: rec.area === 'economic' ? 10 : 5,
        social: rec.area === 'social' ? 10 : 0,
        diplomatic: rec.area === 'diplomatic' ? 10 : 0,
        governance: rec.area === 'governance' ? 10 : 0
      }
    }));

    // Create vitality intelligence from health check
    const vitalityIntelligence: VitalityIntelligence[] = [{
      area: 'economic',
      score: healthCheck.score,
      status: healthCheck.status.toLowerCase() as any,
      trend: healthCheck.trend === 'Improving' ? 'up' as const : 
             healthCheck.trend === 'Declining' ? 'down' as const : 'stable' as const,
      change: {
        value: Math.random() * 5 - 2.5, // Placeholder trend change
        period: '30d',
        reason: healthCheck.trend === 'Improving' ? 'Economic improvement' : 'Stable conditions'
      },
      keyMetrics: [
        {
          id: 'overall-grade',
          label: 'Overall Grade',
          value: healthCheck.overallGrade,
          unit: '',
          trend: 'stable' as any,
          changeValue: 0,
          changePercent: 0,
          changePeriod: '30d',
          status: 'good' as any
        },
        {
          id: 'growth-status',
          label: 'Growth Status',
          value: healthCheck.healthIndicators.growth,
          unit: '',
          trend: 'stable' as any,
          changeValue: 0,
          changePercent: 0,
          changePeriod: '30d',
          status: 'good' as any
        }
      ],
      criticalAlerts: criticalAlerts,
      recommendations: [],
      forecast: {
        shortTerm: { projected: healthCheck.score, confidence: 85, factors: ['Economic stability'] },
        longTerm: { projected: healthCheck.score + 5, confidence: 70, factors: ['Economic reforms'] }
      },
      comparisons: {
        peerAverage: healthCheck.score,
        regionalAverage: healthCheck.score,
        historicalBest: healthCheck.score + 10,
        rank: 1,
        totalCountries: 1
      }
    }];

    return {
      overallStatus: (healthCheck.status || 'good').toLowerCase() as any,
      confidenceLevel: 85,
      criticalAlerts,
      trendingInsights,
      urgentActions,
      vitalityIntelligence,
      // executiveSummary removed as it's not part of ExecutiveIntelligence interface
    } as any;

  } catch (error) {
    console.error('Failed to transform economic data to executive intelligence:', error);
    
    // Return fallback intelligence
    return {
      overallStatus: 'concerning' as any,
      confidenceLevel: 0,
      criticalAlerts: [],
      trendingInsights: [],
      urgentActions: [],
      vitalityIntelligence: [],
      // executiveSummary removed as it's not part of ExecutiveIntelligence interface
    } as any;
  }
}

/**
 * Transform enhanced economic data into vitality intelligence format  
 */
export function transformToVitalityIntelligence(
  countryStats: CountryStats,
  economyData: EconomyData
): VitalityIntelligence[] {
  try {
    const healthCheck = getQuickEconomicHealth(countryStats, economyData);
    const intelligenceData = getIntelligenceEconomicData(countryStats, economyData);

    const economicVitality: VitalityIntelligence = {
      area: 'economic',
      score: healthCheck.score,
      status: healthCheck.status.toLowerCase() as any,
      trend: healthCheck.trend === 'Improving' ? 'up' : 
             healthCheck.trend === 'Declining' ? 'down' : 'stable',
      change: {
        value: countryStats.adjustedGdpGrowth * 100,
        period: '1y',
        reason: countryStats.adjustedGdpGrowth > 0 ? 'Economic growth' : 'Economic contraction'
      },
      keyMetrics: [
        {
          id: 'gdp-per-capita',
          label: 'GDP per Capita',
          value: countryStats.currentGdpPerCapita.toLocaleString(),
          unit: 'USD',
          trend: 'stable' as any,
          changeValue: 0,
          changePercent: 0,
          changePeriod: '1y',
          status: 'good' as any
        },
        {
          id: 'growth-rate',
          label: 'Growth Rate',
          value: (countryStats.adjustedGdpGrowth * 100).toFixed(1),
          unit: '%',
          trend: countryStats.adjustedGdpGrowth > 0 ? 'up' as any : 'down' as any,
          changeValue: countryStats.adjustedGdpGrowth * 100,
          changePercent: 0,
          changePeriod: '1y',
          status: countryStats.adjustedGdpGrowth > 0 ? 'good' as any : 'concerning' as any
        },
        {
          id: 'unemployment',
          label: 'Unemployment',
          value: Number(economyData.labor.unemploymentRate ?? 0).toFixed(1),
          unit: '%',
          trend: 'stable' as any,
          changeValue: 0,
          changePercent: 0,
          changePeriod: '1y',
          status: economyData.labor.unemploymentRate < 6 ? 'good' as any : 'concerning' as any
        },
        {
          id: 'economic-health',
          label: 'Economic Health',
          value: healthCheck.overallGrade,
          unit: '',
          trend: 'stable' as any,
          changeValue: 0,
          changePercent: 0,
          changePeriod: '1y',
          status: 'good' as any
        }
      ],
      criticalAlerts: intelligenceData.executiveIntelligence.criticalAlerts as any,
      recommendations: [],
      forecast: {
        shortTerm: { projected: healthCheck.score, confidence: 85, factors: ['Economic analysis'] },
        longTerm: { projected: healthCheck.score + 5, confidence: 70, factors: ['Economic growth'] }
      },
      comparisons: {
        peerAverage: healthCheck.score,
        regionalAverage: healthCheck.score,
        historicalBest: healthCheck.score + 10,
        rank: 1,
        totalCountries: 1
      }
    };

    return [economicVitality];

  } catch (error) {
    console.error('Failed to transform vitality intelligence:', error);
    return [];
  }
}

/**
 * Generate intelligence metrics for specific economic areas
 */
export function generateEconomicIntelligenceMetrics(
  countryStats: CountryStats,
  economyData: EconomyData,
  area: 'resilience' | 'productivity' | 'wellbeing' | 'complexity' = 'resilience'
): IntelligenceMetric[] {
  try {
    const intelligenceData = getIntelligenceEconomicData(countryStats, economyData);
    const executiveIntelligence = intelligenceData.executiveIntelligence;

    const baseMetrics: IntelligenceMetric[] = [
      {
        id: 'overall_rating',
        label: 'Overall Economic Rating',
        value: executiveIntelligence.overallRating.score,
        unit: '/100',
        trend: 'stable',
        status: executiveIntelligence.overallRating.score >= 70 ? 'good' : 'concerning',
        changeValue: 0,
        changePercent: 0,
        changePeriod: '1y'
      }
    ];

    // Add area-specific metrics
    switch (area) {
      case 'resilience':
        baseMetrics.push({
          id: 'fiscal_stability',
          label: 'Fiscal Stability',
          value: economyData.fiscal.totalDebtGDPRatio,
          unit: '%',
          trend: economyData.fiscal.totalDebtGDPRatio > 80 ? 'down' : 'stable',
          status: economyData.fiscal.totalDebtGDPRatio > 100 ? 'concerning' : 'good',
          changeValue: 0,
          changePercent: 0,
          changePeriod: '1y'
        });
        break;
        
      case 'productivity':
        baseMetrics.push({
          id: 'gdp_per_capita',
          label: 'GDP per Capita',
          value: countryStats.currentGdpPerCapita,
          unit: 'USD',
          trend: countryStats.adjustedGdpGrowth > 0 ? 'up' : 'down',
          status: countryStats.currentGdpPerCapita > 30000 ? 'excellent' : 'good',
          changeValue: 0,
          changePercent: 0,
          changePeriod: '1y'
        });
        break;
        
      case 'wellbeing':
        baseMetrics.push({
          id: 'unemployment_rate',
          label: 'Unemployment Rate',
          value: economyData.labor.unemploymentRate,
          unit: '%',
          trend: economyData.labor.unemploymentRate > 8 ? 'concerning' as any : 'stable',
          status: economyData.labor.unemploymentRate > 12 ? 'concerning' : 'good',
          changeValue: 0,
          changePercent: 0,
          changePeriod: '1y'
        });
        break;
        
      case 'complexity':
        baseMetrics.push({
          id: 'economic_tier',
          label: 'Economic Development',
          value: countryStats.economicTier,
          unit: '',
          trend: 'stable',
          status: ['Strong', 'Very Strong', 'Extravagant'].includes(countryStats.economicTier) ? 'excellent' : 'good',
          changeValue: 0,
          changePercent: 0,
          changePeriod: '1y'
        });
        break;
    }

    return baseMetrics;

  } catch (error) {
    console.error('Failed to generate intelligence metrics:', error);
    return [];
  }
}

/**
 * Check if enhanced economic intelligence is available for a country
 */
export function isEnhancedEconomicIntelligenceAvailable(
  countryStats?: CountryStats,
  economyData?: EconomyData
): boolean {
  return !!(countryStats && economyData && countryStats.currentGdpPerCapita > 0);
}

export default {
  transformToExecutiveIntelligence,
  transformToVitalityIntelligence,
  generateEconomicIntelligenceMetrics,
  isEnhancedEconomicIntelligenceAvailable
};