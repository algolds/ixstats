/**
 * Corporate feedback into MyCountry (Exchange Phase 3): a nation's corporate sector moves its GDP
 * level by at most ±5% and its vitality by at most ±10 points, measured against its tier.
 */
import {
  corporateBenchmarkOf,
  gdpShiftOf,
  syncCorporateFeedback,
  vitalityShiftOf,
} from "~/lib/exchange/feedback";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const BENCHMARK = 100_000;

describe("corporateBenchmarkOf", () => {
  it("scales the 1x benchmark by the tier's stipend multiplier", () => {
    expect(corporateBenchmarkOf("Developed")).toBe(BENCHMARK);
    expect(corporateBenchmarkOf("Impoverished")).toBe(50_000);
    expect(corporateBenchmarkOf("Very Strong")).toBe(175_000);
  });

  it("gives an unknown tier the 1x benchmark", () => {
    expect(corporateBenchmarkOf("Mystery")).toBe(BENCHMARK);
  });
});

describe("gdpShiftOf", () => {
  it("is zero for a corporate sector at par with its benchmark", () => {
    expect(gdpShiftOf(BENCHMARK, BENCHMARK)).toBe(0);
  });

  it("rises by five points of GDP per benchmark of surplus", () => {
    expect(gdpShiftOf(1.5 * BENCHMARK, BENCHMARK)).toBe(0.025);
  });

  it("caps a large surplus at +5%", () => {
    expect(gdpShiftOf(1_000 * BENCHMARK, BENCHMARK)).toBe(0.05);
  });

  it("caps a sector with nothing left at -5%", () => {
    expect(gdpShiftOf(0, BENCHMARK)).toBe(-0.05);
  });

  it("never leaves [-0.05, +0.05] for any score", () => {
    for (const score of [0, 1, 50_000, BENCHMARK, 3 * BENCHMARK, 1e12]) {
      const shift = gdpShiftOf(score, BENCHMARK);
      expect(shift).toBeGreaterThanOrEqual(-0.05);
      expect(shift).toBeLessThanOrEqual(0.05);
    }
  });
});

describe("vitalityShiftOf", () => {
  it("is zero at par and scales with the surplus", () => {
    expect(vitalityShiftOf(BENCHMARK, BENCHMARK)).toBe(0);
    expect(vitalityShiftOf(1.2 * BENCHMARK, BENCHMARK)).toBe(2);
  });

  it("clamps the shift to ±10 points", () => {
    expect(vitalityShiftOf(1e12, BENCHMARK)).toBe(10);
    expect(vitalityShiftOf(0, BENCHMARK)).toBe(-10);
  });
});

describe("syncCorporateFeedback", () => {
  const NATION = "nation_a";
  const EFFECT_KEY = "exchange-corporate-sector";
  const T = Date.now();
  let fake: FakeDb;

  beforeEach(() => {
    fake = createFakeExchangeDb({
      country: [{ id: NATION, realmId: "default", economicTier: "Developed" }],
      company: [
        {
          id: "co1",
          name: "Acme",
          realmId: "default",
          founderId: "alice",
          sectorKey: "services",
          subIndustryKey: "software_media",
          hqCountryId: NATION,
          status: "ACTIVE",
          decisionValue: 150_000,
          capital: 0,
        },
      ],
    });
  });

  const effects = () =>
    (fake.tables.storytellerEffect ?? []).filter((e) => e.createdBy === EFFECT_KEY);

  it("moves a nation's GDP level to its reading, and writes nothing on a rerun", async () => {
    await syncCorporateFeedback(fake.client, T);
    expect(effects()).toEqual([
      expect.objectContaining({
        countryId: NATION,
        inputType: "gdp_level_adjustment",
        value: 0.025,
      }),
    ]);
    expect(fake.tables.nationTreasury).toEqual([
      expect.objectContaining({ countryId: NATION, corporateGdpShift: 0.025 }),
    ]);

    const again = await syncCorporateFeedback(fake.client, T);
    expect(again.effectsWritten).toBe(0);
    expect(effects()).toHaveLength(1);
  });

  it("ends the level and clears the stored shift once the nation's corporate activity stops", async () => {
    await syncCorporateFeedback(fake.client, T);
    fake.tables.company![0]!.status = "BANKRUPT";
    await syncCorporateFeedback(fake.client, T);
    expect(effects()).toHaveLength(2);
    expect(effects()[1]!.value as number).toBeCloseTo(-0.02439, 4);
    expect(fake.tables.nationTreasury![0]).toMatchObject({ corporateGdpShift: 0 });
  });
});
