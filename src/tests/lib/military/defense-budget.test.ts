/**
 * Realm time D1: the defense budget is the National budget's Defense department line in the
 * budget in effect. No separate defense budget row, estimate or category split remains.
 */
import { defenseLineOf } from "~/lib/military/defense-budget";

const departments = [
  { id: "d_fin", name: "Treasury", category: "Finance" },
  { id: "d_def", name: "Ministry of Defence", category: "Defense" },
  { id: "d_army", name: "Royal Army Command", category: "Defense" },
];
const line = (departmentId: string, budgetYear: number, percent: number) => ({
  departmentId,
  budgetYear,
  allocatedPercent: percent,
  allocatedAmount: percent * 1e9,
});

describe("defenseLineOf", () => {
  it("reads the largest Defense line of the budget in effect, with the national total", () => {
    const government = {
      totalBudget: 100e9,
      departments,
      budgetAllocations: [
        line("d_def", 2041, 30), // a future year is not in effect yet
        line("d_def", 2040, 8),
        line("d_army", 2040, 12),
        line("d_fin", 2040, 40),
        line("d_def", 2039, 50),
      ],
    };
    expect(defenseLineOf(government, 2040)).toEqual({
      kind: "line",
      departmentId: "d_army",
      departmentName: "Royal Army Command",
      allocatedAmount: 12e9,
      allocatedPercent: 12,
      // D2: the model's budget sums every Defense line (8% + 12%).
      totalDefenseAmount: 20e9,
      totalBudget: 100e9,
      budgetYear: 2040,
    });
  });

  it("carries the last budget forward after the year rolls over", () => {
    const government = {
      totalBudget: 1e9,
      departments,
      budgetAllocations: [line("d_def", 2038, 9)],
    };
    expect(defenseLineOf(government, 2040)).toMatchObject({
      departmentId: "d_def",
      allocatedPercent: 9,
      budgetYear: 2038,
    });
  });

  it("reads 0 for a Defense department with no allocation in the budget in effect", () => {
    const government = {
      totalBudget: 1e9,
      departments: departments.slice(0, 2),
      budgetAllocations: [line("d_fin", 2040, 40)],
    };
    expect(defenseLineOf(government, 2040)).toMatchObject({
      kind: "line",
      departmentId: "d_def",
      allocatedAmount: 0,
      allocatedPercent: 0,
    });
  });

  it("tells a government with no departments from one with no Defense department", () => {
    expect(defenseLineOf(null, 2040)).toEqual({ kind: "no-structure" });
    expect(defenseLineOf({ departments: [], budgetAllocations: [] }, 2040)).toEqual({
      kind: "no-structure",
    });
    expect(defenseLineOf({ departments: departments.slice(0, 1) }, 2040)).toEqual({
      kind: "no-department",
    });
  });
});
