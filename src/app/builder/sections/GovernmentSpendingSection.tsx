// GovernmentSpendingSection - Simplified policy selection section
// Renders only the core PolicySelector component inside the parent step wrapper

"use client";

import React from "react";
import type { EconomicInputs } from "../lib/economy-data-service";
import type { SectionContentProps } from "../types/builder";
import type { GovernmentBuilderState } from "~/types/government";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { GovernmentBuilderError } from "../components/GovernmentBuilderError";

// Modular components
import { PolicySelector } from "../components/spending/PolicySelector";

// Custom hook for state management
import { useGovernmentSpending } from "../hooks/useGovernmentSpending";
import { createAbsoluteUrl } from "~/lib/utils";

import { EDIT_MODE_FIELD_LOCKS } from "../components/enhanced/builderConfig";

interface GovernmentSpendingSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  selectedAtomicComponents?: ComponentType[];
  governmentBuilderData?: GovernmentBuilderState | null;
  countryId?: string;
  mode?: "create" | "edit";
  fieldLocks?: Record<string, import("../components/enhanced/builderConfig").FieldLockConfig>;
}

/**
 * GovernmentSpendingSection - Main government spending section
 * Simplified to render only the core PolicySelector component
 */
export function GovernmentSpendingSection({
  inputs,
  onInputsChange,
  selectedAtomicComponents = [],
  governmentBuilderData = null,
  countryId,
  mode = "create",
  fieldLocks,
}: GovernmentSpendingSectionProps) {
  const isEditMode = mode === "edit";
  const _locks = fieldLocks || (isEditMode ? EDIT_MODE_FIELD_LOCKS : {});

  // All hooks must be called unconditionally (Rules of Hooks)
  // State management via custom hook
  const { selectedPolicies, togglePolicy, validation } = useGovernmentSpending({
    inputs: inputs ?? ({} as EconomicInputs),
    onInputsChange,
    selectedAtomicComponents,
    governmentBuilderData,
    countryId,
  });

  // Guard against null inputs (after all hooks)
  if (!inputs) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading government spending data...</p>
        </div>
      </div>
    );
  }

  // Show error if no government builder data and no atomic components
  if (!validation.isValid && !selectedAtomicComponents.length) {
    return (
      <GovernmentBuilderError
        validation={validation}
        onNavigateToBuilder={() => {
          window.location.href = createAbsoluteUrl("/builder?section=government");
        }}
        className="mx-auto max-w-4xl"
      />
    );
  }

  return (
    <PolicySelector
      selectedPolicies={selectedPolicies}
      selectedAtomicComponents={selectedAtomicComponents}
      onTogglePolicy={togglePolicy}
    />
  );
}
