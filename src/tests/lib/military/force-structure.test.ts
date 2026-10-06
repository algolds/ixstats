import { describe, it, expect } from "@jest/globals";
import {
  FORCE_LIMITS,
  branchStrength,
  builderDefenseSpending,
  forceTotals,
  militaryStrength,
  planStarterForce,
  populationPersonnelCap,
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
  it("is zero with no force structure", () => {
    expect(militaryStrength([])).toBe(0);
    expect(militaryStrength([branch()])).toBe(0);
  });

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

  it("weights operational, non-retired assets by modernization", () => {
    const assets = [
      { quantity: 10, operational: 8, modernizationLevel: 50 }, // 8 x 10 x 1.0
      { quantity: 2, operational: 5, modernizationLevel: 100 }, // capped at quantity: 2 x 10 x 1.5
      { quantity: 50, operational: 50, status: "retired" }, // ignored
    ];
    expect(branchStrength(branch({ assets }))).toBe(80 + 30);
  });

  it("scales by technology, training and morale (0.75x to 1.25x)", () => {
    const base = { activeDuty: 1_000, readinessLevel: 100 };
    expect(branchStrength(branch({ ...base }))).toBe(1_000);
    expect(
      branchStrength(branch({ ...base, technologyLevel: 100, trainingLevel: 100, morale: 100 }))
    ).toBe(1_250);
    expect(
      branchStrength(branch({ ...base, technologyLevel: 0, trainingLevel: 0, morale: 0 }))
    ).toBe(750);
  });

  it("keeps the units-only shape the conflict code used before (levels default to 50)", () => {
    expect(
      militaryStrength([
        { units: [{ personnel: 1000, readiness: 50 }], assets: [{ quantity: 2, operational: 3 }] },
      ])
    ).toBe(500 + 20);
  });

  it("clamps out-of-range levels and negative counts", () => {
    expect(
      branchStrength(branch({ activeDuty: -50, units: [{ personnel: 100, readiness: 250 }] }))
    ).toBe(100);
  });
});

describe("forceTotals", () => {
  it("rolls up branches, units, personnel, assets, budget and strength", () => {
    const totals = forceTotals([
      branch({
        activeDuty: 1_000,
        reserves: 200,
        civilianStaff: 30,
        annualBudget: 5e6,
        units: [{ personnel: 400, readiness: 50 }],
        assets: [{ quantity: 3, operational: 3 }],
      }),
      branch({ activeDuty: 500, annualBudget: 1e6 }),
    ]);
    expect(totals).toMatchObject({
      branches: 2,
      units: 1,
      assets: 3,
      activeDuty: 1_500,
      reserves: 200,
      civilianStaff: 30,
      assignedPersonnel: 400,
      annualBudget: 6e6,
    });
    expect(totals.strength).toBeGreaterThan(0);
  });

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

  it("sizes army, navy and air force from population and funds them from the builder", () => {
    const plan = planStarterForce({
      population: 10_000_000,
      totalGdp: 500e9,
      builderDefenseSpending: 10e9,
      defenseBudgetTotal: 1e9,
    });
    expect(plan.budgetSource).toBe("builder");
    expect(plan.branches.map((b) => b.branchType)).toEqual(["army", "navy", "air_force"]);
    expect(plan.branches.reduce((s, b) => s + b.activeDuty, 0)).toBe(50_000);
    expect(plan.branches[0]).toMatchObject({ activeDuty: 27_500, reserves: 13_750 });
    expect(plan.branches.reduce((s, b) => s + b.annualBudget, 0)).toBe(10e9);
    // The starter force is far inside the population cap.
    const personnel = plan.branches.reduce((s, b) => s + b.activeDuty + b.reserves, 0);
    expect(personnel).toBeLessThan(populationPersonnelCap(10_000_000)!);
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

  it("caps personnel at the per-branch limits for huge populations", () => {
    const plan = planStarterForce({
      population: 1e10,
      totalGdp: 0,
      builderDefenseSpending: null,
      defenseBudgetTotal: null,
    });
    for (const b of plan.branches)
      expect(b.activeDuty).toBeLessThanOrEqual(FORCE_LIMITS.maxActiveDuty);
  });
});

describe("populationPersonnelCap", () => {
  it("is a quarter of population, or no cap when population is unknown", () => {
    expect(populationPersonnelCap(1_000_000)).toBe(250_000);
    expect(populationPersonnelCap(0)).toBeNull();
    expect(populationPersonnelCap(null)).toBeNull();
  });
});
