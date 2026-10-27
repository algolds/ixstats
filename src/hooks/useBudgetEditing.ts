"use client";

/**
 * The owner's National budget edits (owner decision 1): set a department's share, add and remove
 * departments. Each edit refreshes the budget, the Cabinet's department list and the first steps
 * ("Review your budget" ticks after an edit). Undefined when the viewer may not edit.
 */
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import type { BudgetAllocation, DepartmentCategory } from "~/types/government";

/** The owner's edits, passed only when the budget shown is the one in effect and they may edit it. */
export interface BudgetEditing {
  totalBudget: number;
  pending: boolean;
  onUpdateBudget: (
    departmentId: string,
    allocation: Pick<BudgetAllocation, "allocatedPercent">
  ) => void;
  onRemoveDepartment: (departmentId: string) => void;
  onAddDepartment: (department: { name: string; category: DepartmentCategory }) => void;
}

export function useBudgetEditing(
  countryId: string | undefined,
  totalBudget: number,
  onUpdateBudget?: BudgetEditing["onUpdateBudget"]
): BudgetEditing | undefined {
  const notify = useNotify();
  const utils = api.useUtils();
  const refresh = async () => {
    await Promise.all([
      utils.government.getFullByCountryId.invalidate({ countryId: countryId ?? "" }),
      utils.government.getByCountryId.invalidate({ countryId: countryId ?? "" }),
      utils.mycountry.getFirstSteps.invalidate(),
    ]);
  };
  const handlers = {
    onSuccess: refresh,
    onError: (error: { message: string }) => notify.error(error.message),
  };
  const setAllocation = api.government.setAllocation.useMutation(handlers);
  const addDepartment = api.government.addDepartment.useMutation(handlers);
  const removeDepartment = api.government.removeDepartment.useMutation(handlers);

  if (!countryId) return undefined;
  return {
    totalBudget,
    pending: setAllocation.isPending || addDepartment.isPending || removeDepartment.isPending,
    onUpdateBudget:
      onUpdateBudget ??
      ((departmentId, { allocatedPercent }) =>
        setAllocation.mutate({ countryId, departmentId, allocatedPercent })),
    onRemoveDepartment: (departmentId) => removeDepartment.mutate({ countryId, departmentId }),
    onAddDepartment: (department) => addDepartment.mutate({ countryId, ...department }),
  };
}
