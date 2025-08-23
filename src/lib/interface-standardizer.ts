/**
 * Bulk Interface Standardization System
 * Systematic approach to convert all legacy interfaces to unified format
 */

import type { CountryWithEconomicData } from '~/types/ixstats';
import type { IntelligenceItem } from '~/types/intelligence-unified';
import type { ExecutiveAction, QuickAction, NotificationAction } from '~/types/actions';
import type { StandardPriority, StandardCategory } from '~/types/base';
import { 
  safeString, 
  safeNumber, 
  safeArray, 
  safeTimestamp, 
  validateObjectProperties,
  ensureCountryData 
} from './type-guards';

// Bulk property standardization mappings
const PRIORITY_STANDARDIZATION_MAP: Record<string, StandardPriority> = {
  'critical': 'critical',
  'urgent': 'critical',
  'high': 'high',
  'important': 'high',
  'medium': 'medium',
  'moderate': 'medium',
  'normal': 'medium',
  'low': 'low',
  'minor': 'low'
};

const CATEGORY_STANDARDIZATION_MAP: Record<string, StandardCategory> = {
  'economic': 'economic',
  'economy': 'economic',
  'financial': 'economic',
  'diplomatic': 'diplomatic',
  'diplomacy': 'diplomatic',
  'foreign': 'diplomatic',
  'international': 'diplomatic',
  'social': 'social',
  'population': 'social',
  'welfare': 'social',
  'governance': 'governance',
  'government': 'governance',
  'political': 'governance',
  'admin': 'governance',
  'security': 'security',
  'defense': 'security',
  'military': 'security',
  'safety': 'security',
  'infrastructure': 'infrastructure',
  'transport': 'infrastructure',
  'utilities': 'infrastructure',
  'construction': 'infrastructure'
};

/**
 * Bulk standardize any object with priority/severity properties
 * Fixes all priority/severity/urgency inconsistencies at once
 */
export function standardizePriorityProperties<T extends Record<string, any>>(obj: T): T & {
  priority: StandardPriority;
  severity: StandardPriority;
} {
  const priority = extractPriority(obj);
  return {
    ...obj,
    priority,
    severity: priority, // Unified - both point to same standardized value
  };
}

/**
 * Bulk standardize any object with category properties
 * Fixes all category type mismatches at once
 */
export function standardizeCategoryProperties<T extends Record<string, any>>(obj: T): T & {
  category: StandardCategory;
} {
  const category = extractCategory(obj);
  return {
    ...obj,
    category,
  };
}

/**
 * Bulk standardize timestamp properties across all interfaces
 * Fixes Date/number/string timestamp inconsistencies
 */
export function standardizeTimestampProperties<T extends Record<string, any>>(obj: T): T & {
  timestamp: number;
  createdAt: number;
  updatedAt?: number;
} {
  return {
    ...obj,
    timestamp: safeTimestamp(obj.timestamp || obj.createdAt || obj.lastCalculated),
    createdAt: safeTimestamp(obj.createdAt || obj.timestamp || Date.now()),
    updatedAt: obj.updatedAt ? safeTimestamp(obj.updatedAt) : undefined,
  };
}

/**
 * Master function: Apply all standardizations at once
 * Single function call to fix most type issues
 */
export function bulkStandardizeInterface<T extends Record<string, any>>(obj: T | undefined | null): T {
  if (!obj) return {} as T;
  
  let standardized = { ...obj };
  
  // Apply all standardizations
  standardized = standardizePriorityProperties(standardized);
  standardized = standardizeCategoryProperties(standardized);
  standardized = standardizeTimestampProperties(standardized);
  
  // Fix string/undefined issues
  Object.keys(standardized).forEach(key => {
    if (typeof standardized[key] === 'string' && (standardized[key] as string).trim() === '') {
      (standardized as any)[key] = undefined;
    }
  });
  
  return standardized as T;
}

/**
 * Bulk CountryData standardization
 * Ensures all CountryData objects have required properties
 */
