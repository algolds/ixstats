/**
 * Economic Atomic Selector Adapter (Plan 166)
 *
 * Normalizes economic components, categories, and delegates calculation formulas.
 */

import {
  type EconomicComponentType,
  type EconomicTemplate,
  ECONOMIC_TEMPLATES,
  COMPONENT_CATEGORIES,
} from "~/lib/economy/atomic-data";
import {
  detectEconomicSynergies,
  detectEconomicConflicts,
  getEconomicMetrics,
  validateEconomicSelection,
  getAllComponents,
} from "~/lib/economy/atomic-utils";

export function getEconomicComponents() {
  return getAllComponents();
}

export function getEconomicCategories() {
  return COMPONENT_CATEGORIES;
}

export function getEconomicTemplates(): EconomicTemplate[] {
  return ECONOMIC_TEMPLATES;
}

export function calculateEconomicDomainMetrics(selected: EconomicComponentType[]) {
  return {
    metrics: getEconomicMetrics(selected),
    synergies: detectEconomicSynergies(selected),
    conflicts: detectEconomicConflicts(selected),
    validation: validateEconomicSelection(selected),
  };
}
