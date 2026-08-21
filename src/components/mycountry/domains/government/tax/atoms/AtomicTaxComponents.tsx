"use client";

import React from "react";
import { Receipt } from "lucide-react";
import { UnifiedAtomicComponentSelector } from "~/components/ui/atomic/shared/UnifiedAtomicComponentSelector";
import { TAX_THEME } from "~/components/ui/atomic/shared/themes";
import {
  ATOMIC_TAX_COMPONENTS,
  TAX_COMPONENT_CATEGORIES,
  calculateTotalTaxEffectiveness,
  checkTaxSynergy,
  checkTaxConflicts,
  type AtomicTaxComponent,
  type TaxComponentCategory,
  TAX_SYNERGIES,
  TAX_CONFLICTS,
} from "~/lib/government/tax/atomic-tax-components";

export type { AtomicTaxComponent, TaxComponentCategory };
export {
  ATOMIC_TAX_COMPONENTS,
  TAX_COMPONENT_CATEGORIES,
  TAX_SYNERGIES,
  TAX_CONFLICTS,
  checkTaxSynergy,
  checkTaxConflicts,
  calculateTotalTaxEffectiveness,
};

interface AtomicTaxComponentSelectorProps {
  selectedComponents: string[];
  onComponentChange: (componentIds: string[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
}

export function AtomicTaxComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 15,
  isReadOnly = false,
}: AtomicTaxComponentSelectorProps) {
  return (
    <UnifiedAtomicComponentSelector
      components={ATOMIC_TAX_COMPONENTS}
      categories={TAX_COMPONENT_CATEGORIES}
      selectedComponents={selectedComponents}
      onComponentChange={onComponentChange}
      maxComponents={maxComponents}
      isReadOnly={isReadOnly}
      theme={TAX_THEME}
      systemName="Atomic Tax Components"
      systemIcon={Receipt}
      calculateEffectiveness={calculateTotalTaxEffectiveness}
      checkSynergy={checkTaxSynergy}
      checkConflict={checkTaxConflicts}
    />
  );
}
