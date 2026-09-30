/** @jest-environment node */
/**
 * gdp_level_adjustment / population_level_adjustment (national-issue consequences): the level
 * shift phases in over `duration` IxTime years from the effect's start, is kept afterwards, and
 * never touches the projection before the effect starts.
 */
import { IxStatsCalculator, levelPhaseIn } from "~/lib/economy/calculations";
import { IxTime } from "~/lib/ixtime";
import type { BaseCountryData, EconomicConfig, StorytellerEffect } from "~/types/ixstats";

const config: EconomicConfig = {
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

const base: BaseCountryData = {
  country: "Testland",
  population: 10_000_000,
  gdpPerCapita: 30_000,
  maxGdpGrowthRate: 0.05,
  adjustedGdpGrowth: 0.02,
  populationGrowthRate: 0.01,
  actualGdpGrowth: 0.02,
  projected2040Population: 0,
  projected2040Gdp: 0,
  projected2040GdpPerCapita: 0,
  localGrowthFactor: 1,
};

const calc = new IxStatsCalculator(config);
const baseline = calc.getBaselineDate();
const effectStart = IxTime.addYears(baseline, 2);

function statsAt(years: number, effects: StorytellerEffect[] = []) {
  return calc.calculateTimeProgression(
    calc.initializeCountryStats(base),
    IxTime.addYears(baseline, years),
    effects
  ).newStats;
}

const level = (
  inputType: string,
  value: number,
  duration: number | null = null
): StorytellerEffect => ({
  ixTimeTimestamp: effectStart,
  inputType,
  value,
  duration,
  isActive: true,
});

describe("levelPhaseIn", () => {
  it("is 0 before the start, linear over the duration, then 1", () => {
    const e = { ixTimeTimestamp: effectStart, duration: 1 };
    expect(levelPhaseIn(e, effectStart - 1)).toBe(0);
    expect(levelPhaseIn(e, IxTime.addYears(effectStart, 0.5))).toBeCloseTo(0.5, 6);
    expect(levelPhaseIn(e, IxTime.addYears(effectStart, 3))).toBe(1);
    expect(levelPhaseIn({ ixTimeTimestamp: effectStart, duration: null }, effectStart)).toBe(1);
  });
});

describe("gdp_level_adjustment", () => {
  const phased = [level("gdp_level_adjustment", 0.01, 1)];

  it("leaves the projection before its start unchanged", () => {
    expect(statsAt(1.5, phased).currentGdpPerCapita).toBe(statsAt(1.5).currentGdpPerCapita);
  });

  it("phases in over its duration and is kept afterwards", () => {
    const half = statsAt(2.5, phased).currentGdpPerCapita / statsAt(2.5).currentGdpPerCapita;
    expect(half).toBeCloseTo(1.005, 6);
    const later = statsAt(5, phased).currentGdpPerCapita / statsAt(5).currentGdpPerCapita;
    expect(later).toBeCloseTo(1.01, 6);
  });

  it("applies at once without a duration and moves total GDP with it", () => {
    const shock = [level("gdp_level_adjustment", -0.005)];
    const withShock = statsAt(2.1, shock);
    const without = statsAt(2.1);
    expect(withShock.currentGdpPerCapita / without.currentGdpPerCapita).toBeCloseTo(0.995, 6);
    expect(withShock.currentTotalGdp / without.currentTotalGdp).toBeCloseTo(0.995, 6);
    expect(withShock.currentPopulation).toBe(without.currentPopulation);
  });
});

describe("population_level_adjustment", () => {
  it("scales population (and so total GDP) by 1 + value", () => {
    const withEffect = statsAt(3, [level("population_level_adjustment", 0.002)]);
    const without = statsAt(3);
    expect(withEffect.currentPopulation / without.currentPopulation).toBeCloseTo(1.002, 6);
    expect(withEffect.currentTotalGdp / without.currentTotalGdp).toBeCloseTo(1.002, 6);
  });
});
