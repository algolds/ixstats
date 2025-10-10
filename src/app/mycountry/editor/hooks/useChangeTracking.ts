"use client";

import { useState, useCallback, useEffect } from "react";
import { calculateChangeImpact, type ChangeImpact } from "~/lib/change-impact-calculator";
import type { Country } from "@prisma/client";

export interface PendingChange {
  fieldPath: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  category: string;
  impact?: ChangeImpact;
}

export interface ChangeTrackingState {
  changes: PendingChange[];
  hasChanges: boolean;
  hasHighImpactChanges: boolean;
  hasMediumImpactChanges: boolean;
}

interface UseChangeTrackingOptions {
  onChangeDetected?: (change: PendingChange) => void;
}

/**
 * Hook to track changes to country data and calculate their impact
 */
export function useChangeTracking(
  originalData: Partial<Country>,
  options?: UseChangeTrackingOptions
) {
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [currentData, setCurrentData] = useState(originalData);

  // Calculate derived state
  const hasChanges = changes.length > 0;
  const hasHighImpactChanges = changes.some(
    (c) => c.impact?.impactLevel === "high"
  );
  const hasMediumImpactChanges = changes.some(
    (c) => c.impact?.impactLevel === "medium"
  );

  /**
   * Track a single field change
   */
  const trackChange = useCallback(
    (fieldPath: keyof Country, newValue: unknown, fieldLabel: string, category: string) => {
      const oldValue = originalData[fieldPath];

      // Skip if value hasn't actually changed
      if (oldValue === newValue) {
        // Remove from changes if it exists
        setChanges((prev) => prev.filter((c) => c.fieldPath !== fieldPath));
        return;
      }

      // Calculate impact
      const impact = calculateChangeImpact(fieldPath, oldValue, newValue);

      const change: PendingChange = {
        fieldPath,
        fieldLabel,
        oldValue,
        newValue,
        category,
        impact,
      };

      // Update or add the change
      setChanges((prev) => {
        const existingIndex = prev.findIndex((c) => c.fieldPath === fieldPath);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = change;
          return updated;
        }
        return [...prev, change];
      });

      // Update current data
      setCurrentData((prev) => ({
        ...prev,
        [fieldPath]: newValue,
      }));

      // Callback
      options?.onChangeDetected?.(change);
    },
    [originalData, options]
  );

  /**
   * Track multiple changes at once (bulk update)
   */
  const trackChanges = useCallback(
    (updates: Array<{ field: keyof Country; value: unknown; label: string; category: string }>) => {
      updates.forEach(({ field, value, label, category }) => {
        trackChange(field, value, label, category);
      });
    },
    [trackChange]
  );

  /**
   * Clear all pending changes
   */
  const clearChanges = useCallback(() => {
    setChanges([]);
    setCurrentData(originalData);
  }, [originalData]);

  /**
   * Reset to original data
   */
  const resetToOriginal = useCallback(() => {
    setChanges([]);
    setCurrentData(originalData);
  }, [originalData]);

  /**
   * Get a specific field's change
   */
  const getFieldChange = useCallback(
    (fieldPath: keyof Country) => {
      return changes.find((c) => c.fieldPath === fieldPath);
    },
    [changes]
  );

  /**
   * Check if a field has pending changes
   */
  const hasFieldChanged = useCallback(
    (fieldPath: keyof Country) => {
      return changes.some((c) => c.fieldPath === fieldPath);
    },
    [changes]
  );

  /**
   * Get changes by category
   */
  const getChangesByCategory = useCallback(
    (category: string) => {
      return changes.filter((c) => c.category === category);
    },
    [changes]
  );

  /**
   * Get changes by impact level
   */
  const getChangesByImpact = useCallback(
    (impactLevel: "none" | "low" | "medium" | "high") => {
      return changes.filter((c) => c.impact?.impactLevel === impactLevel);
    },
    [changes]
  );

  /**
   * Remove a specific change
   */
  const removeChange = useCallback(
    (fieldPath: keyof Country) => {
      setChanges((prev) => prev.filter((c) => c.fieldPath !== fieldPath));
      setCurrentData((prev) => ({
        ...prev,
        [fieldPath]: originalData[fieldPath],
      }));
    },
    [originalData]
  );

  /**
   * Get summary statistics
   */
  const getSummary = useCallback(() => {
    const instantChanges = changes.filter((c) => c.impact?.changeType === "instant");
    const nextDayChanges = changes.filter((c) => c.impact?.changeType === "next_day");
    const shortTermChanges = changes.filter((c) => c.impact?.changeType === "short_term");
    const longTermChanges = changes.filter((c) => c.impact?.changeType === "long_term");

    return {
      total: changes.length,
      instant: instantChanges.length,
      nextDay: nextDayChanges.length,
      shortTerm: shortTermChanges.length,
      longTerm: longTermChanges.length,
      highImpact: changes.filter((c) => c.impact?.impactLevel === "high").length,
      mediumImpact: changes.filter((c) => c.impact?.impactLevel === "medium").length,
      lowImpact: changes.filter((c) => c.impact?.impactLevel === "low").length,
      noImpact: changes.filter((c) => c.impact?.impactLevel === "none").length,
    };
  }, [changes]);

  return {
    // State
    changes,
    currentData,
    hasChanges,
    hasHighImpactChanges,
    hasMediumImpactChanges,

    // Actions
    trackChange,
    trackChanges,
    clearChanges,
    resetToOriginal,
    removeChange,

    // Queries
    getFieldChange,
    hasFieldChanged,
    getChangesByCategory,
    getChangesByImpact,
    getSummary,
  };
}

