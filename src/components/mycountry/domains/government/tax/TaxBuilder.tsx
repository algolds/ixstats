"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { isEqual } from "~/lib/utils";
import { Badge as UIBadge } from "~/components/ui/badge";
import { Calculator, WarningTriangle as AlertTriangle, Settings, StatsReport as BarChart3 } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { useTaxBuilderAutoSync } from "~/hooks/useBuilderAutoSync";
import {
  ConflictWarningDialog,
  SyncStatusIndicator,
} from "~/components/mycountry/domains/government/builder/ConflictWarningDialog";

// Extracted hooks and utilities
import { useTaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { useTaxDataSync } from "~/hooks/useTaxDataSync";
import { validateTaxBuilderState } from "~/lib/economy/tax-builder-validation";
import { computeTaxSuggestions } from "~/lib/economy/tax-suggestions-engine";

// Extracted tab components
import { SettingsTab } from "./tabs/SettingsTab";
import { PreviewTab } from "./tabs/PreviewTab";
import { TaxCalculator } from "./atoms/TaxCalculator";

// Existing components
import { SuggestionsPanel, type SuggestionItem } from "~/components/mycountry/domains/government/builder/SuggestionsPanel";
import { useIntelligenceWebSocket } from "~/hooks/useIntelligenceWebSocket";

// Templates and types
import { taxSystemTemplates } from "./TaxSystemTemplates";
import type { TaxSystem, TaxCategory, TaxBracket } from "~/types/tax-system";
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
  flat?: boolean;
}

const EMPTY_ARRAY: any[] = [];

