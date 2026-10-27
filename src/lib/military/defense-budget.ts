/**
 * The defense budget is the National budget's Defense department line (realm time design, owner
 * decision): the Defense department's allocation in the budget in effect. The Defense page reads
 * it from the government budget and edits it through `government.setAllocation`.
 *
 * D2 sums every Defense-category line (an army ministry and an admiralty both fund defense): the
 * model's budget is `defenseLinesTotal` (`~/lib/military/model`); `defenseLineOf` still names the
 * largest line, the one the page edits, and reports the sum as `totalDefenseAmount`.
 */
import { latestBudgetYearUpTo } from "~/lib/government/budget-year";
import type { DepartmentCategory } from "~/types/government";

/** The department category whose allocation is the defense budget. */
export const DEFENSE_CATEGORY = "Defense" satisfies DepartmentCategory;

interface AllocationLike {
  departmentId: string;
  budgetYear: number;
  allocatedAmount: number;
  allocatedPercent: number;
}

interface DepartmentLike {
  id: string;
  name: string;
  category: string;
}

export type DefenseLine =
  | { kind: "no-structure" }
  | { kind: "no-department" }
  | {
      kind: "line";
      departmentId: string;
      departmentName: string;
      allocatedAmount: number;
      allocatedPercent: number;
      /** Every Defense line of that year, summed: the budget the defense model reads. */
      totalDefenseAmount: number;
      totalBudget: number;
      /** The budget in effect, or null when no year has allocations yet. */
      budgetYear: number | null;
    };

/**
 * The defense line of a government: its Defense department with the largest share of the budget
 * in effect (the latest year at or before `currentYear`), the same line directives nudge. A
 * Defense department with no allocation that year reads as 0. No departments at all is
 * "no-structure"; departments but none of category Defense is "no-department".
 */
export function defenseLineOf(
  government:
    | {
        totalBudget?: number | null;
        departments?: readonly DepartmentLike[] | null;
        budgetAllocations?: readonly AllocationLike[] | null;
      }
    | null
    | undefined,
  currentYear: number
): DefenseLine {
  const departments = government?.departments ?? [];
  if (departments.length === 0) return { kind: "no-structure" };
  const defense = departments.filter((d) => d.category === DEFENSE_CATEGORY);
  if (defense.length === 0) return { kind: "no-department" };

  const allocations = government?.budgetAllocations ?? [];
  const budgetYear = latestBudgetYearUpTo(
    allocations.map((a) => a.budgetYear),
    currentYear
  );
  const lineFor = (departmentId: string) =>
    allocations.find((a) => a.departmentId === departmentId && a.budgetYear === budgetYear);
  const shareOf = (departmentId: string) => lineFor(departmentId)?.allocatedPercent ?? 0;

  const best = defense.reduce((top, dept) => (shareOf(dept.id) > shareOf(top.id) ? dept : top));
  const line = lineFor(best.id);
  return {
    kind: "line",
    departmentId: best.id,
    departmentName: best.name,
    allocatedAmount: line?.allocatedAmount ?? 0,
    allocatedPercent: line?.allocatedPercent ?? 0,
    totalDefenseAmount: defense.reduce((sum, d) => sum + (lineFor(d.id)?.allocatedAmount ?? 0), 0),
    totalBudget: government?.totalBudget ?? 0,
    budgetYear,
  };
}