/**
 * Field metadata mapping for common fields
 */
export const FIELD_METADATA: Record<
  string,
  { label: string; category: string; description?: string }
> = {
  // National Identity
  name: { label: "Country Name", category: "National Identity" },
  flag: { label: "Flag", category: "National Identity" },
  coatOfArms: { label: "Coat of Arms", category: "National Identity" },
  leader: { label: "Leader", category: "National Identity" },
  governmentType: { label: "Government Type", category: "National Identity" },
  religion: { label: "Religion", category: "National Identity" },
  continent: { label: "Continent", category: "National Identity" },
  region: { label: "Region", category: "National Identity" },
  landArea: { label: "Land Area", category: "National Identity" },

  // Core Economics
  nominalGDP: { label: "Nominal GDP", category: "Core Economics" },
  realGDPGrowthRate: { label: "Real GDP Growth Rate", category: "Core Economics" },
  inflationRate: { label: "Inflation Rate", category: "Core Economics" },
  currentPopulation: { label: "Population", category: "Core Economics" },
  populationGrowthRate: { label: "Population Growth Rate", category: "Core Economics" },
  currentGdpPerCapita: { label: "GDP per Capita", category: "Core Economics" },
  economicTier: { label: "Economic Tier", category: "Core Economics" },
  populationTier: { label: "Population Tier", category: "Core Economics" },

  // Labor & Employment
  laborForceParticipationRate: { label: "Labor Force Participation Rate", category: "Labor & Employment" },
  employmentRate: { label: "Employment Rate", category: "Labor & Employment" },
  unemploymentRate: { label: "Unemployment Rate", category: "Labor & Employment" },
  totalWorkforce: { label: "Total Workforce", category: "Labor & Employment" },
  averageWorkweekHours: { label: "Average Workweek Hours", category: "Labor & Employment" },
  minimumWage: { label: "Minimum Wage", category: "Labor & Employment" },
  averageAnnualIncome: { label: "Average Annual Income", category: "Labor & Employment" },

  // Fiscal System
  taxRevenueGDPPercent: { label: "Tax Revenue (% of GDP)", category: "Fiscal System" },
  governmentRevenueTotal: { label: "Total Government Revenue", category: "Fiscal System" },
  governmentBudgetGDPPercent: { label: "Government Budget (% of GDP)", category: "Fiscal System" },
  budgetDeficitSurplus: { label: "Budget Deficit/Surplus", category: "Fiscal System" },
  totalDebtGDPRatio: { label: "Total Debt (% of GDP)", category: "Fiscal System" },
  debtPerCapita: { label: "Debt per Capita", category: "Fiscal System" },

  // Demographics
  lifeExpectancy: { label: "Life Expectancy", category: "Demographics" },
  urbanPopulationPercent: { label: "Urban Population %", category: "Demographics" },
  ruralPopulationPercent: { label: "Rural Population %", category: "Demographics" },
  literacyRate: { label: "Literacy Rate", category: "Demographics" },

  // Advanced
  localGrowthFactor: { label: "Local Growth Factor", category: "Advanced Settings" },
  currencyExchangeRate: { label: "Currency Exchange Rate", category: "Advanced Settings" },
  povertyRate: { label: "Poverty Rate", category: "Advanced Settings" },
  incomeInequalityGini: { label: "Income Inequality (Gini)", category: "Advanced Settings" },
};

/**
 * Helper to get field metadata
 */
export function getFieldMetadata(fieldPath: string) {
  return FIELD_METADATA[fieldPath] || {
    label: fieldPath,
    category: "Other",
  };
}
