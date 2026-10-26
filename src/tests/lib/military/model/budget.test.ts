/** @jest-environment node */
/**
 * Layer (a): the budget split and the budget's fallback chain (research §7.1; realm time design §4.2).
 */
import {
  DEFAULT_SHARES,
  SHARE_KEYS,
  SHARE_PRESETS,
  defenseLinesTotal,
  monthlyLines,
  normaliseShares,
  resolveDefenseBudget,
  shareWarnings,
  type BudgetShares,
} from "~/lib/military/model";

const sum = (s: BudgetShares) => SHARE_KEYS.reduce((total, key) => total + s[key], 0);

describe("budget split", () => {
  it("defaults and presets each sum to 1", () => {
    expect(sum(DEFAULT_SHARES)).toBeCloseTo(1, 10);
    for (const preset of Object.values(SHARE_PRESETS)) expect(sum(preset)).toBeCloseTo(1, 10);
  });

  it("normalises shares and falls back to the defaults when all are zero", () => {
    const shares = normaliseShares({
      personnel: 2,
      om: 1,
      procurement: 1,
      rd: 0,
      infrastructure: -3,
    });
    expect(shares.personnel).toBeCloseTo(0.5);
    expect(shares.infrastructure).toBe(0);
    expect(
      normaliseShares({ personnel: 0, om: 0, procurement: 0, rd: 0, infrastructure: 0 })
    ).toEqual(DEFAULT_SHARES);
  });

  it("splits a month of the budget (B = D / 12)", () => {
    const lines = monthlyLines(12e9, DEFAULT_SHARES);
    expect(lines.personnel).toBeCloseTo(0.35e9);
    expect(lines.procurement).toBeCloseTo(0.22e9);
  });

  it("warns that procurement under 20% cannot recapitalise (NATO guideline)", () => {
    expect(shareWarnings(DEFAULT_SHARES)).toEqual([]);
    expect(shareWarnings(SHARE_PRESETS.professional)).toEqual([]);
    expect(shareWarnings({ ...DEFAULT_SHARES, procurement: 0.1 })).toEqual(["cannotRecapitalise"]);
  });
});

describe("defenseLinesTotal (D2 sums every Defense line; D1 took the largest)", () => {
  const line = (category: string, percent: number) => ({
    allocatedAmount: percent * 1e9,
    allocatedPercent: percent,
    department: { category },
  });

  it("sums an army ministry and an admiralty", () => {
    expect(defenseLinesTotal([line("Defense", 6), line("Health", 20), line("Defense", 4)])).toEqual(
      {
        amount: 10e9,
        percent: 10,
      }
    );
  });

  it("is null without a Defense line", () => {
    expect(defenseLinesTotal([line("Health", 20)])).toBeNull();
  });
});

describe("resolveDefenseBudget fallback chain", () => {
  const gdp = 1e12;
  const base = {
    gdp,
    defenseLine: null,
    builderDefense: null,
    formDefenseShare: null,
    governmentSpending: null,
  };

  it("takes the Defense department line first", () => {
    expect(
      resolveDefenseBudget({
        ...base,
        defenseLine: { amount: 30e9, percent: 10 },
        builderDefense: 5e9,
      })
    ).toEqual({
      amount: 30e9,
      source: "defenseDepartment",
    });
  });

  it("respects a deliberate 0% Defense line", () => {
    expect(
      resolveDefenseBudget({ ...base, defenseLine: { amount: 0, percent: 0 }, builderDefense: 5e9 })
    ).toEqual({
      amount: 0,
      source: "defenseDepartment",
    });
  });

  it("skips a line with a share but no money (a budget without a total) and implausible figures", () => {
    expect(
      resolveDefenseBudget({
        ...base,
        defenseLine: { amount: 0, percent: 10 },
        builderDefense: 5e9,
      }).source
    ).toBe("builder");
    expect(resolveDefenseBudget({ ...base, builderDefense: 0.9e12 }).source).toBe("estimate");
  });

  it("then the government form's default share × spending (recorded or 20% of GDP)", () => {
    expect(
      resolveDefenseBudget({ ...base, formDefenseShare: 0.1, governmentSpending: 400e9 })
    ).toEqual({
      amount: 40e9,
      source: "governmentForm",
    });
    expect(resolveDefenseBudget({ ...base, formDefenseShare: 0.1 }).amount).toBeCloseTo(20e9);
    // An unscaled structure budget (under 5% of GDP) reads as unknown spending.
    expect(
      resolveDefenseBudget({ ...base, formDefenseShare: 0.1, governmentSpending: 1e9 }).amount
    ).toBeCloseTo(20e9);
  });

  it("then 2% of GDP, and nothing without a GDP", () => {
    expect(resolveDefenseBudget(base)).toEqual({ amount: 20e9, source: "estimate" });
    expect(resolveDefenseBudget({ ...base, gdp: 0 })).toEqual({ amount: 0, source: "none" });
  });
});
