/**
 * Labor Market Calculation Utilities
 *
 * Provides calculation functions for deriving labor market metrics and
 * utility functions for color-coding employment types, sectors, and protections.
 * Extracted from LaborEmploymentTab for reusability.
 */

import type { LaborConfiguration } from "~/types/economy-builder";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";

/**
 * Derived labor market metrics calculated from base labor configuration
 */
export interface DerivedLaborMetrics {
  /** Number of employed workers */
  employed: number;
  /** Number of unemployed workers */
  unemployed: number;
  /** Number of underemployed workers */
  underemployed: number;
  /** Total working age population */
  workingAgePopulation: number;
  /** Total labor force size */
  laborForceSize: number;
  /** Effective unemployment rate including underemployment */
  effectiveUnemployment: number;
  /** Number of employed workers (for tests) */
  employedWorkforce: number;
  /** Number of unemployed workers (for tests) */
  unemployedWorkforce: number;
  /** Average worker protection score (for tests) */
  avgProtectionScore: number;
  /** Employment rate (for tests) */
  employmentRate: number;
  /** Unemployment rate (for tests) */
  unemploymentRate: number;
}

/**
 * Calculate derived labor market metrics from base labor configuration
 *
 * Computes absolute numbers of employed, unemployed, and underemployed workers,
 * as well as the effective unemployment rate that accounts for underemployment.
 *
 * @param laborMarket - Base labor market configuration with rates
 * @returns Calculated labor metrics in absolute numbers
 *
 * @example
 * ```ts
 * const labor = {
 *   totalWorkforce: 10000000,
 *   employmentRate: 95,
 *   unemploymentRate: 5,
 *   underemploymentRate: 3,
 *   laborForceParticipationRate: 65
 * };
 * const metrics = calculateDerivedLabor(labor);
 * // metrics.employed = 9500000
 * // metrics.effectiveUnemployment = 8 (5% + 3%)
 * ```
 */
export function calculateDerivedLabor(laborMarket: LaborConfiguration): DerivedLaborMetrics {
  const totalWorkforce = laborMarket.totalWorkforce;
  const employed = Math.round(totalWorkforce * (laborMarket.employmentRate / 100));
  const unemployed = totalWorkforce - employed;
  const underemployed = Math.round(totalWorkforce * (laborMarket.underemploymentRate / 100));

  const protections = Object.values(laborMarket.workerProtections || {});
  const avgProtectionScore =
    protections.length > 0 ? protections.reduce((a, b) => a + b, 0) / protections.length : 0;

  return {
    employed,
    unemployed,
    underemployed,
    workingAgePopulation: Math.round(
      totalWorkforce / (laborMarket.laborForceParticipationRate / 100)
    ),
    laborForceSize: totalWorkforce,
    effectiveUnemployment:
      totalWorkforce > 0 ? ((unemployed + underemployed) / totalWorkforce) * 100 : 0,
    employedWorkforce: employed,
    unemployedWorkforce: Math.round(totalWorkforce * (laborMarket.unemploymentRate / 100)),
    avgProtectionScore,
    employmentRate: laborMarket.employmentRate,
    unemploymentRate: laborMarket.unemploymentRate,
  };
}

/**
 * Get a color identifier for an employment type
 *
 * Returns a predefined color for consistent visualization of employment types
 * in charts and UI components.
 *
 * @param type - Employment type identifier (e.g., 'fullTime', 'partTime')
 * @returns Tailwind color name
 *
 * @example
 * ```ts
 * const color = getEmploymentTypeColor('fullTime'); // 'blue'
 * ```
 */
export function getEmploymentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    fullTime: "blue",
    partTime: "green",
    temporary: "yellow",
    seasonal: "orange",
    selfEmployed: "purple",
    gig: "pink",
    informal: "red",
  };
  return colors[type] || "gray";
}

/**
 * Get a color identifier for an economic sector
 *
 * Returns a predefined color for consistent visualization of economic sectors
 * across charts and UI components.
 *
 * @param sector - Sector identifier (e.g., 'agriculture', 'manufacturing')
 * @returns Tailwind color name
 *
 * @example
 * ```ts
 * const color = getSectorColor('finance'); // 'amber'
 * ```
 */
