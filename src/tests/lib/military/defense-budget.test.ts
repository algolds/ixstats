/**
 * Realm time D1: the defense budget is the National budget's Defense department line in the
 * budget in effect. No separate defense budget row, estimate or category split remains.
 */
import { defenseAllocationAmount, defenseLineOf } from "~/lib/military/defense-budget";
import { planStarterForce } from "~/lib/military/force-structure";

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

describe("defenseAllocationAmount", () => {
  it("is the largest Defense line's amount, or null without one", () => {
    const lines = [
      { allocatedAmount: 5, allocatedPercent: 5, department: { category: "Defense" } },
      { allocatedAmount: 40, allocatedPercent: 40, department: { category: "Finance" } },
      { allocatedAmount: 9, allocatedPercent: 9, department: { category: "Defense" } },
    ];
    expect(defenseAllocationAmount(lines)).toBe(9);
    expect(defenseAllocationAmount(lines.slice(1, 2))).toBeNull();
  });
});

describe("planStarterForce", () => {
  const base = { population: 10_000_000, totalGdp: 500e9 };

  it("funds the starter force from the Defense department line first", () => {
    const plan = planStarterForce({
      ...base,
      defenseAllocation: 20e9,
      builderDefenseSpending: 10e9,
    });
    expect(plan.budgetSource).toBe("defenseDepartment");
    expect(plan.branches.reduce((sum, b) => sum + b.annualBudget, 0)).toBe(20e9);
  });

  it("falls back to the builder's Defense spending, then 2% of GDP", () => {
    expect(
      planStarterForce({ ...base, defenseAllocation: null, builderDefenseSpending: 10e9 })
        .budgetSource
    ).toBe("builder");
    expect(
      planStarterForce({ ...base, defenseAllocation: 0, builderDefenseSpending: null }).budgetSource
    ).toBe("estimate");
  });
});
