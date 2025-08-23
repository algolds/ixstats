/**
 * Comprehensive Type Guards and Utility Functions
 * Bulk solution for undefined/null checking and type safety
 */

import type { CountryWithEconomicData } from '~/types/ixstats';
import type { IntelligenceItem } from '~/types/intelligence-unified';
import type { ExecutiveAction, QuickAction } from '~/types/actions';

// Null/undefined safety utilities (fixes 23+ "possibly undefined" errors)
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function safeString(value: string | undefined | null, fallback = ''): string {
  return isDefined(value) ? value : fallback;
}

export function safeNumber(value: number | undefined | null, fallback = 0): number {
  return isDefined(value) && isNumber(value) ? value : fallback;
}

export function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

// Country data validation (fixes "currentPopulation does not exist" errors)
export function isValidCountryData(data: any): data is CountryWithEconomicData {
  return data && 
    typeof data === 'object' &&
    isString(data.id) &&
    isString(data.name) &&
    isNumber(data.currentPopulation) &&
    isNumber(data.currentGdpPerCapita) &&
    isNumber(data.currentTotalGdp);
}

export function ensureCountryData(data: CountryWithEconomicData | undefined | null): CountryWithEconomicData {
  if (!data || !isValidCountryData(data)) {
    return {
      id: '',
      name: 'Unknown Country',
      currentPopulation: 0,
      currentGdpPerCapita: 0,
      currentTotalGdp: 0,
      economicTier: 'Developing',
      populationTier: 'Small',
      adjustedGdpGrowth: 0,
      populationGrowthRate: 0,
      lastCalculated: new Date(),
      baselineDate: new Date(),
      realGDPGrowthRate: 0,
      // Add all required properties with safe defaults
    } as CountryWithEconomicData;
  }
  return data;
}

// Intelligence item validation
export function isValidIntelligenceItem(item: any): item is IntelligenceItem {
  return item &&
    typeof item === 'object' &&
    isString(item.id) &&
    isString(item.title) &&
    isString(item.description);
}

// Action validation
export function isExecutiveAction(action: any): action is ExecutiveAction {
  return action && action.type === 'executive' && isString(action.id);
}

export function isQuickAction(action: any): action is QuickAction {
  return action && action.type === 'quick' && isString(action.id);
}

// Safe object property access
export function safeAccess<T, K extends keyof T>(
  obj: T | undefined | null, 
  key: K, 
  fallback: T[K]
): T[K] {
  return (obj && isDefined(obj[key])) ? obj[key] : fallback;
}

// Batch property validation for objects
export function validateObjectProperties<T extends Record<string, any>>(
  obj: T | undefined | null,
  requiredProps: Array<keyof T>,
  defaultValues: Partial<T> = {}
): T {
  if (!obj || typeof obj !== 'object') {
    return { ...defaultValues } as T;
  }

  const result = { ...obj };
  
  // Ensure all required properties exist
  requiredProps.forEach(prop => {
    if (!(prop in result) || result[prop] === undefined || result[prop] === null) {
      result[prop] = defaultValues[prop] as T[typeof prop];
    }
  });

  return result;
}

// Array utility functions
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (isDefined(value)) return [value];
  return [];
}

export function filterDefined<T>(array: (T | undefined | null)[]): T[] {
  return array.filter(isDefined);
}

// Date/timestamp utilities
export function safeDate(value: Date | string | number | undefined | null): Date {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date();
}

export function safeTimestamp(value: Date | string | number | undefined | null): number {
  return safeDate(value).getTime();
}

// Generic object merger with type safety
export function safeObjectMerge<T extends Record<string, any>>(
  target: T | undefined | null,
  source: Partial<T> | undefined | null,
  defaults: Partial<T> = {}
): T {
  const baseObject = { ...defaults } as T;
  if (target && typeof target === 'object') Object.assign(baseObject, target);
  if (source && typeof source === 'object') Object.assign(baseObject, source);
  return baseObject;
}