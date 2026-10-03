/**
 * Unified Intelligence Type System
 *
 * Consolidates real-time live events, strategic insights, vitality metrics,
 * actionable recommendations, and standardized intelligence items.
 */

import type { BaseIntelligence, StandardPriority, StandardTrend } from "./base";

export type { Country } from "./ixstats";
type TrendDirection = StandardTrend;
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
// ─── 3. Vitality Intelligence & Forward Predictions ─────────────────────────
// ─── 4. Domain Specific Alert Sub-types ──────────────────────────────────────
