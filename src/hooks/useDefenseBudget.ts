"use client";
// src/hooks/useDefenseBudget.ts

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useBudgetEditing } from "~/hooks/useBudgetEditing";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { DEFENSE_CATEGORY, defenseLineOf } from "~/lib/military/defense-budget";

/**
 * The defense budget: the Defense department's line in the National budget in effect, read from
 * the government budget (the National budget tab's query, so both stay in step). Saving a share
 * goes through the owner-checked `government.setAllocation`; with no Defense department, the
 * owner can add one.
 */
export function useDefenseBudget({ countryId }: { countryId: string }) {
  const [editingBudget, setEditingBudget] = useState(false);
  const { data: government, isLoading } = api.government.getFullByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const line = useMemo(() => defenseLineOf(government, currentBudgetYear()), [government]);
  const editing = useBudgetEditing(countryId, line.kind === "line" ? line.totalBudget : 0);

  return {
    line,
    isLoading,
    editingBudget,
    setEditingBudget,
    isSaving: editing?.pending ?? false,
    saveShare: (allocatedPercent: number) => {
      if (line.kind !== "line" || !editing) return;
      editing.onUpdateBudget(line.departmentId, { allocatedPercent });
      setEditingBudget(false);
    },
    addDefenseDepartment: () =>
      editing?.onAddDepartment({ name: "Ministry of Defence", category: DEFENSE_CATEGORY }),
  };
}
