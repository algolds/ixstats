/**
 * measureWorld: the 0.5 degree grid sampler behind World Studio's Calibration tab. Land share, hypsometry, climate
 * mix, nation sizes and coastline, from the layers a generated world or a realm's stored map carries.
 */

import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Position } from "geojson";
import { measureWorld } from "~/lib/worldgen/measure-world";
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
});

describe("measureWorld: climate", () => {
  const land = layer(square(0, 0, 40));
  const halves = (west: Feature, east: Feature) => ({
    political: land,
    climate: layer(west, east),
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
    expect(trewartha.climate.D).toBeCloseTo(0.5, 10);
    expect(trewartha.climate.B).toBeCloseTo(0.5, 10);
    for (const other of [koppenCodes, koppenKey, koppenByColour]) {
      expect(other.climate).toEqual(trewartha.climate);
    }
  });
});
describe("measureWorld: coastline", () => {
  it("drops the border two nations share", () => {
    const apart = measureWorld({ political: layer(square(0, 0, 10), square(20, 0, 10)) });
    const joined = measureWorld({ political: layer(square(0, 0, 10), square(10, 0, 10)) });
    expect(joined.coastlineKm).toBeLessThan(apart.coastlineKm - 10 * DEG_KM * 1.9);
  });
  it("counts nothing for the edges of a polar ring that run along the pole", () => {
    const cap = (poleVertices: Position[]) =>
      measureWorld({
        political: layer(
          feature(
            polygon([
              [-180, 80],
              [0, 80],
              [180, 80],
              [180, 90],
              ...poleVertices,
              [-180, 90],
              [-180, 80],
            ])
          )
        ),
      }).coastlineKm;
    expect(
      cap([
        [90, 90],
        [0, 90],
        [-90, 90],
      ])
    ).toBeCloseTo(cap([]), 6);
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
