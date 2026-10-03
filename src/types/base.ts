/**
 * Foundation interfaces for all IxStats entities
 * These provide consistent base properties across the entire system
 */

// Core entity properties
interface BaseEntity {
  id: string;
  createdAt: number; // Unix timestamp - standardized across all entities
  updatedAt?: number;
}

// Base for all actionable entities
// Base for all notification-like entities
// Base for all intelligence/insight entities
export interface BaseIntelligence extends BaseEntity {
  category: StandardCategory;
  source: string;
  confidence?: number; // 0-100 scale
  actionable: boolean;
}

// Standardized enums (replace all variants)
export type StandardPriority = "critical" | "high" | "medium" | "low";
type StandardCategory =
  "economic" | "diplomatic" | "social" | "governance" | "security" | "infrastructure" | "crisis";
export type StandardTrend = "up" | "down" | "stable";

// Icon reference type (standardized across system)
// Standardized impact metrics
// Standardized cost structure
