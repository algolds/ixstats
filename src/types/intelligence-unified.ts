/**
 * Intelligence Adapter Types (ACTIVE)
 *
 * This is the canonical, app-facing intelligence type module. It defines the
 * lightweight, standardized shapes consumed across the UI and lib layers:
 * `IntelligenceItem`, `IntelligenceMetric`, `CriticalAlert`,
 * `ActionableRecommendation`, `EconomicAlert`, `DiplomaticIntelligence`, and
 * re-exports `Country` / `VitalityIntelligence`.
 *
 * NOTE ON NAMING: Do not confuse this with `./unified-intelligence.ts` (the
 * larger server/domain catalogue). That module defines a DIFFERENT-shaped
 * `IntelligenceMetric` and is not imported by the adapter consumers. The two
 * are intentionally kept separate — importers of THIS file expect the shapes
 * defined below. If you ever consolidate the two, the `IntelligenceMetric`
 * name collision must be resolved explicitly so every adapter consumer keeps
 * the shape it expects.
 */

import type {
  BaseIntelligence,
  BaseEntity,
  StandardPriority,
  StandardCategory,
  StandardTrend,
  StandardTimeframe,
} from "./base";

// Re-export types from other modules for unified access
export type { Country } from "./ixstats";
export type { VitalityIntelligence } from "../app/mycountry/types/intelligence";

// Unified intelligence item (replaces all variants)
export interface IntelligenceItem extends BaseIntelligence {
  type: "alert" | "opportunity" | "update" | "prediction" | "insight";
  title: string;
  description: string;
  severity: StandardPriority; // Unified with priority
  timestamp: number; // Standardized Unix timestamp
  affectedRegions?: string[];
  affectedCountries?: string[] | string; // Added for API compatibility
  relatedItems?: string[];
  tags?: string[];
  metrics?: IntelligenceMetric[];
  // API compatibility fields
  content?: string; // Alternative to description
  region?: string; // Single region field
  isActive?: boolean; // Activity status
}

// Standardized intelligence metric
export interface IntelligenceMetric extends BaseEntity {
  label: string;
  value: number | string;
  unit?: string;
  trend: StandardTrend; // Standardized trend type
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

// Critical alert with standardized properties
export interface CriticalAlert extends BaseIntelligence {
  title: string;
  message: string;
  severity: StandardPriority; // Unified
  category: StandardCategory; // Unified
  actionRequired: boolean;
  timeframe: StandardTimeframe; // Unified
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
  category: StandardCategory; // Unified
  priority: StandardPriority; // Unified
  complexity: "simple" | "moderate" | "complex";
  estimatedTime: string;
  estimatedCost: {
    economic: number;
    political: number;
    time: number;
  };
  requiredResources: string[];
  expectedOutcome: string;
  confidence: number; // 0-100 inherited from base
  implementationSteps?: string[];
}

// Economic intelligence specific interfaces
export interface EconomicAlert extends CriticalAlert {
  category: "economic";
  economicMetrics: {
    gdpImpact?: number;
    inflationChange?: number;
    employmentImpact?: number;
    tradeBalance?: number;
  };
}

// Diplomatic intelligence specific interfaces
export interface DiplomaticIntelligence extends IntelligenceItem {
  category: "diplomatic";
  involvedCountries: string[];
  relationshipImpact: "positive" | "negative" | "neutral";
  treatyRelevance?: string[];
  diplomaticPriority: StandardPriority;
}

// Crisis event interface
export interface CrisisEvent {
  id: string;
  type:
    | "natural_disaster"
    | "economic_crisis"
    | "political_crisis"
    | "security_threat"
    | "pandemic"
    | "environmental";
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  affectedCountries: string[];
  casualties: number;
  economicImpact: number;
  status: "coordinating" | "monitoring" | "deployed" | "standby" | "resolved";
  responseStatus: "coordinating" | "monitoring" | "deployed" | "standby" | "resolved";
  timestamp: Date;
  description: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
}

// Global economic indicator interface
export interface EconomicIndicator {
  globalGDP: number;
  globalGrowth: number;
  inflationRate: number;
  unemploymentRate: number;
  tradeVolume: number;
  currencyVolatility: number;
  timestamp: Date;
}
