/**
 * Tax Builder Data Synchronization Hook
 *
 * Handles all useEffect syncing logic including:
 * - Economic data parsing and auto-population
 * - Government revenue source integration
 * - Bidirectional sync service subscriptions
 * - Intelligence-based suggestions
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { TaxBuilderState } from "./useTaxBuilderState";
import type { TaxBracketInput, TaxDeductionInput } from "~/types/tax-system";
import type { SuggestionItem } from "~/components/builders/SuggestionsPanel";
import { parseEconomicDataForTaxSystem } from "~/lib/tax-data-parser";
import { revenueTaxIntegrationService } from "~/app/builder/services/RevenueTaxIntegrationService";
import { bidirectionalTaxSyncService } from "~/app/builder/services/BidirectionalTaxSyncService";
import type { TaxSystem } from "~/types/tax-system";

// Dev-only logger to avoid noisy logs in production
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

interface UseTaxDataSyncOptions {
  builderState: TaxBuilderState;
  setBuilderState: (update: React.SetStateAction<TaxBuilderState>) => void;
  countryId?: string;
  economicData?: {
    gdp: number;
    sectors: any;
    population: number;
  };
  governmentData?: any;
  onSuggestionsUpdate?: (suggestions: SuggestionItem[]) => void;
}

/**
 * Custom hook for managing tax builder data synchronization
 */
