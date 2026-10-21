import { describe, it, expect } from "@jest/globals";
import {
  branchStrength,
  builderDefenseSpending,
  forceTotals,
  militaryStrength,
  planStarterForce,
  type BranchForce,
} from "~/lib/military/force-structure";

type TestBranch = BranchForce & { civilianStaff?: number; annualBudget?: number };

const branch = (overrides: Partial<TestBranch> = {}): TestBranch => ({
  activeDuty: 0,
  reserves: 0,
  units: [],
  assets: [],
  ...overrides,
});

describe("militaryStrength", () => {
  it("counts branch personnel that no unit holds (MC-3: authored branches are not zero)", () => {
    // 10,000 active at 50% readiness + 4,000 reserves x 50% x 0.25, quality 1.0
    expect(militaryStrength([branch({ activeDuty: 10_000, reserves: 4_000 })])).toBe(5_000 + 500);
  });

  it("draws unit personnel from active duty first, then reserves, without double counting", () => {
    const units = [{ personnel: 12_000, readiness: 100 }];
    // Units take all 10,000 active and 2,000 reserves; 2,000 reserves stay unassigned.
    const strength = branchStrength(branch({ activeDuty: 10_000, reserves: 4_000, units }));
    expect(strength).toBe(12_000 + 2_000 * 0.5 * 0.25);
  });
  it("clamps out-of-range levels and negative counts", () => {
    expect(
      branchStrength(branch({ activeDuty: -50, units: [{ personnel: 100, readiness: 250 }] }))
    ).toBe(100);
  });
});

describe("forceTotals", () => {
  it("reports a null budget when budgets are redacted for a visitor", () => {
    expect(forceTotals([branch({ activeDuty: 10 })]).annualBudget).toBeNull();
  });
});

describe("starter force from builder data", () => {
  it("reads the Defense amount from either builder storage shape", () => {
    expect(
      builderDefenseSpending(JSON.stringify([{ category: "Defense", amount: 5e9, percent: 15 }]))
    ).toBe(5e9);
    expect(builderDefenseSpending(JSON.stringify({ defense: 2e9, education: 1e9 }))).toBe(2e9);
    expect(builderDefenseSpending(JSON.stringify([{ category: "Health", amount: 1 }]))).toBeNull();
    expect(builderDefenseSpending("not json")).toBeNull();
    expect(builderDefenseSpending(null)).toBeNull();
  });
  it("skips implausible builder spending and falls back to the defense budget, then 2% of GDP", () => {
    const base = { population: 1_000_000, totalGdp: 100e9 };
    expect(
      planStarterForce({ ...base, builderDefenseSpending: 90e9, defenseBudgetTotal: 3e9 })
        .budgetSource
    ).toBe("defenseBudget");
    const estimate = planStarterForce({
      ...base,
      builderDefenseSpending: null,
      defenseBudgetTotal: 0,
    });
    expect(estimate.budgetSource).toBe("estimate");
    expect(estimate.branches.reduce((s, b) => s + b.annualBudget, 0)).toBe(2e9);
    expect(
      planStarterForce({
        population: 0,
        totalGdp: 0,
        builderDefenseSpending: null,
        defenseBudgetTotal: null,
      })
    ).toMatchObject({ budgetSource: "none" });
  });
});
