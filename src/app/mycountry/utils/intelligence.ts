// Intelligence utility functions for MyCountry system
// Optimized for performance and type safety

import { TrendingUp, BarChart3 } from 'lucide-react';
import type {
  TrendDirection,
  DataPriority,
  IntelligenceMetric,
  VitalityIntelligence,
  ActionableRecommendation,
  CriticalAlert,
  TrendingInsight,
  ForwardIntelligence,
  ExecutiveIntelligence,
  ActionUrgency,
  AlertSeverity
} from '../types/intelligence';

// Efficient trend calculation with momentum consideration
export const calculateTrend = (current: number, previous: number, threshold = 0.02): TrendDirection => {
  const change = (current - previous) / Math.max(previous, 0.01);
  if (Math.abs(change) < threshold) return 'stable';
  return change > 0 ? 'up' : 'down';
};

// Smart priority determination based on multiple factors
export const determinePriority = (
  score: number, 
  trend: TrendDirection, 
  category: string,
  hasAlerts = false
): DataPriority => {
  // Critical thresholds by category
  const criticalThresholds = {
    economic: 30,
    population: 25,
    diplomatic: 35,
    governance: 40
  } as const;
  
  const categoryThreshold = criticalThresholds[category as keyof typeof criticalThresholds] ?? 30;
  
  if (hasAlerts || score < categoryThreshold) return 'critical';
  if (score < categoryThreshold + 20 || trend === 'down') return 'high';
  if (score < categoryThreshold + 40 || trend === 'stable') return 'medium';
  return 'low';
};

