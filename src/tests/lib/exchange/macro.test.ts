/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import { countryMacroOf, sectorAdvantageOf } from "~/lib/exchange/macro";

const SAVED = {
  fiscalSystem: {
    corporateTaxRates: '{"corporateRate":22}',
    exciseTaxRates: JSON.stringify({
      tariffRate: 8,
      capitalGainsRate: 18,
      "sectorTariff:industry": 12,
      "sectorTariff:services": 40,
    }),
  },
  economicProfile: {
    sectorBreakdown: JSON.stringify({ services: 58, industry: 32, agriculture: 10 }),
  },
  interestRates: 6,
  inflationRate: 3.2,
  governmentalEfficiency: 72,
  economicTier: "Strong",
  adjustedGdpGrowth: 0.02,
  historicalData: [{ gdpGrowthRate: 0.031 }],
};

describe("countryMacroOf: saved rates", () => {
  it("converts saved percents to fractions and reads the saved tariffs", () => {
    const macro = countryMacroOf(SAVED);
    expect(macro.corporateTaxRate).toBeCloseTo(0.22);
    expect(macro.capGainsTaxRate).toBeCloseTo(0.18);
    expect(macro.tariffFor("industry")).toBeCloseTo(0.12);
    expect(macro.tariffFor("agriculture")).toBeCloseTo(0.08);
    expect(macro.tariffFor("services")).toBeCloseTo(0.25);
  });

  it("caps a tariff at 25% of contract value and never returns a negative one", () => {
    const macro = countryMacroOf({
      fiscalSystem: { exciseTaxRates: '{"tariffRate":-4,"sectorTariff:mining":40}' },
    });
    expect(macro.tariffFor("mining")).toBe(0.25);
    expect(macro.tariffFor("industry")).toBe(0);
  });

  it("reads growth, tier and efficiency from the saved figures", () => {
    const macro = countryMacroOf(SAVED);
    expect(macro.growth).toBeCloseTo(0.031);
    expect(macro.governmentEfficiency).toBeCloseTo(0.72);
    expect(macro.economicTier).toBe("Strong");
  });
});

describe("countryMacroOf: nothing saved", () => {
  const macro = countryMacroOf({});

  it("falls back to the default rates and figures", () => {
    expect(macro.corporateTaxRate).toBe(0.15);
    expect(macro.capGainsTaxRate).toBe(0.1);
    expect(macro.interestRate).toBe(0.05);
    expect(macro.inflation).toBeNull();
    expect(macro.growth).toBeNull();
    expect(macro.governmentEfficiency).toBe(0.5);
    expect(macro.economicTier).toBe("Developed");
  });

  it("charges no tariff and records no sector", () => {
    expect(macro.tariffFor("industry")).toBe(0);
    expect(macro.sectorShares).toEqual({ agriculture: 0, industry: 0, services: 0, government: 0 });
    expect(macro.hasRecordedSector).toBe(false);
  });

  it("treats a stored zero efficiency and an unknown tier as unknown", () => {
    const zeroed = countryMacroOf({ governmentalEfficiency: 0, economicTier: "Atlantis" });
    expect(zeroed.governmentEfficiency).toBe(0.5);
    expect(zeroed.economicTier).toBe("Developed");
  });
});

describe("countryMacroOf: interest and inflation units", () => {
  it("reads a percent above 1 as a percent", () => {
    const macro = countryMacroOf({ interestRates: 6, inflationRate: 3.2 });
    expect(macro.interestRate).toBeCloseTo(0.06);
    expect(macro.inflation).toBeCloseTo(0.032);
  });

  it("reads a value of 1 or below as an existing fraction", () => {
    const macro = countryMacroOf({ interestRates: 0.04, inflationRate: 0.5 });
    expect(macro.interestRate).toBe(0.04);
    expect(macro.inflation).toBe(0.5);
  });
});

describe("countryMacroOf: recorded sector breakdown", () => {
  it("reads the array shape and drops names outside the alias list", () => {
    const macro = countryMacroOf({
      economicProfile: {
        sectorBreakdown: JSON.stringify([
          { name: "Agriculture", gdp: 10 },
          { name: "Manufacturing", gdp: 30 },
          { name: "Retail", gdp: 20 },
          { name: "Public administration", gdp: 15 },
          { name: "Crypto boutiques", gdp: 25 },
        ]),
      },
    });
    expect(macro.sectorShares.agriculture).toBeCloseTo(0.1);
    expect(macro.sectorShares.industry).toBeCloseTo(0.3);
    expect(macro.sectorShares.services).toBeCloseTo(0.2);
    expect(macro.sectorShares.government).toBeCloseTo(0.15);
    expect(macro.hasRecordedSector).toBe(true);
  });

  it("reads the flat record shape", () => {
    const macro = countryMacroOf(SAVED);
    expect(macro.sectorShares.services).toBeCloseTo(0.58);
    expect(macro.sectorShares.industry).toBeCloseTo(0.32);
    expect(macro.sectorShares.agriculture).toBeCloseTo(0.1);
    expect(macro.sectorShares.government).toBe(0);
  });

  it("scales back shares that overshoot 100% in total", () => {
    const macro = countryMacroOf({
      economicProfile: { sectorBreakdown: '{"services":80,"industry":60,"farming":60}' },
    });
    const total = Object.values(macro.sectorShares).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(1);
    expect(macro.sectorShares.services).toBeCloseTo(0.8 / 2);
  });
});

describe("sectorAdvantageOf", () => {
  const at = (share: number) =>
    sectorAdvantageOf(
      { sectorShares: { agriculture: share, industry: 0, services: 0, government: 0 } },
      "agriculture"
    );

  it("gives no bonus below 25% of GDP", () => {
    expect(at(0)).toBe(0);
    expect(at(0.24)).toBe(0);
  });

  it("starts at +5% at 25% of GDP", () => {
    expect(at(0.25)).toBeCloseTo(0.05);
  });

  it("rises linearly to +15% at 60% of GDP", () => {
    expect(at(0.425)).toBeCloseTo(0.1);
    expect(at(0.6)).toBeCloseTo(0.15);
  });

  it("caps at +15% above 60% of GDP", () => {
    expect(at(0.9)).toBeCloseTo(0.15);
  });

  it("reads each sector's own share", () => {
    const macro = countryMacroOf(SAVED);
    expect(sectorAdvantageOf(macro, "industry")).toBeCloseTo(0.07);
    expect(sectorAdvantageOf(macro, "services")).toBeCloseTo(0.1443, 3);
    expect(sectorAdvantageOf(macro, "government")).toBe(0);
  });
});
