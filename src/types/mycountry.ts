/**
 * TypeScript types for MyCountry system
 *
 * This file defines all the data structures used by the MyCountry API and components.
 * These types ensure type safety across the entire MyCountry system.
 */

import type { IntelligenceItem } from "./intelligence-unified";

// Re-export from ixstats for consistency
export type { CountryWithEconomicData } from "./ixstats";

/**
 * Intelligence feed item for executive dashboard
 */
// Re-export unified IntelligenceItem to maintain backward compatibility
export type { IntelligenceItem } from "./intelligence-unified";

/**
 * Achievement earned by the country
 */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: "economic" | "diplomatic" | "social" | "governance" | "special";
  rarity: "common" | "rare" | "epic" | "legendary";
  achievedAt: number; // Unix timestamp
  points: number;
  icon: string; // Lucide icon name
  progress: number; // 0-100 for partial achievements
  requirements?: string[];
  nextLevel?: Achievement;
}

/**
 * International ranking information
 */
export type RankingCategory =
  | "GDP per Capita"
  | "Population"
  | "Total GDP"
  | "GDP Growth"
  | "Public Approval"
  | "Stability"
  | "Diplomatic Standing"
  | "Infrastructure"
  | "Debt to GDP"
  | "Income Equality";

export interface Ranking {
  category: RankingCategory;
  /** The country's own value in this category (units depend on the category). */
  value: number;
  /** True when a lower value ranks higher (debt, inequality). */
  lowerIsBetter?: boolean;
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
  /** Only set where a real growth rate backs it (GDP, population). */
  trend?: "improving" | "stable" | "declining";
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
  diplomaticStanding: number | null; // 0-100; null when the country has no diplomatic record
  governmentalEfficiency: number | null; // 0-100; null when no government structure exists
  overallScore: number; // Average of the scores that are known
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

// Utility types
// Form validation schemas (for use with zod)

/**
 * Shared types for country comparison modal and comparison hooks
 */
export interface ComparisonCountry {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  populationTier: string;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  landArea?: number | null;
  continent?: string | null;
  color: string;
}