// Optimized metric formatting with internationalization support
export const formatMetric = (value: number, unit?: string): string => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  
  const formatMap = {
    'percentage': (v: number) => `${v.toFixed(1)}%`,
    'currency': (v: number) => `$${(v / 1000000).toFixed(1)}M`,
    'population': (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`,
    'rate': (v: number) => `${(v * 100).toFixed(1)}%`,
    'score': (v: number) => `${Math.round(v)}/100`,
    'default': (v: number) => v.toLocaleString()
  };
  
  const formatter = formatMap[unit as keyof typeof formatMap] ?? formatMap.default;
  return formatter(value);
};

// Generate contextual recommendations based on current state
export const generateRecommendations = (vitality: VitalityIntelligence): ActionableRecommendation[] => {
  const recommendations: ActionableRecommendation[] = [];
  const { area, score, trend, keyMetrics } = vitality;
  
  // Economic recommendations
  if (area === 'economic') {
    if (score < 40) {
      recommendations.push({
        id: `eco-crisis-${Date.now()}`,
        title: 'Emergency Economic Stimulus',
        description: 'Implement immediate measures to stabilize the economy',
        category: 'economic',
        urgency: 'urgent',
        difficulty: 'complex',
        estimatedDuration: '3-6 months',
        estimatedCost: 'High',
        estimatedBenefit: '+15-25 economic score',
        prerequisites: ['Budget approval', 'Legislative support'],
        risks: ['Inflation risk', 'Debt increase'],
        successProbability: 70,
        impact: { economic: 20, social: 5, governance: -5 }
      });
    } else if (trend === 'down' && score < 70) {
      recommendations.push({
        id: `eco-optimize-${Date.now()}`,
        title: 'Economic Policy Optimization',
        description: 'Review and adjust current economic policies for better performance',
        category: 'economic',
        urgency: 'important',
        difficulty: 'moderate',
        estimatedDuration: '2-4 months',
        estimatedCost: 'Medium',
        estimatedBenefit: '+8-12 economic score',
        prerequisites: ['Economic analysis', 'Stakeholder consultation'],
        risks: ['Short-term disruption'],
        successProbability: 85,
        impact: { economic: 10, social: 2 }
      });
    }
  }
  
  // Population recommendations
  if (area === 'population') {
    if (score < 50) {
      recommendations.push({
        id: `pop-welfare-${Date.now()}`,
        title: 'Enhanced Social Welfare Program',
        description: 'Expand healthcare, education, and social services',
        category: 'population',
        urgency: 'important',
        difficulty: 'complex',
        estimatedDuration: '6-12 months',
        estimatedCost: 'High',
        estimatedBenefit: '+10-20 population score',
        prerequisites: ['Budget allocation', 'Infrastructure assessment'],
        risks: ['Budget strain', 'Implementation challenges'],
        successProbability: 75,
        impact: { social: 18, economic: -3, governance: 5 }
      });
    }
  }
  
  // Diplomatic recommendations
  if (area === 'diplomatic') {
    if (score < 60 || trend === 'down') {
      recommendations.push({
        id: `dip-engage-${Date.now()}`,
        title: 'Strategic Diplomatic Engagement',
        description: 'Strengthen relationships with key allies and trading partners',
        category: 'diplomatic',
        urgency: 'important',
        difficulty: 'moderate',
        estimatedDuration: '3-6 months',
        estimatedCost: 'Low',
        estimatedBenefit: '+5-15 diplomatic score',
        prerequisites: ['Diplomatic assessment', 'Foreign ministry coordination'],
        risks: ['Regional tensions', 'Resource allocation'],
        successProbability: 80,
        impact: { diplomatic: 12, economic: 3 }
      });
    }
  }
  
  // Governance recommendations
  if (area === 'governance') {
    if (score < 55) {
      recommendations.push({
        id: `gov-reform-${Date.now()}`,
        title: 'Governance Efficiency Reform',
        description: 'Streamline government processes and improve transparency',
        category: 'governance',
        urgency: 'important',
        difficulty: 'complex',
        estimatedDuration: '4-8 months',
        estimatedCost: 'Medium',
        estimatedBenefit: '+8-15 governance score',
        prerequisites: ['Legislative approval', 'Administrative restructuring'],
        risks: ['Political resistance', 'Transition disruption'],
        successProbability: 65,
        impact: { governance: 12, social: 5, economic: 3 }
      });
    }
  }
  
  return recommendations.slice(0, 3); // Limit to top 3 recommendations
};

// Predictive modeling for future performance
export const predictFuture = (
  historical: number[], 
  factors: string[],
  timeHorizon: 'short' | 'long' = 'short'
): { value: number; confidence: number } => {
  if (historical.length < 2) {
    return { value: historical[0] ?? 50, confidence: 20 };
  }
  
  // Simple linear regression for trend prediction
  const n = historical.length;
  const xSum = ((n - 1) * n) / 2; // Sum of indices 0,1,2,...,n-1
  const ySum = historical.reduce((sum, val) => sum + val, 0);
  const xySum = historical.reduce((sum, val, i) => sum + i * val, 0);
  const xSquaredSum = ((n - 1) * n * (2 * n - 1)) / 6;
  
  const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
  const intercept = (ySum - slope * xSum) / n;
  
  // Project forward
  const periodsAhead = timeHorizon === 'short' ? 3 : 12;
  const predicted = intercept + slope * (n - 1 + periodsAhead);
  
  // Calculate confidence based on data stability and factor count
  const variance = historical.reduce((sum, val, i) => {
    const expected = intercept + slope * i;
    return sum + Math.pow(val - expected, 2);
  }, 0) / n;
  
  const baseConfidence = Math.max(20, 100 - variance * 2);
  const factorAdjustment = Math.min(20, factors.length * 5); // More factors = higher confidence
  const confidence = Math.min(95, baseConfidence + factorAdjustment);
  
  return {
    value: Math.max(0, Math.min(100, predicted)),
    confidence: Math.round(confidence)
  };
};

// Efficient percentile comparison
export const compareToPercentile = (value: number, allValues: number[]): number => {
  if (allValues.length === 0) return 50;
  
  const sorted = [...allValues].sort((a, b) => a - b);
  let rank = 0;
  
  for (const val of sorted) {
    if (val < value) rank++;
    else break;
  }
  
  return Math.round((rank / sorted.length) * 100);
};

// Generate critical alerts based on current state
export const generateCriticalAlerts = (
  vitality: VitalityIntelligence[],
  previousVitality?: VitalityIntelligence[]
): CriticalAlert[] => {
  const alerts: CriticalAlert[] = [];
  const now = Date.now();
  
  for (const current of vitality) {
    const previous = previousVitality?.find(p => p.area === current.area);
    
    // Critical score alert
    if (current.score < 30) {
      alerts.push({
        id: `critical-${current.area}-${now}`,
        title: `Critical ${current.area.charAt(0).toUpperCase() + current.area.slice(1)} Alert`,
        message: `${current.area} score has fallen to ${current.score}/100, requiring immediate attention`,
        severity: 'critical',
        category: current.area,
        priority: 'critical',
        actionRequired: true,
        timeframe: 'immediate',
        estimatedImpact: {
          magnitude: 'severe',
          areas: [current.area, 'overall stability']
        },
        recommendedActions: current.recommendations.slice(0, 2).map(r => r.title),
        createdAt: now,
        expiresAt: now + (7 * 24 * 60 * 60 * 1000) // 7 days
      });
    }
    
    // Rapid decline alert
    if (previous && (current.score - previous.score) < -10) {
      alerts.push({
        id: `decline-${current.area}-${now}`,
        title: `Rapid ${current.area.charAt(0).toUpperCase() + current.area.slice(1)} Decline`,
        message: `${current.area} score dropped ${Math.abs(current.score - previous.score).toFixed(1)} points`,
        severity: 'warning',
        category: current.area,
        priority: 'high',
        actionRequired: true,
        timeframe: 'short',
        estimatedImpact: {
          magnitude: 'high',
          areas: [current.area]
        },
        recommendedActions: ['Investigate causes', 'Implement corrective measures'],
        createdAt: now,
        expiresAt: now + (3 * 24 * 60 * 60 * 1000) // 3 days
      });
    }
  }
  
  return alerts.slice(0, 5); // Limit to top 5 most critical
};

// Generate trending insights based on performance changes
export const generateTrendingInsights = (
  vitality: VitalityIntelligence[],
  previousVitality?: VitalityIntelligence[]
): TrendingInsight[] => {
  const insights: TrendingInsight[] = [];
  
  for (const current of vitality) {
    const previous = previousVitality?.find(p => p.area === current.area);
    
    if (!previous) continue;
    
    const scoreChange = current.score - previous.score;
    const rankChange = previous.comparisons.rank - current.comparisons.rank; // Positive = improvement
    
    // Significant improvement insight
    if (scoreChange > 5 || rankChange > 2) {
      insights.push({
        id: `improvement-${current.area}-${Date.now()}`,
        title: `${current.area.charAt(0).toUpperCase() + current.area.slice(1)} Performance Rising`,
        description: `Strong improvement in ${current.area} metrics with ${scoreChange.toFixed(1)} point increase`,
        category: 'performance',
        icon: TrendingUp,
        trend: 'up',
        significance: scoreChange > 10 ? 'major' : 'moderate',
        metrics: current.keyMetrics.slice(0, 3),
        context: {
          comparison: 'historical',
          timeframe: current.change.period,
          confidence: 85
        },
        actionable: true,
        nextReview: Date.now() + (30 * 24 * 60 * 60 * 1000)
      });
    }
    
    // Ranking movement insight
    if (Math.abs(rankChange) > 1) {
      insights.push({
        id: `ranking-${current.area}-${Date.now()}`,
        title: `Global Ranking ${rankChange > 0 ? 'Improvement' : 'Decline'}`,
        description: `Moved ${Math.abs(rankChange)} positions in global ${current.area} rankings`,
        category: 'ranking',
        icon: BarChart3,
        trend: rankChange > 0 ? 'up' : 'down',
        significance: Math.abs(rankChange) > 5 ? 'major' : 'moderate',
        metrics: current.keyMetrics[0] ? [current.keyMetrics[0]] : [],
        context: {
          comparison: 'peer',
          timeframe: 'recent',
          confidence: 90
        },
        actionable: false
      });
    }
  }
  
  return insights.slice(0, 4);
};

// Create complete executive intelligence summary
export const createExecutiveIntelligence = (
  countryId: string,
  vitality: VitalityIntelligence[],
  previousVitality?: VitalityIntelligence[]
): ExecutiveIntelligence => {
  const criticalAlerts = generateCriticalAlerts(vitality, previousVitality);
  const trendingInsights = generateTrendingInsights(vitality, previousVitality);
  
  // Ensure all items have valid IDs to prevent React key issues
  criticalAlerts.forEach((alert, index) => {
    if (!alert.id || !alert.id.trim()) {
      alert.id = `alert-fallback-${Date.now()}-${index}`;
    }
  });
  
  trendingInsights.forEach((insight, index) => {
    if (!insight.id || !insight.id.trim()) {
      insight.id = `insight-fallback-${Date.now()}-${index}`;
    }
  });
  
  // Calculate overall status
  const averageScore = vitality.reduce((sum, v) => sum + v.score, 0) / vitality.length;
  const criticalCount = vitality.filter(v => v.score < 40).length;
  
  let overallStatus: 'excellent' | 'good' | 'concerning' | 'critical';
  if (criticalCount > 0 || averageScore < 40) overallStatus = 'critical';
  else if (averageScore < 60) overallStatus = 'concerning';
  else if (averageScore < 80) overallStatus = 'good';
  else overallStatus = 'excellent';
  
  const urgentActions = vitality.flatMap(v => v.recommendations.filter(r => r.urgency === 'urgent')).slice(0, 3);
  
  // Ensure urgent actions have valid IDs
  urgentActions.forEach((action, index) => {
    if (!action.id || !action.id.trim()) {
      action.id = `urgent-action-fallback-${Date.now()}-${index}`;
    }
  });

  return {
    countryId,
    generatedAt: Date.now(),
    nextUpdate: Date.now() + (60 * 60 * 1000), // 1 hour
    
    criticalAlerts,
    urgentActions,
    
    vitalityIntelligence: vitality,
    trendingInsights,
    
    forwardIntelligence: {
      predictions: [],
      opportunities: [],
      risks: [],
      competitiveIntelligence: []
    },
    
    overallStatus,
    confidenceLevel: Math.round(vitality.reduce((sum, v) => sum + v.forecast.shortTerm.confidence, 0) / vitality.length),
    
    lastMajorChange: {
      date: Date.now() - (24 * 60 * 60 * 1000),
      description: 'Economic policy adjustment',
      impact: 'Positive trend in economic metrics'
    },
    
    viewMode: 'executive',
    priorityThreshold: 'high'
  };
};