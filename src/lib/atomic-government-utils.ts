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

import { ComponentType } from '@prisma/client';
import type { AtomicGovernmentComponent } from './atomic-government-data';
import { ATOMIC_COMPONENTS } from './atomic-government-data';
import type { EffectivenessMetrics } from '~/components/atomic/shared/types';

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
    components.reduce((sum, comp) => sum + comp.effectiveness, 0) /
    (components.length || 1);

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
 * Check for synergy between two government components
 *
 * @param comp1 - First component type
 * @param comp2 - Second component type
 * @returns Synergy score (0-10)
 */
export function checkGovernmentSynergy(comp1: string, comp2: string): number {
  const component1 = ATOMIC_COMPONENTS[comp1 as ComponentType];
  const component2 = ATOMIC_COMPONENTS[comp2 as ComponentType];

  if (!component1 || !component2) return 0;

  if (component1.synergies.includes(comp2 as ComponentType)) return 10;
  if (component2.synergies.includes(comp1 as ComponentType)) return 10;

  return 0;
}

/**
 * Check for conflict between two government components
 *
 * @param comp1 - First component type
 * @param comp2 - Second component type
 * @returns True if components conflict
 */
export function checkGovernmentConflict(
  comp1: string,
  comp2: string
): boolean {
  const component1 = ATOMIC_COMPONENTS[comp1 as ComponentType];
  const component2 = ATOMIC_COMPONENTS[comp2 as ComponentType];

  if (!component1 || !component2) return false;

  return (
    component1.conflicts.includes(comp2 as ComponentType) ||
    component2.conflicts.includes(comp1 as ComponentType)
  );
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
    Object.entries(components).filter(
      ([, comp]) => comp?.category === category
    )
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
export function calculateImplementationCost(
  selectedComponents: ComponentType[]
): number {
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
export function calculateMaintenanceCost(
  selectedComponents: ComponentType[]
): number {
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
export function calculateRequiredCapacity(
  selectedComponents: ComponentType[]
): number {
  return selectedComponents.reduce((total, type) => {
    const component = ATOMIC_COMPONENTS[type];
    return total + (component?.requiredCapacity ?? 0);
  }, 0);
}

/**
 * Validate component selection
 *
 * @param selectedComponents - Array of selected component types
 * @param maxComponents - Maximum allowed components
 * @returns Validation result with errors
 */
export function validateSelection(
  selectedComponents: ComponentType[],
  maxComponents: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (selectedComponents.length === 0) {
    errors.push('At least one component must be selected');
  }

  if (selectedComponents.length > maxComponents) {
    errors.push(`Maximum ${maxComponents} components allowed`);
  }

  const conflicts = detectConflicts(selectedComponents);
  if (conflicts.length > 0) {
    errors.push(
      `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} detected`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
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
 * Calculate complexity distribution
 *
 * @param selectedComponents - Array of selected component types
 * @returns Count of low/medium/high complexity components
 */
export function calculateComplexityDistribution(
  selectedComponents: ComponentType[]
): Record<'Low' | 'Medium' | 'High', number> {
  const distribution = { Low: 0, Medium: 0, High: 0 };

  selectedComponents.forEach((type) => {
    const component = ATOMIC_COMPONENTS[type];
    if (component?.metadata.complexity) {
      distribution[component.metadata.complexity]++;
    }
  });

  return distribution;
}
