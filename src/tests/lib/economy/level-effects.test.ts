/** @jest-environment node */
/**
 * The economy corpus. gdp_level_adjustment / population_level_adjustment (national-issue and directive
 * consequences): the level shift phases in over `duration` IxTime years from the effect's start and is kept
 * afterwards. Stacked negative population effects never produce NaN or a zero population (plan 339). The country
 * event spine clamps a stat to its bounds and never treats a missing stat as 0. A Fiscal Policy rate save keeps the
 * builder's excise list and the other excise keys. Refusing a non-finite stat is in national-issue-response.
 *
 * Folds population-progression, country-event-spine and fiscal-tax-channels.
 */
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: { Economic: { onTaxPolicyChange: jest.fn().mockResolvedValue(true) } },
}));

import { nextIxDayStart } from "~/lib/ixtime/day";
import { CountryEventSpine } from "~/lib/activity";
import { fiscalUpdateForRate } from "~/lib/economy/tax-channels";
import { growthModifierToLevelShift, IxStatsCalculator } from "~/lib/economy/calculations";
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
    // Effects take hold from the IxTime day after they begin: read every point that much later.
    IxTime.addYears(baseline, years) + (nextIxDayStart(effectStart) - effectStart),
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
describe("gdp_level_adjustment", () => {
  const phased = [level("gdp_level_adjustment", 0.01, 1)];
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

describe("growthModifierToLevelShift", () => {
  it("is the extra growth a relative modifier adds at the reference rate", () => {
    // 3% growth x 1.02 for a year: 1.0306 / 1.03 - 1
    expect(growthModifierToLevelShift(0.02, 1)).toBe(0.000583);
    expect(growthModifierToLevelShift(0.05, 2)).toBeCloseTo(Math.pow(1.0315 / 1.03, 2) - 1, 6);
    expect(growthModifierToLevelShift(0, 1)).toBe(0);
  });
});

describe("population progression floor (plan 339)", () => {
  it.each([
    ["two -0.5 effects on a shrinking nation, for a year and a half", -0.01, 1.5],
    ["a summed rate of exactly -1", 0, 1],
  ])("%s stays finite and positive", (_label, baseRate, years) => {
    const stats = calc.initializeCountryStats({ ...base, populationGrowthRate: baseRate });
    const effects: StorytellerEffect[] = [-0.5, -0.5].map((value) => ({
      ixTimeTimestamp: baseline,
      inputType: "population_adjustment",
      value,
      isActive: true,
    }));
    const { currentPopulation } = calc.calculateTimeProgression(
      stats,
      IxTime.addYears(baseline, years),
      effects
    ).newStats;
    expect(Number.isFinite(currentPopulation)).toBe(true);
    expect(currentPopulation).toBeGreaterThan(0);
  });
});

describe("the country event spine", () => {
  const countryId = "test-country-id";
  function spineDb(country: Record<string, unknown>) {
    return {
      country: {
        findUnique: jest.fn().mockResolvedValue({ id: countryId, ...country }),
        update: jest.fn().mockResolvedValue({ id: countryId }),
      },
      governmentStructure: {
        findUnique: jest.fn().mockResolvedValue({ countryId, totalBudget: 50000 }),
        update: jest.fn().mockResolvedValue({ countryId }),
      },
      internalStabilityMetrics: {
        findUnique: jest.fn().mockResolvedValue({ countryId, stabilityScore: 70 }),
        update: jest.fn().mockResolvedValue({ countryId }),
      },
      countryChangeLog: { create: jest.fn().mockResolvedValue({ id: "log-id" }) },
    };
  }

  it("clamps a stat to its bounds", async () => {
    const db = spineDb({ publicApproval: 95 });
    const results = await CountryEventSpine.recordCountryEvent({
      db: db as never,
      countryId,
      sourceType: "policy",
      sourceId: "policy-123",
      description: "Activate policy",
      consequences: [
        { targetModel: "Country", targetField: "publicApproval", operation: "add", value: 15 },
      ],
    });
    expect(results).toEqual([expect.objectContaining({ newValue: 100, delta: 5 })]);
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { publicApproval: 100 },
    });
  });

  it("skips a stat that has no stored value and no engine default, instead of treating it as 0", async () => {
    const db = spineDb({ publicApproval: null });
    const results = await CountryEventSpine.recordCountryEvent({
      db: db as never,
      countryId,
      sourceType: "decision",
      description: "Directive",
      consequences: [
        { targetModel: "Country", targetField: "publicApproval", operation: "subtract", value: 3 },
      ],
    });
    expect(results).toHaveLength(0);
    expect(db.country.update).not.toHaveBeenCalled();
  });

  it.each([
    ["inflationRate", 2, 1.4],
    ["unemploymentRate", 5, 4.4],
  ])("moves an unset %s from the engine default (%s%%)", async (field, base, expected) => {
    const db = spineDb({ [field]: null });
    const results = await CountryEventSpine.recordCountryEvent({
      db: db as never,
      countryId,
      sourceType: "decision",
      description: "Directive",
      consequences: [
        { targetModel: "Country", targetField: field, operation: "subtract", value: 0.6 },
      ],
    });
    expect(results).toEqual([
      expect.objectContaining({ previousValue: base, newValue: expect.closeTo(expected, 9) }),
    ]);
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { [field]: expect.closeTo(expected, 9) },
    });
  });
});

describe("a Fiscal Policy rate save keeps the other excise rates", () => {
  it.each([
    ["an excise object", '{"capitalGainsRate":18}', 7, { capitalGainsRate: 18, tariffRate: 7 }],
    [
      "the builder's excise list",
      '[{"type":"alcohol","rate":20},{"type":"tariff","rate":3}]',
      5,
      [
        { type: "alcohol", rate: 20 },
        { type: "tariff", rate: 5 },
      ],
    ],
  ])("in %s", (_label, stored, rate, expected) => {
    const update = fiscalUpdateForRate("tariff", rate, stored);
    expect(JSON.parse(update.exciseTaxRates!)).toEqual(expected);
  });
});
