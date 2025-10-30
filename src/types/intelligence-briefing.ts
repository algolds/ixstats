/**
 * Type definitions for the Enhanced Intelligence Briefing system
 *
 * This module contains all TypeScript interfaces and type definitions
 * used throughout the intelligence briefing components.
 */

import type React from "react";
import type { CountryInfobox } from '~/lib/mediawiki-service';

/**
 * Represents a single vitality metric for country health visualization
 */
export interface VitalityMetric {
  id: string;
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'fair' | 'poor';
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

/**
 * Represents a country metric with optional trend information
 */
export interface CountryMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    period: string;
  };
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  importance: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Represents an intelligence alert with action handlers
 */
export interface IntelligenceAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Represents categorized country information
 */
export interface CountryInformation {
  id: string;
  category: string;
  items: {
    label: string;
    value: string;
    classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  }[];
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

/**
 * Represents a wiki section from MediaWiki
 */
export interface WikiSection {
  id: string;
  title: string;
  content: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  importance: 'critical' | 'high' | 'medium' | 'low';
  lastModified: string;
  wordCount: number;
  images?: string[];
  level?: number;
  subsections?: WikiSection[];
}

/**
 * Represents complete wiki intelligence data for a country
 */
export interface WikiIntelligenceData {
  countryName: string;
  sections: WikiSection[];
  lastUpdated: number;
  confidence: number;
  infobox: CountryInfobox | null;
  isLoading?: boolean;
  error?: string;
}

/**
 * Props for the main EnhancedIntelligenceBriefing component
 */
export interface EnhancedIntelligenceBriefingProps {
  // Country data
  country: {
    id: string;
    name: string;
    continent?: string;
    region?: string;
    governmentType?: string;
    leader?: string;
    religion?: string;
    capital?: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    populationTier: string;
    populationGrowthRate: number;
    adjustedGdpGrowth: number;
    populationDensity?: number;
    landArea?: number;
    lastCalculated: number;
    baselineDate: number;
  };

  // Intelligence data
  intelligenceAlerts?: IntelligenceAlert[];
  wikiData?: WikiIntelligenceData;
  currentIxTime: number;

  // Security context
  viewerClearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  isOwnCountry?: boolean;

  // Styling
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

/**
 * Classification level type
 */
export type ClassificationLevel = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';

/**
 * Trend direction type
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Status type for metrics
 */
export type StatusType = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Importance level type
 */
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Alert type enumeration
 */
export type AlertType = 'critical' | 'warning' | 'info' | 'success';
