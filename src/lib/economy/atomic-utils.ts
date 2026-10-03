/**
 * Atomic Economic Components - Utilities Layer
 *
 * Pure utility functions for economic component calculations,
 * synergy detection, filtering, and validation.
 * No React dependencies - all pure TypeScript functions.
 *
 * Functions:
 * - Synergy and conflict detection
 * - Component filtering and searching
 * - Economic metrics calculations
 * - Validation logic
 * - Color and formatting utilities
 */

import {
  ATOMIC_ECONOMIC_COMPONENTS,
  type AtomicEconomicComponent,
  type EconomicComponentType,
  type EconomicCategory,
} from "./atomic-data";

// ============================================================================
// Synergy and Conflict Detection
// ============================================================================

/**
 * Check if two economic components have synergy
 * @param component1Id First component type
 * @param component2Id Second component type
 * @returns Synergy bonus value (0-10)
 */
function checkEconomicSynergy(component1Id: string, component2Id: string): number {
  const component1 = ATOMIC_ECONOMIC_COMPONENTS[component1Id as EconomicComponentType];
  const component2 = ATOMIC_ECONOMIC_COMPONENTS[component2Id as EconomicComponentType];

  if (!component1 || !component2) return 0;

  const synergy1 = component1.synergies.includes(component2Id as EconomicComponentType) ? 5 : 0;
  const synergy2 = component2.synergies.includes(component1Id as EconomicComponentType) ? 5 : 0;

  return Math.max(synergy1, synergy2);
}

/**
 * Check if two economic components conflict
 * @param component1Id First component type
 * @param component2Id Second component type
 * @returns True if components conflict
 */
function checkEconomicConflict(component1Id: string, component2Id: string): boolean {
  const component1 = ATOMIC_ECONOMIC_COMPONENTS[component1Id as EconomicComponentType];
  const component2 = ATOMIC_ECONOMIC_COMPONENTS[component2Id as EconomicComponentType];

  if (!component1 || !component2) return false;

  return (
    component1.conflicts.includes(component2Id as EconomicComponentType) ||
    component2.conflicts.includes(component1Id as EconomicComponentType)
  );
}

/**
 * Detect all synergies between selected components
 * @param selectedComponents Array of selected component types
 * @returns Array of synergy pairs with bonus values
 */
export function detectEconomicSynergies(selectedComponents: EconomicComponentType[]): Array<{
  component1: EconomicComponentType;
  component2: EconomicComponentType;
  bonus: number;
  description: string;
}> {
  const synergies: Array<{
    component1: EconomicComponentType;
    component2: EconomicComponentType;
    bonus: number;
    description: string;
  }> = [];

  for (let i = 0; i < selectedComponents.length; i++) {
    for (let j = i + 1; j < selectedComponents.length; j++) {
      const comp1 = selectedComponents[i];
      const comp2 = selectedComponents[j];

      if (!comp1 || !comp2) continue;

      const bonus = checkEconomicSynergy(comp1, comp2);
      if (bonus > 0) {
        const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
        const component2 = ATOMIC_ECONOMIC_COMPONENTS[comp2];

        synergies.push({
          component1: comp1,
          component2: comp2,
          bonus,
          description: `${component1?.name ?? ""} synergizes with ${component2?.name ?? ""}`,
        });
      }
    }
  }

  return synergies;
}

/**
 * Detect all conflicts between selected components
 * @param selectedComponents Array of selected component types
 * @returns Array of conflict pairs with descriptions
 */