export function getSectorColor(sector: string): string {
  const colors: Record<string, string> = {
    agriculture: "green",
    mining: "orange",
    manufacturing: "blue",
    construction: "yellow",
    utilities: "purple",
    wholesale: "cyan",
    retail: "pink",
    transportation: "indigo",
    information: "teal",
    finance: "amber",
    professional: "emerald",
    education: "violet",
    healthcare: "red",
    hospitality: "lime",
    government: "gray",
    other: "slate",
  };
  return colors[sector] || "gray";
}

/**
 * Get a color identifier for a labor protection type
 *
 * Returns a predefined color for consistent visualization of labor protections
 * in UI components showing worker rights and regulations.
 *
 * @param protection - Protection type identifier (e.g., 'jobSecurity', 'wageProtection')
 * @returns Tailwind color name
 *
 * @example
 * ```ts
 * const color = getProtectionColor('healthSafety'); // 'red'
 * ```
 */
export function getProtectionColor(protection: string): string {
  const colors: Record<string, string> = {
    jobSecurity: "blue",
    wageProtection: "green",
    healthSafety: "red",
    discriminationProtection: "purple",
    collectiveRights: "orange",
  };
  return colors[protection] || "gray";
}

/**
 * Bounds for labor market sliders, adjusted by atomic component impacts
 */
export interface LaborBounds {
  /** Min/max for unemployment rate slider */
  unemploymentRate?: { min: number; max: number };
  /** Min/max for participation rate slider */
  participationRate?: { min: number; max: number };
  /** Min/max for minimum wage slider */
  minimumWage?: { min: number; max: number };
  /** Min/max for living wage slider */
  livingWage?: { min: number; max: number };
}

/**
 * Compute labor market slider bounds from selected atomic components
 *
 * Uses employmentImpact values to adjust slider ranges:
 * - unemploymentModifier → narrows/broadens unemployment rate range
 * - participationModifier → shifts participation rate range
 * - wageGrowthModifier → adjusts wage slider ranges
 *
 * @param selectedComponents - Array of selected economic component types
 * @returns Bounds overrides for labor sliders (undefined fields use defaults)
 */
export function getLaborBounds(
  selectedComponents: EconomicComponentType[]
): LaborBounds {
  if (selectedComponents.length === 0) return {};

  let totalUnemploymentMod = 0;
  let totalParticipationMod = 1;
  let totalWageGrowthMod = 1;

  selectedComponents.forEach((compType) => {
    const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
    if (!component?.employmentImpact) return;

    totalUnemploymentMod += component.employmentImpact.unemploymentModifier || 0;
    totalParticipationMod *= component.employmentImpact.participationModifier || 1;
    totalWageGrowthMod *= component.employmentImpact.wageGrowthModifier || 1;
  });

  const bounds: LaborBounds = {};

  // Unemployment: default 0-30, narrowed by strong modifiers
  if (totalUnemploymentMod < -2) {
    bounds.unemploymentRate = { min: 0, max: 15 };
  } else if (totalUnemploymentMod > 2) {
    bounds.unemploymentRate = { min: 0, max: 20 };
  }

  // Participation: default 30-90, shifted by participation modifier
  if (totalParticipationMod > 1.2) {
    bounds.participationRate = {
      min: Math.round(30 * totalParticipationMod),
      max: Math.min(95, Math.round(90 * totalParticipationMod)),
    };
  } else if (totalParticipationMod < 0.8) {
    bounds.participationRate = {
      min: 20,
      max: Math.round(70 * totalParticipationMod),
    };
  }

  // Wages: default 5-50 min, 10-100 living, adjusted by wage growth modifier
  if (totalWageGrowthMod > 1.3) {
    bounds.minimumWage = { min: 8, max: 50 };
    bounds.livingWage = { min: 15, max: 100 };
  } else if (totalWageGrowthMod < 0.7) {
    bounds.minimumWage = { min: 3, max: 30 };
    bounds.livingWage = { min: 8, max: 60 };
  }

  return bounds;
}
