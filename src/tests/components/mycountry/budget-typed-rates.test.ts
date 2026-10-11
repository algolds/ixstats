import { describe, it, expect } from "@jest/globals";
import { parseRate } from "~/components/mycountry/shell/RateInput";
import { buildTrendData, summarizeBudget } from "~/components/mycountry/domains/government/budget/budgetSummaries";
import type { BudgetAllocation, GovernmentDepartment } from "~/types/government";

describe("parseRate", () => {
  it("clamps to the slider range and snaps to the step", () => {
    expect(parseRate("12.3", 0, 50, 0.5)).toBe(12.5);
    expect(parseRate("80", 0, 50, 0.5)).toBe(50);
    expect(parseRate("-4", 0, 50, 0.5)).toBe(0);
    expect(parseRate("0.3", 0, 10, 0.1)).toBe(0.3);
  });

  it("rejects text that is not a number", () => {
    expect(parseRate("", 0, 50, 1)).toBeNull();
    expect(parseRate("abc", 0, 50, 1)).toBeNull();
  });
});

describe("summarizeBudget department list", () => {
  const dept = (id: string) => ({ id, name: id }) as GovernmentDepartment;
  const alloc = (departmentId: string, allocatedAmount: number) =>
    ({ departmentId, allocatedAmount, spentAmount: 0 }) as BudgetAllocation;

  it("lists every department, including those with no allocation, largest first", () => {
    const summary = summarizeBudget(
      [alloc("b", 10), alloc("c", 30)],
      [dept("a"), dept("b"), dept("c"), dept("d"), dept("e"), dept("f")],
      100
    );
    expect(summary.departmentAllocations.map((d) => d.department.id)).toEqual([
      "c",
      "b",
      "a",
      "d",
      "e",
      "f",
    ]);
    expect(summary.departmentAllocations[2]?.allocation).toBeNull();
  });
});

describe("buildTrendData", () => {
  it("sums recorded allocations per budget year, oldest first", () => {
    const row = (budgetYear: number, allocatedAmount: number, spentAmount: number) =>
      ({ budgetYear, allocatedAmount, spentAmount }) as BudgetAllocation;
    expect(buildTrendData([row(2041, 10, 4), row(2040, 5, 5), row(2041, 20, 1)])).toEqual([
      { year: "2040", budget: 5, spent: 5 },
      { year: "2041", budget: 30, spent: 5 },
    ]);
  });
});
