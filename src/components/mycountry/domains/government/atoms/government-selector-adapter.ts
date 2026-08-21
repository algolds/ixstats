/**
 * Government Atomic Selector Adapter (Plan 166)
 *
 * Normalizes government components, categories, and delegates calculation formulas.
 */

import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS, COMPONENT_CATEGORIES } from "~/lib/government/atomic-data";
import {
  calculateGovernmentEffectiveness,
  detectSynergies,
  detectConflicts,
  calculateImplementationCost,
  calculateMaintenanceCost,
  calculateRequiredCapacity,
  validateSelection,
} from "~/lib/government/atomic-utils";

export function getGovernmentComponents() {
  return ATOMIC_COMPONENTS;
}

export function getGovernmentCategories() {
  return COMPONENT_CATEGORIES;
}

export function calculateGovernmentMetrics(selected: ComponentType[], maxComponents = 10) {
  return {
    effectiveness: calculateGovernmentEffectiveness(selected),
    implementationCost: calculateImplementationCost(selected),
    maintenanceCost: calculateMaintenanceCost(selected),
    requiredCapacity: calculateRequiredCapacity(selected),
    synergies: detectSynergies(selected),
    conflicts: detectConflicts(selected),
    validation: validateSelection(selected, maxComponents),
  };
}
