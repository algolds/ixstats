/**
 * Unified Intelligence Type System
 *
 * Consolidates real-time live events, strategic insights, vitality metrics,
 * actionable recommendations, and standardized intelligence items.
 */

import type {
  BaseIntelligence,
  StandardPriority,
  StandardCategory,
  StandardTrend,
  StandardTimeframe,
} from "./base";

export type { Country } from "./ixstats";

export type DataPriority = StandardPriority;
export type TrendDirection = StandardTrend;
export type TimeHorizon = StandardTimeframe;
export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type ActionUrgency = "urgent" | "important" | "routine" | "future";

// ─── 1. Intelligence Metrics & Base Items ───────────────────────────────────

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
  createdAt?: number;
  updatedAt?: number;
}

export interface IntelligenceItem extends BaseIntelligence {
  type: "alert" | "opportunity" | "update" | "prediction" | "insight";
  title: string;
  description: string;
  severity: StandardPriority;
  timestamp: number;
  affectedRegions?: string[];
  affectedCountries?: string[] | string;
  relatedItems?: string[];
  tags?: string[];
  metrics?: IntelligenceMetric[];
  content?: string;
  region?: string;
  isActive?: boolean;
}

// ─── 2. Critical Alerts & Insights ──────────────────────────────────────────

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

export interface TrendingInsight {
  id: string;
  title: string;
  description: string;
  category: "performance" | "ranking" | "opportunity" | "comparison";
  icon: React.ComponentType<{ className?: string }>;
  trend: TrendDirection;
  significance: "major" | "moderate" | "minor";
  metrics: IntelligenceMetric[];
  context: {
    comparison?: "peer" | "historical" | "target";
    timeframe: string;
    confidence: number;
  };
  actionable: boolean;
  nextReview?: number;
}

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
  successProbability: number;
  impact: {
    economic?: number;
    social?: number;
    diplomatic?: number;
    governance?: number;
  };
}

// ─── 3. Vitality Intelligence & Forward Predictions ─────────────────────────

export interface VitalityIntelligence {
  area: "economic" | "population" | "diplomatic" | "governance";
  score: number;
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
      projected: number;
      confidence: number;
      factors: string[];
    };
    longTerm: {
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

export interface ForwardIntelligence {
  predictions: {
    id: string;
    title: string;
    description: string;
    category: "economic" | "population" | "diplomatic" | "governance";
    timeHorizon: TimeHorizon;
    probability: number;
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
    probability: number;
    impact: "low" | "medium" | "high" | "severe";
    timeframe: TimeHorizon;
    earlyWarnings: string[];
    mitigation: ActionableRecommendation[];
  }[];

  competitiveIntelligence: {
    id: string;
    targetCountry: string;
    category: "peer" | "competitor" | "ally" | "regional";
    insights: string[];
    implications: string[];
    recommendedResponse?: ActionableRecommendation;
  }[];
}

export interface ExecutiveIntelligence {
  countryId: string;
  generatedAt: number;
  nextUpdate: number;
  criticalAlerts: CriticalAlert[];
  urgentActions: ActionableRecommendation[];
  vitalityIntelligence: VitalityIntelligence[];
  trendingInsights: TrendingInsight[];
  forwardIntelligence: ForwardIntelligence;
  overallStatus: "excellent" | "good" | "concerning" | "critical";
  confidenceLevel: number;
  lastMajorChange: {
    date: number;
    description: string;
    impact: string;
  };
  viewMode: "executive" | "detailed" | "crisis";
  priorityThreshold: DataPriority;
}

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

export type IntelligenceComponentProps<T = Record<string, unknown>> = T & {
  className?: string;
  loading?: boolean;
  error?: string | null;
  onUpdate?: (update: IntelligenceUpdate) => void;
  viewConfig?: Partial<IntelligenceViewConfig>;
};

// ─── 4. Domain Specific Alert Sub-types ──────────────────────────────────────

export interface EconomicAlert extends CriticalAlert {
  category: "economic";
  metricType: "gdp" | "inflation" | "unemployment" | "growth";
  currentValue: number;
  previousValue: number;
  threshold: number;
}

export interface DiplomaticIntelligence extends BaseIntelligence {
  type: "diplomatic";
  sourceCountryId: string;
  targetCountryId: string;
  relationLevel: number;
  treaties: string[];
  embassyStatus: "active" | "recalled" | "none";
  recentEvents: string[];
}

export interface CrisisEvent {
  id: string;
  type?: string;
  title?: string;
  severity?: "critical" | "warning" | "info" | "high" | "medium" | "low" | string;
  affectedCountries?: string[];
  affectedSectors?: string[];
  casualties?: number;
  economicImpact?: number;
  economicImpactPercent?: number;
  status?: string;
  responseStatus?: string;
  timestamp?: Date | number;
  description?: string;
  location?: string;
  coordinates?: any;
  estimatedRecoveryDays?: number;
}

export interface EconomicIndicator {
  globalGDP?: number;
  globalGrowth?: number;
  inflationRate?: number;
  unemploymentRate?: number;
  tradeVolume?: number;
  currencyVolatility?: number;
  name?: string;
  value?: number;
  unit?: string;
  category?: StandardCategory;
  lastUpdated?: number;
  timestamp?: Date | number;
}
