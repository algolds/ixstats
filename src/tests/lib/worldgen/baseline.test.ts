/**
 * Derived nation baseline: population from habitable land by climate group, GDP per capita from the
 * development level varied by geography within 0.75-1.25.
 */

import { baselineBounds, deriveBaseline } from "~/lib/worldgen/baseline";
import type { DevelopmentLevel } from "~/lib/worldgen/v2/types";

const LEVELS: DevelopmentLevel[] = ["developing", "industrial", "modern"];
const BASE_GDP: Record<DevelopmentLevel, number> = {
  developing: 6000,
  industrial: 20000,
  modern: 45000,
};

const input = (over: Partial<Parameters<typeof deriveBaseline>[0]> = {}) => ({
  cells: 100,
  habitableKm2: 1000,
  climateMix: { C: 1 },
  coastShare: 0.4,
  riverShare: 0.35,
  developmentLevel: "industrial" as DevelopmentLevel,
  ...over,
});

describe("deriveBaseline population", () => {
  it("scales with habitable area and with the development level", () => {
    const base = deriveBaseline(input()).population;
    expect(deriveBaseline(input({ habitableKm2: 3000 })).population).toBe(base * 3);
    const dev = deriveBaseline(input({ developmentLevel: "developing" })).population;
    const mod = deriveBaseline(input({ developmentLevel: "modern" })).population;
    expect(dev).toBeLessThan(base);
    expect(mod).toBeGreaterThan(base);
  });
  it.each(LEVELS)("%s: an all-ice slot has neither people nor GDP", (level) => {
    const allIce = { cells: 40, habitableKm2: 0, developmentLevel: level };
    expect(deriveBaseline(input(allIce))).toEqual({ population: 0, gdpPerCapita: 0 });
    expect(deriveBaseline(input({ ...allIce, habitableKm2: -5 }))).toEqual({
      population: 0,
      gdpPerCapita: 0,
    });
  });

  it("treats non-finite numbers as zero instead of leaking NaN or Infinity", () => {
    expect(deriveBaseline(input({ cells: NaN }))).toEqual({ population: 0, gdpPerCapita: 0 });
    expect(deriveBaseline(input({ habitableKm2: NaN }))).toEqual({
      population: 0,
      gdpPerCapita: 0,
    });
    expect(deriveBaseline(input({ habitableKm2: Infinity }))).toEqual({
      population: 0,
      gdpPerCapita: 0,
    });
  });

  it("reads a non-finite coast, river or climate share as zero", () => {
    expect(deriveBaseline(input({ coastShare: NaN }))).toEqual(
      deriveBaseline(input({ coastShare: 0 }))
    );
    expect(deriveBaseline(input({ coastShare: Infinity }))).toEqual(
      deriveBaseline(input({ coastShare: 0 }))
    );
    expect(deriveBaseline(input({ riverShare: NaN }))).toEqual(
      deriveBaseline(input({ riverShare: 0 }))
    );
    expect(deriveBaseline(input({ climateMix: { C: NaN, D: 1 } }))).toEqual(
      deriveBaseline(input({ climateMix: { D: 1 } }))
    );
    expect(deriveBaseline(input({ climateMix: { C: Infinity, D: 1 } }))).toEqual(
      deriveBaseline(input({ climateMix: { D: 1 } }))
    );
  });
});

describe("deriveBaseline GDP per capita", () => {
  const best = { climateMix: { D: 1 }, coastShare: 1, riverShare: 1 };
  const worst = { climateMix: { F: 1 }, coastShare: 0, riverShare: 0 };
  it("always lands inside the band for any geography", () => {
    for (const group of ["A", "B", "C", "D", "E", "F", "H"]) {
      for (const coastShare of [0, 0.5, 1]) {
        for (const riverShare of [0, 0.5, 1]) {
          const { gdpPerCapita } = deriveBaseline(
            input({ climateMix: { [group]: 1 }, coastShare, riverShare })
          );
          expect(gdpPerCapita).toBeGreaterThanOrEqual(20000 * 0.75);
          expect(gdpPerCapita).toBeLessThanOrEqual(20000 * 1.25);
        }
      }
    }
  });
});

describe("baselineBounds", () => {
  it.each(LEVELS)(
    "brackets everything deriveBaseline gives at the %s level",
    (developmentLevel) => {
      const { gdpPerCapita, maxDensity } = baselineBounds(developmentLevel);
      expect(gdpPerCapita).toEqual({
        min: BASE_GDP[developmentLevel] * 0.75,
        max: BASE_GDP[developmentLevel] * 1.25,
      });
      for (const group of ["A", "B", "C", "D", "E", "F", "H"]) {
        for (const coastShare of [0, 1]) {
          const out = deriveBaseline(
            input({ developmentLevel, climateMix: { [group]: 1 }, coastShare })
          );
          expect(out.gdpPerCapita).toBeGreaterThanOrEqual(gdpPerCapita.min);
          expect(out.gdpPerCapita).toBeLessThanOrEqual(gdpPerCapita.max);
          expect(out.population).toBeLessThanOrEqual(1000 * maxDensity);
        }
      }
    }
  );
});
