import type { BaseIntelligence, BaseEntity, StandardPriority, StandardCategory, StandardTrend, StandardTimeframe, IconReference } from './base';

// Unified intelligence item (replaces all variants)
export interface IntelligenceItem extends BaseIntelligence {
  type: 'alert' | 'opportunity' | 'update' | 'prediction' | 'insight';
  title: string;
  description: string;
  severity: StandardPriority;    // Unified with priority
  timestamp: number;             // Standardized Unix timestamp
  affectedRegions?: string[];
  relatedItems?: string[];
  tags?: string[];
  metrics?: IntelligenceMetric[];
}

// Standardized intelligence metric
export interface IntelligenceMetric extends BaseEntity {
  label: string;
  value: number | string;
  unit?: string;
  trend: StandardTrend;          // Standardized trend type
  changeValue: number;
  changePercent: number;
  changePeriod: string;
  status: 'excellent' | 'good' | 'concerning' | 'critical';
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

// Critical alert with standardized properties
export interface CriticalAlert extends BaseIntelligence {
  title: string;
  message: string;
  severity: StandardPriority;    // Unified
  category: StandardCategory;    // Unified  
  actionRequired: boolean;
  timeframe: StandardTimeframe;  // Unified
  estimatedImpact: {
    magnitude: StandardPriority; // Reuse priority scale
    areas: string[];
  };
  recommendedActions: string[];
  expiresAt?: number;
}

// Actionable recommendation with unified properties
export interface ActionableRecommendation extends BaseIntelligence {
  title: string;
  description: string;
  category: StandardCategory;    // Unified
  priority: StandardPriority;    // Unified
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
  estimatedCost: {
    economic: number;
    political: number;
    time: number;
  };
  requiredResources: string[];
  expectedOutcome: string;
  confidence: number;            // 0-100 inherited from base
  implementationSteps?: string[];
}

// Economic intelligence specific interfaces
export interface EconomicAlert extends CriticalAlert {
  category: 'economic';
  economicMetrics: {
    gdpImpact?: number;
    inflationChange?: number;
    employmentImpact?: number;
    tradeBalance?: number;
  };
}

// Diplomatic intelligence specific interfaces  
export interface DiplomaticIntelligence extends IntelligenceItem {
  category: 'diplomatic';
  involvedCountries: string[];
  relationshipImpact: 'positive' | 'negative' | 'neutral';
  treatyRelevance?: string[];
  diplomaticPriority: StandardPriority;
}