export function standardizeCountryData(data: any): CountryWithEconomicData {
  const baseCountry = ensureCountryData(data);
  
  return validateObjectProperties(baseCountry, [
    'id', 'name', 'currentPopulation', 'currentGdpPerCapita', 'currentTotalGdp',
    'economicTier', 'populationTier', 'adjustedGdpGrowth', 'populationGrowthRate'
  ], {
    id: safeString(data?.id),
    name: safeString(data?.name, 'Unknown Country'),
    currentPopulation: safeNumber(data?.currentPopulation || data?.population),
    currentGdpPerCapita: safeNumber(data?.currentGdpPerCapita || data?.gdpPerCapita),
    currentTotalGdp: safeNumber(data?.currentTotalGdp || data?.totalGdp),
    economicTier: safeString(data?.economicTier, 'Developing'),
    populationTier: safeString(data?.populationTier, 'Small'),
    adjustedGdpGrowth: safeNumber(data?.adjustedGdpGrowth || data?.gdpGrowthRate),
    populationGrowthRate: safeNumber(data?.populationGrowthRate),
    lastCalculated: data?.lastCalculated || new Date(),
    baselineDate: data?.baselineDate || new Date(),
    realGDPGrowthRate: safeNumber(data?.realGDPGrowthRate || data?.gdpGrowthRate),
  });
}

/**
 * Bulk IntelligenceItem standardization
 * Handles all intelligence interface variants
 */
export function standardizeIntelligenceItem(item: any): IntelligenceItem {
  const standardized = bulkStandardizeInterface(item);
  
  return {
    id: safeString(item?.id),
    type: item?.type || 'update',
    title: safeString(item?.title),
    description: safeString(item?.description || item?.message || item?.content),
    category: standardized.category,
    severity: standardized.severity,
    source: safeString(item?.source, 'system'),
    confidence: safeNumber(item?.confidence, 80),
    actionable: Boolean(item?.actionable),
    timestamp: standardized.timestamp,
    createdAt: standardized.createdAt,
    updatedAt: standardized.updatedAt,
    affectedRegions: safeArray(item?.affectedRegions || item?.relatedCountries),
    relatedItems: safeArray(item?.relatedItems),
    tags: safeArray(item?.tags),
    metrics: safeArray(item?.metrics),
    
    // Backward compatibility properties
    priority: standardized.priority,
    content: safeString(item?.description || item?.message || item?.content),
    relatedCountries: safeArray(item?.affectedRegions || item?.relatedCountries),
  } as IntelligenceItem & {
    priority: StandardPriority;
    content: string;
    relatedCountries: string[];
  };
}

/**
 * Bulk ExecutiveAction standardization
 */
export function standardizeExecutiveAction(action: any): ExecutiveAction {
  const standardized = bulkStandardizeInterface(action);
  
  return {
    id: safeString(action?.id),
    type: 'executive',
    title: safeString(action?.title),
    description: safeString(action?.description),
    category: standardized.category,
    enabled: Boolean(action?.enabled ?? true),
    priority: standardized.priority,
    createdAt: standardized.createdAt,
    updatedAt: standardized.updatedAt,
    urgency: standardized.priority, // Map to priority for consistency
    estimatedImpact: action?.estimatedImpact || { timeframe: 'unknown' },
    requirements: safeArray(action?.requirements),
    cooldownHours: action?.cooldownHours,
    cost: action?.cost,
    risks: safeArray(action?.risks),
  };
}

// Helper functions
function extractPriority(obj: any): StandardPriority {
  const priority = obj?.priority || obj?.severity || obj?.urgency || 'medium';
  const normalized = String(priority).toLowerCase();
  return PRIORITY_STANDARDIZATION_MAP[normalized] || 'medium';
}

function extractCategory(obj: any): StandardCategory {
  const category = obj?.category || obj?.type || 'governance';
  const normalized = String(category).toLowerCase();
  return CATEGORY_STANDARDIZATION_MAP[normalized] || 'governance';
}

/**
 * Bulk apply standardization to arrays of objects
 */
export function bulkStandardizeArray<T>(
  items: any[] | undefined | null,
  standardizer: (item: any) => T
): T[] {
  return safeArray(items).map(standardizer);
}

/**
 * Export shorthand functions for common use cases
 */
export const standardize = {
  country: standardizeCountryData,
  intelligence: standardizeIntelligenceItem,
  executive: standardizeExecutiveAction,
  bulk: bulkStandardizeInterface,
  array: bulkStandardizeArray,
};