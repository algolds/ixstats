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
  nudgeShare,
} from "~/lib/government/budget-math";

const total = (lines: { allocatedPercent: number }[]) =>
  lines.reduce((sum, line) => sum + line.allocatedPercent, 0);

describe("allocations", () => {
  it("is worth its share of the budget, clamped to 0 to the max", () => {
    expect(allocationAmount(1e10, 26.5)).toBe(2.65e9);
    expect(allocationAmount(0, 50)).toBe(0);
    expect(allocationAt(1e10, 70, 60)).toEqual({ allocatedPercent: 60, allocatedAmount: 6e9 });
    expect(allocationAt(1e10, -3)).toEqual({ allocatedPercent: 0, allocatedAmount: 0 });
  });
});

describe("a directive's budget nudge", () => {
  const full = [
    { id: "finance", allocatedPercent: 10 },
    { id: "health", allocatedPercent: 40 },
    { id: "education", allocatedPercent: 50 },
  ];

  it("takes a raise from the other departments in proportion, so the total stays at 100%", () => {
    const moved = nudgeShare(full, "finance", 3);
    expect(moved[0]!.allocatedPercent).toBe(13);
    // Health and Education give up 3 points 40:50
    expect(moved[1]!.allocatedPercent).toBeCloseTo(40 - 3 * (40 / 90), 9);
    expect(moved[2]!.allocatedPercent).toBeCloseTo(50 - 3 * (50 / 90), 9);
    expect(total(moved)).toBeCloseTo(100, 9);
  });

  it("uses unallocated room first and leaves a cut unallocated", () => {
    const partial = [
      { id: "finance", allocatedPercent: 10 },
      { id: "health", allocatedPercent: 80 },
    ];
    expect(nudgeShare(partial, "finance", 3).map((l) => l.allocatedPercent)).toEqual([13, 80]);
    expect(nudgeShare(full, "finance", -4).map((l) => l.allocatedPercent)).toEqual([6, 40, 50]);
  });

  it("brings an over-allocated budget back to 100%, and respects the line's cap", () => {
    const over = [
      { id: "finance", allocatedPercent: 13 },
      { id: "health", allocatedPercent: 90 },
    ];
    expect(total(nudgeShare(over, "finance", 1.5))).toBeCloseTo(100, 9);
    expect(nudgeShare(full, "education", 30, 60)[2]!.allocatedPercent).toBe(60);
    expect(nudgeShare(full, "unknown", 3)).toEqual(full);
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

  it("starts a new structure at the nation's revenue, so it opens balanced, not in deficit", () => {
    const noSpending = { totalGovernmentSpending: null, currentTotalGdp: 1.5e11 };
    // Revenue 6.0B on a 150B GDP: the budget starts at 6.0B, not 30B (20% of GDP).
    expect(initialTotalBudget(noSpending, 6e9)).toBe(6e9);
    // Never above the GDP-share default, and recorded spending still comes first.
    expect(initialTotalBudget(noSpending, 9e10)).toBe(1.5e11 * DEFAULT_BUDGET_SHARE_OF_GDP);
    expect(initialTotalBudget({ ...noSpending, totalGovernmentSpending: 4e10 }, 6e9)).toBe(4e10);
    expect(initialTotalBudget(noSpending, 0)).toBe(1.5e11 * DEFAULT_BUDGET_SHARE_OF_GDP);
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
