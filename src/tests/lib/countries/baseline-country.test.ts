/** @jest-environment node */
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import { IxTime } from "~/lib/ixtime";

describe("buildBaselineCountryData", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-09-28T12:00:00Z")));
  afterEach(() => jest.useRealTimers());

  it("gives a new nation the baseline defaults", () => {
    const data = buildBaselineCountryData("Aurelia");
    const now = new Date(IxTime.getCurrentIxTime());

    expect(data).toMatchObject({
      name: "Aurelia",
      continent: "Unknown",
      region: "Unknown",
      baselinePopulation: 1_000_000,
      baselineGdpPerCapita: 50_000,
      landArea: 100_000,
      baselineDate: now,
      lastCalculated: now,
      localGrowthFactor: 1.0,
      nominalGDP: 1_000_000 * 50_000,
      realGDPGrowthRate: 3.0,
      inflationRate: 2.0,
      unemploymentRate: 5.0,
      taxRevenueGDPPercent: 20.0,
      literacyRate: 95.0,
      lifeExpectancy: 75.0,
    });
    expect(data.flag).toBeUndefined();
    expect(data.coatOfArms).toBeUndefined();
    expect(data.governmentType).toBeUndefined();
    expect(data).not.toHaveProperty("slug");
  });

  it("derives the current stats and tiers from the calculator", () => {
    const data = buildBaselineCountryData("Aurelia");
    expect(data.currentPopulation).toBeGreaterThan(0);
    expect(data.currentGdpPerCapita).toBeGreaterThan(0);
    expect(data.currentTotalGdp).toBeCloseTo(data.currentPopulation * data.currentGdpPerCapita, -3);
    expect(typeof data.economicTier).toBe("string");
    expect(typeof data.populationTier).toBe("string");
    for (const key of [
      "populationGrowthRate",
      "adjustedGdpGrowth",
      "maxGdpGrowthRate",
      "populationDensity",
      "gdpDensity",
    ] as const) {
      expect(Number.isFinite(data[key])).toBe(true);
    }
  });

  it("takes the builder's initial values, falling back on empty or zero ones", () => {
    const data = buildBaselineCountryData("Borea", {
      continent: "Eurth",
      baselinePopulation: 4_000_000,
      baselineGdpPerCapita: 20_000,
      flag: "https://example.test/flag.png",
      government: "Republic",
      inflationRate: 0,
      lifeExpectancy: 81,
    });
    expect(data).toMatchObject({
      name: "Borea",
      continent: "Eurth",
      region: "Unknown",
      baselinePopulation: 4_000_000,
      baselineGdpPerCapita: 20_000,
      flag: "https://example.test/flag.png",
      governmentType: "Republic",
      nominalGDP: 4_000_000 * 20_000,
      inflationRate: 2.0, // 0 is treated as "not given", as createCountry always did
      lifeExpectancy: 81,
    });
  });
});
