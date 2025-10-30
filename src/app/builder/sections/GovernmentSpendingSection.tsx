// GovernmentSpendingSectionEnhanced - Refactored with modular components
// Main section component now composes smaller, focused sub-components
// Extracted components: PolicySelector, SpendingValidationPanel,
// PolicyAnalysis, PolicyPresetSelector
// State management: useGovernmentSpending hook
// Data: government-spending-policies.ts

"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Settings, Eye, TrendingUp } from "lucide-react";
import type { EconomicInputs } from "../lib/economy-data-service";
import type { SectionContentProps } from "../types/builder";
import type { GovernmentBuilderState } from "~/types/government";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { GovernmentBuilderError } from "../components/GovernmentBuilderError";
import { AtomicIntegrationFeedback } from "../components/AtomicIntegrationFeedback";

// Modular components
import { PolicySelector } from "../components/spending/PolicySelector";
import { SpendingValidationPanel } from "../components/spending/SpendingValidationPanel";
import { PolicyAnalysis } from "../components/spending/PolicyAnalysis";
import { PolicyPresetSelector } from "../components/spending/PolicyPresetSelector";

// Custom hook for state management
import { useGovernmentSpending } from "../hooks/useGovernmentSpending";
import { createAbsoluteUrl } from "~/lib/url-utils";

// Help System
import { GovernmentSpendingHelpSystem } from "../components/help/GovernmentHelpSystem";

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
 * Refactored to use modular components for better maintainability
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
  const { EDIT_MODE_FIELD_LOCKS } = require("../components/enhanced/builderConfig");
  const locks = fieldLocks || (isEditMode ? EDIT_MODE_FIELD_LOCKS : {});

  // Guard against null inputs
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

  // State management via custom hook
  const {
    selectedPolicies,
    integrationState,
    validation,
    totalBudget,
    totalAllocated,
    totalRevenue,
    budgetUtilization,
    isValidBudget,
    isSurplus,
    spendingData,
    togglePolicy,
    applyPolicyPreset,
    handleAtomicComponentUpdate,
  } = useGovernmentSpending({
    inputs,
    onInputsChange,
    selectedAtomicComponents,
    governmentBuilderData,
    countryId,
  });

  // Local UI state
  const [activeTab, setActiveTab] = useState("policies");
  const [showAtomicFeedback, setShowAtomicFeedback] = useState(true);

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
    <div className="space-y-6">
      {/* Atomic Integration Feedback - shows when atomic components are selected */}
      {selectedAtomicComponents.length > 0 && showAtomicFeedback && (
        <AtomicIntegrationFeedback
          selectedComponents={selectedAtomicComponents}
          currentGovernmentBuilder={governmentBuilderData}
          economicInputs={inputs}
          onUpdateGovernmentBuilder={handleAtomicComponentUpdate}
          className="mb-6"
        />
      )}

      {/* Header with Validation and Preset Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-lg font-semibold">Government Policies</h3>
            <p className="text-muted-foreground text-sm">
              Select policies that align with your government structure and atomic components
            </p>
          </div>
          <GovernmentSpendingHelpSystem />
        </div>
        <PolicyPresetSelector onApplyPreset={applyPolicyPreset} />
      </div>

      {/* Validation Panel - shows budget status and key metrics */}
      <SpendingValidationPanel
        totalBudget={totalBudget}
        totalAllocated={totalAllocated}
        totalRevenue={totalRevenue}
        budgetUtilization={budgetUtilization}
        isValidBudget={isValidBudget}
        isSurplus={isSurplus}
        selectedPoliciesCount={selectedPolicies.size}
        isUpdating={integrationState.isUpdating}
      />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="policies">
            <Settings className="mr-2 h-4 w-4" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="visualization">
            <TrendingUp className="mr-2 h-4 w-4" />
            Policy Analysis
          </TabsTrigger>
        </TabsList>

        {/* Policies Tab - policy selection interface */}
        <TabsContent value="policies" className="mt-6">
          <PolicySelector
            selectedPolicies={selectedPolicies}
            selectedAtomicComponents={selectedAtomicComponents}
            onTogglePolicy={togglePolicy}
          />
        </TabsContent>

        {/* Visualization Tab - policy impact analysis */}
        <TabsContent value="visualization" className="mt-6">
          <PolicyAnalysis
            selectedPolicies={selectedPolicies}
            selectedAtomicComponents={selectedAtomicComponents}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
