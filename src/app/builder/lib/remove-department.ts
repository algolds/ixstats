import type { GovernmentBuilderState } from "~/types/government";

/**
 * The government without the department at `index`. Budget allocations and parent links refer
 * to departments by index, so the removed department's allocations go with it, links to it are
 * cleared, and every later index moves down by one.
 */
export function removeDepartmentAt(
  government: GovernmentBuilderState,
  index: number
): GovernmentBuilderState {
  const removed = String(index);
  const shift = (ref: string): string => {
    const n = Number(ref);
    return Number.isInteger(n) && n > index ? String(n - 1) : ref;
  };

  return {
    ...government,
    departments: (government.departments || [])
      .filter((_dept, i) => i !== index)
      .map((dept) =>
        dept.parentDepartmentId === undefined
          ? dept
          : {
              ...dept,
              parentDepartmentId:
                dept.parentDepartmentId === removed ? undefined : shift(dept.parentDepartmentId),
            }
      ),
    budgetAllocations: (government.budgetAllocations || [])
      .filter((alloc) => alloc.departmentId !== removed)
      .map((alloc) => ({ ...alloc, departmentId: shift(alloc.departmentId) })),
  };
}