export function detectEconomicConflicts(selectedComponents: EconomicComponentType[]): Array<{
  component1: EconomicComponentType;
  component2: EconomicComponentType;
  penalty: number;
  description: string;
}> {
  const conflicts: Array<{
    component1: EconomicComponentType;
    component2: EconomicComponentType;
    penalty: number;
    description: string;
  }> = [];

  for (let i = 0; i < selectedComponents.length; i++) {
    for (let j = i + 1; j < selectedComponents.length; j++) {
      const comp1 = selectedComponents[i];
      const comp2 = selectedComponents[j];

      if (!comp1 || !comp2) continue;

      if (checkEconomicConflict(comp1, comp2)) {
        const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
        const component2 = ATOMIC_ECONOMIC_COMPONENTS[comp2];

        conflicts.push({
          component1: comp1,
          component2: comp2,
          penalty: 15,
          description: `${component1?.name ?? ""} conflicts with ${component2?.name ?? ""}`,
        });
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Component Filtering and Searching
// ============================================================================

/**
 * Filter economic components by category
 * @param components Array of component types
 * @param category Category to filter by (null for all)
 * @returns Filtered array of components
 */
function filterEconomicComponents(
  components: EconomicComponentType[],
  category: EconomicCategory | null
): EconomicComponentType[] {
  if (!category) return components;

  return components.filter((compType) => {
    const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
    return component?.category === category;
  });
}

/**
 * Search economic components by query string
 * @param components Array of component types
 * @param query Search query
 * @returns Filtered array of components matching query
 */
function searchEconomicComponents(
  components: EconomicComponentType[],
  query: string
): EconomicComponentType[] {
  if (!query.trim()) return components;

  const lowerQuery = query.toLowerCase();

  return components.filter((compType) => {
    const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
    if (!component) return false;

    return (
      component.name.toLowerCase().includes(lowerQuery) ||
      component.description.toLowerCase().includes(lowerQuery) ||
      component.category.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Filter and search components (combined operation)
 * @param components Array of component types
 * @param category Category to filter by (null for all)
 * @param query Search query
 * @returns Filtered and searched array of components
 */
export function filterAndSearchComponents(
  components: EconomicComponentType[],
  category: EconomicCategory | null,
  query: string
): EconomicComponentType[] {
  let filtered = filterEconomicComponents(components, category);
  filtered = searchEconomicComponents(filtered, query);
  return filtered;
}

// ============================================================================
// Economic Calculations
// ============================================================================

/**
 * Economic Effectiveness Result
 */
interface EconomicEffectivenessResult {
  baseEffectiveness: number;
  synergyBonus: number;
  conflictPenalty: number;
  totalEffectiveness: number;
  synergyCount: number;
  conflictCount: number;
}

/**
 * Calculate total economic effectiveness from selected components
 * @param selectedComponents Array of selected component types
 * @returns Economic effectiveness metrics
 */
function calculateEconomicEffectiveness(
  selectedComponents: EconomicComponentType[]
): EconomicEffectivenessResult {
  const components = selectedComponents
    .map((id) => ATOMIC_ECONOMIC_COMPONENTS[id])
    .filter((comp): comp is AtomicEconomicComponent => comp !== undefined);

  const baseEffectiveness =
    components.reduce((sum, comp) => sum + comp.effectiveness, 0) / (components.length || 1);

  let synergyBonus = 0;
  let synergyCount = 0;
  let conflictPenalty = 0;
  let conflictCount = 0;

  for (let i = 0; i < selectedComponents.length; i++) {
    for (let j = i + 1; j < selectedComponents.length; j++) {
      const comp1 = selectedComponents[i];
      const comp2 = selectedComponents[j];

      if (!comp1 || !comp2) continue;

      const synergy = checkEconomicSynergy(comp1, comp2);
      if (synergy > 0) {
        synergyBonus += synergy;
        synergyCount++;
      }

      if (checkEconomicConflict(comp1, comp2)) {
        conflictPenalty += 15;
        conflictCount++;
      }
    }
  }

  const totalEffectiveness = Math.max(
    0,
    Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty)
  );

  return {
    baseEffectiveness,
    synergyBonus,
    conflictPenalty,
    totalEffectiveness,
    synergyCount,
    conflictCount,
  };
}

/**
 * Sector Balance Analysis
 */
interface SectorBalance {
  sector: string;
  impact: number;
  percentage: number;
}

/**
 * Calculate sector balance distribution
 * @param selectedComponents Array of selected component types
 * @returns Array of sector impact percentages
 */
function calculateSectorBalance(selectedComponents: EconomicComponentType[]): SectorBalance[] {
  const components = selectedComponents
    .map((id) => ATOMIC_ECONOMIC_COMPONENTS[id])
    .filter((comp): comp is AtomicEconomicComponent => comp !== undefined);

  const sectorTotals: Record<string, number> = {};

  // Aggregate sector impacts
  components.forEach((comp) => {
    Object.entries(comp.sectorImpact).forEach(([sector, impact]) => {
      sectorTotals[sector] = (sectorTotals[sector] || 0) + impact;
    });
  });

  const totalImpact = Object.values(sectorTotals).reduce((sum, val) => sum + val, 0);

  return Object.entries(sectorTotals)
    .map(([sector, impact]) => ({
      sector,
      impact,
      percentage: totalImpact > 0 ? (impact / totalImpact) * 100 : 0,
    }))
    .sort((a, b) => b.impact - a.impact);
}

/**
 * Economic Metrics Result
 */
export interface EconomicMetrics {
  effectiveness: EconomicEffectivenessResult;
  sectorBalance: SectorBalance[];
  totalCost: number;
  maintenanceCost: number;
  avgComplexity: "Low" | "Medium" | "High";
  requiredCapacity: number;
  optimalTaxRates: {
    corporate: number;
    income: number;
  };
  employmentImpact: {
    unemployment: number;
    participation: number;
    wageGrowth: number;
  };
}

/**
 * Calculate comprehensive economic metrics
 * @param selectedComponents Array of selected component types
 * @returns Complete economic metrics
 */
export function getEconomicMetrics(selectedComponents: EconomicComponentType[]): EconomicMetrics {
  const components = selectedComponents
    .map((id) => ATOMIC_ECONOMIC_COMPONENTS[id])
    .filter((comp): comp is AtomicEconomicComponent => comp !== undefined);

  const effectiveness = calculateEconomicEffectiveness(selectedComponents);
  const sectorBalance = calculateSectorBalance(selectedComponents);

  const totalCost = components.reduce((sum, comp) => sum + comp.implementationCost, 0);
  const maintenanceCost = components.reduce((sum, comp) => sum + comp.maintenanceCost, 0);
  const requiredCapacity = components.reduce((sum, comp) => sum + comp.requiredCapacity, 0);

  // Calculate average complexity
  const complexityMap = { Low: 1, Medium: 2, High: 3 };
  const avgComplexityNum =
    components.reduce((sum, comp) => sum + complexityMap[comp.metadata.complexity], 0) /
    (components.length || 1);
  const avgComplexity: "Low" | "Medium" | "High" =
    avgComplexityNum < 1.5 ? "Low" : avgComplexityNum < 2.5 ? "Medium" : "High";

  // Calculate optimal tax rates (weighted average)
  const optimalCorporateRate =
    components.reduce((sum, comp) => sum + comp.taxImpact.optimalCorporateRate, 0) /
    (components.length || 1);
  const optimalIncomeRate =
    components.reduce((sum, comp) => sum + comp.taxImpact.optimalIncomeRate, 0) /
    (components.length || 1);

  // Calculate employment impact (average)
  const unemployment =
    components.reduce((sum, comp) => sum + comp.employmentImpact.unemploymentModifier, 0) /
    (components.length || 1);
  const participation =
    components.reduce((sum, comp) => sum + comp.employmentImpact.participationModifier, 0) /
    (components.length || 1);
  const wageGrowth =
    components.reduce((sum, comp) => sum + comp.employmentImpact.wageGrowthModifier, 0) /
    (components.length || 1);

  return {
    effectiveness,
    sectorBalance,
    totalCost,
    maintenanceCost,
    avgComplexity,
    requiredCapacity,
    optimalTaxRates: {
      corporate: Math.round(optimalCorporateRate),
      income: Math.round(optimalIncomeRate),
    },
    employmentImpact: {
      unemployment,
      participation,
      wageGrowth,
    },
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate economic component selection
 * @param selectedComponents Array of selected component types
 * @param maxComponents Maximum allowed components
 * @returns Validation result with errors and warnings
 */
export function validateEconomicSelection(
  selectedComponents: EconomicComponentType[],
  maxComponents: number = 12
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check component limit
  if (selectedComponents.length > maxComponents) {
    errors.push(`Too many components selected (${selectedComponents.length}/${maxComponents})`);
  }

  // Check for conflicts
  const conflicts = detectEconomicConflicts(selectedComponents);
  if (conflicts.length > 0) {
    warnings.push(
      `${conflicts.length} conflicting component${conflicts.length > 1 ? "s" : ""} detected`
    );
  }

  // Check for at least one economic model
  const hasEconomicModel = selectedComponents.some((comp) => {
    const component = ATOMIC_ECONOMIC_COMPONENTS[comp];
    return component?.category === ("Economic Model" as EconomicCategory);
  });

  if (!hasEconomicModel && selectedComponents.length > 0) {
    warnings.push("No fundamental economic model selected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Color and Formatting Utilities
// ============================================================================
export { formatCurrency } from "~/lib/utils/format-utils";

// ============================================================================
// Component Utility Functions
// ============================================================================

/**
 * Get all available component types
 * @returns Array of all economic component types
 */
export function getAllComponents(): EconomicComponentType[] {
  return Object.keys(ATOMIC_ECONOMIC_COMPONENTS) as EconomicComponentType[];
}
