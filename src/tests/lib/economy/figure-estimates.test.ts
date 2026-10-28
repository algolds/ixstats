/**
 * Blank economic figures derived from the economy (owner decision 2026-10-28): the estimator is
 * deterministic, finite and bounded for any input, moves the way simple economics says, and a
 * recorded figure always wins over the estimate.
 */
import { describe, it, expect } from "@jest/globals";
import fc from "fast-check";
import {
  effectiveFiguresOfCountry,
  estimateEconomicFigures,
  type EconomicFigureInputs,
  type EconomicFigures,
} from "~/lib/economy/figure-estimates";

const BOUNDS: Record<keyof EconomicFigures, [number, number]> = {
  unemploymentRate: [2, 30],
  inflationRate: [0.5, 40],
  totalDebtGDPRatio: [5, 250],
};

function expectBounded(figures: EconomicFigures) {
  for (const [field, [min, max]] of Object.entries(BOUNDS)) {
    const value = figures[field as keyof EconomicFigures];
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
  }
}

const anyNumber = fc.oneof(
  fc.double(),
  fc.constantFrom(0, -0, 1, -1, Number.NaN, Infinity, -Infinity, 1e308, -1e308),
  fc.constant(null),
  fc.constant(undefined)
);

const anyInputs: fc.Arbitrary<EconomicFigureInputs> = fc.record({
  economicTier: fc.oneof(
    fc.constantFrom("Impoverished", "Developed", "Extravagant", "", "Bogus"),
    fc.constant(null)
  ),
  gdpPerCapita: anyNumber,
  realGrowthPct: anyNumber,
  revenueGdpPct: anyNumber,
  spendingGdpPct: anyNumber,
});

describe("estimateEconomicFigures", () => {
  it("is finite, bounded and deterministic for any input", () => {
    fc.assert(
      fc.property(anyInputs, (inputs) => {
        const first = estimateEconomicFigures(inputs);
        expectBounded(first);
        expect(estimateEconomicFigures(inputs)).toEqual(first);
      })
    );
  });

  it("gives a neutral, mid-range estimate with no inputs at all", () => {
    const figures = estimateEconomicFigures({});
    expectBounded(figures);
    expect(figures.unemploymentRate).toBe(5);
    expect(figures.totalDebtGDPRatio).toBe(55);
  });

  it("handles a zero- or one-person nation (GDP per capita 0, NaN or Infinity)", () => {
    for (const gdpPerCapita of [0, Number.NaN, Infinity, -5]) {
      expectBounded(estimateEconomicFigures({ gdpPerCapita, realGrowthPct: 0 }));
    }
  });

  it("falls back to the tier when GDP per capita is missing", () => {
    const poorTier = estimateEconomicFigures({ economicTier: "Impoverished" });
    const richTier = estimateEconomicFigures({ economicTier: "Extravagant" });
    expect(poorTier.unemploymentRate).toBeGreaterThan(richTier.unemploymentRate);
    expect(poorTier.inflationRate).toBeGreaterThan(richTier.inflationRate);
    expect(estimateEconomicFigures({ economicTier: "Impoverished", gdpPerCapita: 80_000 })).toEqual(
      estimateEconomicFigures({ gdpPerCapita: 80_000 })
    );
  });

  it("stays inside its bounds at the extreme tiers", () => {
    expectBounded(estimateEconomicFigures({ gdpPerCapita: 1, realGrowthPct: -50 }));
    expectBounded(estimateEconomicFigures({ gdpPerCapita: 1e12, realGrowthPct: 100 }));
  });

  it("gives poorer economies higher inflation and unemployment and less debt", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 300, max: 400_000, noNaN: true }),
        fc.double({ min: 1.5, max: 10, noNaN: true }),
        (gdpPerCapita, factor) => {
          const rich = estimateEconomicFigures({ gdpPerCapita: gdpPerCapita * factor });
          const poor = estimateEconomicFigures({ gdpPerCapita });
          expect(poor.unemploymentRate).toBeGreaterThanOrEqual(rich.unemploymentRate);
          expect(poor.inflationRate).toBeGreaterThanOrEqual(rich.inflationRate);
          expect(poor.totalDebtGDPRatio).toBeLessThanOrEqual(rich.totalDebtGDPRatio);
        }
      )
    );
  });

  it("follows Okun's law: slower growth means more unemployment", () => {
    const slow = estimateEconomicFigures({ gdpPerCapita: 30_000, realGrowthPct: -1 });
    const fast = estimateEconomicFigures({ gdpPerCapita: 30_000, realGrowthPct: 5 });
    expect(slow.unemploymentRate).toBeGreaterThan(fast.unemploymentRate);
    expect(fast.inflationRate).toBeGreaterThan(slow.inflationRate);
  });

  it("raises debt and inflation when spending runs above revenue, only when both are recorded", () => {
    const balanced = estimateEconomicFigures({ revenueGdpPct: 30, spendingGdpPct: 30 });
    const deficit = estimateEconomicFigures({ revenueGdpPct: 25, spendingGdpPct: 30 });
    expect(deficit.totalDebtGDPRatio).toBeGreaterThan(balanced.totalDebtGDPRatio);
    expect(deficit.inflationRate).toBeGreaterThan(balanced.inflationRate);
    expect(estimateEconomicFigures({ spendingGdpPct: 30 })).toEqual(estimateEconomicFigures({}));
  });
});

describe("effectiveFiguresOfCountry", () => {
  const economy = { economicTier: "Developing", currentGdpPerCapita: 12_000 };

  it("keeps a recorded figure, 0 included, and flags nothing", () => {
    const figures = effectiveFiguresOfCountry(
      { ...economy, inflationRate: 0, unemploymentRate: 12.5, totalDebtGDPRatio: 140 },
      0.1
    );
    expect(figures.inflationRate).toEqual({ value: 0, estimated: false });
    expect(figures.unemploymentRate).toEqual({ value: 12.5, estimated: false });
    expect(figures.totalDebtGDPRatio).toEqual({ value: 140, estimated: false });
  });

  it("estimates a blank figure and flags it", () => {
    const figures = effectiveFiguresOfCountry({ ...economy, inflationRate: null }, 0.1);
    const estimate = estimateEconomicFigures({
      economicTier: "Developing",
      gdpPerCapita: 12_000,
      realGrowthPct: 0.1,
    });
    expect(figures.inflationRate).toEqual({ value: estimate.inflationRate, estimated: true });
    expect(figures.unemploymentRate).toEqual({ value: estimate.unemploymentRate, estimated: true });
    expect(figures.totalDebtGDPRatio.estimated).toBe(true);
  });

  it("reads spending from the budget share, else the spending share", () => {
    const withBudget = effectiveFiguresOfCountry(
      {
        ...economy,
        taxRevenueGDPPercent: 20,
        governmentBudgetGDPPercent: 30,
        spendingGDPPercent: 0,
      },
      2
    );
    const withSpending = effectiveFiguresOfCountry(
      {
        ...economy,
        taxRevenueGDPPercent: 20,
        governmentBudgetGDPPercent: 0,
        spendingGDPPercent: 30,
      },
      2
    );
    expect(withBudget).toEqual(withSpending);
    expect(withBudget.totalDebtGDPRatio.value).toBeGreaterThan(
      effectiveFiguresOfCountry(economy, 2).totalDebtGDPRatio.value
    );
  });
});
