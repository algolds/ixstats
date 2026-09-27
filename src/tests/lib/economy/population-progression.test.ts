/** @jest-environment node */
/**
 * Plan 339 Step 1: the summed population growth rate is floored so stacked negative effects can
 * never produce NaN (Math.pow of a negative base) or a zero population, and non-finite stats are
 * refused before they reach the DB.
 */
import { assertPersistableStats, IxStatsCalculator } from "~/lib/economy/calculations";
import { IxTime } from "~/lib/ixtime";
import type { BaseCountryData, EconomicConfig, StorytellerEffect } from "~/types/ixstats";

const mockConfig: EconomicConfig = {
  globalGrowthFactor: 1.0321,
  baseInflationRate: 0.02,
  economicTierThresholds: {
    impoverished: 0,
    developing: 10000,
    developed: 25000,
    healthy: 35000,
    strong: 45000,
    veryStrong: 55000,
    extravagant: 65000,
  },
  populationTierThresholds: {
    tier1: 0,
    tier2: 10_000_000,
    tier3: 30_000_000,
    tier4: 50_000_000,
    tier5: 80_000_000,
    tier6: 120_000_000,
    tier7: 350_000_000,
    tierX: 500_000_000,
  },
  tierGrowthModifiers: {},
  calculationIntervalMs: 60_000,
  ixTimeUpdateFrequency: 30_000,
};

const baseCountry = (populationGrowthRate: number): BaseCountryData => ({
  country: "Testland",
  population: 10_000_000,
  gdpPerCapita: 30_000,
  maxGdpGrowthRate: 0.05,
  adjustedGdpGrowth: 0.02,
  populationGrowthRate,
  actualGdpGrowth: 0.02,
  projected2040Population: 0,
  projected2040Gdp: 0,
  projected2040GdpPerCapita: 0,
  localGrowthFactor: 1,
});

function populationAfter(baseRate: number, effectValues: number[], years: number): number {
  const calculator = new IxStatsCalculator(mockConfig);
  const baseline = calculator.getBaselineDate();
  const effects: StorytellerEffect[] = effectValues.map((value) => ({
    ixTimeTimestamp: baseline,
    inputType: "population_adjustment",
    value,
    isActive: true,
  }));
  const stats = calculator.initializeCountryStats(baseCountry(baseRate));
  const result = calculator.calculateTimeProgression(
    stats,
    IxTime.addYears(baseline, years),
    effects
  );
  return result.newStats.currentPopulation;
}

describe("population progression floor", () => {
  it("two -0.5 population effects stay finite and positive", () => {
    const population = populationAfter(-0.01, [-0.5, -0.5], 1.5);
    expect(Number.isFinite(population)).toBe(true);
    expect(population).toBeGreaterThan(0);
  });

  it("a summed rate of exactly -1 does not zero the population", () => {
    expect(populationAfter(0, [-0.5, -0.5], 1)).toBeGreaterThan(0);
  });

  it("leaves small effects unchanged", () => {
    const years = 2;
    const expected = 10_000_000 * Math.pow(1 + 0.01 - 0.1, years);
    expect(populationAfter(0.01, [-0.1], years)).toBeCloseTo(expected, 0);
  });
});

describe("assertPersistableStats", () => {
  const ok = { currentPopulation: 1, currentGdpPerCapita: 2, currentTotalGdp: 2 };

  it("accepts finite non-negative stats", () => {
    expect(() => assertPersistableStats(ok)).not.toThrow();
  });

  it("ignores fields other than the three persisted stats", () => {
    expect(() => assertPersistableStats({ ...ok, country: "Testland" } as typeof ok)).not.toThrow();
  });

  it.each([
    ["currentPopulation", Number.NaN],
    ["currentGdpPerCapita", Number.POSITIVE_INFINITY],
    ["currentTotalGdp", -1],
  ])("throws on %s = %p", (key, value) => {
    expect(() => assertPersistableStats({ ...ok, [key]: value })).toThrow(key);
  });
});
