// src/components/defense/CommandPanel.tsx
"use client";

import { useDefenseBudget } from "~/hooks/useDefenseBudget";
import {
  BudgetManagementCard,
  ReadinessOverviewCard,
} from "~/components/defense/command";

interface CommandPanelProps {
  countryId: string;
}

export function CommandPanel({ countryId }: CommandPanelProps) {
  const {
    editingBudget,
    setEditingBudget,
    budgetData,
    currentYear,
    branches,
    handleSaveBudget,
    handleTotalBudgetChange,
    handleCategoryChange,
    totalAllocated,
    allocationPercent,
    averageReadiness,
    averageTechnology,
    averageMorale,
  } = useDefenseBudget({ countryId });

  return (
    <div className="space-y-6">
      <BudgetManagementCard
        budgetData={budgetData}
        editingBudget={editingBudget}
        setEditingBudget={setEditingBudget}
        handleSaveBudget={handleSaveBudget}
        handleTotalBudgetChange={handleTotalBudgetChange}
        handleCategoryChange={handleCategoryChange}
        totalAllocated={totalAllocated}
        allocationPercent={allocationPercent}
        currentYear={currentYear}
      />

      <ReadinessOverviewCard
        averageReadiness={averageReadiness}
        averageTechnology={averageTechnology}
        averageMorale={averageMorale}
        branches={branches}
      />
    </div>
  );
}
