/** @jest-environment node */
/**
 * Units the projection reads and returns (MyCountry fix plan, WP-A2).
 * - Inflation is a percent everywhere: the projection keeps stored 3.5 as 3.5 (it used to clamp to [-0.5, 2], so every
 *   "inflation rises" consequence above 2% vanished), defaults to 2 and moves by component modifiers in points.
 * - The displayed GDP growth is the engine's rate (tier cap and diminishing returns included), not the static input.
 */
import { IxStatsCalculator } from "~/lib/economy/calculations";
import { calculateComponentEconomicModifiers } from "~/lib/government/atomic-utils";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import { historyPointData } from "~/server/cron/stat-progression";
import type { BaseCountryData, CountryStats } from "~/types/ixstats";

const BASELINE = Date.UTC(2040, 0, 1);
const ONE_YEAR_LATER = BASELINE + 365.25 * 864e5;

function baseline(overrides: Partial<BaseCountryData> = {}) {
  const calc = new IxStatsCalculator(getDefaultEconomicConfig(), BASELINE);
  const stats = calc.initializeCountryStats({
    country: "Testland",
    population: 1_000_000,
    gdpPerCapita: 30_000,
    maxGdpGrowthRate: 0.05,
    adjustedGdpGrowth: 0.03,
    populationGrowthRate: 0.01,
    actualGdpGrowth: 0,
    projected2040Population: 0,
    projected2040Gdp: 0,
    projected2040GdpPerCapita: 0,
    landArea: 1,
    localGrowthFactor: 1,
    ...overrides,
  });
  return { calc, stats };
}

function projectInflation(stored: number | undefined, econComponents: string[] = []) {
  const { calc, stats } = baseline({ inflationRate: stored });
  const withComponents = { ...stats, activeEconComponents: econComponents } as CountryStats;
  return calc.calculateTimeProgression(withComponents, ONE_YEAR_LATER, []).newStats.inflationRate;
}

describe("inflation is a percent", () => {
  it("keeps stored percents the old fraction clamp cut off", () => {
    expect(projectInflation(3.5)).toBe(3.5);
    expect(projectInflation(-1)).toBe(-1);
    expect(projectInflation(12)).toBe(12);
  });

  it("defaults to 2% and stays inside the event spine's [-5, 100] bounds", () => {
    expect(projectInflation(undefined)).toBe(2);
    expect(projectInflation(150)).toBe(100);
    expect(projectInflation(-9)).toBe(-5);
  });

  it("moves by component modifiers in percentage points", () => {
    expect(
      calculateComponentEconomicModifiers([], ["PLANNED_ECONOMY"] as never[], []).inflationModifier
    ).toBe(1);
    expect(
      calculateComponentEconomicModifiers([], ["FREE_TRADE"] as never[], []).inflationModifier
    ).toBe(-0.5);
    expect(projectInflation(2, ["PLANNED_ECONOMY"])).toBe(3);
  });
});

describe("effective GDP growth", () => {
  it("is the rate the engine grows GDP per capita at, after the tier cap and diminishing returns", () => {
    const { calc, stats } = baseline({ gdpPerCapita: 70_000, adjustedGdpGrowth: 0.03 });
    const { newStats } = calc.calculateTimeProgression(stats, ONE_YEAR_LATER, []);

    // Repro G: input 3%, Extravagant cap 0.5%, then diminishing returns.
    expect(newStats.effectiveGdpGrowth).toBeCloseTo(newStats.currentGdpPerCapita / 70_000 - 1, 6);
    expect(newStats.effectiveGdpGrowth).toBeCloseTo(0.00321, 5);
  });

  it("is reported at the baseline instant too", () => {
    const { calc, stats } = baseline({ gdpPerCapita: 30_000, adjustedGdpGrowth: 0.03 });
    const { newStats } = calc.calculateTimeProgression(stats, BASELINE, []);
    expect(newStats.effectiveGdpGrowth).toBeGreaterThan(0.03);
  });

  it("is the growth a history point records, not the static input", () => {
    const { calc, stats } = baseline({ gdpPerCapita: 70_000, adjustedGdpGrowth: 0.03 });
    const { newStats } = calc.calculateTimeProgression(stats, ONE_YEAR_LATER, []);
    expect(historyPointData("c1", newStats, ONE_YEAR_LATER).gdpGrowthRate).toBeCloseTo(0.00321, 5);
  });
});
