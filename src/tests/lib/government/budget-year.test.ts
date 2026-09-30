/** @jest-environment node */
/**
 * MC-1: `BudgetAllocation.budgetYear` has one basis, the IxTime game year.
 */
import { afterEach, describe, expect, it } from "@jest/globals";
import { IxTime } from "~/lib/ixtime";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { BudgetAllocationInputSchema } from "~/types/government";

describe("currentBudgetYear", () => {
  afterEach(() => {
    IxTime.clearTimeOverride();
    jest.useRealTimers();
  });

  it("is the current IxTime game year, not the real calendar year", () => {
    jest.useFakeTimers({ now: new Date("2026-09-30T12:00:00Z") });
    expect(currentBudgetYear()).toBe(IxTime.getCurrentGameYear());
    expect(currentBudgetYear()).toBe(2042);
    expect(currentBudgetYear()).not.toBe(new Date().getUTCFullYear());
  });

  it("follows an IxTime override", () => {
    IxTime.setTimeOverride(Date.UTC(2045, 6, 1));
    expect(currentBudgetYear()).toBe(2045);
  });

  it("maps an explicit IxTime timestamp to its game year", () => {
    expect(currentBudgetYear(Date.UTC(2040, 5, 15))).toBe(2040);
    expect(currentBudgetYear(Date.UTC(2051, 5, 15))).toBe(
      IxTime.getCurrentGameYear(Date.UTC(2051, 5, 15))
    );
  });

  it("is accepted by the budget-allocation input schema", () => {
    const parse = (budgetYear: number) =>
      BudgetAllocationInputSchema.safeParse({
        departmentId: "0",
        budgetYear,
        allocatedAmount: 100,
        allocatedPercent: 10,
      }).success;
    expect(parse(currentBudgetYear(Date.UTC(2042, 5, 1)))).toBe(true);
    expect(parse(2099)).toBe(true);
    expect(parse(1899)).toBe(false);
    expect(parse(3001)).toBe(false);
  });
});
