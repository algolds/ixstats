/**
 * Government Builder - Refactored Orchestrator
 *
 * Clean orchestration layer using modular components and hooks.
 * Reduced from 1,015 lines to ~250 lines (75% reduction).
 */

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Building2, Users, DollarSign, Receipt } from 'lucide-react';
import { ConflictWarningDialog, SyncStatusIndicator } from '~/components/builders/ConflictWarningDialog';
import { SuggestionsPanel, type SuggestionItem } from '~/components/builders/SuggestionsPanel';
import { computeGovernmentSuggestions } from '~/components/builders/suggestions/utils';
import { useIntelligenceWebSocket } from '~/hooks/useIntelligenceWebSocket';
import { useGovernmentBuilder } from '~/hooks/useGovernmentBuilder';
import { getGovernmentTemplates } from './templates/governmentTemplates';

// Import atomic components
import { GovernmentStructureForm } from './atoms/GovernmentStructureForm';
import { RevenueSourceForm } from './atoms/RevenueSourceForm';

// Import new modular components
import {
  StepProgress,
  ValidationAlert,
  DepartmentList,
  BudgetAllocationList,
  NavigationButtons,
  TemplateModal,
  type Step,
} from '~/components/builder/government';

import type { GovernmentBuilderState } from '~/types/government';

interface GovernmentBuilderProps {
  initialData?: Partial<GovernmentBuilderState>;
  onSave?: (data: GovernmentBuilderState) => Promise<void>;
  onChange?: (data: GovernmentBuilderState) => void;
  onPreview?: (data: GovernmentBuilderState) => void;
  isReadOnly?: boolean;
  hideSaveButton?: boolean;
  countryId?: string;
  enableAutoSync?: boolean;
  gdpData?: {
    nominalGDP: number;
    countryName?: string;
  };
}

