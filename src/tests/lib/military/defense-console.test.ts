/** @jest-environment node */
/**
 * Realm time D2b: the Defense page's arithmetic. The split always adds up to 100 and presets read back as presets;
 * the weakest readiness area; manpower models; the mobilisation curve; alert bite timing; procurement quotes and the
 * domestic refusals; order slips; and the funding preview, which is the model's own funding on a draft policy.
 */
import {
  DEFAULT_SHARES,
  MONTH_MS,
  SHARE_KEYS,
  SHARE_PRESETS,
  defaultPolicy,
  memberPay,
} from "~/lib/military/model";
import {
  alertChange,
  defaultOrderBranch,
  domesticBlock,
  fitsDomain,
  fundingPreview,
  manpowerModelOf,
  matchingPreset,
  mobilisationCost,
  mobilisationSchedule,
  nationalSubScores,
  orderSlipMonths,
  pendingAlert,
  quoteOrder,
  rebalancePercents,
  toPercents,
  toShares,
  worstSubScore,
  type PreviewSource,
  type SharePercents,
} from "~/lib/military/defense-console";

const total = (p: SharePercents) => SHARE_KEYS.reduce((sum, key) => sum + p[key], 0);

describe("budget split", () => {
  it("reads stored shares as whole percents adding up to 100", () => {
    expect(toPercents(DEFAULT_SHARES)).toEqual({
      personnel: 35,
      om: 30,
      procurement: 22,
      rd: 6,
      infrastructure: 7,
    });
    const odd = toPercents({ personnel: 1 / 3, om: 1 / 3, procurement: 1 / 3, rd: 0, infrastructure: 0 });
    expect(total(odd)).toBe(100);
  });

  it("keeps the split at 100 whichever line moves, spreading the rest in proportion", () => {
    const start = toPercents(DEFAULT_SHARES);
    for (const key of SHARE_KEYS) {
      for (const value of [0, 13, 50, 100, 140, -5]) {
        const next = rebalancePercents(start, key, value);
        expect(total(next)).toBe(100);
        expect(next[key]).toBe(Math.min(100, Math.max(0, value)));
      }
    }
    const moreProcurement = rebalancePercents(start, "procurement", 42);
    expect(moreProcurement.personnel).toBeGreaterThan(moreProcurement.om);
  });

  it("spreads evenly when the other lines hold nothing", () => {
    const all = rebalancePercents(toPercents(DEFAULT_SHARES), "om", 100);
    expect(rebalancePercents(all, "om", 60)).toEqual({
      personnel: 10,
      om: 60,
      procurement: 10,
      rd: 10,
      infrastructure: 10,
    });
  });

  it("recognises each preset and nothing else", () => {
    for (const preset of Object.keys(SHARE_PRESETS) as (keyof typeof SHARE_PRESETS)[]) {
      expect(matchingPreset(toPercents(SHARE_PRESETS[preset]))).toBe(preset);
    }
    expect(matchingPreset(toPercents(DEFAULT_SHARES))).toBeNull();
    expect(toShares(toPercents(SHARE_PRESETS.rearm)).procurement).toBeCloseTo(0.5);
  });
});

describe("readiness", () => {
  it("names the weakest area, the first on a tie", () => {
    expect(worstSubScore({ personnel: 0.9, equipment: 0.6, condition: 0.7, training: 0.8 })).toBe(
      "equipment"
    );
    expect(worstSubScore({ personnel: 0.5, equipment: 0.5, condition: 0.9, training: 0.9 })).toBe(
      "personnel"
    );
  });

  it("weights the nation's areas by personnel", () => {
    const scores = nationalSubScores([
      { personnel: 300, subScores: { personnel: 1, equipment: 1, condition: 1, training: 1 } },
      { personnel: 100, subScores: { personnel: 0, equipment: 0.2, condition: 0.6, training: 0.2 } },
    ]);
    expect(scores?.personnel).toBeCloseTo(0.75);
    expect(scores?.condition).toBeCloseTo(0.9);
    expect(nationalSubScores([])).toBeNull();
  });
});

describe("manpower and mobilisation", () => {
  it("reads the volunteer share as a model", () => {
    expect(manpowerModelOf(1)).toBe("volunteer");
    expect(manpowerModelOf(0.4)).toBe("mixed");
    expect(manpowerModelOf(0)).toBe("conscription");
  });

  it("reports about a quarter in 3 days and nearly all in 60 under a balanced doctrine", () => {
    const [three, fourteen, sixty] = mobilisationSchedule("balanced");
    expect(three!.share).toBeCloseTo(0.26, 2);
    expect(fourteen!.share).toBeGreaterThan(0.7);
    expect(sixty!.share).toBeGreaterThan(0.9);
    expect(mobilisationSchedule("defensive")[0]!.share).toBeGreaterThan(three!.share);
  });

  it("prices the supplement at the force's pay", () => {
    expect(mobilisationCost({ reservists: 1000, volunteerShare: 1, gdpPerCapita: 20_000 })).toBe(
      1000 * memberPay(1, 20_000)
    );
  });
});

