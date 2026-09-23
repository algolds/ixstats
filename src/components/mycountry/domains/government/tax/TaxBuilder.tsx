"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { isEqual } from "~/lib/utils";
import { Badge as UIBadge } from "~/components/ui/badge";
import { Calculator, Settings, StatsReport as BarChart3 } from "iconoir-react";
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
import { TaxSystemTemplatesModal } from "./atoms/TaxSystemTemplatesModal";

// Existing components
import {
  SuggestionsPanel,
  type SuggestionItem,
} from "~/components/mycountry/domains/government/builder/SuggestionsPanel";
import { useIntelligenceWebSocket } from "~/hooks/useIntelligenceWebSocket";

// Templates and types
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
    sectors?: Record<string, number>;
    population: number;
  };
  governmentData?: {
    structure?: {
      budgetCurrency?: string;
    };
  } | null;
  componentOptimization?: {
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
    componentCount: number;
  } | null;
  flat?: boolean;
}

const EMPTY_COMPONENTS: ComponentType[] = [];
const EMPTY_OBJECTS: never[] = [];

export function TaxBuilder({
  initialData,
  onSave,
  onChange,
  // oxlint-disable-next-line eslint/no-unused-vars
  onPreview: _onPreview,
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

  // Auto-sync hook
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
    (validationVal: { isValid: boolean; errors: string[] | Record<string, string[]> }) => {
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
    return (
      atomicComponents?.filter((c) => c.isActive).map((c) => c.componentType as ComponentType) ||
      EMPTY_COMPONENTS
    );
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

  useEffect(() => {
    updateValidation(validation);
  }, [validation, updateValidation]);

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

  // Save handler
  const _handleSave = async () => {
    const currentValidation = validateTaxBuilderState(builderState);
    updateValidation(currentValidation);

    if (currentValidation.isValid) {
      type ServerCalculationMethod = "percentage" | "fixed" | "tiered" | "progressive";
      const normalizedCategories = builderState.categories.map((cat) => ({
        ...cat,
        calculationMethod: cat.calculationMethod as ServerCalculationMethod,
      }));
      const submitState: TaxBuilderState = {
        taxSystem: builderState.taxSystem,
        categories: normalizedCategories,
        brackets: builderState.brackets,
        exemptions: builderState.exemptions,
        deductions: builderState.deductions,
        selectedAtomicTaxComponents,
        isValid: builderState.isValid,
        errors: builderState.errors,
      };

      if (enableAutoSync && countryId && syncState.conflictWarnings.length > 0) {
        setPendingSaveCallback(() => async () => {
          if (onSave) {
            setIsSaving(true);
            try {
              await onSave(submitState);
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
          await onSave(submitState);
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
          try {
            await updateMutation.mutateAsync({
              countryId,
              data: submitState as Parameters<typeof updateMutation.mutateAsync>[0]["data"],
              skipConflictCheck: true,
            });
          } catch (updateErr) {
            const notFound =
              (updateErr as { data?: { code?: string } })?.data?.code === "NOT_FOUND";
            if (notFound) {
              await createMutation.mutateAsync({
                countryId,
                data: submitState as Parameters<typeof createMutation.mutateAsync>[0]["data"],
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

  // Render tab content with zero duplication
  const renderTabContent = () => {
    if (activeTab === "settings") {
      return (
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
      );
    }

    if (activeTab === "preview") {
      return (
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
      );
    }

    if (activeTab === "calculator") {
      return (
        <div className="w-full space-y-6">
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
              exemptions={EMPTY_OBJECTS}
              deductions={EMPTY_OBJECTS}
              economicData={calculatorEconomicData}
              governmentData={governmentData}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="space-y-6 pt-2">{renderTabContent()}</div>
      ) : (
        <Card className="border-white/10 bg-white/[0.01] shadow-2xl backdrop-blur-xl dark:bg-black/20">
          <div className="space-y-6 p-6">{renderTabContent()}</div>
        </Card>
      )}

      {/* Template Modal */}
      <TaxSystemTemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onApplyTemplate={applyTemplate}
      />

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
