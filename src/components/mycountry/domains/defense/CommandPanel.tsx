"use client";
// src/components/defense/CommandPanel.tsx

import { useDefenseBudget } from "~/hooks/useDefenseBudget";
import { BudgetManagementCard } from "~/components/mycountry/domains/defense/command";

interface CommandPanelProps {
  countryId: string;
}

export function CommandPanel({ countryId }: CommandPanelProps) {
  const {
    editingBudget,
    setEditingBudget,
    budgetData,
    currentYear,
    handleSaveBudget,
    handleTotalBudgetChange,
    handleCategoryChange,
    totalAllocated,
    allocationPercent,
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
    </div>
  );
}