export function TaxBuilder({
  initialData,
  onSave,
  onChange,
  // oxlint-disable-next-line eslint/no-unused-vars
  onPreview,
  isReadOnly = false,
  countryId,
  showAtomicIntegration = true,
  hideSaveButton: _hideSaveButton = false,
  enableAutoSync = false,
  economicData,
  governmentData,
  componentOptimization,
  flat = false,
}: TaxBuilderProps) {
  const notify = useNotify();

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<"settings" | "preview" | "calculator">("settings");

  // UI state
  const [_isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<(() => void) | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [_selectedTaxComponents, _setSelectedTaxComponents] = useState<ComponentType[]>([]);
  const [templateToConfirm, setTemplateToConfirm] = useState<
    (typeof taxSystemTemplates)[number] | null
  >(null);

  // oxlint-disable-next-line eslint/no-unused-vars
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
    updateValidation: _updateValidation,
  } = useTaxBuilderState({ initialData, countryId });

  // Auto-sync hook. It observes localBuilderState (passed below) and pushes to the
  // server — it must NOT own the displayed editing copy, or edits made through the
  // local handlers never reach the UI.
  const {
    builderState: _autoSyncState,
    setBuilderState: _setAutoSyncState,
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

  // Single source of truth: the local editing store. The auto-sync hook mirrors this
  // (it receives localBuilderState as its initialData) and handles server pushes.
  // ponytail: one store, not two — the dual-store split left the tax form uneditable
  // whenever a countryId was present (auto-sync on), because edits went to localBuilderState
  // while the UI rendered the never-updated autoSyncState.
  const builderState = localBuilderState;
  const setBuilderState = setLocalBuilderState;
  const selectedAtomicTaxComponents = builderState.selectedAtomicTaxComponents || [];
  const setSelectedAtomicTaxComponents = useCallback(
    (components: string[] | ((prev: string[]) => string[])) => {
      setBuilderState((prev) => {
        const nextComponents =
          typeof components === "function"
            ? components(prev.selectedAtomicTaxComponents || [])
            : components;
        return {
          ...prev,
          selectedAtomicTaxComponents: nextComponents,
        };
      });
    },
    [setBuilderState]
  );
  const updateValidation = useCallback(
    (validationVal: { isValid: boolean; errors: any }) => {
      setBuilderState((prev) => {
        if (prev.isValid === validationVal.isValid && isEqual(prev.errors, validationVal.errors)) {
          return prev;
        }
        return { ...prev, ...validationVal };
      });
    },
    [setBuilderState]
  );

  // Memoized suggestion update handler to prevent useEffect subscription loops
  const handleSuggestionsUpdate = useCallback((newSuggestions: SuggestionItem[]) => {
    setSuggestions((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const filtered = newSuggestions.filter((s) => !existingIds.has(s.id));
      if (filtered.length === 0) return prev;
      return [...prev, ...filtered];
    });
  }, []);

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
    onSuggestionsUpdate: handleSuggestionsUpdate,
  });

  // Atomic component integration
  const { data: atomicComponents } = api.government.getComponents.useQuery(
    { countryId: countryId || "" },
    {
      enabled: !!countryId && showAtomicIntegration,
      staleTime: 30000,
    }
  );

  const activeComponents = useMemo(() => {
    return atomicComponents?.filter((c) => c.isActive).map((c) => c.componentType) || EMPTY_ARRAY;
  }, [atomicComponents]);

  const calculatorEconomicData = useMemo(() => {
    if (!economicData) return undefined;
    return {
      totalPopulation: economicData.population,
      nominalGDP: economicData.gdp,
      gdpPerCapita: economicData.gdp / economicData.population,
      realGDPGrowthRate: 0.03,
      inflationRate: 0.02,
      currencyExchangeRate: 1.0,
    };
  }, [economicData]);

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
    { id: "calculator", label: "Tax Calculator", icon: Calculator },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Toolbar: tab navigation + actions (header provided by parent GlassCard) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab Navigation */}
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "settings" | "preview" | "calculator")}
                disabled={isReadOnly}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-500/15 font-semibold text-emerald-400"
                    : "text-foreground/50 hover:text-foreground/80 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
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
      {flat ? (
        <div className="space-y-6 pt-2">
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
              currency={governmentData?.structure?.budgetCurrency || "USD"}
            />
          )}

          {activeTab === "calculator" && (
            <div className="w-full space-y-6 pt-2">
              {builderState.categories.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm backdrop-blur-sm">
                  <Calculator className="mx-auto mb-3 h-12 w-12 animate-pulse text-zinc-500 opacity-50" />
                  <p className="text-foreground font-medium">Tax Calculator Locked</p>
                  <p className="mt-1 max-w-sm text-xs">
                    Please define at least one tax category in{" "}
                    <strong>Tax Settings &rarr; Categories</strong> before using the calculator.
                  </p>
                </div>
              ) : (
                <TaxCalculator
                  taxSystem={previewTaxSystem}
                  categories={previewCategories}
                  brackets={previewBrackets}
                  exemptions={EMPTY_ARRAY}
                  deductions={EMPTY_ARRAY}
                  economicData={calculatorEconomicData}
                  governmentData={governmentData}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <Card
          className="border-white/10 bg-white/[0.01] shadow-2xl backdrop-blur-xl dark:bg-black/20"
        >
          <div className="space-y-6 p-6">
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
                currency={governmentData?.structure?.budgetCurrency || "USD"}
              />
            )}

            {activeTab === "calculator" && (
              <div className="space-y-6">
                {builderState.categories.length === 0 ? (
                  <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm backdrop-blur-sm">
                    <Calculator className="mx-auto mb-3 h-12 w-12 animate-pulse text-zinc-500 opacity-50" />
                    <p className="text-foreground font-medium">Tax Calculator Locked</p>
                    <p className="mt-1 max-w-sm text-xs">
                      Please define at least one tax category in{" "}
                      <strong>Tax Settings &rarr; Categories</strong> before using the calculator.
                    </p>
                  </div>
                ) : (
                  <TaxCalculator
                    taxSystem={previewTaxSystem}
                    categories={previewCategories}
                    brackets={previewBrackets}
                    exemptions={EMPTY_ARRAY}
                    deductions={EMPTY_ARRAY}
                    economicData={calculatorEconomicData}
                    governmentData={governmentData}
                  />
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-emerald-500/25 bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
            <div className="border-border/40 sticky top-0 z-10 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 backdrop-blur-xl dark:bg-black/[0.1]">
              <h2 className="text-foreground text-xl font-bold">Tax System Templates</h2>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="text-foreground/50 hover:text-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              {taxSystemTemplates.map((template, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"
                >
                  <div>
                    <h3 className="text-foreground text-base font-bold">{template.name}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{template.description}</p>
                  </div>
                  <div>
                    <UIBadge variant="secondary">
                      {template.progressiveTax ? "Progressive" : "Flat"} Tax
                    </UIBadge>
                    <UIBadge variant="outline" className="ml-2">
                      {template.categories.length} Categories
                    </UIBadge>
                  </div>
                  <div className="text-sm">
                    <strong className="text-foreground">Categories:</strong>
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
                  <button
                    type="button"
                    onClick={() => setTemplateToConfirm(template)}
                    className="mt-auto w-full rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                  >
                    Use This Template
                  </button>
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-emerald-500/25 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-foreground text-lg font-bold">Apply Template?</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  This will replace your current tax configuration with{" "}
                  <strong className="text-foreground">{templateToConfirm.name}</strong>. All
                  existing categories, brackets, exemptions, and deductions will be overwritten.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTemplateToConfirm(null)}
                className="text-foreground/70 hover:text-foreground rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  applyTemplate(templateToConfirm);
                  setTemplateToConfirm(null);
                  setShowTemplates(false);
                }}
                className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export TaxBuilderState for backwards compatibility
export type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
