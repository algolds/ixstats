"use client";
// src/components/defense/CommandPanel.tsx

import { useDefenseBudget } from "~/hooks/useDefenseBudget";
import { BudgetManagementCard } from "~/components/mycountry/domains/defense/command";
import { ForceStructurePanel } from "./forces/ForceStructurePanel";

interface CommandPanelProps {
  countryId: string;
}

export function CommandPanel({ countryId }: CommandPanelProps) {
  const {
    editingBudget,
    setEditingBudget,
    budgetData,
    isEstimate,
    isSaving,
    handleSaveBudget,
    handleTotalBudgetChange,
    handleCategoryChange,
    allocationPercent,
  } = useDefenseBudget({ countryId });

  return (
    <div className="space-y-6">
      <ForceStructurePanel countryId={countryId} />
      <BudgetManagementCard
        budgetData={budgetData}
        isEstimate={isEstimate}
        isSaving={isSaving}
        editingBudget={editingBudget}
        setEditingBudget={setEditingBudget}
        handleSaveBudget={handleSaveBudget}
        handleTotalBudgetChange={handleTotalBudgetChange}
        handleCategoryChange={handleCategoryChange}
        allocationPercent={allocationPercent}
      />
    </div>
  );
}
