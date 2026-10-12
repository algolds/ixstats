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
  it.each([
    ["A", 55],
    ["B", 10],
    ["C", 110],
    ["D", 80],
    ["E", 6],
    ["F", 0.5],
    ["H", 15],
  ])("climate group %s holds %f people per km2 at the industrial level", (group, density) => {
    const { population } = deriveBaseline(input({ climateMix: { [group]: 1 } }));
    expect(population).toBe(Math.round(1000 * density));
  });

  it("blends the densities by the climate mix and normalises a mix that does not sum to 1", () => {
    const even = deriveBaseline(input({ climateMix: { A: 0.5, C: 0.5 } })).population;
    expect(even).toBe(Math.round(1000 * (0.5 * 55 + 0.5 * 110)));
    const doubled = deriveBaseline(input({ climateMix: { A: 1, C: 1 } })).population;
    expect(doubled).toBe(even);
  });

  it("ignores unknown climate groups and treats an empty mix as uninhabited", () => {
    expect(deriveBaseline(input({ climateMix: { C: 1, Z: 5 } })).population).toBe(110000);
    expect(deriveBaseline(input({ climateMix: {} })).population).toBe(0);
  });

  it("scales with habitable area and with the development level", () => {
    const base = deriveBaseline(input()).population;
    expect(deriveBaseline(input({ habitableKm2: 3000 })).population).toBe(base * 3);
    const dev = deriveBaseline(input({ developmentLevel: "developing" })).population;
    const mod = deriveBaseline(input({ developmentLevel: "modern" })).population;
    expect(dev).toBeLessThan(base);
    expect(mod).toBeGreaterThan(base);
  });

  it("returns an empty slot for no land", () => {
    expect(deriveBaseline(input({ cells: 0 }))).toEqual({ population: 0, gdpPerCapita: 0 });
    expect(deriveBaseline(input({ habitableKm2: 0 })).population).toBe(0);
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

  it("orders climates the way a map reader expects", () => {
    const pop = (g: string) => deriveBaseline(input({ climateMix: { [g]: 1 } })).population;
    expect(pop("C")).toBeGreaterThan(pop("D"));
    expect(pop("D")).toBeGreaterThan(pop("A"));
    expect(pop("A")).toBeGreaterThan(pop("H"));
    expect(pop("H")).toBeGreaterThan(pop("B"));
    expect(pop("B")).toBeGreaterThan(pop("E"));
    expect(pop("E")).toBeGreaterThan(pop("F"));
  });
});

describe("deriveBaseline GDP per capita", () => {
  const best = { climateMix: { D: 1 }, coastShare: 1, riverShare: 1 };
  const worst = { climateMix: { F: 1 }, coastShare: 0, riverShare: 0 };

  it.each(LEVELS)("%s: the best geography is capped at 1.25 times the base", (level) => {
    const { gdpPerCapita } = deriveBaseline(input({ ...best, developmentLevel: level }));
    expect(gdpPerCapita).toBe(Math.round(BASE_GDP[level] * 1.25));
  });

  it.each(LEVELS)("%s: the worst geography is floored at 0.75 times the base", (level) => {
    const { gdpPerCapita } = deriveBaseline(input({ ...worst, developmentLevel: level }));
    expect(gdpPerCapita).toBe(Math.round(BASE_GDP[level] * 0.75));
  });

  it.each(LEVELS)("%s: a middling geography stays strictly inside the band", (level) => {
    const { gdpPerCapita } = deriveBaseline(input({ developmentLevel: level }));
    expect(gdpPerCapita).toBeGreaterThan(BASE_GDP[level] * 0.75);
    expect(gdpPerCapita).toBeLessThan(BASE_GDP[level] * 1.25);
  });

  it("rewards coast, river access and temperate climate", () => {
    const gdp = (over: Parameters<typeof input>[0]) => deriveBaseline(input(over)).gdpPerCapita;
    expect(gdp({ coastShare: 0.8 })).toBeGreaterThan(gdp({ coastShare: 0.2 }));
    expect(gdp({ riverShare: 0.7 })).toBeGreaterThan(gdp({ riverShare: 0.1 }));
    expect(gdp({ climateMix: { D: 1 } })).toBeGreaterThan(gdp({ climateMix: { B: 1 } }));
  });

  it("clamps shares outside 0..1 instead of extrapolating", () => {
    const wild = deriveBaseline(input({ coastShare: 7, riverShare: -3 }));
    const clamped = deriveBaseline(input({ coastShare: 1, riverShare: 0 }));
    expect(wild).toEqual(clamped);
  });

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

  it("allows the densest the climate table has, scaled by the level", () => {
    expect(baselineBounds("developing").maxDensity).toBeCloseTo(110 * 0.8);
    expect(baselineBounds("industrial").maxDensity).toBe(110);
    expect(baselineBounds("modern").maxDensity).toBeCloseTo(110 * 1.25);
  });
});
