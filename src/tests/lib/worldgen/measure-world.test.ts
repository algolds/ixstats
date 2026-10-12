/**
 * measureWorld: the 0.5 degree grid sampler behind World Studio's Calibration tab. Land share, hypsometry, climate
 * mix, nation sizes and coastline, from the layers a generated world or a realm's stored map carries.
 */

import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Position } from "geojson";
import { measureWorld, TREWARTHA_GROUPS, type MeasureLayers } from "~/lib/worldgen/measure-world";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";

type Ring = Position[];

const box = (west: number, south: number, east: number, north: number): Ring => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
const polygon = (...rings: Ring[]): Geometry => ({ type: "Polygon", coordinates: rings });
const feature = (geometry: Geometry, properties: GeoJsonProperties = {}): Feature => ({
  type: "Feature",
  geometry,
  properties,
});
const layer = (...features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});
const square = (west: number, south: number, size: number, properties?: GeoJsonProperties) =>
  feature(polygon(box(west, south, west + size, south + size)), properties);

/** Share of the globe a lng/lat box covers (a sphere's area is proportional to the sine of latitude). */
const globeShare = (lngSpan: number, southLat: number, northLat: number): number =>
  (lngSpan / 360) *
  ((Math.sin((northLat * Math.PI) / 180) - Math.sin((southLat * Math.PI) / 180)) / 2);

/** Km in one degree of a great circle on Earth. */
const DEG_KM = (2 * Math.PI * 6371) / 360;

describe("measureWorld: land and hypsometry", () => {
  it("weights land share by area, not by pixels", () => {
    const measures = measureWorld({ political: layer(square(0, 0, 40), square(0, 50, 40)) });
    const expected = globeShare(40, 0, 40) + globeShare(40, 50, 90);
    expect(measures.landShare).toBeCloseTo(expected, 3);
  });

  it("counts background and political land once", () => {
    const measures = measureWorld({
      background: layer(square(0, 0, 20)),
      political: layer(square(10, 0, 20)),
    });
    expect(measures.landShare).toBeCloseTo(globeShare(30, 0, 20), 3);
  });

  it("shares the land among the nine zones, unbanded land counting as the lowest", () => {
    const measures = measureWorld({
      political: layer(square(0, 0, 20)),
      altitudes: layer(feature(polygon(box(0, 0, 10, 20)), { zone: "zone_3" })),
    });
    expect(measures.hypsometry).toHaveLength(9);
    expect(measures.hypsometry[0]).toBeCloseTo(0.5, 1);
    expect(measures.hypsometry[3]).toBeCloseTo(0.5, 1);
    expect(measures.hypsometry.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 6);
  });

  it("reads Ixnay's altitude subgroups", () => {
    const measures = measureWorld({
      political: layer(square(0, 0, 20)),
      altitudes: layer(feature(polygon(box(0, 0, 20, 20)), { "ixmap-subgroup": "Altitude-4" })),
    });
    expect(measures.hypsometry[4]).toBeCloseTo(1, 6);
  });

  it("measures an empty world as zeros", () => {
    const measures = measureWorld({});
    expect(measures).toEqual({
      landShare: 0,
      hypsometry: new Array(9).fill(0),
      climate: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, H: 0 },
      nations: { count: 0, medianKm2: 0, p90Km2: 0 },
      coastlineKm: 0,
    });
  });
});

