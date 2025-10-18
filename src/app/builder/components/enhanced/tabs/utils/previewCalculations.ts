/**
 * Preview Calculation Utilities
 *
 * Provides calculation and aggregation functions for the economy preview tab,
 * including summaries for sectors, labor, and demographics, as well as
 * validation and effectiveness calculations for atomic economic components.
 * Extracted from EconomyPreviewTab for reusability.
 */

import type {
  EconomyBuilderState,
  DemographicsConfiguration,
  LaborConfiguration,
  SectorConfiguration
} from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

/**
 * Aggregated summary of all economic sectors
 */
export interface SectorSummary {
  totalGDP: number;
  totalEmployment: number;
  primarySectors: SectorConfiguration[];
  secondarySectors: SectorConfiguration[];
  tertiarySectors: SectorConfiguration[];
}

/**
 * Aggregated summary of labor market statistics
 */
export interface LaborSummary {
  totalWorkforce: number;
  employed: number;
  unemployed: number;
  unemploymentRate: number;
  participationRate: number;
  averageHours: number;
  minimumWage: number;
  livingWage: number;
  wageGap: number;
}

/**
 * Aggregated summary of demographic statistics
 */
export interface DemographicsSummary {
  totalPopulation: number;
  workingAgePopulation: number;
  urbanPopulation: number;
  ruralPopulation: number;
  lifeExpectancy: number;
  literacyRate: number;
  populationGrowth: number;
  dependencyRatio: number;
  tertiaryEducation: number;
}

/**
 * Validation result with errors and warnings
 */
export interface ValidationStatus {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate overall effectiveness score for selected atomic economic components
 *
 * Computes a weighted effectiveness score considering base effectiveness,
 * synergies between components, and conflicts that reduce effectiveness.
 *
 * @param selectedComponents - Array of selected atomic component types
 * @returns Overall effectiveness score (0-100)
 *
 * @example
 * ```ts
 * const effectiveness = calculateComponentEffectiveness([
 *   'FREE_MARKET',
 *   'MARKET_REGULATION'
 * ]);
 * // Returns score accounting for synergies/conflicts
 * ```
 */
export function calculateComponentEffectiveness(
  selectedComponents: EconomicComponentType[]
): number {
  if (selectedComponents.length === 0) return 0;

  const totalEffectiveness = selectedComponents.reduce(
    (sum, comp) => sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0), 0
  );

  const baseEffectiveness = totalEffectiveness / selectedComponents.length;

  let synergyBonus = 0;
  let conflictPenalty = 0;

  selectedComponents.forEach(comp1 => {
    selectedComponents.forEach(comp2 => {
      if (comp1 !== comp2) {
        const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
        if (component1?.synergies.includes(comp2)) {
          synergyBonus += 2;
        }
        if (component1?.conflicts.includes(comp2)) {
          conflictPenalty += 5;
        }
      }
    });
  });

  return Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
}

/**
 * Calculate aggregated sector summary from sector configurations
 *
 * @param sectors - Array of sector configurations
 * @returns Aggregated sector metrics
 *
 * @example
 * ```ts
 * const summary = calculateSectorSummary(sectors);
 * // { totalGDP: 100, totalEmployment: 100, primarySectors: [...] }
 * ```
 */
export function calculateSectorSummary(sectors: SectorConfiguration[]): SectorSummary {
  return {
    totalGDP: sectors.reduce((sum, sector) => sum + sector.gdpContribution, 0),
    totalEmployment: sectors.reduce((sum, sector) => sum + sector.employmentShare, 0),
    primarySectors: sectors.filter(s => s.category === 'Primary'),
    secondarySectors: sectors.filter(s => s.category === 'Secondary'),
    tertiarySectors: sectors.filter(s => s.category === 'Tertiary')
  };
}

/**
 * Calculate aggregated labor market summary
 *
 * @param labor - Labor market configuration
 * @returns Aggregated labor metrics
 *
 * @example
 * ```ts
 * const summary = calculateLaborSummary(laborConfig);
 * // { totalWorkforce: 10000000, employed: 9500000, ... }
 * ```
 */
export function calculateLaborSummary(labor: LaborConfiguration): LaborSummary {
  const totalWorkforce = labor.totalWorkforce;
  const employed = Math.round(totalWorkforce * (labor.employmentRate / 100));
  const unemployed = totalWorkforce - employed;

  return {
    totalWorkforce,
    employed,
    unemployed,
    unemploymentRate: labor.unemploymentRate,
    participationRate: labor.laborForceParticipationRate,
    averageHours: labor.averageWorkweekHours,
    minimumWage: labor.minimumWageHourly,
    livingWage: labor.livingWageHourly,
    wageGap: labor.livingWageHourly - labor.minimumWageHourly
  };
}

