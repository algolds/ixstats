// Core types for the enhanced MyCountry intelligence system
// Designed for optimal performance and type safety

import type { LucideIcon } from "lucide-react";

// Import and re-export unified types for backward compatibility
import type { StandardPriority, StandardTrend, StandardTimeframe } from "~/types/base";

export type DataPriority = StandardPriority;
export type TrendDirection = StandardTrend;
export type TimeHorizon = StandardTimeframe;
export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type ActionUrgency = "urgent" | "important" | "routine" | "future";

// Enhanced metric with context and trend analysis
export interface IntelligenceMetric {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  trend: TrendDirection;
  changeValue: number;
  changePercent: number;
  changePeriod: string;
  status: "excellent" | "good" | "concerning" | "critical";
  rank?: {
    global: number;
    regional: number;
    total: number;
  };
  target?: {
    value: number;
    achieved: boolean;
    timeToTarget?: string;
  };
}

// Critical alerts for immediate attention
export interface CriticalAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: "economic" | "population" | "diplomatic" | "governance" | "crisis";
  priority: DataPriority;
  actionRequired: boolean;
  timeframe: TimeHorizon;
  estimatedImpact: {
    magnitude: "low" | "medium" | "high" | "severe";
    areas: string[];
  };
  recommendedActions: string[];
  createdAt: number;
  expiresAt?: number;
}

// Trending insights for performance context
export interface TrendingInsight {
  id: string;
  title: string;
  description: string;
  category: "performance" | "ranking" | "opportunity" | "comparison";
  icon: LucideIcon;
  trend: TrendDirection;
  significance: "major" | "moderate" | "minor";
  metrics: IntelligenceMetric[];
  context: {
    comparison?: "peer" | "historical" | "target";
    timeframe: string;
    confidence: number; // 0-100
  };
  actionable: boolean;
  nextReview?: number;
}

// Actionable recommendations based on current state
export interface ActionableRecommendation {
  id: string;
  title: string;
  description: string;
  category: "economic" | "population" | "diplomatic" | "governance";
  urgency: ActionUrgency;
  difficulty: "easy" | "moderate" | "complex" | "major";
  estimatedDuration: string;
  estimatedCost: string;
  estimatedBenefit: string;
  prerequisites: string[];
  risks: string[];
  successProbability: number; // 0-100
  impact: {
    economic?: number;
    social?: number;
    diplomatic?: number;
    governance?: number;
  };
}

// Enhanced vitality score with contextual intelligence
export interface VitalityIntelligence {
  area: "economic" | "population" | "diplomatic" | "governance";
  score: number; // 0-100
  trend: TrendDirection;
  change: {
    value: number;
    period: string;
    reason: string;
  };
  status: "excellent" | "good" | "concerning" | "critical";
  keyMetrics: IntelligenceMetric[];
  criticalAlerts: CriticalAlert[];
  recommendations: ActionableRecommendation[];
  forecast: {
    shortTerm: {
      // 3 months
      projected: number;
      confidence: number;
      factors: string[];
    };
    longTerm: {
      // 1 year
      projected: number;
      confidence: number;
      factors: string[];
    };
  };
  comparisons: {
    peerAverage: number;
    regionalAverage: number;
    historicalBest: number;
    rank: number;
    totalCountries: number;
  };
}

// Forward-looking intelligence for strategic planning
export interface ForwardIntelligence {
  predictions: {
    id: string;
    title: string;
    description: string;
    category: "economic" | "population" | "diplomatic" | "governance";
    timeHorizon: TimeHorizon;
    probability: number; // 0-100
    impact: "positive" | "negative" | "neutral";
    magnitude: "low" | "medium" | "high";
    keyFactors: string[];
    mitigation?: ActionableRecommendation[];
  }[];

  opportunities: {
    id: string;
    title: string;
    description: string;
    category: "economic" | "population" | "diplomatic" | "governance";
    timeWindow: {
      start: number;
      end: number;
      optimal: number;
    };
    difficulty: "easy" | "moderate" | "complex";
    requirements: string[];
    expectedBenefit: string;
    successProbability: number;
  }[];

  risks: {
    id: string;
    title: string;
    description: string;
    category: "economic" | "population" | "diplomatic" | "governance";
    probability: number; // 0-100
    impact: "low" | "medium" | "high" | "severe";
    timeframe: TimeHorizon;
    earlyWarnings: string[];
    mitigation: ActionableRecommendation[];
  }[];

  competitiveIntelligence: {
    id: string;
    title: string;
    targetCountry: string;
    category: "peer" | "competitor" | "ally" | "regional";
    insights: string[];
    implications: string[];
    recommendedResponse?: ActionableRecommendation;
  }[];
}

// Main intelligence summary for executive overview
export interface ExecutiveIntelligence {
  countryId: string;
  generatedAt: number;
  nextUpdate: number;

  // Immediate attention items
  criticalAlerts: CriticalAlert[];
  urgentActions: ActionableRecommendation[];

  // Performance overview
  vitalityIntelligence: VitalityIntelligence[];
  trendingInsights: TrendingInsight[];

  // Strategic outlook
  forwardIntelligence: ForwardIntelligence;

  // Overall assessment
  overallStatus: "excellent" | "good" | "concerning" | "critical";
  confidenceLevel: number; // 0-100
  lastMajorChange: {
    date: number;
    description: string;
    impact: string;
  };

  // Display preferences
  viewMode: "executive" | "detailed" | "crisis";
  priorityThreshold: DataPriority;
}

// View configuration for adaptive content display
export interface IntelligenceViewConfig {
  mode: "overview" | "detailed" | "crisis" | "forecast";
  showAlerts: boolean;
  showRecommendations: boolean;
  showComparisons: boolean;
  showForecasts: boolean;
  priorityFilter: DataPriority[];
  categoryFilter: ("economic" | "population" | "diplomatic" | "governance")[];
  timeHorizonFilter: TimeHorizon[];
  maxItems: {
    alerts: number;
    insights: number;
    recommendations: number;
    forecasts: number;
  };
}

// Performance optimized data structure for real-time updates
export interface IntelligenceUpdate {
  timestamp: number;
  countryId: string;
  changeType: "metric" | "alert" | "recommendation" | "forecast";
  changes: {
    id: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    impact: "minor" | "moderate" | "major";
  }[];
  triggeredBy: "calculation" | "external" | "user" | "system";
}

// Utility types for component props
export type IntelligenceComponentProps<T = Record<string, unknown>> = T & {
  className?: string;
  loading?: boolean;
  error?: string | null;
  onUpdate?: (update: IntelligenceUpdate) => void;
  viewConfig?: Partial<IntelligenceViewConfig>;
};

// Export utility functions type
export interface IntelligenceUtils {
  calculateTrend: (current: number, previous: number) => TrendDirection;
  determinePriority: (score: number, trend: TrendDirection, category: string) => DataPriority;
  formatMetric: (value: number, unit?: string) => string;
  generateRecommendations: (vitality: VitalityIntelligence) => ActionableRecommendation[];
  predictFuture: (historical: number[], factors: string[]) => { value: number; confidence: number };
  compareToPercentile: (value: number, allValues: number[]) => number;
}