describe("measureWorld: climate", () => {
  const land = layer(square(0, 0, 40));
  const halves = (west: Feature, east: Feature) => ({
    political: land,
    climate: layer(west, east),
  });

  it("splits the land by Trewartha group, whichever way a feature names its type", () => {
    const west = feature(polygon(box(0, 0, 20, 40)), { code: "Cs" });
    const east = feature(polygon(box(20, 0, 40, 40)), { biomeId: 0 });
    const { climate } = measureWorld(halves(west, east));
    expect(climate.C).toBeCloseTo(0.5, 1);
    expect(climate.A).toBeCloseTo(0.5, 1);
    expect(climate.B).toBe(0);
  });

  it("reads a colour-only feature as the nearest Trewartha colour", () => {
    const { climate } = measureWorld({
      political: land,
      climate: layer(feature(polygon(box(0, 0, 40, 40)), { fill: "#980000" })),
    });
    expect(climate.A).toBeCloseTo(1, 6);
  });

  it("maps Koppen and Trewartha encodings to the same groups", () => {
    const trewartha = measureWorld(
      halves(
        feature(polygon(box(0, 0, 20, 40)), { code: "Do" }),
        feature(polygon(box(20, 0, 40, 40)), { code: "Bw" })
      )
    );
    const koppenCodes = measureWorld(
      halves(
        feature(polygon(box(0, 0, 20, 40)), { code: "Cfb" }),
        feature(polygon(box(20, 0, 40, 40)), { code: "BWh" })
      )
    );
    const climateKey: ClimateKey = {
      system: "Koppen",
      zones: [
        { code: "Cfb", name: "Oceanic", color: "#00ff00" },
        { code: "BWh", name: "Hot desert", color: "#ff0000" },
      ],
    };
    const koppenKey = measureWorld(
      halves(
        feature(polygon(box(0, 0, 20, 40)), { climateId: "Cfb" }),
        feature(polygon(box(20, 0, 40, 40)), { climateId: "BWh" })
      ),
      { climateKey }
    );
    const koppenByColour = measureWorld(
      halves(
        feature(polygon(box(0, 0, 20, 40)), { fill: "#00FF00" }),
        feature(polygon(box(20, 0, 40, 40)), { fill: "#ff0000" })
      ),
      { climateKey }
    );
    expect(trewartha.climate.D).toBeCloseTo(0.5, 1);
    expect(trewartha.climate.B).toBeCloseTo(0.5, 1);
    for (const other of [koppenCodes, koppenKey, koppenByColour]) {
      expect(other.climate).toEqual(trewartha.climate);
    }
  });

  it("maps Koppen's cold and polar types to Trewartha's boreal and polar groups", () => {
    const { climate } = measureWorld(
      halves(
        feature(polygon(box(0, 0, 20, 40)), { code: "Dfc" }),
        feature(polygon(box(20, 0, 40, 40)), { code: "ET" })
      )
    );
    expect(climate.D + climate.E).toBeCloseTo(0.5, 1);
    expect(climate.F).toBeCloseTo(0.5, 1);
  });

  it("shares only the classified land and ignores climate over the sea", () => {
    const { climate } = measureWorld({
      political: land,
      climate: layer(
        feature(polygon(box(0, 0, 20, 40)), { code: "E" }),
        feature(polygon(box(100, 0, 140, 40)), { code: "Ar" })
      ),
    });
    expect(climate.E).toBeCloseTo(1, 6);
    expect(climate.A).toBe(0);
  });

  it("keeps every group as a key", () => {
    expect(Object.keys(measureWorld({}).climate)).toEqual([...TREWARTHA_GROUPS]);
  });
});

describe("measureWorld: nations", () => {
  it("counts the political features and measures their area in km2", () => {
    const layers: MeasureLayers = {
      political: layer(square(0, 0, 10), square(20, 0, 10), square(40, 0, 20)),
    };
    const { nations } = measureWorld(layers);
    expect(nations.count).toBe(3);
    // 10 x 10 degrees at the equator is about 1.236 million km2
    expect(nations.medianKm2).toBeGreaterThan(1.2e6);
    expect(nations.medianKm2).toBeLessThan(1.25e6);
    // p90 interpolates toward the 20 x 20 degree nation (about 4.9 million km2)
    expect(nations.p90Km2).toBeGreaterThan(nations.medianKm2);
    expect(nations.p90Km2).toBeLessThan(5e6);
  });

  it("subtracts a hole and sums the parts of a multipolygon", () => {
    const withHole = feature(polygon(box(0, 0, 10, 10), box(2, 2, 8, 8).reverse()));
    const parts = feature({
      type: "MultiPolygon",
      coordinates: [[box(20, 0, 25, 5)], [box(30, 0, 35, 5)]],
    });
    const { nations } = measureWorld({ political: layer(withHole, parts) });
    expect(nations.count).toBe(2);
    const full = (DEG_KM * 10) ** 2;
    const hole = (DEG_KM * 6) ** 2;
    const split = 2 * (DEG_KM * 5) ** 2;
    expect(nations.medianKm2).toBeCloseTo((full - hole + split) / 2, -4);
  });

  it("scales areas and distances to the planet's radius", () => {
    const layers = { political: layer(square(0, 0, 10)) };
    const earth = measureWorld(layers);
    const half = measureWorld(layers, { radiusKm: 6371 / 2 });
    expect(half.nations.medianKm2).toBeCloseTo(earth.nations.medianKm2 / 4, -2);
    expect(half.coastlineKm).toBeCloseTo(earth.coastlineKm / 2, 0);
  });

  it("leaves out features without a polygon", () => {
    const { nations } = measureWorld({
      political: {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: null }, square(0, 0, 10)],
      },
    });
    expect(nations.count).toBe(1);
  });
});

