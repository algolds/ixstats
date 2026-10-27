"use client";

import { useDefenseBudget } from "~/hooks/useDefenseBudget";
import { BudgetManagementCard } from "./BudgetManagementCard";

/** The Defense department's line of the national budget, edited in place. */
export function DefenseBudgetSection({ countryId }: { countryId: string }) {
  const budget = useDefenseBudget({ countryId });
  return (
    <BudgetManagementCard
      countryId={countryId}
      line={budget.line}
      isLoading={budget.isLoading}
      isSaving={budget.isSaving}
      editingBudget={budget.editingBudget}
      setEditingBudget={budget.setEditingBudget}
      onSaveShare={budget.saveShare}
      onAddDefenseDepartment={budget.addDefenseDepartment}
    />
  );
}
