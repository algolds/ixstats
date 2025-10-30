/**
 * Labor Market Calculation Utilities
 *
 * Provides calculation functions for deriving labor market metrics and
 * utility functions for color-coding employment types, sectors, and protections.
 * Extracted from LaborEmploymentTab for reusability.
 */

import type { LaborConfiguration } from "~/types/economy-builder";

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

  return {
    employed,
    unemployed,
    underemployed,
    workingAgePopulation: Math.round(
      totalWorkforce / (laborMarket.laborForceParticipationRate / 100)
    ),
    laborForceSize: totalWorkforce,
    effectiveUnemployment: ((unemployed + underemployed) / totalWorkforce) * 100,
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
