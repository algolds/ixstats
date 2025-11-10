"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge as UIBadge } from "~/components/ui/badge";
import { Eye, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { useTaxBuilderAutoSync } from "~/hooks/useBuilderAutoSync";
import {
  ConflictWarningDialog,
  SyncStatusIndicator,
} from "~/components/builders/ConflictWarningDialog";

// Extracted hooks and utilities
import { useTaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { useTaxDataSync } from "~/hooks/useTaxDataSync";
import { validateTaxBuilderState, hasStepErrors } from "~/lib/tax-builder-validation";
import { computeTaxSuggestions } from "~/lib/tax-suggestions-engine";

// Extracted step components
import { AtomicComponentsStep } from "./tax-builder/steps/AtomicComponentsStep";
import { ConfigurationStep } from "./tax-builder/steps/ConfigurationStep";
import { ExemptionsDeductionsStep } from "./tax-builder/steps/ExemptionsDeductionsStep";
import { CalculatorPreviewStep } from "./tax-builder/steps/CalculatorPreviewStep";

// Extracted panel components
import { ValidationPanel } from "./tax-builder/panels/ValidationPanel";
import { SyncStatusPanel } from "./tax-builder/panels/SyncStatusPanel";

// Existing components
import { SuggestionsPanel, type SuggestionItem } from "~/components/builders/SuggestionsPanel";
import { useIntelligenceWebSocket } from "~/hooks/useIntelligenceWebSocket";

// Templates and types
import { taxSystemTemplates } from "./TaxSystemTemplates";
import type { TaxSystem, TaxCategory, TaxBracket, TaxCalculationResult } from "~/types/tax-system";
import type { ComponentType } from "~/types/government";

// API integration
import { api } from "~/trpc/react";
import { toast } from "sonner";

export interface TaxBuilderProps {
  initialData?: Partial<TaxBuilderState>;
  onSave?: (data: TaxBuilderState) => Promise<void>;
  onChange?: (data: TaxBuilderState) => void;
  onPreview?: (data: TaxBuilderState) => void;
  isReadOnly?: boolean;
  countryId?: string;
  showAtomicIntegration?: boolean;
  hideSaveButton?: boolean;
  enableAutoSync?: boolean;
  economicData?: {
    gdp: number;
    sectors: any;
    population: number;
  };
  governmentData?: any;
}

/**
 * TaxBuilder - Orchestrator Component
 * Refactored from 1,851 lines to ~400 lines by extracting:
 * - State management to useTaxBuilderState hook
 * - Data sync to useTaxDataSync hook
 * - Validation to tax-builder-validation.ts
 * - Suggestions to tax-suggestions-engine.ts
 * - Step components to tax-builder/steps/
 * - Panel components to tax-builder/panels/
 */
export function TaxBuilder({
  initialData,
  onSave,
  onChange,
  onPreview,
  isReadOnly = false,
  countryId,
  showAtomicIntegration = true,
  hideSaveButton = false,
  enableAutoSync = false,
  economicData,
  governmentData,
}: TaxBuilderProps) {
  // Step navigation state
  const [currentStep, setCurrentStep] = useState<
    "atomic" | "configuration" | "exemptions" | "calculator"
  >("atomic");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<(() => void) | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedTaxComponents, setSelectedTaxComponents] = useState<ComponentType[]>([]);
  const [selectedAtomicTaxComponents, setSelectedAtomicTaxComponents] = useState<string[]>([]);

  // State management hook
  const {
    builderState: localBuilderState,
    setBuilderState: setLocalBuilderState,
    handleTaxSystemChange,
    handleCategoriesChange,
    handleBracketsChange,
    handleExemptionsChange,
    handleDeductionsChange,
    addCategory,
    removeCategory,
    applyTemplate,
    updateValidation,
  } = useTaxBuilderState({ initialData, countryId });

  // Auto-sync hook
  const {
    builderState: autoSyncState,
    setBuilderState: setAutoSyncState,
    syncState,
    triggerSync,
    clearConflicts,
  } = useTaxBuilderAutoSync(countryId, localBuilderState, {
    enabled: enableAutoSync && !!countryId,
    showConflictWarnings: true,
    onConflictDetected: (warnings) => {
      if (warnings.some((w) => w.severity === "critical" || w.severity === "warning")) {
        setShowConflictDialog(true);
      }
    },
  });

  // Use auto-sync state if enabled, otherwise use local state
  const builderState = enableAutoSync && countryId ? autoSyncState : localBuilderState;
  const setBuilderState = useCallback(
    (update: React.SetStateAction<TaxBuilderState>) => {
      if (enableAutoSync && countryId) {
        setAutoSyncState(update);
      } else {
        setLocalBuilderState(update);
      }
    },
    [enableAutoSync, countryId, setAutoSyncState, setLocalBuilderState]
  );

  // Data sync hook
  const {
    parsedDataApplied,
    revenueAutoPopulated,
    syncedCategoryIndices,
    setSyncedCategoryIndices,
  } = useTaxDataSync({
    builderState,
    setBuilderState,
    countryId,
    economicData,
    governmentData,
    onSuggestionsUpdate: (newSuggestions) => {
      setSuggestions((prev) => [...prev, ...newSuggestions]);
    },
  });

  // Atomic component integration
  const { data: atomicComponents } = api.government.getComponents.useQuery(
    { countryId: countryId || "" },
    {
      enabled: !!countryId && showAtomicIntegration,
      staleTime: 30000,
    }
  );

  const activeComponents =
    atomicComponents?.filter((c) => c.isActive).map((c) => c.componentType) || [];

  // Local save mutations (fallback when onSave is not provided)
  const createMutation = api.taxSystem.create.useMutation();
  const updateMutation = api.taxSystem.update.useMutation();

  // Validation
  const validation = useMemo(() => validateTaxBuilderState(builderState), [builderState]);

  // Update validation in state when it changes
  useEffect(() => {
    updateValidation(validation);
  }, [validation, updateValidation]);

  // Call onChange whenever builderState changes
  useEffect(() => {
    if (onChange) {
      onChange(builderState);
    }
  }, [builderState, onChange]);

  // Intelligence-based suggestions
  const intel = useIntelligenceWebSocket({ countryId });
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS !== "true") return;
    if (!intel.latestUpdate) return;
    setSuggestions(computeTaxSuggestions(builderState));
  }, [intel.latestUpdate, builderState]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS !== "true") return;
    setSuggestions(computeTaxSuggestions(builderState));
  }, [builderState]);

  // Save handler
  const handleSave = async () => {
    const currentValidation = validateTaxBuilderState(builderState);
    updateValidation(currentValidation);

    if (currentValidation.isValid) {
      type ServerCalculationMethod = "percentage" | "fixed" | "tiered" | "progressive";
      const normalizedCategories = builderState.categories.map((cat) => ({
        ...cat,
        calculationMethod: cat.calculationMethod as ServerCalculationMethod,
      }));
      const submitState = {
        taxSystem: builderState.taxSystem,
        categories: normalizedCategories,
        brackets: builderState.brackets,
        exemptions: builderState.exemptions,
        deductions: builderState.deductions,
        atomicComponents: selectedAtomicTaxComponents,
      };

      if (enableAutoSync && countryId && syncState.conflictWarnings.length > 0) {
        setPendingSaveCallback(() => async () => {
          if (onSave) {
            setIsSaving(true);
            try {
              await onSave(submitState as any);
              clearConflicts();
            } catch (error) {
              console.error("Save failed:", error);
            } finally {
              setIsSaving(false);
            }
          }
        });
        setShowConflictDialog(true);
      } else if (onSave) {
        setIsSaving(true);
        try {
          await onSave(submitState as any);
          toast.success("Tax system saved");
        } catch (error) {
          console.error("Save failed:", error);
          toast.error("Failed to save tax system");
        } finally {
          setIsSaving(false);
        }
      } else if (countryId) {
        setIsSaving(true);
        try {
          let result: any;
          try {
            result = await updateMutation.mutateAsync({
              countryId,
              data: submitState as any,
              skipConflictCheck: true,
            });
          } catch (updateErr) {
            const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
            const notFound = msg.includes("No record was found") || msg.includes("P2025");
            if (notFound) {
              result = await createMutation.mutateAsync({
                countryId,
                data: submitState as any,
                skipConflictCheck: true,
              });
            } else {
              throw updateErr;
            }
          }
          toast.success("Tax system saved");
        } catch (err) {
          console.error("Save failed:", err);
          toast.error("Failed to save tax system");
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const handlePreview = () => {
    const currentValidation = validateTaxBuilderState(builderState);
    updateValidation(currentValidation);

    if (onPreview) {
      onPreview({ ...builderState, ...currentValidation });
    }
  };

  // Preview data transformations
  const previewTaxSystem: TaxSystem = useMemo(
    () => ({
      id: "builder-preview",
      countryId: countryId || "preview",
      ...builderState.taxSystem,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    [builderState.taxSystem, countryId]
  );

  const previewCategories: TaxCategory[] = useMemo(
    () =>
      builderState.categories.map((cat, index) => ({
        id: `category-${index}`,
        taxSystemId: "builder-preview",
        ...cat,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    [builderState.categories]
  );

  const previewBrackets: TaxBracket[] = useMemo(() => {
    const brackets: TaxBracket[] = [];
    Object.entries(builderState.brackets).forEach(([categoryIndex, categoryBrackets]) => {
      categoryBrackets.forEach((bracket, bracketIndex) => {
        brackets.push({
          id: `bracket-${categoryIndex}-${bracketIndex}`,
          taxSystemId: "builder-preview",
          categoryId: `category-${categoryIndex}`,
          ...bracket,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });
    return brackets;
  }, [builderState.brackets]);

  const steps = [
    { id: "atomic", label: "Atomic Components", icon: "⚡" },
    { id: "configuration", label: "Tax System Configuration", icon: "⚙️" },
    { id: "exemptions", label: "Exemptions & Deductions", icon: "📄" },
    { id: "calculator", label: "Calculator & Preview", icon: "🧮" },
  ];

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold sm:text-3xl">Tax System Builder</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Design and configure your country's taxation system
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {enableAutoSync && countryId && (
            <SyncStatusIndicator
              isSyncing={syncState.isSyncing}
              lastSyncTime={syncState.lastSyncTime}
              pendingChanges={syncState.pendingChanges}
              hasError={!!syncState.syncError}
              errorMessage={syncState.syncError?.message}
            />
          )}
          {!enableAutoSync && (
            <UIBadge variant="secondary" className="text-xs">
              Manual mode
            </UIBadge>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} disabled={isReadOnly}>
            Use Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={builderState.categories.length === 0}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="bg-muted/50 border-border rounded-lg border p-3 sm:p-4">
        <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto sm:justify-between">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const stepHasErrors = hasStepErrors(step.id, validation.errors);

            return (
              <div key={step.id} className="flex shrink-0 items-center">
                <button
                  onClick={() => setCurrentStep(step.id as any)}
                  disabled={isReadOnly}
                  className={`relative flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors sm:gap-2 sm:px-3 sm:text-sm ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted && !stepHasErrors
                        ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                        : stepHasErrors
                          ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                          : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-base sm:text-lg">{step.icon}</span>
                  <span className="hidden font-medium sm:inline">{step.label}</span>
                  {isCompleted && !stepHasErrors && <CheckCircle className="hidden h-4 w-4 sm:block" />}
                  {stepHasErrors && <AlertTriangle className="hidden h-4 w-4 sm:block" />}
                </button>
                {index < steps.length - 1 && (
                  <ArrowRight className="text-muted-foreground mx-1 h-3 w-3 shrink-0 sm:mx-2 sm:h-4 sm:w-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation Panel */}
      <ValidationPanel isValid={validation.isValid} errors={validation.errors} />

      {/* Sync Status Panel */}
      <SyncStatusPanel
        governmentData={governmentData}
        revenueAutoPopulated={revenueAutoPopulated}
        syncedCategoryIndices={syncedCategoryIndices}
      />

      {/* Suggestions Panel */}
      {process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS === "true" && suggestions.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestions}
          onApply={(s) => {
            if (s.action) {
              s.action();
            }
            setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
          }}
          onDismiss={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === "atomic" && (
          <AtomicComponentsStep
            taxSystem={builderState.taxSystem}
            onTaxSystemChange={handleTaxSystemChange}
            selectedAtomicTaxComponents={selectedAtomicTaxComponents}
            onAtomicComponentsChange={setSelectedAtomicTaxComponents}
            activeGovernmentComponents={activeComponents}
            economicData={economicData}
            validationErrors={validation.errors.taxSystem || {}}
            isReadOnly={isReadOnly}
            showAtomicIntegration={showAtomicIntegration}
            countryId={countryId}
            previewTaxSystem={previewTaxSystem}
          />
        )}

        {currentStep === "configuration" && (
          <ConfigurationStep
            taxSystem={builderState.taxSystem}
            onTaxSystemChange={handleTaxSystemChange}
            validationErrors={validation.errors.taxSystem || {}}
            isReadOnly={isReadOnly}
            countryId={countryId}
          />
        )}

        {currentStep === "exemptions" && <ExemptionsDeductionsStep isReadOnly={isReadOnly} />}

        {currentStep === "calculator" && (
          <CalculatorPreviewStep
            previewTaxSystem={previewTaxSystem}
            previewCategories={previewCategories}
            previewBrackets={previewBrackets}
            onCalculationChange={setCalculationResult}
            economicData={economicData}
            governmentData={governmentData}
          />
        )}
      </div>

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="bg-background border-border mx-4 max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg border p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-foreground text-2xl font-semibold">Tax System Templates</h2>
              <Button variant="outline" onClick={() => setShowTemplates(false)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {taxSystemTemplates.map((template, index) => (
                <Card key={index} className="cursor-pointer transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">{template.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <UIBadge variant="secondary">
                          {template.progressiveTax ? "Progressive" : "Flat"} Tax
                        </UIBadge>
                        <UIBadge variant="outline" className="ml-2">
                          {template.categories.length} Categories
                        </UIBadge>
                      </div>
                      <div className="text-sm">
                        <strong>Categories:</strong>
                        <ul className="text-muted-foreground mt-1">
                          {template.categories.slice(0, 3).map((cat) => (
                            <li key={cat.categoryName}>
                              • {cat.categoryName} ({cat.baseRate}%)
                            </li>
                          ))}
                          {template.categories.length > 3 && (
                            <li>• +{template.categories.length - 3} more...</li>
                          )}
                        </ul>
                      </div>
                      <Button
                        onClick={() => {
                          applyTemplate(template);
                          setShowTemplates(false);
                        }}
                        className="w-full"
                      >
                        Use This Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conflict Dialog */}
      {showConflictDialog && enableAutoSync && (
        <ConflictWarningDialog
          open={showConflictDialog}
          onOpenChange={setShowConflictDialog}
          warnings={syncState.conflictWarnings}
          onConfirm={() => {
            if (pendingSaveCallback) {
              pendingSaveCallback();
              setPendingSaveCallback(null);
            }
            setShowConflictDialog(false);
          }}
          onCancel={() => {
            setPendingSaveCallback(null);
            setShowConflictDialog(false);
          }}
          builderType="tax"
        />
      )}
    </div>
  );
}

// Re-export TaxBuilderState for backwards compatibility
export type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
