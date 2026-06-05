"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge as UIBadge } from "~/components/ui/badge";
import { Calculator, X, AlertTriangle, Settings, BarChart3 } from "lucide-react";
import { useTaxBuilderAutoSync } from "~/hooks/useBuilderAutoSync";
import {
  ConflictWarningDialog,
  SyncStatusIndicator,
} from "~/components/builders/ConflictWarningDialog";

// Extracted hooks and utilities
import { useTaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { useTaxDataSync } from "~/hooks/useTaxDataSync";
import { validateTaxBuilderState } from "~/lib/tax-builder-validation";
import { computeTaxSuggestions } from "~/lib/tax-suggestions-engine";

// Extracted tab components
import { SettingsTab } from "./tabs/SettingsTab";
import { PreviewTab } from "./tabs/PreviewTab";
import { TaxCalculator } from "./atoms/TaxCalculator";

// Existing components
import { SuggestionsPanel, type SuggestionItem } from "~/components/builders/SuggestionsPanel";
import { useIntelligenceWebSocket } from "~/hooks/useIntelligenceWebSocket";

// Templates and types
import { taxSystemTemplates } from "./TaxSystemTemplates";
import type { TaxSystem, TaxCategory, TaxBracket, TaxCalculationResult } from "~/types/tax-system";
import type { ComponentType } from "~/types/government";

// API integration
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

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
  componentOptimization?: {
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
    componentCount: number;
  } | null;
}

export function TaxBuilder({
  initialData,
  onSave,
  onChange,
  onPreview,
  isReadOnly = false,
  countryId,
  showAtomicIntegration = true,
  hideSaveButton: _hideSaveButton = false,
  enableAutoSync = false,
  economicData,
  governmentData,
  componentOptimization,
}: TaxBuilderProps) {
  const notify = useNotify();

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<"settings" | "preview">("settings");

  // UI state
  const [_isSaving, setIsSaving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [_calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<(() => void) | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [_selectedTaxComponents, _setSelectedTaxComponents] = useState<ComponentType[]>([]);
  const [selectedAtomicTaxComponents, setSelectedAtomicTaxComponents] = useState<string[]>([]);
  const [templateToConfirm, setTemplateToConfirm] = useState<
    (typeof taxSystemTemplates)[number] | null
  >(null);

  // State management hook
  const {
    builderState: localBuilderState,
    setBuilderState: setLocalBuilderState,
    handleTaxSystemChange,
    handleCategoriesChange,
    handleBracketsChange,
    handleExemptionsChange: _handleExemptionsChange,
    handleDeductionsChange: _handleDeductionsChange,
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
    triggerSync: _triggerSync,
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
    parsedDataApplied: _parsedDataApplied,
    revenueAutoPopulated,
    syncedCategoryIndices,
    setSyncedCategoryIndices: _setSyncedCategoryIndices,
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

  // Call onChange whenever builderState changes (stabilized with ref to prevent loops)
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (onChangeRef.current) {
      onChangeRef.current(builderState);
    }
  }, [builderState]);

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

  // Save handler - available for external use
  const _handleSave = async () => {
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
          notify.success("Tax system saved");
        } catch (error) {
          console.error("Save failed:", error);
          notify.error("Failed to save tax system");
        } finally {
          setIsSaving(false);
        }
      } else if (countryId) {
        setIsSaving(true);
        try {
          let _result: any;
          try {
            _result = await updateMutation.mutateAsync({
              countryId,
              data: submitState as any,
              skipConflictCheck: true,
            });
          } catch (updateErr) {
            const notFound = (updateErr as any)?.data?.code === "NOT_FOUND";
            if (notFound) {
              _result = await createMutation.mutateAsync({
                countryId,
                data: submitState as any,
                skipConflictCheck: true,
              });
            } else {
              throw updateErr;
            }
          }
          notify.success("Tax system saved");
        } catch (err) {
          console.error("Save failed:", err);
          notify.error("Failed to save tax system");
        } finally {
          setIsSaving(false);
        }
      }
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

  const tabs = [
    { id: "settings", label: "Tax Settings", icon: Settings },
    { id: "preview", label: "Preview & Impact", icon: BarChart3 },
  ];

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCalculator(true)}
            disabled={builderState.categories.length === 0}
          >
            <Calculator className="mr-2 h-4 w-4" />
            Tax Calculator
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-muted/50 border-border rounded-lg border p-1">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "settings" | "preview")}
                disabled={isReadOnly}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

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

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "settings" && (
          <SettingsTab
            taxSystem={builderState.taxSystem}
            onTaxSystemChange={handleTaxSystemChange}
            categories={builderState.categories}
            brackets={builderState.brackets}
            onCategoriesChange={handleCategoriesChange}
            onBracketsChange={handleBracketsChange}
            onAddCategory={addCategory}
            onRemoveCategory={removeCategory}
            selectedAtomicTaxComponents={selectedAtomicTaxComponents}
            onAtomicComponentsChange={setSelectedAtomicTaxComponents}
            activeGovernmentComponents={activeComponents}
            showAtomicIntegration={showAtomicIntegration}
            economicData={economicData}
            previewTaxSystem={previewTaxSystem}
            validation={validation}
            isReadOnly={isReadOnly}
            countryId={countryId}
            onOpenTemplates={() => setShowTemplates(true)}
            revenueAutoPopulated={revenueAutoPopulated}
            syncedCategoryIndices={syncedCategoryIndices}
          />
        )}

        {activeTab === "preview" && (
          <PreviewTab
            previewTaxSystem={previewTaxSystem}
            economicData={economicData}
            countryId={countryId}
            componentOptimization={componentOptimization}
            selectedAtomicTaxComponents={selectedAtomicTaxComponents}
            activeGovernmentComponents={activeComponents}
            showAtomicIntegration={showAtomicIntegration}
          />
        )}
      </div>

      {/* Tax Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80">
          <div className="bg-background mx-2 flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-foreground text-lg font-semibold">Tax Calculator</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCalculator(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <TaxCalculator
                taxSystem={previewTaxSystem}
                categories={previewCategories}
                brackets={previewBrackets}
                exemptions={[]}
                deductions={[]}
                onCalculationChange={setCalculationResult}
                economicData={
                  economicData
                    ? {
                        totalPopulation: economicData.population,
                        nominalGDP: economicData.gdp,
                        gdpPerCapita: economicData.gdp / economicData.population,
                        realGDPGrowthRate: 0.03,
                        inflationRate: 0.02,
                        currencyExchangeRate: 1.0,
                      }
                    : undefined
                }
                governmentData={governmentData}
              />
            </div>
          </div>
        </div>
      )}

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
                      <Button onClick={() => setTemplateToConfirm(template)} className="w-full">
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

      {/* Template Confirmation Dialog */}
      {templateToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="bg-background border-border mx-4 w-full max-w-md rounded-lg border p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Apply Template?</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  This will replace your current tax configuration with{" "}
                  <strong>{templateToConfirm.name}</strong>. All existing categories, brackets,
                  exemptions, and deductions will be overwritten.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setTemplateToConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  applyTemplate(templateToConfirm);
                  setTemplateToConfirm(null);
                  setShowTemplates(false);
                }}
              >
                Apply Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export TaxBuilderState for backwards compatibility
export type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