describe("measureWorld: coastline", () => {
  it("measures the length of a land polygon's rings", () => {
    const { coastlineKm } = measureWorld({ background: layer(square(0, 0, 10)) });
    // two meridian edges of 10 degrees, an equator edge of 10 degrees and one at 10N a little shorter
    const expected = 2 * 10 * DEG_KM + 10 * DEG_KM + 10 * DEG_KM * Math.cos((10 * Math.PI) / 180);
    expect(coastlineKm).toBeGreaterThan(expected * 0.995);
    expect(coastlineKm).toBeLessThan(expected * 1.005);
  });

  it("drops the border two nations share", () => {
    const apart = measureWorld({ political: layer(square(0, 0, 10), square(20, 0, 10)) });
    const joined = measureWorld({ political: layer(square(0, 0, 10), square(10, 0, 10)) });
    expect(joined.coastlineKm).toBeLessThan(apart.coastlineKm - 10 * DEG_KM * 1.9);
  });

  it("counts land that the background and the political layer both draw once", () => {
    const either = measureWorld({ background: layer(square(0, 0, 10)) });
    const both = measureWorld({
      background: layer(square(0, 0, 10)),
      political: layer(square(0, 0, 10)),
    });
    expect(both.coastlineKm).toBeCloseTo(either.coastlineKm, 3);
  });

  it("counts a hole in the land as coast and ignores a ring too short to enclose anything", () => {
    const solid = measureWorld({ political: layer(square(0, 0, 20)) });
    const lagoon = measureWorld({
      political: layer(feature(polygon(box(0, 0, 20, 20), box(8, 8, 12, 12)))),
    });
    expect(lagoon.coastlineKm).toBeGreaterThan(solid.coastlineKm + 4 * 4 * DEG_KM * 0.95);
    const line = measureWorld({
      background: layer(
        feature(
          polygon([
            [-153, 85],
            [-153, -85],
          ])
        )
      ),
    });
    expect(line.coastlineKm).toBe(0);
  });
});

describe("measureWorld: the antimeridian and the poles", () => {
  const across = feature(
    polygon([
      [170, -5],
      [-170, -5],
      [-170, 5],
      [170, 5],
      [170, -5],
    ])
  );

  it("measures a polygon that crosses the antimeridian as the 20 degree strip it is", () => {
    const measures = measureWorld({ political: layer(across) });
    expect(measures.landShare).toBeCloseTo(globeShare(20, -5, 5), 3);
    expect(measures.nations.count).toBe(1);
    expect(measures.nations.medianKm2 / (20 * 10 * DEG_KM ** 2)).toBeGreaterThan(0.99);
    expect(measures.nations.medianKm2 / (20 * 10 * DEG_KM ** 2)).toBeLessThan(1.01);
    expect(measures.coastlineKm).toBeGreaterThan((2 * 20 + 2 * 10) * DEG_KM * 0.99);
    expect(measures.coastlineKm).toBeLessThan((2 * 20 + 2 * 10) * DEG_KM * 1.01);
  });

  it("does not count the seam as coast when the strip is cut in two at 180", () => {
    const split = measureWorld({
      political: layer(
        feature(polygon(box(170, -5, 180, 5))),
        feature(polygon(box(-180, -5, -170, 5)))
      ),
    });
    const whole = measureWorld({ political: layer(across) });
    expect(split.landShare).toBeCloseTo(whole.landShare, 3);
    expect(split.coastlineKm).toBeCloseTo(whole.coastlineKm, -1);
  });

  it("fills a polar continent drawn to the pole and one that winds once around it", () => {
    const parallel: Ring = [];
    for (let lng = -180; lng <= 180; lng += 30) parallel.push([lng, -70]);
    const framed: Ring = [...parallel, [180, -90], [-180, -90], [-180, -70]];
    // starts on the prime meridian and ends where it began, once around
    const winding: Ring = [...parallel.slice(6), ...parallel.slice(1, 6), [0, -70]];
    for (const ring of [framed, winding]) {
      const measures = measureWorld({ political: layer(feature(polygon(ring))) });
      // the cap south of 70S is (1 - sin 70) / 2 of the globe, about 15.4 million km2
      expect(measures.landShare).toBeCloseTo((1 - Math.sin((70 * Math.PI) / 180)) / 2, 2);
      expect(measures.nations.count).toBe(1);
      expect(measures.nations.medianKm2).toBeGreaterThan(1.3e7);
      expect(measures.nations.medianKm2).toBeLessThan(1.6e7);
    }
  });
});
