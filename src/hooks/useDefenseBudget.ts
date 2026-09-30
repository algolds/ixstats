"use client";
// src/hooks/useDefenseBudget.ts

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useLocalActions } from "~/hooks/useLocalActions";

export const BUDGET_CATEGORIES = [
  {
    key: "personnelCosts",
    label: "Personnel",
    iconName: "Users" as const,
    color: "text-blue-600",
    defaultPercent: 40,
  },
  {
    key: "operationsMaintenance",
    label: "Operations & Maintenance",
    iconName: "Wrench" as const,
    color: "text-green-600",
    defaultPercent: 30,
  },
  {
    key: "procurement",
    label: "Procurement",
    iconName: "Package" as const,
    color: "text-purple-600",
    defaultPercent: 15,
  },
  {
    key: "rdteCosts",
    label: "Research & Development",
    iconName: "Microscope" as const,
    color: "text-orange-600",
    defaultPercent: 10,
  },
  {
    key: "militaryConstruction",
    label: "Military Construction",
    iconName: "Building" as const,
    color: "text-cyan-600",
    defaultPercent: 5,
  },
] as const;

export type BudgetCategoryKey =
  "personnelCosts" | "operationsMaintenance" | "procurement" | "rdteCosts" | "militaryConstruction";

export interface BudgetData {
  totalBudget: number;
  gdpPercent: number;
  personnelCosts: number;
  operationsMaintenance: number;
  procurement: number;
  rdteCosts: number;
  militaryConstruction: number;
}

interface UseDefenseBudgetOptions {
  countryId: string;
}

export function useDefenseBudget({ countryId }: UseDefenseBudgetOptions) {
  const notify = useNotify();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetData>({
    totalBudget: 0,
    gdpPercent: 0,
    personnelCosts: 0,
    operationsMaintenance: 0,
    procurement: 0,
    rdteCosts: 0,
    militaryConstruction: 0,
  });

  const currentYear = new Date().getFullYear();
  const { saveAction } = useLocalActions(countryId);

  // --- tRPC Queries ---

  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // oxlint-disable-next-line eslint/no-unused-vars
  const { data: defenseBudget, refetch: refetchBudget } = api.security.getDefenseBudget.useQuery(
    { countryId, fiscalYear: currentYear },
    { enabled: !!countryId }
  );

  const { data: branches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // --- Local Save (replaces mutation) ---

  // --- Initialize budget data from query results ---

  useEffect(() => {
    if (defenseBudget) {
      setBudgetData({
        totalBudget: defenseBudget.totalBudget ?? 0,
        gdpPercent: defenseBudget.gdpPercent ?? 0,
        personnelCosts: defenseBudget.personnelCosts ?? 0,
        operationsMaintenance: defenseBudget.operationsMaintenance ?? 0,
        procurement: defenseBudget.procurement ?? 0,
        rdteCosts: defenseBudget.rdteCosts ?? 0,
        militaryConstruction: defenseBudget.militaryConstruction ?? 0,
      });
    } else if (country) {
      const defaultBudget = (country.calculatedStats.currentTotalGdp ?? 0) * 0.02;
      setBudgetData({
        totalBudget: defaultBudget,
        gdpPercent: country.calculatedStats.currentTotalGdp ? 2.0 : 0,
        personnelCosts: defaultBudget * 0.4,
        operationsMaintenance: defaultBudget * 0.3,
        procurement: defaultBudget * 0.15,
        rdteCosts: defaultBudget * 0.1,
        militaryConstruction: defaultBudget * 0.05,
      });
    }
  }, [defenseBudget, country]);

  // --- Handlers ---

  const handleSaveBudget = useCallback(() => {
    if (!countryId) {
      notify.error("Cannot update budget: missing countryId.");
      return;
    }
    if (!budgetData) {
      notify.error("Cannot update budget: missing budget data.");
      return;
    }

    const {
      totalBudget,
      gdpPercent,
      personnelCosts,
      operationsMaintenance,
      procurement,
      rdteCosts,
      militaryConstruction,
    } = budgetData;

    const payload = {
      countryId,
      fiscalYear: currentYear,
      totalBudget: totalBudget || 0,
      gdpPercent: gdpPercent || 0,
      personnelCosts: personnelCosts || 0,
      operationsMaintenance: operationsMaintenance || 0,
      procurement: procurement || 0,
      rdteCosts: rdteCosts || 0,
      militaryConstruction: militaryConstruction || 0,
    };

    for (const key in payload) {
      if (
        typeof (payload as Record<string, unknown>)[key] === "number" &&
        isNaN((payload as unknown as Record<string, number>)[key]!)
      ) {
        notify.error(`Invalid budget data: ${key} is not a number.`);
        return;
      }
    }

    saveAction("budget_update", payload);
    notify.success("Defense budget updated");
    setEditingBudget(false);
  }, [countryId, budgetData, currentYear, saveAction, notify]);

  const handleTotalBudgetChange = useCallback(
    (value: number) => {
      const ratio = value / (budgetData.totalBudget || 1);
      setBudgetData({
        ...budgetData,
        totalBudget: value,
        personnelCosts: budgetData.personnelCosts * ratio,
        operationsMaintenance: budgetData.operationsMaintenance * ratio,
        procurement: budgetData.procurement * ratio,
        rdteCosts: budgetData.rdteCosts * ratio,
        militaryConstruction: budgetData.militaryConstruction * ratio,
        gdpPercent:
          country && country.calculatedStats.currentTotalGdp
            ? (value / country.calculatedStats.currentTotalGdp) * 100
            : budgetData.gdpPercent,
      });
    },
    [budgetData, country]
  );

  const handleCategoryChange = useCallback(
    (key: string, value: number) => {
      setBudgetData({ ...budgetData, [key]: value });
    },
    [budgetData]
  );

  // --- Computed values ---

  const totalAllocated = useMemo(
    () =>
      budgetData.personnelCosts +
      budgetData.operationsMaintenance +
      budgetData.procurement +
      budgetData.rdteCosts +
      budgetData.militaryConstruction,
    [budgetData]
  );

  const allocationPercent = useMemo(
    () => (budgetData.totalBudget > 0 ? (totalAllocated / budgetData.totalBudget) * 100 : 0),
    [totalAllocated, budgetData.totalBudget]
  );

  const averageReadiness = useMemo(
    () =>
      branches && branches.length > 0
        ? branches.reduce((sum, b) => sum + b.readinessLevel, 0) / branches.length
        : 0,
    [branches]
  );

  const averageTechnology = useMemo(
    () =>
      branches && branches.length > 0
        ? branches.reduce((sum, b) => sum + b.technologyLevel, 0) / branches.length
        : 0,
    [branches]
  );

  const averageMorale = useMemo(
    () =>
      branches && branches.length > 0
        ? branches.reduce((sum, b) => sum + b.morale, 0) / branches.length
        : 0,
    [branches]
  );

  return {
    // State
    editingBudget,
    setEditingBudget,
    budgetData,
    currentYear,

    // Data
    branches,

    // Handlers
    handleSaveBudget,
    handleTotalBudgetChange,
    handleCategoryChange,

    // Computed
    totalAllocated,
    allocationPercent,
    averageReadiness,
    averageTechnology,
    averageMorale,
  };
}
