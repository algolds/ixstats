/** @jest-environment node */
/**
 * Budget arithmetic: amounts follow shares, the yearly budget follows GDP (never zeroed by a bad projection), a new
 * structure's budget comes from recorded spending or a share of GDP, and policy maintenance is spending within a year
 * that stops at the year's budget, read back per year from its markers.
 */
import {
  allocationAmount,
  allocationAt,
  chargeMaintenance,
  DEFAULT_BUDGET_SHARE_OF_GDP,
  gdpScaleRatio,
  initialTotalBudget,
  maintenanceByYear,
  maintenanceEffect,
} from "~/lib/government/budget-math";

describe("allocations", () => {
  it("is worth its share of the budget, clamped to 0 to the max", () => {
    expect(allocationAmount(1e10, 26.5)).toBe(2.65e9);
    expect(allocationAmount(0, 50)).toBe(0);
    expect(allocationAt(1e10, 70, 60)).toEqual({ allocatedPercent: 60, allocatedAmount: 6e9 });
    expect(allocationAt(1e10, -3)).toEqual({ allocatedPercent: 0, allocatedAmount: 0 });
  });
});

describe("the yearly budget follows GDP", () => {
  it("moves by the GDP ratio, and stays put on a missing or non-positive figure", () => {
    expect(gdpScaleRatio(3e11, 3.3e11)).toBeCloseTo(1.1, 12);
    expect(gdpScaleRatio(0, 3e11)).toBe(1);
    expect(gdpScaleRatio(3e11, Number.NaN)).toBe(1);
    expect(gdpScaleRatio(null, 3e11)).toBe(1);
  });

  it("starts a new structure from recorded spending, else a share of GDP", () => {
    expect(initialTotalBudget({ totalGovernmentSpending: 5e10, currentTotalGdp: 3e11 })).toBe(5e10);
    expect(initialTotalBudget({ totalGovernmentSpending: null, currentTotalGdp: 3e11 })).toBe(
      3e11 * DEFAULT_BUDGET_SHARE_OF_GDP
    );
    expect(initialTotalBudget({ totalGovernmentSpending: 0, currentTotalGdp: null })).toBe(0);
  });
});

describe("policy maintenance is spending within the year", () => {
  it("charges each cost until the year's budget is spent, never below zero", () => {
    expect(chargeMaintenance(1000, 0, [300, 400])).toEqual([300, 400]);
    expect(chargeMaintenance(1000, 700, [200, 400, 50])).toEqual([200, 100, 0]);
    expect(chargeMaintenance(1000, 1200, [10])).toEqual([0]);
    expect(chargeMaintenance(0, 0, [10])).toEqual([0]);
  });

  it("reads the spending per year back from the markers, ignoring anything else", () => {
    expect(
      maintenanceByYear([
        { notes: "FY2042", actualEffect: maintenanceEffect(300) },
        { notes: "FY2042", actualEffect: maintenanceEffect(200) },
        { notes: "FY2043", actualEffect: maintenanceEffect(50) },
        { notes: "FY2043", actualEffect: "not json" },
        { notes: "repealed", actualEffect: maintenanceEffect(999) },
      ])
    ).toEqual({ 2042: 500, 2043: 50 });
  });
});