export function GovernmentBuilder({
  initialData,
  onSave,
  onChange,
  onPreview,
  isReadOnly = false,
  hideSaveButton = false,
  countryId,
  enableAutoSync = false,
  gdpData
}: GovernmentBuilderProps) {
  // ==================== LOCAL STATE ====================
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<(() => void) | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  // ==================== GOVERNMENT BUILDER HOOK ====================
  const builder = useGovernmentBuilder(initialData, {
    countryId,
    enableAutoSync,
    isReadOnly,
    onSave,
    onChange,
  });

  const {
    builderState,
    validation,
    budgetSummary,
    currentStep,
    syncState,
    updateStructure,
    addDepartment,
    removeDepartment,
    updateDepartment,
    updateBudgetAllocation,
    fixBudgetAllocations,
    updateRevenue,
    setCurrentStep,
    goToNextStep,
    goToPreviousStep,
    applyTemplate: builderApplyTemplate,
    handleSave,
    triggerSync,
    clearConflicts,
    allCollapsed,
    setAllCollapsed,
    budgetAllocationsCollapsed,
    toggleBudgetAllocationCollapse,
    collapseAllBudgetAllocations,
    expandAllBudgetAllocations,
  } = builder;

  // ==================== STEP CONFIGURATION ====================
  const steps: Step[] = useMemo(
    () => [
      { id: 'structure', label: 'Government Structure', icon: Building2 },
      { id: 'departments', label: 'Departments', icon: Users },
      { id: 'budget', label: 'Budget Allocation', icon: DollarSign },
      { id: 'revenue', label: 'Revenue Sources', icon: Receipt },
    ],
    []
  );

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  // ==================== CONFLICT HANDLERS ====================
  const handleConfirmConflicts = () => {
    setShowConflictDialog(false);
    if (pendingSaveCallback) {
      pendingSaveCallback();
      setPendingSaveCallback(null);
    }
    clearConflicts();
  };

  const handleCancelConflicts = () => {
    setShowConflictDialog(false);
    setPendingSaveCallback(null);
  };

  // ==================== TEMPLATE HANDLERS ====================
  const handleApplyTemplate = (template: any) => {
    builderApplyTemplate(template);
    setShowTemplates(false);
  };

  // ==================== SUGGESTIONS ====================
  const intel = useIntelligenceWebSocket({ countryId });

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS !== 'true') return;
    setSuggestions(computeGovernmentSuggestions(builderState as any));
  }, [builderState, intel.latestUpdate]);

  const handleApplySuggestion = (s: SuggestionItem) => {
    if (s.id === 'budget-cap') {
      const over =
        builderState.budgetAllocations.reduce((sum, a) => sum + (a.allocatedPercent || 0), 0) - 100;
      if (over > 0) {
        fixBudgetAllocations();
      }
    }
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
  };

  // ==================== RENDER ====================
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Conflict Warning Dialog */}
      <ConflictWarningDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        warnings={syncState.conflictWarnings}
        onConfirm={handleConfirmConflicts}
        onCancel={handleCancelConflicts}
        builderType="government"
      />

      {/* Template Modal */}
      {showTemplates && (
        <TemplateModal
          templates={getGovernmentTemplates()}
          onApplyTemplate={handleApplyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {enableAutoSync && countryId && (
            <SyncStatusIndicator
              isSyncing={syncState.isSyncing}
              lastSyncTime={syncState.lastSyncTime}
              pendingChanges={syncState.pendingChanges}
              hasError={!!syncState.syncError}
              errorMessage={syncState.syncError?.message}
            />
          )}
          <Button variant="outline" onClick={() => setShowTemplates(true)} disabled={isReadOnly}>
            Use Template
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <StepProgress
        steps={steps}
        currentStep={currentStep}
        onStepChange={(stepId) => setCurrentStep(stepId as any)}
        validationErrors={validation.errors}
        isReadOnly={isReadOnly}
      />

      {/* Validation Errors */}
      <ValidationAlert errors={validation.errors} />

      {/* Intelligent Suggestions */}
      {process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS === 'true' && suggestions.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestions}
          onApply={handleApplySuggestion}
          onDismiss={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 'structure' && (
          <GovernmentStructureForm
            data={builderState.structure}
            onChange={updateStructure}
            isReadOnly={isReadOnly}
            gdpData={gdpData}
          />
        )}

        {currentStep === 'departments' && (
          <DepartmentList
            departments={builderState.departments}
            onAddDepartment={addDepartment}
            onUpdateDepartment={updateDepartment}
            onRemoveDepartment={removeDepartment}
            validationErrors={validation.errors}
            isReadOnly={isReadOnly}
            allCollapsed={allCollapsed}
            onToggleAllCollapsed={setAllCollapsed}
          />
        )}

        {currentStep === 'budget' && (
          <BudgetAllocationList
            departments={builderState.departments}
            budgetAllocations={builderState.budgetAllocations}
            budgetSummary={budgetSummary}
            totalBudget={builderState.structure.totalBudget}
            currency={builderState.structure.budgetCurrency || 'USD'}
            onUpdateAllocation={updateBudgetAllocation}
            onFixAllocations={fixBudgetAllocations}
            isReadOnly={isReadOnly}
            budgetAllocationsCollapsed={budgetAllocationsCollapsed}
            onToggleCollapse={toggleBudgetAllocationCollapse}
            onExpandAll={expandAllBudgetAllocations}
            onCollapseAll={collapseAllBudgetAllocations}
          />
        )}

        {currentStep === 'revenue' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">Revenue Sources</h2>
            <RevenueSourceForm
              data={builderState.revenueSources}
              onChange={updateRevenue}
              totalRevenue={builderState.structure.totalBudget}
              currency={builderState.structure.budgetCurrency || 'USD'}
              isReadOnly={isReadOnly}
              availableDepartments={builderState.departments.map((d, i) => ({
                id: i.toString(),
                name: d.name,
              }))}
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <NavigationButtons
        currentStepIndex={currentStepIndex}
        totalSteps={steps.length}
        validation={validation}
        onPrevious={goToPreviousStep}
        onNext={goToNextStep}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
