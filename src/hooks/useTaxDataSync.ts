"use client";

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
import { useNotify } from "~/hooks/useNotify";
import type { TaxBuilderState } from "./useTaxBuilderState";
import type { TaxBracketInput } from "~/types/tax-system";
import type { SuggestionItem } from "~/components/mycountry/domains/government/builder/SuggestionsPanel";
import { parseEconomicDataForTaxSystem } from "~/lib/economy/tax-data-parser";
import {
  mapRevenueSourceToTaxCategory,
  revenueSourcesToTaxCategories,
  getTaxBracketsForRevenueSource,
} from "~/lib/builder/tax-revenue-mapping";
import type { TaxSystem } from "~/types/tax-system";

// Dev-only logger to avoid noisy logs in production
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== "production") {
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
  const notify = useNotify();
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
      notify.success("Tax data pre-populated from economic indicators");
    } catch (error) {
      console.error("Failed to parse economic data:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const taxCategories = revenueSourcesToTaxCategories(
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
          const defaultBrackets = getTaxBracketsForRevenueSource(matchingRevenue);
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

      notify.success(
        `Auto-populated ${taxCategories.length} tax categories from government revenue sources`,
        "Review and adjust the pre-populated tax structure as needed"
      );

      devLog("Successfully auto-populated tax categories:", {
        categoriesCount: taxCategories.length,
        bracketsCount: Object.keys(bracketsMapping).length,
        categories: taxCategories.map((c) => c.categoryName),
      });
    } catch (error) {
      console.error("Failed to auto-populate from revenue sources:", error);
      notify.error(
        "Failed to auto-populate tax categories",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    governmentData,
    revenueAutoPopulated,
    builderState.categories.length,
    setBuilderState,
    countryId,
  ]);



  return {
    parsedDataApplied,
    revenueAutoPopulated,
    syncedCategoryIndices,
    setSyncedCategoryIndices,
  };
}
