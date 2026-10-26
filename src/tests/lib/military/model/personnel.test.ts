/** @jest-environment node */
/**
 * Layer (b): pay, the manpower pool, headcount, reserves and mobilisation (research §7.2).
 */
import {
  DAY_MS,
  HEADCOUNT_RATE_DOWN,
  HEADCOUNT_RATE_UP,
  headcountAfter,
  manpowerPool,
  memberPay,
  mobilisedCount,
  nationalHeadcountTarget,
  reserveInflowRate,
  reserveRetention,
  reservesAfter,
  reservistCost,
  stepHeadcount,
  stepReserves,
  branchSplits,
  deriveNation,
  setEffortShare,
} from "~/lib/military/model";
import { T0, economy, starter } from "./fixtures";

describe("pay from GDP per capita", () => {
  it("pays a volunteer 2.2× and a conscript 0.6× GDP per capita, mixed in between", () => {
    expect(memberPay(1, 20_000)).toBeCloseTo(44_000);
    expect(memberPay(0, 20_000)).toBeCloseTo(12_000);
    expect(memberPay(0.5, 20_000)).toBeCloseTo(28_000);
    expect(reservistCost(1, 20_000)).toBeCloseTo(4_400);
  });
});

describe("manpower pool", () => {
  it("draws 1% of the military-age population as volunteers, cohorts × service as conscripts", () => {
    const volunteers = manpowerPool({ population: 10e6, volunteerShare: 1, serviceMonths: 12 });
    expect(volunteers).toBeCloseTo(30_000); // 1% of the 30% aged 18–40
    const conscripts = manpowerPool({ population: 10e6, volunteerShare: 0, serviceMonths: 18 });
    expect(conscripts).toBeCloseTo(0.4 * (3e6 / 22) * 1.5);
  });
});

describe("headcount", () => {
  it("affords what the personnel line pays after reserve refreshers, within the pool", () => {
    const head = nationalHeadcountTarget({
      personnelAnnual: 4.4e9 + 0.44e9,
      reserves: 100_000,
      volunteerShare: 1,
      gdpPerCapita: 20_000,
      pool: 1e9,
    });
    expect(head.afford).toBeCloseTo(100_000);
    expect(head.reserveFunding).toBe(1);
    expect(
      nationalHeadcountTarget({ personnelAnnual: 1e12, reserves: 0, volunteerShare: 1, gdpPerCapita: 20_000, pool: 5_000 })
        .target
    ).toBe(5_000);
  });

  it("grows at 5% of the gap a month and shrinks at 15% (budget whiplash: cuts bite faster)", () => {
    expect(stepHeadcount(1000, 2000)).toBeCloseTo(1000 + HEADCOUNT_RATE_UP * 1000);
    expect(stepHeadcount(2000, 1000)).toBeCloseTo(2000 - HEADCOUNT_RATE_DOWN * 1000);
  });

  it("matches the stepwise path in closed form", () => {
    let n = 10_000;
    for (let k = 0; k < 60; k++) n = stepHeadcount(n, 50_000);
    expect(headcountAfter(10_000, 50_000, 60)).toBeCloseTo(n, 6);
  });

  it("splits personnel by effort × (1 − α) and capital by effort × α", () => {
    const { labour, capital } = branchSplits([
      { domain: "land", effortShare: 0.5 },
      { domain: "sea", effortShare: 0.5 },
    ]);
    expect(labour[0]).toBeCloseTo(0.55 / 0.75);
    expect(capital[1]).toBeCloseTo(0.8 / 1.25);
  });
});

describe("reserves", () => {
  it("retains 1 − 1/(12 × years) a month and keeps none without an obligation", () => {
    expect(reserveRetention(20)).toBeCloseTo(1 - 1 / 240);
    expect(reserveRetention(0)).toBe(0);
    expect(reserveInflowRate({ volunteerShare: 0.5, serviceMonths: 12, reserveYears: 0 })).toBe(0);
  });

  it("matches stepwise reserves while headcount approaches its target, exactly", () => {
    const params = { volunteerShare: 0.3, serviceMonths: 12, reserveYears: 15 };
    const retention = reserveRetention(params.reserveYears);
    const inflowRate = reserveInflowRate(params);
    let rv = 5_000;
    let n = 80_000;
    for (let k = 0; k < 60; k++) {
      rv = stepReserves(rv, n, retention, inflowRate);
      n = stepHeadcount(n, 40_000);
    }
    expect(
      reservesAfter({ reserves: 5_000, active: 80_000, activeTarget: 40_000, retention, inflowRate, months: 60 })
    ).toBeCloseTo(rv, 4);
  });
});

describe("mobilisation", () => {
  const at = (days: number, doctrine: "defensive" | "balanced" | "expeditionary" = "balanced") =>
    mobilisedCount({ order: 1000, orderedClockMs: 0, nowClockMs: days * DAY_MS, doctrine }) / 1000;

  it("reports by the NATO windows: 25% in 3 days, 50% by 14, 90% by 60 (τ = 10 days)", () => {
    expect(at(3)).toBeGreaterThanOrEqual(0.25);
    expect(at(14)).toBeGreaterThanOrEqual(0.5);
    expect(at(60)).toBeGreaterThanOrEqual(0.9);
    expect(at(0)).toBe(0);
  });

  it("is faster under a defensive doctrine and slower expeditionary (mobilise-strike is gradual)", () => {
    expect(at(5, "defensive")).toBeGreaterThan(at(5));
    expect(at(5, "expeditionary")).toBeLessThan(at(5));
    expect(at(1)).toBeLessThan(0.1);
  });
});

describe("reported reservists in the nation view", () => {
  it("counts whole people, and pays the supplement for exactly those", () => {
    const econ = economy();
    const s = starter(econ);
    const branch = s.branches[0]!;
    // An hour after a 5,000 order: a fraction of one reservist has "arrived".
    const ordered = { ...branch, mobilisationOrder: 5_000, mobilisationOrderedClockMs: T0 };
    const early = deriveNation({ ...s, branches: [ordered, ...s.branches.slice(1)] }, econ, [], T0 + 60_000);
    expect(early.branches[0]!.mobilised).toBe(0);
    expect(early.mobilisationSupplement).toBe(0);

    const later = deriveNation({ ...s, branches: [ordered, ...s.branches.slice(1)] }, econ, [], T0 + 5 * DAY_MS);
    const reported = later.branches[0]!.mobilised;
    expect(Number.isInteger(reported)).toBe(true);
    expect(reported).toBeGreaterThan(0);
    expect(later.mobilisationSupplement).toBeCloseTo(reported * memberPay(s.policy.volunteerShare, econ.gdpPerCapita), 6);
  });
});

describe("setEffortShare", () => {
  it("sets one branch and splits the rest in proportion, summing to 1", () => {
    const next = setEffortShare([0.55, 0.25, 0.2], 2, 0.4);
    expect(next[2]).toBeCloseTo(0.4, 12);
    expect(next[0]! / next[1]!).toBeCloseTo(0.55 / 0.25, 12);
    expect(next.reduce((s, e) => s + e, 0)).toBeCloseTo(1, 12);
  });

  it("splits the rest evenly when the others have none, and gives a lone branch everything", () => {
    expect(setEffortShare([0, 0, 0.3], 2, 0.4)).toEqual([0.3, 0.3, 0.4]);
    expect(setEffortShare([0.2], 0, 0.2)).toEqual([1]);
  });
});
