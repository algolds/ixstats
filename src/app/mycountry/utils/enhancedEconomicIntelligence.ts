// Enhanced Economic Intelligence Integration
// Transforms enhanced economic analysis into intelligence system format

import { getIntelligenceEconomicData, getQuickEconomicHealth } from '~/lib/enhanced-economic-service';
import type { CountryStats, EconomyData, HistoricalDataPoint } from '~/types/ixstats';
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
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      timestamp: alert.timestamp,
      category: alert.category,
      affectedSystems: ['Economic'],
      estimatedImpact: alert.severity === 'critical' ? 'High' : 'Medium',
      recommendedActions: [`Address ${alert.title.toLowerCase()}`],
      relatedMetrics: []
    }));

    // Transform trending insights
    const trendingInsights: TrendingInsight[] = executiveIntelligence.trendingInsights.map(insight => ({
      id: insight.id,
      title: insight.title,
      insight: insight.insight,
      trend: insight.trend,
      impact: insight.impact,
      timeframe: '30 days',
      significance: insight.impact === 'high' ? 'critical' as const : 'moderate' as const,
      context: {
        dataPoints: 1,
        confidence: insight.confidence,
        lastUpdated: new Date(),
        sources: ['Enhanced Economic Analysis']
      }
    }));

    // Transform actionable recommendations  
    const urgentActions: ActionableRecommendation[] = executiveIntelligence.actionableRecommendations.map(rec => ({
      id: `action_${rec.area.toLowerCase()}_${Date.now()}`,
      title: `${rec.area} Initiative`,
      description: rec.action,
      urgency: rec.impact === 'high' ? 'urgent' as const : rec.impact === 'medium' ? 'important' as const : 'routine' as const,
      category: rec.area,
      estimatedDuration: rec.timeframe === 'immediate' ? '1-3 months' : 
                        rec.timeframe === 'short_term' ? '3-6 months' :
                        rec.timeframe === 'medium_term' ? '6-12 months' : '1-2 years',
      estimatedBenefit: rec.impact === 'high' ? 'Significant improvement' : 'Moderate improvement',
      successProbability: rec.impact === 'high' ? 75 : 60,
      resourcesRequired: ['Policy coordination', 'Budget allocation'],
      risks: ['Implementation challenges', 'Political resistance']
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
        direction: healthCheck.trend === 'Improving' ? 'positive' as const : 'neutral' as const
      },
      keyMetrics: [
        {
          label: 'Overall Grade',
          value: healthCheck.overallGrade,
          unit: '',
          description: 'Economic health grade'
        },
        {
          label: 'Growth Status',
          value: healthCheck.healthIndicators.growth,
          unit: '',
          description: 'Economic growth momentum'
        }
      ],
      criticalAlerts: criticalAlerts,
      lastUpdated: new Date()
    }];

    return {
      overallStatus: healthCheck.status.toLowerCase() as any,
      confidenceLevel: 85,
      lastAnalysisTime: new Date(),
      criticalAlerts,
      trendingInsights,
      urgentActions,
      vitalityIntelligence,
      executiveSummary: {
        keyHighlights: [
          `Economic Health Grade: ${healthCheck.overallGrade}`,
          `Overall Status: ${healthCheck.status}`,
          healthCheck.keyMessage
        ],
        majorConcerns: criticalAlerts.map(alert => alert.title).slice(0, 3),
        emergingOpportunities: ['Economic modernization', 'Growth acceleration'],
        riskLevel: healthCheck.quickStats.riskLevel.toLowerCase() as any,
        nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }
    };

  } catch (error) {
    console.error('Failed to transform economic data to executive intelligence:', error);
    
    // Return fallback intelligence
    return {
      overallStatus: 'unknown',
      confidenceLevel: 0,
      lastAnalysisTime: new Date(),
      criticalAlerts: [],
      trendingInsights: [],
      urgentActions: [],
      vitalityIntelligence: [],
      executiveSummary: {
        keyHighlights: ['Enhanced economic analysis unavailable'],
        majorConcerns: ['Analysis system error'],
        emergingOpportunities: [],
        riskLevel: 'unknown',
        nextReviewDate: new Date()
      }
    };
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
        direction: countryStats.adjustedGdpGrowth > 0 ? 'positive' : 'negative'
      },
      keyMetrics: [
        {
          label: 'GDP per Capita',
          value: countryStats.currentGdpPerCapita.toLocaleString(),
          unit: 'USD',
          description: 'Economic output per person'
        },
        {
          label: 'Growth Rate',
          value: (countryStats.adjustedGdpGrowth * 100).toFixed(1),
          unit: '%',
          description: 'Annual economic growth'
        },
        {
          label: 'Unemployment',
          value: economyData.labor.unemploymentRate.toFixed(1),
          unit: '%', 
          description: 'Labor market health'
        },
        {
          label: 'Economic Health',
          value: healthCheck.overallGrade,
          unit: '',
          description: 'Overall assessment grade'
        }
      ],
      criticalAlerts: intelligenceData.executiveIntelligence.criticalAlerts,
      lastUpdated: new Date()
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
        name: 'Overall Economic Rating',
        value: executiveIntelligence.overallRating.score,
        unit: '/100',
        trend: 'stable',
        status: executiveIntelligence.overallRating.score >= 70 ? 'good' : 'concerning',
        description: executiveIntelligence.overallRating.description
      }
    ];

    // Add area-specific metrics
    switch (area) {
      case 'resilience':
        baseMetrics.push({
          id: 'fiscal_stability',
          name: 'Fiscal Stability',
          value: economyData.fiscal.totalDebtGDPRatio,
          unit: '%',
          trend: economyData.fiscal.totalDebtGDPRatio > 80 ? 'down' : 'stable',
          status: economyData.fiscal.totalDebtGDPRatio > 100 ? 'concerning' : 'good',
          description: 'Government debt sustainability'
        });
        break;
        
      case 'productivity':
        baseMetrics.push({
          id: 'gdp_per_capita',
          name: 'GDP per Capita',
          value: countryStats.currentGdpPerCapita,
          unit: 'USD',
          trend: countryStats.adjustedGdpGrowth > 0 ? 'up' : 'down',
          status: countryStats.currentGdpPerCapita > 30000 ? 'excellent' : 'good',
          description: 'Economic productivity per person'
        });
        break;
        
      case 'wellbeing':
        baseMetrics.push({
          id: 'unemployment_rate',
          name: 'Unemployment Rate',
          value: economyData.labor.unemploymentRate,
          unit: '%',
          trend: economyData.labor.unemploymentRate > 8 ? 'concerning' as any : 'stable',
          status: economyData.labor.unemploymentRate > 12 ? 'concerning' : 'good',
          description: 'Labor market health indicator'
        });
        break;
        
      case 'complexity':
        baseMetrics.push({
          id: 'economic_tier',
          name: 'Economic Development',
          value: countryStats.economicTier,
          unit: '',
          trend: 'stable',
          status: ['Strong', 'Very Strong', 'Extravagant'].includes(countryStats.economicTier) ? 'excellent' : 'good',
          description: 'Economic development classification'
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