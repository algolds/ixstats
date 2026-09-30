/** @jest-environment node */
import {
  LEGACY_MAX_BUDGET_YEAR,
  planBudgetYearRemap,
  summarizeRemap,
} from "../../../scripts/migrations/budget-year-remap-plan";

describe("planBudgetYearRemap", () => {
  it("shifts real-calendar rows by ixYear - realYear and keeps IxTime rows", () => {
    const plan = planBudgetYearRemap(
      [
        { id: "a", departmentId: "d1", budgetYear: 2026 },
        { id: "b", departmentId: "d1", budgetYear: 2025 },
        { id: "c", departmentId: "d2", budgetYear: 2026 },
        { id: "d", departmentId: "d3", budgetYear: 2041 },
      ],
      2026,
      2042
    );
    expect(plan.offset).toBe(16);
    expect(plan.updates).toEqual([
      { id: "a", departmentId: "d1", from: 2026, to: 2042 },
      { id: "b", departmentId: "d1", from: 2025, to: 2041 },
      { id: "c", departmentId: "d2", from: 2026, to: 2042 },
    ]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unchanged).toBe(1);
    expect(summarizeRemap(plan)).toEqual(["2025 → 2041: 1", "2026 → 2042: 2"]);
  });

  it("reports, never overwrites, a target year the department already holds", () => {
    const plan = planBudgetYearRemap(
      [
        { id: "legacy", departmentId: "d1", budgetYear: 2026 },
        { id: "ix", departmentId: "d1", budgetYear: 2042 },
      ],
      2026,
      2042
    );
    expect(plan.updates).toEqual([]);
    expect(plan.conflicts).toEqual([
      { id: "legacy", departmentId: "d1", from: 2026, to: 2042, existingId: "ix" },
    ]);
  });

  it("treats years up to the old schema maximum as legacy and is a no-op once remapped", () => {
    const first = planBudgetYearRemap(
      [{ id: "a", departmentId: "d1", budgetYear: LEGACY_MAX_BUDGET_YEAR }],
      2026,
      2042
    );
    expect(first.updates).toHaveLength(1);
    const again = planBudgetYearRemap(
      [{ id: "a", departmentId: "d1", budgetYear: first.updates[0]!.to }],
      2026,
      2042
    );
    expect(again.updates).toEqual([]);
    expect(again.unchanged).toBe(1);
  });

  it("refuses a non-positive offset", () => {
    expect(() => planBudgetYearRemap([], 2042, 2042)).toThrow();
  });
});