/**
 * Calculate aggregated demographics summary
 *
 * @param demographics - Demographics configuration
 * @returns Aggregated demographic metrics
 *
 * @example
 * ```ts
 * const summary = calculateDemographicsSummary(demographics);
 * // { totalPopulation: 10000000, workingAgePopulation: 6500000, ... }
 * ```
 */
export function calculateDemographicsSummary(demographics: DemographicsConfiguration): DemographicsSummary {
  const totalPop = demographics.totalPopulation;
  const workingAge = Math.round(totalPop * (demographics.ageDistribution.age15to64 / 100));
  const urbanPop = Math.round(totalPop * (demographics.urbanRuralSplit.urban / 100));

  return {
    totalPopulation: totalPop,
    workingAgePopulation: workingAge,
    urbanPopulation: urbanPop,
    ruralPopulation: totalPop - urbanPop,
    lifeExpectancy: demographics.lifeExpectancy,
    literacyRate: demographics.literacyRate,
    populationGrowth: demographics.populationGrowthRate,
    dependencyRatio: demographics.totalDependencyRatio,
    tertiaryEducation: demographics.educationLevels.tertiary
  };
}

/**
 * Validate economy builder configuration for errors and warnings
 *
 * Checks that percentages sum to 100, rates are realistic, and
 * data is internally consistent.
 *
 * @param economyBuilder - Complete economy builder state
 * @param sectorSummary - Aggregated sector summary
 * @param laborSummary - Aggregated labor summary
 * @returns Validation status with errors and warnings
 *
 * @example
 * ```ts
 * const validation = validateConfiguration(state, sectors, labor);
 * if (!validation.isValid) {
 *   console.error(validation.errors);
 * }
 * ```
 */
export function validateConfiguration(
  economyBuilder: EconomyBuilderState,
  sectorSummary: SectorSummary,
  laborSummary: LaborSummary
): ValidationStatus {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check sector validation
  if (Math.abs(sectorSummary.totalGDP - 100) > 1) {
    errors.push(`Sector GDP contributions must sum to 100% (currently ${sectorSummary.totalGDP.toFixed(1)}%)`);
  }

  if (Math.abs(sectorSummary.totalEmployment - 100) > 1) {
    errors.push(`Employment shares must sum to 100% (currently ${sectorSummary.totalEmployment.toFixed(1)}%)`);
  }

  // Check labor validation
  if (laborSummary.unemploymentRate < 0 || laborSummary.unemploymentRate > 50) {
    warnings.push('Unemployment rate seems unrealistic');
  }

  if (laborSummary.participationRate > 90) {
    warnings.push('Labor force participation rate seems too high');
  }

  // Check demographics validation
  const ageSum = economyBuilder.demographics.ageDistribution.under15 +
                 economyBuilder.demographics.ageDistribution.age15to64 +
                 economyBuilder.demographics.ageDistribution.over65;

  if (Math.abs(ageSum - 100) > 1) {
    errors.push(`Age distribution must sum to 100% (currently ${ageSum.toFixed(1)}%)`);
  }

  const urbanRuralSum = economyBuilder.demographics.urbanRuralSplit.urban +
                        economyBuilder.demographics.urbanRuralSplit.rural;

  if (Math.abs(urbanRuralSum - 100) > 1) {
    errors.push(`Urban-rural split must sum to 100% (currently ${urbanRuralSum.toFixed(1)}%)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get a color identifier for a sector by ID
 *
 * @param sectorId - Sector identifier
 * @returns Tailwind color name
 *
 * @example
 * ```ts
 * const color = getSectorColor('finance'); // 'yellow'
 * ```
 */
export function getSectorColor(sectorId: string): string {
  const colors: Record<string, string> = {
    agriculture: 'green',
    manufacturing: 'blue',
    services: 'purple',
    technology: 'cyan',
    finance: 'yellow',
    government: 'gray'
  };
  return colors[sectorId] || 'gray';
}

/**
 * Get a color identifier for an employment type
 *
 * @param type - Employment type identifier
 * @returns Tailwind color name
 *
 * @example
 * ```ts
 * const color = getEmploymentTypeColor('partTime'); // 'green'
 * ```
 */
export function getEmploymentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    fullTime: 'blue',
    partTime: 'green',
    temporary: 'yellow',
    seasonal: 'orange',
    selfEmployed: 'purple',
    gig: 'pink',
    informal: 'red'
  };
  return colors[type] || 'gray';
}