export function useTaxDataSync(options: UseTaxDataSyncOptions) {
  const {
    builderState,
    setBuilderState,
    countryId,
    economicData,
    governmentData,
    onSuggestionsUpdate,
  } = options;

  const [parsedDataApplied, setParsedDataApplied] = useState(false);
  const [revenueAutoPopulated, setRevenueAutoPopulated] = useState(false);
  const [syncedCategoryIndices, setSyncedCategoryIndices] = useState<Set<number>>(new Set());

  /**
   * Parse and pre-populate economic/government data on mount
   */
  useEffect(() => {
    if (parsedDataApplied || !economicData || !governmentData) return;
    if (builderState.categories.length > 0) return; // Don't overwrite existing data

    try {
      const parsedData = parseEconomicDataForTaxSystem(economicData as any, governmentData, {
        useAggressiveParsing: true,
        includeGovernmentPolicies: true,
        autoGenerateBrackets: true,
        targetRevenueMatch: true,
      });

      setBuilderState((prev: TaxBuilderState) => ({
        ...prev,
        taxSystem: { ...prev.taxSystem, ...parsedData.taxSystem },
        categories: parsedData.categories,
        brackets: parsedData.brackets,
        exemptions: parsedData.exemptions,
        deductions: parsedData.deductions,
      }));

      setParsedDataApplied(true);
      toast.success("Tax data pre-populated from economic indicators");
    } catch (error) {
      console.error("Failed to parse economic data:", error);
    }
  }, [
    economicData,
    governmentData,
    parsedDataApplied,
    builderState.categories.length,
    setBuilderState,
  ]);

  /**
   * Auto-populate tax categories from government revenue sources
   */
  useEffect(() => {
    // Only apply once, when government data is available with revenue sources
    if (revenueAutoPopulated) return;
    if (!governmentData?.revenueSources) return;
    if (builderState.categories.length > 0) return; // Don't overwrite existing data

    try {
      devLog("Auto-populating tax categories from government revenue sources...");

      // Convert revenue sources to tax categories
      const taxCategories = revenueTaxIntegrationService.revenueSourcesToTaxCategories(
        governmentData.revenueSources
      );

      if (taxCategories.length === 0) {
        devLog("No tax categories generated from revenue sources");
        return;
      }

      // Create brackets mapping based on categories
      const bracketsMapping: Record<string, TaxBracketInput[]> = {};
      taxCategories.forEach((category, index) => {
        // Get default brackets for the revenue source
        const matchingRevenue = governmentData.revenueSources.find(
          (rs: any) => rs.name === category.categoryName
        );
        if (matchingRevenue) {
          const defaultBrackets =
            revenueTaxIntegrationService.getTaxBracketsForRevenueSource(matchingRevenue);
          if (defaultBrackets.length > 0) {
            bracketsMapping[index.toString()] = defaultBrackets;
          }
        }
      });

      // Track which category indices are synced from government
      const syncedIndices = new Set<number>();
      taxCategories.forEach((_, index) => {
        syncedIndices.add(index);
      });
      setSyncedCategoryIndices(syncedIndices);

      // Apply the mapped data to builder state
      setBuilderState((prev: TaxBuilderState) => ({
        ...prev,
        categories: taxCategories,
        brackets: bracketsMapping,
        exemptions: [],
        deductions: {},
        taxSystem: {
          ...prev.taxSystem,
          taxSystemName: prev.taxSystem.taxSystemName || `${countryId || "Country"} Tax System`,
          collectionEfficiency: prev.taxSystem.collectionEfficiency || 90,
          complianceRate: prev.taxSystem.complianceRate || 85,
        },
      }));

      setRevenueAutoPopulated(true);

      toast.success(
        `Auto-populated ${taxCategories.length} tax categories from government revenue sources`,
        {
          description: "Review and adjust the pre-populated tax structure as needed",
        }
      );

      devLog("Successfully auto-populated tax categories:", {
        categoriesCount: taxCategories.length,
        bracketsCount: Object.keys(bracketsMapping).length,
        categories: taxCategories.map((c) => c.categoryName),
      });
    } catch (error) {
      console.error("Failed to auto-populate from revenue sources:", error);
      toast.error("Failed to auto-populate tax categories", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }, [
    governmentData,
    revenueAutoPopulated,
    builderState.categories.length,
    setBuilderState,
    countryId,
  ]);

  /**
   * Subscribe to bidirectional tax sync service for recommendations
   */
  useEffect(() => {
    const unsubscribe = bidirectionalTaxSyncService.subscribe((state) => {
      if (state.taxRecommendations.length > 0 && !revenueAutoPopulated) {
        // Convert tax recommendations to suggestions
        const newSuggestions: SuggestionItem[] = state.taxRecommendations.map((rec) => ({
          id: `tax-rec-${rec.taxType}-${Date.now()}`,
          type: "tax_recommendation",
          title: `Optimize ${rec.taxType} tax rate`,
          description: rec.rationale,
          severity: rec.implementationPriority === "high" ? "warning" : "info",
          impact: rec.implementationPriority,
          action: () => {
            // Find matching category and update rate
            const categoryIndex = builderState.categories.findIndex((c) =>
              c.categoryName.toLowerCase().includes(rec.taxType.toLowerCase())
            );
            if (categoryIndex >= 0) {
              const updatedCategories = [...builderState.categories];
              updatedCategories[categoryIndex] = {
                ...updatedCategories[categoryIndex],
                baseRate: rec.recommendedRate,
              };
              setBuilderState((prev) => ({
                ...prev,
                categories: updatedCategories,
              }));
              toast.success(`Applied ${rec.taxType} tax recommendation: ${rec.recommendedRate}%`);
            }
          },
        }));

        if (onSuggestionsUpdate) {
          onSuggestionsUpdate(newSuggestions);
        }
      }

      if (state.economicImpacts.length > 0) {
        devLog("Economic impacts from tax changes:", state.economicImpacts);
      }

      if (state.errors.length > 0) {
        toast.error(`Tax sync error: ${state.errors[state.errors.length - 1]}`);
      }
    });

    return unsubscribe;
  }, [builderState.categories, setBuilderState, revenueAutoPopulated, onSuggestionsUpdate]);

  /**
   * Update bidirectional sync service when tax system changes
   */
  useEffect(() => {
    if (builderState.categories.length > 0) {
      const taxSystemData = {
        id: countryId || "draft",
        countryId: countryId || "draft",
        taxSystemName: builderState.taxSystem.taxSystemName,
        fiscalYear: builderState.taxSystem.fiscalYear,
        progressiveTax: builderState.taxSystem.progressiveTax,
        alternativeMinTax: builderState.taxSystem.alternativeMinTax,
        collectionEfficiency: builderState.taxSystem.collectionEfficiency,
        complianceRate: builderState.taxSystem.complianceRate,
        taxCategories: builderState.categories.map((cat, idx) => ({
          id: `cat-${idx}`,
          taxSystemId: countryId || "draft",
          categoryId: `cat-${idx}`,
          categoryName: cat.categoryName,
          categoryType: cat.categoryType,
          description: cat.description,
          baseRate: cat.baseRate,
          calculationMethod: cat.calculationMethod,
          minimumAmount: cat.minimumAmount,
          maximumAmount: cat.maximumAmount,
          exemptionAmount: cat.exemptionAmount,
          deductionAllowed: cat.deductionAllowed,
          standardDeduction: cat.standardDeduction,
          priority: cat.priority || idx + 1,
          color: cat.color,
          icon: cat.icon,
          isActive: cat.isActive,
          taxBrackets: (builderState.brackets[idx] || []).map((bracket, bIdx) => ({
            id: `bracket-${idx}-${bIdx}`,
            taxSystemId: countryId || "draft",
            categoryId: `cat-${idx}`,
            bracketName: bracket.bracketName,
            minIncome: bracket.minIncome,
            maxIncome: bracket.maxIncome,
            rate: bracket.rate,
            flatAmount: bracket.flatAmount,
            marginalRate: bracket.marginalRate,
            isActive: bracket.isActive,
            priority: bracket.priority,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          taxExemptions: [],
          taxDeductions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TaxSystem;

      bidirectionalTaxSyncService.updateTaxSystem(taxSystemData).catch((err) => {
        devLog("Failed to update bidirectional tax sync:", err);
      });
    }
  }, [builderState.categories, builderState.brackets, builderState.taxSystem, countryId]);

  return {
    parsedDataApplied,
    revenueAutoPopulated,
    syncedCategoryIndices,
    setSyncedCategoryIndices,
  };
}
