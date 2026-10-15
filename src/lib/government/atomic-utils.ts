/**
 * Atomic Government Utilities
 *
 * Pure utility functions for government component operations.
 * This file contains NO React code, only TypeScript functions.
 *
 * Functions:
 * - Synergy detection and scoring
 * - Conflict validation
 * - Component filtering and search
 * - Effectiveness calculations
 * - Metrics computation
 *
 * @module atomic-government-utils
 */

import { ComponentType } from "@prisma/client";
import type { AtomicGovernmentComponent } from "./atomic-data";
import { ATOMIC_COMPONENTS } from "./atomic-data";
import type { EffectivenessMetrics } from "./tax/atomic-tax-components";
import { EconomicComponentType } from "~/lib/economy/atomic-data";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";
import { ATOMIC_TAX_COMPONENTS } from "./tax/atomic-tax-components";
import { IxTime } from "~/lib/ixtime";
import { CONFLICT_PENALTY, findSynergyPair, synergyScoreDelta } from "./synergy-table";

/**
 * Calculate government effectiveness metrics based on selected components
 *
 * @param selectedComponents - Array of selected component types
 * @returns Effectiveness metrics including base, synergies, conflicts, and total
 */
export function calculateGovernmentEffectiveness(
  selectedComponents: ComponentType[]
): EffectivenessMetrics {
  const components = selectedComponents
    .map((type) => ATOMIC_COMPONENTS[type])
    .filter((comp): comp is AtomicGovernmentComponent => comp !== undefined);

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

      const synergy = checkGovernmentSynergy(comp1, comp2);
      if (synergy > 0) {
        synergyBonus += synergy;
        synergyCount++;
      }

      if (checkGovernmentConflict(comp1, comp2)) {
        conflictPenalty += CONFLICT_PENALTY;
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
 * Check for synergy between two government components, from the shared synergy table.
 * Scores match the server's: +10 for an additive synergy, +10 × multiplier for a
 * multiplicative one.
 *
 * @param comp1 - First component type
 * @param comp2 - Second component type
 * @returns Synergy score (0 when the pair has no synergy)
 */
export function checkGovernmentSynergy(comp1: string, comp2: string): number {
  const pair = findSynergyPair(comp1, comp2);
  if (!pair || pair.type === "CONFLICTING") return 0;
  return synergyScoreDelta(pair.type, pair.multiplier);
}

/**
 * Check for conflict between two government components, from the shared synergy table.
 *
 * @param comp1 - First component type
 * @param comp2 - Second component type
 * @returns True if components conflict
 */
export function checkGovernmentConflict(comp1: string, comp2: string): boolean {
  return findSynergyPair(comp1, comp2)?.type === "CONFLICTING";
}

/**
 * Filter components by category
 *
 * @param components - Component library
 * @param category - Category to filter by
 * @returns Filtered components
 */
export function filterByCategory(
  components: Partial<Record<ComponentType, AtomicGovernmentComponent>>,
  category: string | null
): Partial<Record<ComponentType, AtomicGovernmentComponent>> {
  if (!category) return components;

  return Object.fromEntries(
    Object.entries(components).filter(([, comp]) => comp?.category === category)
  ) as Partial<Record<ComponentType, AtomicGovernmentComponent>>;
}

/**
 * Search components by name or description
 *
 * @param components - Component library
 * @param query - Search query string
 * @returns Filtered components matching search
 */
export function searchComponents(
  components: Partial<Record<ComponentType, AtomicGovernmentComponent>>,
  query: string
): Partial<Record<ComponentType, AtomicGovernmentComponent>> {
  if (!query.trim()) return components;

  const lowerQuery = query.toLowerCase();

  return Object.fromEntries(
    Object.entries(components).filter(([, comp]) => {
      if (!comp) return false;
      return (
        comp.name.toLowerCase().includes(lowerQuery) ||
        comp.description.toLowerCase().includes(lowerQuery)
      );
    })
  ) as Partial<Record<ComponentType, AtomicGovernmentComponent>>;
}

/**
 * Detect all synergies in selected components
 *
 * @param selectedComponents - Array of selected component types
 * @returns Array of synergy pairs with scores
 */
export function detectSynergies(
  selectedComponents: ComponentType[]
): Array<{ comp1: ComponentType; comp2: ComponentType; score: number }> {
  const synergies: Array<{
    comp1: ComponentType;
    comp2: ComponentType;
    score: number;
  }> = [];

  for (let i = 0; i < selectedComponents.length; i++) {
    for (let j = i + 1; j < selectedComponents.length; j++) {
      const comp1 = selectedComponents[i];
      const comp2 = selectedComponents[j];

      if (!comp1 || !comp2) continue;

      const score = checkGovernmentSynergy(comp1, comp2);
      if (score > 0) {
        synergies.push({ comp1, comp2, score });
      }
    }
  }

  return synergies;
}

/**
 * Detect all conflicts in selected components
 *
 * @param selectedComponents - Array of selected component types
 * @returns Array of conflicting component pairs
 */
export function detectConflicts(
  selectedComponents: ComponentType[]
): Array<{ comp1: ComponentType; comp2: ComponentType }> {
  const conflicts: Array<{ comp1: ComponentType; comp2: ComponentType }> = [];

  for (let i = 0; i < selectedComponents.length; i++) {
    for (let j = i + 1; j < selectedComponents.length; j++) {
      const comp1 = selectedComponents[i];
      const comp2 = selectedComponents[j];

      if (!comp1 || !comp2) continue;

      if (checkGovernmentConflict(comp1, comp2)) {
        conflicts.push({ comp1, comp2 });
      }
    }
  }

  return conflicts;
}

/**
 * Calculate total implementation cost
 *
 * @param selectedComponents - Array of selected component types
 * @returns Total implementation cost
 */
export function calculateImplementationCost(selectedComponents: ComponentType[]): number {
  return selectedComponents.reduce((total, type) => {
    const component = ATOMIC_COMPONENTS[type];
    return total + (component?.implementationCost ?? 0);
  }, 0);
}

/**
 * Calculate total maintenance cost
 *
 * @param selectedComponents - Array of selected component types
 * @returns Total maintenance cost
 */
export function calculateMaintenanceCost(selectedComponents: ComponentType[]): number {
  return selectedComponents.reduce((total, type) => {
    const component = ATOMIC_COMPONENTS[type];
    return total + (component?.maintenanceCost ?? 0);
  }, 0);
}

/**
 * Calculate total required capacity
 *
 * @param selectedComponents - Array of selected component types
 * @returns Total required capacity
 */
export function calculateRequiredCapacity(selectedComponents: ComponentType[]): number {
  return selectedComponents.reduce((total, type) => {
    const component = ATOMIC_COMPONENTS[type];
    return total + (component?.requiredCapacity ?? 0);
  }, 0);
}

/**
 * Count the selected components that are defined in the library. Only these count toward
 * the component cap; an unknown type (for example from old saved data) is ignored.
 */
export function countDefinedComponents(selectedComponents: readonly string[]): number {
  return new Set(selectedComponents.filter((type) => ATOMIC_COMPONENTS[type as ComponentType]))
    .size;
}

/**
 * Validate component selection
 *
 * Only defined components count toward the cap. Conflicts are warnings, never errors, and an
 * empty selection is allowed: nothing here blocks a player from moving on.
 *
 * @param selectedComponents - Array of selected component types
 * @param maxComponents - Maximum allowed components
 * @returns Validation result with blocking errors and non-blocking warnings
 */
export function validateSelection(
  selectedComponents: ComponentType[],
  maxComponents: number
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (countDefinedComponents(selectedComponents) > maxComponents) {
    errors.push(`Maximum ${maxComponents} components allowed`);
  }

  const conflicts = detectConflicts(selectedComponents);
  if (conflicts.length > 0) {
    warnings.push(
      conflicts.length === 1
        ? "1 pair of components works against each other"
        : `${conflicts.length} pairs of components work against each other`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get unique categories from component library
 *
 * @param components - Component library
 * @returns Array of unique category names
 */
export function getCategories(
  components: Partial<Record<ComponentType, AtomicGovernmentComponent>>
): string[] {
  const categories = new Set<string>();

  Object.values(components).forEach((comp) => {
    if (comp?.category) {
      categories.add(comp.category);
    }
  });

  return Array.from(categories).sort();
}

/**
 * Calculate the country's civil service capacity limit
 * @param population - Current country population
 * @param governmentEffectiveness - Government effectiveness score (0-100)
 */
export function calculateCivilServiceCapacity(
  population: number,
  governmentEffectiveness: number
): number {
  return Math.max(50, 100 + Math.floor((population / 100000) * (governmentEffectiveness / 100)));
}

/**
 * Calculate total staff consumed by active and implementing components
 */
export function calculateTotalConsumedStaff(
  govComponents: ComponentType[],
  econComponents: EconomicComponentType[],
  taxComponents: string[]
): number {
  let totalStaff = 0;

  govComponents.forEach((type) => {
    const component = ATOMIC_COMPONENTS[type];
    if (component) {
      totalStaff += component.metadata.staffRequired || 0;
    }
  });

  econComponents.forEach((type) => {
    const component = ATOMIC_ECONOMIC_COMPONENTS[type];
    if (component) {
      totalStaff += component.metadata.staffRequired || 0;
    }
  });

  taxComponents.forEach((id) => {
    const component = ATOMIC_TAX_COMPONENTS[id];
    if (component) {
      totalStaff += component.metadata.staffRequired || 0;
    }
  });

  return totalStaff;
}

/**
 * Calculate combined economic modifiers from active components
 */
export function calculateComponentEconomicModifiers(
  govComponents: ComponentType[],
  econComponents: EconomicComponentType[],
  taxComponents: string[]
) {
  let maintenanceCost = 0;
  let taxRevenueModifier = 0;
  let unemploymentModifier = 0;
  let inflationModifier = 0;

  govComponents.forEach((type) => {
    const component = ATOMIC_COMPONENTS[type];
    if (component) {
      maintenanceCost += component.maintenanceCost || 0;
    }
  });

  econComponents.forEach((type) => {
    const component = ATOMIC_ECONOMIC_COMPONENTS[type];
    if (component) {
      maintenanceCost += component.maintenanceCost || 0;
      if (component.employmentImpact) {
        unemploymentModifier += component.employmentImpact.unemploymentModifier || 0;
      }
      if (type === "PLANNED_ECONOMY" || type === "STATE_CAPITALISM") {
        inflationModifier += 0.01;
      } else if (type === "KNOWLEDGE_ECONOMY" || type === "FREE_TRADE") {
        inflationModifier -= 0.005;
      }
    }
  });

  taxComponents.forEach((id) => {
    const component = ATOMIC_TAX_COMPONENTS[id];
    if (component) {
      maintenanceCost += component.maintenanceCost || 0;
      if (component.category === "Revenue Strategies" || component.id.includes("tax")) {
        taxRevenueModifier += 0.5; // +0.5% GDP
      } else if (component.category === "Compliance Systems") {
        taxRevenueModifier += 0.3; // +0.3% GDP
      } else if (component.category === "Incentive Structures") {
        taxRevenueModifier -= 0.2; // Tax incentives/credits reduce tax revenue
      }
    }
  });

  return {
    maintenanceCost,
    taxRevenueModifier, // percentage points e.g. +0.5 means +0.5%
    unemploymentModifier, // percentage points e.g. -0.5 means -0.5%
    inflationModifier, // decimal fraction e.g. +0.01 means +1%
  };
}

/**
 * Helper to parse a timeToImplement string (e.g. "12 months", "2-3 years")
 * and return the number of months or years to add.
 */
export function parseTimeToImplement(timeStr: string): { months?: number; years?: number } {
  const str = timeStr.toLowerCase().trim();
  if (str.includes("month")) {
    const matches = str.match(/\d+/g);
    if (matches && matches.length > 0) {
      const val = parseInt(matches[matches.length - 1]!, 10);
      return { months: val };
    }
    return { months: 12 };
  }
  if (str.includes("year")) {
    const matches = str.match(/\d+/g);
    if (matches && matches.length > 0) {
      const val = parseInt(matches[matches.length - 1]!, 10);
      return { years: val };
    }
    return { years: 1 };
  }
  return { months: 12 };
}

/**
 * Calculate future implementation date based on timeToImplement string.
 */
export function calculateImplementationDate(timeToImplementStr: string): Date {
  const parsed = parseTimeToImplement(timeToImplementStr);
  const currentIxTime = IxTime.getCurrentIxTime();
  let futureTime = currentIxTime;
  if (parsed.years) {
    futureTime = IxTime.addYears(currentIxTime, parsed.years);
  } else if (parsed.months) {
    futureTime = IxTime.addMonths(currentIxTime, parsed.months);
  }
  return new Date(futureTime);
}
