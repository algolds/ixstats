/**
 * Comprehensive Type Guards and Utility Functions
 * Bulk solution for undefined/null checking and type safety
 */

import type { CountryWithEconomicData } from "~/types/ixstats";
import type { IntelligenceItem } from "~/types/intelligence-unified";
import type { ExecutiveAction, QuickAction } from "~/types/actions";

/**
 * Normalize country name for consistent storage and lookups
 * - Removes leading/trailing whitespace
 * - Normalizes multiple consecutive spaces to single space
 * - Preserves case and special characters
 *
 * @param name - Country name to normalize
 * @returns Normalized country name
 *
 * @example
 * normalizeCountryName("  Daxia  ") // "Daxia"
 * normalizeCountryName("North  America") // "North America"
 */
export function normalizeCountryName(name: string | null | undefined): string {
  if (!name) return "";

  return name
    .trim() // Remove leading/trailing whitespace
    .replace(/\s+/g, " "); // Normalize multiple spaces to single space
}

// Null/undefined safety utilities (fixes 23+ "possibly undefined" errors)
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function safeString(value: string | undefined | null, fallback = ""): string {
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
  return (
    data &&
    typeof data === "object" &&
    isString(data.id) &&
    isString(data.name) &&
    isNumber(data.currentPopulation) &&
    isNumber(data.currentGdpPerCapita) &&
    isNumber(data.currentTotalGdp)
  );
}

export function ensureCountryData(data: CountryWithEconomicData | undefined | null): any {
  const baseData = data || {
    id: "",
    name: "Unknown Country",
    currentPopulation: 0,
    currentGdpPerCapita: 0,
    currentTotalGdp: 0,
    economicTier: "Developing",
    populationTier: "Small",
    adjustedGdpGrowth: 0,
    populationGrowthRate: 0,
    lastCalculated: new Date(),
    baselineDate: new Date(),
    realGDPGrowthRate: 0,
    flagUrl: undefined as string | undefined,
  };

  // Calculate vitality properties from actual economic data
  const gdpPerCapita = baseData.currentGdpPerCapita || 0;
  const gdpGrowth = baseData.adjustedGdpGrowth || baseData.realGDPGrowthRate || 0;
  const population = baseData.currentPopulation || 1;

  const baseFlagUrl = (baseData as { flagUrl?: string | null }).flagUrl;
  const fallbackFlag = (baseData as { flag?: string | null }).flag;
  const normalizedFlagUrl =
    typeof baseFlagUrl === "string" && baseFlagUrl.trim().length > 0
      ? baseFlagUrl
      : typeof fallbackFlag === "string" && fallbackFlag.trim().length > 0
        ? fallbackFlag
        : undefined;

  return {
    ...baseData,
    flagUrl: normalizedFlagUrl,
    // Economic vitality based on GDP per capita and growth rate
    economicVitality: Math.min(100, Math.max(0, (gdpPerCapita / 1000) * 10 + gdpGrowth * 20 + 30)),
    // Population wellbeing correlates with GDP per capita
    populationWellbeing: Math.min(
      100,
      Math.max(0, (gdpPerCapita / 800) * 8 + (population > 50000000 ? -5 : 5) + 40)
    ),
    // Diplomatic standing based on economic tier and stability
    diplomaticStanding: Math.min(
      100,
      Math.max(
        0,
        (baseData.economicTier === "Developed"
          ? 70
          : baseData.economicTier === "Advanced"
            ? 85
            : 50) + (Math.abs(gdpGrowth) < 5 ? 10 : -10)
      )
    ),
    // Governmental efficiency based on economic performance
    governmentalEfficiency: Math.min(
      100,
      Math.max(
        0,
        60 +
          (gdpGrowth > 2 ? 20 : gdpGrowth < -2 ? -20 : 0) +
          (gdpPerCapita > 30000 ? 15 : gdpPerCapita > 15000 ? 5 : -5)
      )
    ),
  };
}

// Intelligence item validation
export function isValidIntelligenceItem(item: any): item is IntelligenceItem {
  return (
    item &&
    typeof item === "object" &&
    isString(item.id) &&
    isString(item.title) &&
    isString(item.description)
  );
}

// Action validation
export function isExecutiveAction(action: any): action is ExecutiveAction {
  return action && action.type === "executive" && isString(action.id);
}

export function isQuickAction(action: any): action is QuickAction {
  return action && action.type === "quick" && isString(action.id);
}

// Safe object property access
export function safeAccess<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  fallback: T[K]
): T[K] {
  return obj && isDefined(obj[key]) ? obj[key] : fallback;
}

// Batch property validation for objects
export function validateObjectProperties<T extends Record<string, any>>(
  obj: T | undefined | null,
  requiredProps: Array<keyof T>,
  defaultValues: Partial<T> = {}
): T {
  if (!obj || typeof obj !== "object") {
    return { ...defaultValues } as T;
  }

  const result = { ...obj };

  // Ensure all required properties exist
  requiredProps.forEach((prop) => {
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
  if (typeof value === "string" || typeof value === "number") {
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
  if (target && typeof target === "object") Object.assign(baseObject, target);
  if (source && typeof source === "object") Object.assign(baseObject, source);
  return baseObject;
}
