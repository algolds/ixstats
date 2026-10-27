"use client";
// src/hooks/useDefenseBudget.ts

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useBudgetEditing } from "~/hooks/useBudgetEditing";
import { useNationClock } from "~/hooks/useNationClock";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { DEFENSE_CATEGORY, defenseLineOf } from "~/lib/military/defense-budget";

/**
 * The defense budget: the Defense department's line in the National budget in effect, read from
 * the government budget (the National budget tab's query, so both stay in step). Saving a share
 * goes through the owner-checked `government.setAllocation`; with no Defense department, the
 * owner can add one. The budget year is the nation's, on its realm clock (loading until it is known).
 */
export function useDefenseBudget({ countryId }: { countryId: string }) {
  const [editingBudget, setEditingBudget] = useState(false);
  const { data: government, isLoading } = api.government.getFullByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const clock = useNationClock();
  const budgetYear = clock ? currentBudgetYear(clock.now()) : null;
  const line = useMemo(
    () => defenseLineOf(budgetYear === null ? null : government, budgetYear ?? 0),
    [government, budgetYear]
  );
  const editing = useBudgetEditing(countryId, line.kind === "line" ? line.totalBudget : 0);

  return {
    line,
    isLoading: isLoading || budgetYear === null,
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
