/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import {
  POPULATION_TIERS,
  computePerformance,
  toChartPoint,
  type PopulationChartDataPoint,
  type PopulationCountryData,
} from "~/lib/mycountry/population-details";
import { IXNAY_CALENDAR, formatRealmDate } from "~/lib/realms/realm-clock";

const AT = Date.UTC(2041, 5, 2);

function point(population: number): PopulationChartDataPoint {
  return toChartPoint({ population }, AT, IXNAY_CALENDAR);
}

const country: PopulationCountryData = {
  currentPopulation: 20_000_000,
  populationGrowthRate: 0.01,
  economicTier: "Developed",
  landArea: 400_000,
};

describe("toChartPoint", () => {
  it("dates the point on the realm calendar and scales the growth rate to percent", () => {
    expect(
      toChartPoint(
        { population: 5_000, populationGrowthRate: 0.02, populationDensity: 12, totalGdp: 9 },
        new Date(AT).toISOString(),
        IXNAY_CALENDAR
      )
    ).toEqual({
      year: 2041,
      population: 5_000,
      populationGrowthRate: 2,
      populationDensity: 12,
      totalGdp: 9,
      timestamp: AT,
      date: formatRealmDate(AT, IXNAY_CALENDAR),
    });
  });

  it("defaults missing fields", () => {
    expect(toChartPoint({}, AT, IXNAY_CALENDAR)).toMatchObject({
      population: 0,
      populationGrowthRate: 0,
      populationDensity: null,
      totalGdp: 0,
      timestamp: AT,
    });
  });
});

describe("computePerformance", () => {
  it("uses the last two chart points for growth and compares with the global average", () => {
    expect(
      computePerformance(
        country,
        [point(1), point(100), point(110)],
        { count: 4, totalPopulation: 40_000_000 },
        2,
        10
      )
    ).toEqual({
      growth: expect.closeTo(10, 10),
      globalComparison: 100,
      globalAverage: 10_000_000,
      rank: 3,
      totalCountries: 10,
      density: 50,
    });
  });

  it("falls back to the live rate, rank 1, one nation and the stored density", () => {
    const fallback = computePerformance(
      { ...country, populationDensity: 7, landArea: null },
      [point(0), point(10)],
      undefined,
      -1,
      0
    );
    expect(fallback).toEqual({
      growth: 1,
      globalComparison: 0,
      globalAverage: 0,
      rank: 1,
      totalCountries: 1,
      density: 7,
    });
    expect(
      computePerformance(country, [point(10)], { count: 0, totalPopulation: 5 }, 0, 3).growth
    ).toBe(1);
    expect(computePerformance({ ...country, landArea: null }, [], undefined, 0, 1).density).toBe(
      20_000_000
    );
  });
});

describe("POPULATION_TIERS", () => {
  it("covers every population without gaps", () => {
    POPULATION_TIERS.slice(1).forEach((tier, i) =>
      expect(tier.min).toBe(POPULATION_TIERS[i]!.max + 1)
    );
    expect(POPULATION_TIERS[0]!.min).toBe(0);
    expect(POPULATION_TIERS.at(-1)!.max).toBe(Infinity);
  });
});
