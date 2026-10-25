"use client";
// src/components/mycountry/domains/defense/CommandPanel.tsx

import { useDefenseBudget } from "~/hooks/useDefenseBudget";
import { BudgetManagementCard } from "~/components/mycountry/domains/defense/command";
import { ForceStructurePanel } from "./forces/ForceStructurePanel";

interface CommandPanelProps {
  countryId: string;
}

export function CommandPanel({ countryId }: CommandPanelProps) {
  const budget = useDefenseBudget({ countryId });

  return (
    <div className="space-y-6">
      <ForceStructurePanel countryId={countryId} />
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
    </div>
  );
}
