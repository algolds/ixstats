/**
 * TypeScript types for MyCountry system
 * 
 * This file defines all the data structures used by the MyCountry API and components.
 * These types ensure type safety across the entire MyCountry system.
 */

import type { LucideIcon } from 'lucide-react';
import type { IntelligenceItem } from './intelligence-unified';

// Re-export from ixstats for consistency
export type { CountryWithEconomicData } from './ixstats';

/**
 * Intelligence feed item for executive dashboard
 */
// Re-export unified IntelligenceItem to maintain backward compatibility
export type { IntelligenceItem } from './intelligence-unified';

/**
 * Achievement earned by the country
 */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'economic' | 'diplomatic' | 'social' | 'governance' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  achievedAt: number; // Unix timestamp
  points: number;
  icon: string; // Lucide icon name
  progress: number; // 0-100 for partial achievements
  requirements?: string[];
  nextLevel?: Achievement;
}

/**
 * Historical milestone achieved by the country
 */
export interface Milestone {
  id: string;
  title: string;
  description: string;
  achievedAt: number; // Unix timestamp
  impact: string;
  category: 'population' | 'economic' | 'diplomatic' | 'governance' | 'infrastructure';
  significance: 'minor' | 'moderate' | 'major' | 'historic';
  relatedMetrics?: {
    metric: string;
    value: number;
    previousValue?: number;
  }[];
}

/**
 * International ranking information
 */
export interface Ranking {
  category: 'GDP per Capita' | 'Population' | 'Total GDP' | 'Quality of Life' | 'Innovation' | 'Competitiveness';
  global: {
    position: number;
    total: number;
  };
  regional: {
    position: number;
    total: number;
    region: string;
  };
  tier: {
    position: number;
    total: number;
    tier: string;
  };
  trend: 'improving' | 'stable' | 'declining';
  percentile: number; // 0-100, where 100 is the best
  historicalBest?: {
    position: number;
    timestamp: number;
  };
}

/**
 * National vitality scores (Apple Health rings style)
 */
export interface VitalityScores {
  economicVitality: number; // 0-100
  populationWellbeing: number; // 0-100
  diplomaticStanding: number; // 0-100
  governmentalEfficiency: number; // 0-100
  overallScore: number; // Average of all scores
}

/**
 * Executive action available to country leaders
 */
export interface ExecutiveAction {
  id: string;
  title: string;
  description: string;
  category: 'economic' | 'diplomatic' | 'social' | 'military' | 'infrastructure' | 'emergency';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: {
    economic?: string;
    social?: string;
    diplomatic?: string;
    timeframe: string;
  };
  requirements: string[];
  enabled: boolean;
  cooldownHours?: number;
  cost?: {
    budget: number;
    politicalCapital: number;
  };
  risks?: string[];
}

/**
 * National summary for dashboard overview
 */
export interface NationalSummary {
  countryId: string;
  countryName: string;
  overallHealth: number; // 0-100 composite score
  keyMetrics: {
    population: number;
    gdpPerCapita: number;
    totalGdp: number;
    economicTier: string;
    populationTier: string;
  };
  growthRates: {
    population: number;
    economic: number;
  };
  vitalityScores: VitalityScores;
  lastUpdated: number; // Unix timestamp
  alerts?: IntelligenceItem[];
  recentAchievements?: Achievement[];
}

/**
 * Activity ring data for Apple Health-style visualization
 */
export interface ActivityRing {
  id: string;
  title: string;
  description: string;
  value: number; // Current value (0-100)
  max: number; // Maximum value (usually 100)
  color: string; // CSS color
  icon: LucideIcon;
  metrics: {
    primary: string;
    secondary: string;
    trend: 'up' | 'down' | 'stable';
    change: string;
  };
  target?: number; // Optional target value
  history?: number[]; // Historical values for sparkline
}

/**
 * Focus card for management areas
 */
export interface FocusCard {
  id: string;
  title: string;
  description: string;
  category: 'economic' | 'population' | 'diplomatic' | 'governance';
  healthScore: number; // 0-100
  status: 'excellent' | 'good' | 'attention' | 'critical';
  metrics: FocusMetric[];
  actions: FocusAction[];
  alerts: Alert[];
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: number;
}

/**
 * Metric within a focus card
 */
export interface FocusMetric {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  change: string;
  target?: number;
  format: 'number' | 'percentage' | 'currency' | 'text';
  importance: 'primary' | 'secondary';
}

/**
 * Action within a focus card
 */
