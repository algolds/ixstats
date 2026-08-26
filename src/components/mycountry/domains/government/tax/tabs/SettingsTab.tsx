"use client";

import React, { useState } from "react";
import { InfoCircle as Info, WarningTriangle as AlertTriangle, Settings as SettingsIcon, List, NavArrowDown as ChevronDown, NavArrowRight as ChevronRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { TaxSystemForm } from "../atoms/TaxSystemForm";
import { TaxCategoryForm } from "../atoms/TaxCategoryForm";
import { AtomicTaxComponentSelector } from "../atoms/AtomicTaxComponents";
import { UnifiedTaxEffectivenessDisplay } from "../UnifiedTaxEffectivenessDisplay";
import type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxSystem,
} from "~/types/tax-system";
import type { ComponentType } from "~/types/government";

interface SettingsTabProps {
  taxSystem: TaxSystemInput;
  onTaxSystemChange: (taxSystem: TaxSystemInput) => void;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>;
  onCategoriesChange: (categories: TaxCategoryInput[]) => void;
  onBracketsChange: (categoryIndex: string, brackets: TaxBracketInput[]) => void;
  onAddCategory: () => void;
  onRemoveCategory: (index: number) => void;
  selectedAtomicTaxComponents: string[];
  onAtomicComponentsChange: (components: string[]) => void;
  activeGovernmentComponents: ComponentType[];
  showAtomicIntegration: boolean;
  economicData?: { gdp: number; sectors: any; population: number };
  previewTaxSystem: TaxSystem;
  validation: { isValid: boolean; errors: Record<string, any> };
  isReadOnly: boolean;
  countryId?: string;
  onOpenTemplates: () => void;
  revenueAutoPopulated: boolean;
  syncedCategoryIndices: Set<number>;
}

const subTabs = [
  { id: "system", label: "System", icon: SettingsIcon },
  { id: "categories", label: "Categories", icon: List },
];

export function SettingsTab({
  taxSystem,
  onTaxSystemChange,
  categories,
  brackets,
  onCategoriesChange,
  onBracketsChange,
  onAddCategory,
  onRemoveCategory,
  selectedAtomicTaxComponents,
  onAtomicComponentsChange,
  activeGovernmentComponents,
  showAtomicIntegration,
  economicData,
  previewTaxSystem,
  validation,
  isReadOnly,
  countryId,
  onOpenTemplates,
  revenueAutoPopulated: _revenueAutoPopulated,
  syncedCategoryIndices,
}: SettingsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"system" | "categories">("system");
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
        {subTabs.map((tab) => {
          const isActive = tab.id === activeSubTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as "system" | "categories")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-emerald-500/15 font-semibold text-emerald-400"
                  : "text-foreground/50 hover:text-foreground/80 hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Inline validation */}
      {!validation.isValid && Object.keys(validation.errors).length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please fix the following issues:
            <ul className="mt-2 list-inside list-disc space-y-1">
              {Object.entries(validation.errors).map(([key, errorValue]) =>
                Array.isArray(errorValue)
                  ? errorValue.map((error, index) => (
                      <li key={`${key}-${index}`} className="text-sm">
                        {error}
                      </li>
                    ))
                  : Object.entries(errorValue as Record<string, unknown>).map(
                      ([subKey, subErrors]) => (
                        <li key={`${key}-${subKey}`} className="text-sm">
                          {key === "categories" ? `Category ${parseInt(subKey) + 1}: ` : ""}
                          {Array.isArray(subErrors) ? subErrors.join(", ") : (subErrors as string)}
                        </li>
                      )
                    )
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* ── System Sub-tab ── */}
      {activeSubTab === "system" && (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              Tax System Settings
            </h3>
            <TaxSystemForm
              data={taxSystem}
              onChange={onTaxSystemChange}
              isReadOnly={isReadOnly}
              errors={validation.errors.taxSystem || {}}
              countryId={countryId}
            />
          </div>

          {/* Advanced: Atomic Tax Components */}
          {showAtomicIntegration && (
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                >
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Advanced
                  {showAdvanced ? "" : ` (${selectedAtomicTaxComponents.length} atomic components)`}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.01] p-5">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    Atomic Tax Components
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Build your tax system using modular components with synergies and conflicts
                  </p>
                  <AtomicTaxComponentSelector
                    selectedComponents={selectedAtomicTaxComponents}
                    onComponentChange={onAtomicComponentsChange}
                    maxComponents={15}
                    isReadOnly={isReadOnly}
                  />
                  {selectedAtomicTaxComponents.length > 0 && economicData && (
                    <UnifiedTaxEffectivenessDisplay
                      taxComponents={selectedAtomicTaxComponents.map((id) => ({
                        id,
                        type: id,
                        name: id,
                        effectiveness: 80,
                      }))}
                      governmentComponents={activeGovernmentComponents.map((type) => ({
                        id: type,
                        type,
                        name: type,
                        effectiveness: 80,
                        countryId: countryId || "",
                        effectivenessScore: 80,
                        implementationDate: new Date(),
                        implementationCost: 0,
                        maintenanceCost: 0,
                        requiredCapacity: 50,
                        isActive: true,
                        notes: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      }))}
                      economicData={economicData as any}
                      taxSystem={previewTaxSystem}
                    />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* ── Categories Sub-tab ── */}
      {activeSubTab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              Tax Categories
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onOpenTemplates} disabled={isReadOnly}>
                Apply Template
              </Button>
              <Button variant="default" size="sm" onClick={onAddCategory} disabled={isReadOnly}>
                Add Category
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                <Info className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No tax categories defined yet.</p>
                <p className="mt-1">Add a category or apply a template to get started.</p>
              </div>
            ) : (
              categories.map((category, index) => (
                <TaxCategoryForm
                  key={index}
                  data={category}
                  onChange={(updatedCategory) => {
                    const newCategories = [...categories];
                    newCategories[index] = updatedCategory;
                    onCategoriesChange(newCategories);
                  }}
                  onDelete={() => onRemoveCategory(index)}
                  isReadOnly={isReadOnly}
                  showBrackets={true}
                  brackets={brackets[index.toString()] || []}
                  onBracketsChange={(updatedBrackets) =>
                    onBracketsChange(index.toString(), updatedBrackets)
                  }
                  categoryIndex={index}
                  errors={validation.errors.categories?.[index] || {}}
                  isSyncedFromRevenue={syncedCategoryIndices.has(index)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
