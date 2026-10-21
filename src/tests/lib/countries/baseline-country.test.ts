/** @jest-environment node */
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import { IxTime } from "~/lib/ixtime";
import {
  IXSTATS_NATION_GROWTH_DEFAULTS,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";

describe("buildBaselineCountryData", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-09-28T12:00:00Z")));
  afterEach(() => jest.useRealTimers());

  it("gives a new nation the baseline defaults", () => {
    const data = buildBaselineCountryData("Aurelia");
    const now = new Date(IxTime.getCurrentIxTime());

    expect(data).toMatchObject({
      name: "Aurelia",
      // Unknown stays empty, as on Ixnay's countries: every reader shows its own fallback.
      continent: null,
      region: null,
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
    expect(data.leader).toBeUndefined();
    expect(data).not.toHaveProperty("slug");
  });
  it("caps GDP growth by the IxStats tier rule and takes the system growth defaults for the tier", () => {
    const strong = buildBaselineCountryData("Aurelia"); // $50,000: Strong
    expect(strong).toMatchObject({
      maxGdpGrowthRate: 0.0275,
      ...IXSTATS_NATION_GROWTH_DEFAULTS.Strong,
    });
    const poor = buildBaselineCountryData("Borea", { baselineGdpPerCapita: 5_000 });
    expect(poor).toMatchObject({
      maxGdpGrowthRate: 0.1,
      ...IXSTATS_NATION_GROWTH_DEFAULTS.Impoverished,
    });
  });

  it("takes a realm's own growth table", () => {
    const table: NationGrowthTable = {
      ...IXSTATS_NATION_GROWTH_DEFAULTS,
      Developing: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 },
    };
    const data = buildBaselineCountryData("Calder", { baselineGdpPerCapita: 15_000 }, table);
    expect(data).toMatchObject({
      populationGrowthRate: 0.02,
      adjustedGdpGrowth: 0.004,
      maxGdpGrowthRate: 0.075,
    });
  });
});
