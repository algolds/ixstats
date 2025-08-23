/**
 * Foundation interfaces for all IxStats entities
 * These provide consistent base properties across the entire system
 */

// Core entity properties
export interface BaseEntity {
  id: string;
  createdAt: number;  // Unix timestamp - standardized across all entities
  updatedAt?: number;
}

// Base for all actionable entities
export interface BaseAction extends BaseEntity {
  title: string;
  description: string;
  enabled: boolean;
  priority: StandardPriority;
  category: StandardCategory;
}

// Base for all notification-like entities
export interface BaseNotification extends BaseEntity {
  title: string;
  message: string;
  type: string;
  severity: StandardPriority;  // Aligned with priority for consistency
  read?: boolean;
}

// Base for all intelligence/insight entities  
export interface BaseIntelligence extends BaseEntity {
  category: StandardCategory;
  source: string;
  confidence?: number; // 0-100 scale
  actionable: boolean;
}

// Standardized enums (replace all variants)
export type StandardPriority = 'critical' | 'high' | 'medium' | 'low';
export type StandardCategory = 'economic' | 'diplomatic' | 'social' | 'governance' | 'security' | 'infrastructure';
export type StandardTimeframe = 'immediate' | 'short' | 'medium' | 'long';
export type StandardTrend = 'up' | 'down' | 'stable';

// Icon reference type (standardized across system)
export interface IconReference {
  name: string;      // Lucide icon name
  variant?: 'solid' | 'outline';
  color?: string;
}

// Standardized impact metrics
export interface ImpactMetrics {
  economic?: string;
  social?: string;
  diplomatic?: string;
  timeframe: string;
  magnitude: StandardPriority;
}

// Standardized cost structure
export interface CostStructure {
  economic: number;
  political: number;
  time: number;
}