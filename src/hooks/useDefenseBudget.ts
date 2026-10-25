"use client";
// src/hooks/useDefenseBudget.ts

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  ESTIMATE_GDP_SHARE,
  allocatedDefenseBudget,
  defenseBudgetRatios,
  estimateDefenseBudget,
  type DefenseBudgetAmounts,
  type DefenseBudgetCategoryKey,
} from "~/lib/military/defense-budget";

export const BUDGET_CATEGORIES: ReadonlyArray<{
  key: DefenseBudgetCategoryKey;
  label: string;
  iconName: "Users" | "Wrench" | "Package" | "Microscope" | "Building";
}> = [
  { key: "personnelCosts", label: "Personnel", iconName: "Users" },
  { key: "operationsMaintenance", label: "Operations & Maintenance", iconName: "Wrench" },
  { key: "procurement", label: "Procurement", iconName: "Package" },
  { key: "rdteCosts", label: "Research & Development", iconName: "Microscope" },
  { key: "militaryConstruction", label: "Military Construction", iconName: "Building" },
];

export type BudgetData = DefenseBudgetAmounts & { gdpPercent: number };

interface UseDefenseBudgetOptions {
  countryId: string;
}

const EMPTY_BUDGET: BudgetData = { ...estimateDefenseBudget(0), gdpPercent: 0 };

/**
 * The nation's saved defense budget (one `DefenseBudget` row), or until one is saved an
 * estimate of 2% of GDP that the card labels as an estimate. Saving upserts the row.
 */
export function useDefenseBudget({ countryId }: UseDefenseBudgetOptions) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetData>(EMPTY_BUDGET);

  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );
  const gdp = country?.calculatedStats.currentTotalGdp ?? 0;

  const { data: defenseBudget, isSuccess: budgetLoaded } = api.security.getDefenseBudget.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const isEstimate = budgetLoaded && !defenseBudget;

  const saveMutation = api.security.upsertDefenseBudget.useMutation({
    onSuccess: () => {
      notify.success("Defense budget saved");
      setEditingBudget(false);
      void utils.security.getDefenseBudget.invalidate({ countryId });
    },
    onError: (error) => notify.error(`Could not save the defense budget: ${error.message}`),
  });

  // Show the saved row, or the estimate when none exists. Not while editing, so a refetch
  // cannot overwrite unsaved input.
  useEffect(() => {
    if (editingBudget) return;
    if (defenseBudget) {
      setBudgetData({
        totalBudget: defenseBudget.totalBudget,
        gdpPercent: defenseBudget.gdpPercent,
        personnelCosts: defenseBudget.personnelCosts,
        operationsMaintenance: defenseBudget.operationsMaintenance,
        procurement: defenseBudget.procurement,
        rdteCosts: defenseBudget.rdteCosts,
        militaryConstruction: defenseBudget.militaryConstruction,
      });
    } else if (country) {
      setBudgetData({
        ...estimateDefenseBudget(gdp),
        gdpPercent: gdp > 0 ? ESTIMATE_GDP_SHARE * 100 : 0,
      });
    }
  }, [defenseBudget, country, gdp, editingBudget]);

  const handleSaveBudget = useCallback(() => {
    const { gdpPercent: _gdpPercent, ...amounts } = budgetData;
    saveMutation.mutate({ countryId, ...amounts });
  }, [countryId, budgetData, saveMutation]);

  const handleTotalBudgetChange = useCallback(
    (value: number) => {
      setBudgetData((prev) => {
        const ratio = prev.totalBudget > 0 ? value / prev.totalBudget : 0;
        const next = { ...prev, totalBudget: value };
        for (const c of BUDGET_CATEGORIES) next[c.key] = prev[c.key] * ratio;
        next.gdpPercent = defenseBudgetRatios(value, gdp, null).gdpPercent;
        return next;
      });
    },
    [gdp]
  );

  const handleCategoryChange = useCallback((key: DefenseBudgetCategoryKey, value: number) => {
    setBudgetData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const totalAllocated = useMemo(() => allocatedDefenseBudget(budgetData), [budgetData]);
  const allocationPercent =
    budgetData.totalBudget > 0 ? (totalAllocated / budgetData.totalBudget) * 100 : 0;

  return {
    editingBudget,
    setEditingBudget,
    budgetData,
    isEstimate,
    isSaving: saveMutation.isPending,
    handleSaveBudget,
    handleTotalBudgetChange,
    handleCategoryChange,
    allocationPercent,
  };
}
