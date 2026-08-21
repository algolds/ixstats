/**
 * Tax Atomic Selector Adapter (Plan 166)
 *
 * Normalizes tax components, categories, and delegates calculation formulas.
 */

import {
  ATOMIC_TAX_COMPONENTS,
  TAX_COMPONENT_CATEGORIES,
  calculateTotalTaxEffectiveness,
  checkTaxSynergy,
  checkTaxConflicts,
  type AtomicTaxComponent,
} from "~/lib/government/tax/atomic-tax-components";
import type { UnifiedAtomicComponent } from "~/components/ui/atomic/shared/types";

export function getNormalizedTaxComponents(): Record<string, UnifiedAtomicComponent> {
  return ATOMIC_TAX_COMPONENTS;
}

export function getNormalizedTaxCategories(): Record<string, string[]> {
  return TAX_COMPONENT_CATEGORIES;
}

export function calculateTaxMetrics(selected: string[]) {
  return calculateTotalTaxEffectiveness(selected);
}

export function evaluateTaxSynergy(comp1: string, comp2: string): number {
  return checkTaxSynergy(comp1, comp2);
}

export function evaluateTaxConflict(comp1: string, comp2: string): boolean {
  return checkTaxConflicts(comp1, comp2);
}