export interface FocusAction {
  id: string;
  label: string;
  type: 'policy' | 'budget' | 'diplomatic' | 'emergency';
  enabled: boolean;
  requiresConfirmation: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: {
    economic?: string;
    social?: string;
    diplomatic?: string;
    timeframe: string;
  };
  description?: string;
}

/**
 * Alert within a focus card
 */
export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  timestamp: number;
  actionable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dismissible: boolean;
}

/**
 * Real-time notification for the notification system
 */
export interface MyCountryNotification {
  id: string;
  type: 'economic' | 'demographic' | 'diplomatic' | 'governance' | 'achievement' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  countryId: string;
  read: boolean;
  actionable: boolean;
  actions?: NotificationAction[];
  data?: Record<string, any>;
}

/**
 * Action associated with a notification
 */
export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  handler: () => void | Promise<void>;
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  type: 'activity-rings' | 'focus-cards' | 'intelligence-feed' | 'achievements' | 'rankings' | 'metrics';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  settings: Record<string, any>;
  visible: boolean;
  refreshInterval?: number; // seconds
}

/**
 * MyCountry page mode
 */
export type MyCountryMode = 'public' | 'executive';

/**
 * Data synchronization state
 */
export interface MyCountryDataSyncState {
  isConnected: boolean;
  lastUpdate: number;
  updateCount: number;
  errors: string[];
  status: 'idle' | 'syncing' | 'error' | 'disconnected';
}

/**
 * API response wrapper for MyCountry endpoints
 */
export interface MyCountryApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  cached?: boolean;
}

/**
 * Search/filter parameters for intelligence feed
 */
export interface IntelligenceFeedFilters {
  categories?: IntelligenceItem['category'][];
  severities?: IntelligenceItem['severity'][];
  types?: IntelligenceItem['type'][];
  timeRange?: {
    start: number;
    end: number;
  };
  sources?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Executive dashboard configuration
 */
export interface ExecutiveDashboardConfig {
  layout: 'grid' | 'cards' | 'compact';
  widgets: DashboardWidget[];
  notifications: {
    enabled: boolean;
    categories: IntelligenceItem['category'][];
    minSeverity: IntelligenceItem['severity'];
  };
  refreshInterval: number; // seconds
  theme: 'light' | 'dark' | 'auto';
}

/**
 * Country comparison data for benchmarking
 */
export interface CountryComparison {
  countries: {
    id: string;
    name: string;
    metrics: Record<string, number>;
    vitalityScores: VitalityScores;
  }[];
  benchmarks: {
    metric: string;
    average: number;
    median: number;
    top10Percent: number;
    bottom10Percent: number;
  }[];
  recommendations: {
    area: string;
    suggestion: string;
    potentialImpact: string;
    difficulty: 'low' | 'medium' | 'high';
  }[];
}

/**
 * Historical trend data
 */
export interface HistoricalTrend {
  metric: string;
  data: {
    timestamp: number;
    value: number;
    events?: string[]; // Notable events at this time
  }[];
  trend: 'improving' | 'stable' | 'declining';
  changeRate: number; // Rate of change per period
  projection?: {
    timestamp: number;
    value: number;
    confidence: number; // 0-1
  }[];
}

/**
 * Export configuration for data export features
 */
export interface ExportConfig {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  data: ('overview' | 'metrics' | 'history' | 'intelligence' | 'achievements')[];
  timeRange?: {
    start: number;
    end: number;
  };
  includeCharts: boolean;
  includeAnalysis: boolean;
}

// Utility types
export type MyCountryEventType = 'data-update' | 'achievement-unlocked' | 'alert-generated' | 'action-executed';

export interface MyCountryEvent {
  type: MyCountryEventType;
  timestamp: number;
  countryId: string;
  data: any;
  userId?: string;
}

// Form validation schemas (for use with zod)
export const IntelligenceItemSchema = {
  id: 'string',
  type: ['alert', 'opportunity', 'update', 'prediction'],
  severity: ['low', 'medium', 'high', 'critical'],
  title: 'string',
  description: 'string',
  category: ['economic', 'diplomatic', 'social', 'governance', 'security'],
  timestamp: 'number',
  actionable: 'boolean',
  source: 'string',
} as const;

export const ExecutiveActionSchema = {
  id: 'string',
  title: 'string',
  description: 'string',
  category: ['economic', 'diplomatic', 'social', 'military', 'infrastructure', 'emergency'],
  urgency: ['low', 'medium', 'high', 'critical'],
  enabled: 'boolean',
} as const;