describe("alert", () => {
  it("makes a raise wait its days and a lowering instant", () => {
    expect(alertChange("peacetime", "war")).toEqual({ raise: true, biteDays: 30 });
    expect(alertChange("high", "elevated")).toEqual({ raise: false, biteDays: 0 });
  });

  it("reports a raise not yet in effect", () => {
    expect(
      pendingAlert({ alertLevel: "high", alertInEffect: "peacetime", alertEffectiveAtClockMs: 5 })
    ).toEqual({ level: "high", effectiveAtClockMs: 5 });
    expect(
      pendingAlert({ alertLevel: "high", alertInEffect: "high", alertEffectiveAtClockMs: 5 })
    ).toBeNull();
  });
});

describe("procurement", () => {
  const base = {
    catalogCost: 5e6,
    subcategory: "tank",
    era: "CONTEMPORARY",
    quantity: 10,
    priceIndex: 1,
    surging: false,
    nowClockMs: 1000,
  };

  it("quotes a domestic order at catalog cost with a 15% down payment", () => {
    const quote = quoteOrder({ ...base, source: "domestic" });
    expect(quote).toMatchObject({ unitCost: 5e6, total: 5e7, leadMonths: 24, designYear: 2016 });
    expect(quote.downPayment).toBeCloseTo(7.5e6);
    expect(quote.monthlyPayment * 24 + quote.downPayment).toBeCloseTo(5e7);
    expect(quote.deliveryClockMs).toBe(1000 + 24 * MONTH_MS);
    expect(quote.capacityDraw).toBeCloseTo(5e7 / 24);
  });

  it("quotes an import at +15% and a longer lead time, off domestic capacity", () => {
    const quote = quoteOrder({ ...base, source: "import" });
    expect(quote.unitCost).toBeCloseTo(5.75e6);
    expect(quote.leadMonths).toBe(36);
    expect(quote.capacityDraw).toBe(0);
  });

  it("refuses domestic designs past the frontier, then orders past capacity", () => {
    const quote = quoteOrder({ ...base, source: "domestic" });
    expect(
      domesticBlock({ quote, accessibleYear: 2010, capacityMonthly: 1e9, capacityUsedMonthly: 0 })
    ).toBe("frontier");
    expect(
      domesticBlock({ quote, accessibleYear: 2030, capacityMonthly: 2e6, capacityUsedMonthly: 0 })
    ).toBe("capacity");
    expect(
      domesticBlock({ quote, accessibleYear: 2030, capacityMonthly: 1e9, capacityUsedMonthly: 0 })
    ).toBeNull();
  });

  it("keeps ships out of land branches", () => {
    expect(fitsDomain("naval", "land")).toBe(false);
    expect(fitsDomain("naval", "sea")).toBe(true);
    expect(fitsDomain("missile", "land")).toBe(true);
  });

  it("counts the months an order has slipped", () => {
    expect(orderSlipMonths({ orderedClockMs: 0, expectedClockMs: 26 * MONTH_MS, leadMonths: 24 })).toBe(2);
    expect(orderSlipMonths({ orderedClockMs: 0, expectedClockMs: 24 * MONTH_MS, leadMonths: 24 })).toBe(0);
  });
});

describe("funding preview", () => {
  const source: PreviewSource = {
    clockMs: 1e12,
    budget: { annual: 10e9 },
    policy: defaultPolicy(0),
    economy: { population: 30e6, gdpPerCapita: 25_000, gdp: 750e9 },
    branches: [
      {
        id: "b1",
        domain: "land",
        active: 300_000,
        reserves: 50_000,
        capital: 60e9,
        effortShare: 1,
        targetActive: null,
        mobilisationOrder: 0,
        operationWear: 1,
        subScores: { personnel: 1, equipment: 1, condition: 0.9, training: 0.8 },
      },
    ],
  };

  it("affords more personnel with a larger personnel line, and funds less O&M", () => {
    const now = fundingPreview(source, {});
    const territorial = fundingPreview(source, { shares: SHARE_PRESETS.territorial });
    expect(territorial.headcountAfford).toBeGreaterThan(now.headcountAfford);
    expect(territorial.trainingFunding).toBeLessThan(now.trainingFunding);
  });

  it("affords more conscripts than volunteers on the same money", () => {
    const volunteers = fundingPreview(source, { volunteerShare: 1 });
    const conscripts = fundingPreview(source, { volunteerShare: 0 });
    expect(conscripts.headcountAfford).toBeGreaterThan(volunteers.headcountAfford);
  });
});

describe("defaultOrderBranch", () => {
  const army = { id: "army", domain: "land" as const };
  const navy = { id: "navy", domain: "sea" as const };
  const air = { id: "air", domain: "air" as const };

  it("starts on the item's natural domain", () => {
    expect(defaultOrderBranch("aircraft", [army, navy, air])).toBe(air);
    expect(defaultOrderBranch("naval", [army, navy])).toBe(navy);
    expect(defaultOrderBranch("vehicle", [navy, army])).toBe(army);
  });

  it("falls back to the first eligible branch", () => {
    expect(defaultOrderBranch("aircraft", [army, navy])).toBe(army);
    expect(defaultOrderBranch("missile", [navy, army])).toBe(navy);
    expect(defaultOrderBranch("aircraft", [])).toBeUndefined();
  });
});
