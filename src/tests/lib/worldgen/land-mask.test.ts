/**
 * Land mask rasteriser: scanline polygon fill of a realm's background, political and altitude layers.
 */

import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { rasterizeLandMask, sampleLandMask } from "~/lib/worldgen/land-mask";
type Ring = [number, number][];

const feature = (geometry: Geometry, properties: GeoJsonProperties = {}): Feature => ({
  type: "Feature",
  geometry,
  properties,
});
const collection = (
  ...features: Feature<Geometry | null>[]
): FeatureCollection<Geometry | null> => ({
  type: "FeatureCollection",
  features,
});
const box = (west: number, south: number, east: number, north: number): Ring => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
const polygon = (...rings: Ring[]): Geometry => ({ type: "Polygon", coordinates: rings });
const landCount = (land: Uint8Array) => land.reduce((sum, v) => sum + v, 0);

/** 1° pixels: easy to count by hand. */
const WIDTH = 360;

describe("rasterizeLandMask", () => {
  it("fills a ring that crosses the antimeridian the short way", () => {
    // 170E -> 170W is a 20 degree wide polygon, not a 340 degree one
    const ring: Ring = [
      [170, -10],
      [-170, -10],
      [-170, 10],
      [170, 10],
      [170, -10],
    ];
    const mask = rasterizeLandMask({ background: collection(feature(polygon(ring))) }, WIDTH);
    expect(landCount(mask.land)).toBe(20 * 20);
    expect(sampleLandMask(mask, 175, 0).land).toBe(true);
    expect(sampleLandMask(mask, 179.5, 0).land).toBe(true);
    expect(sampleLandMask(mask, -179.5, 0).land).toBe(true);
    expect(sampleLandMask(mask, -175, 0).land).toBe(true);
    expect(sampleLandMask(mask, 0, 0).land).toBe(false);
    expect(sampleLandMask(mask, 100, 0).land).toBe(false);
    expect(sampleLandMask(mask, -100, 0).land).toBe(false);
  });

  it("fills a ring that crosses the antimeridian westward", () => {
    const ring: Ring = [
      [-175, -5],
      [175, -5],
      [175, 5],
      [-175, 5],
      [-175, -5],
    ];
    const mask = rasterizeLandMask({ background: collection(feature(polygon(ring))) }, WIDTH);
    expect(landCount(mask.land)).toBe(10 * 10);
    expect(sampleLandMask(mask, 178, 0).land).toBe(true);
    expect(sampleLandMask(mask, -178, 0).land).toBe(true);
    expect(sampleLandMask(mask, 0, 0).land).toBe(false);
  });

  it("keeps the hole of a polygon that crosses the antimeridian", () => {
    const outer: Ring = [
      [160, -20],
      [-160, -20],
      [-160, 20],
      [160, 20],
      [160, -20],
    ];
    const hole: Ring = [
      [175, -5],
      [-175, -5],
      [-175, 5],
      [175, 5],
      [175, -5],
    ];
    const mask = rasterizeLandMask(
      { background: collection(feature(polygon(outer, hole))) },
      WIDTH
    );
    expect(landCount(mask.land)).toBe(40 * 40 - 10 * 10);
    expect(sampleLandMask(mask, 180, 0).land).toBe(false);
    expect(sampleLandMask(mask, 165, 0).land).toBe(true);
    expect(sampleLandMask(mask, -165, 10).land).toBe(true);
  });

  it("fills a polar continent drawn with explicit pole vertices", () => {
    const ring: Ring = [
      [-180, -70],
      [-90, -65],
      [0, -68],
      [90, -66],
      [180, -70],
      [180, -90],
      [-180, -90],
      [-180, -70],
    ];
    const mask = rasterizeLandMask({ background: collection(feature(polygon(ring))) }, WIDTH);
    for (const lng of [-179.5, -90, 0, 90, 179.5]) {
      expect(sampleLandMask(mask, lng, -85).land).toBe(true);
      expect(sampleLandMask(mask, lng, -60).land).toBe(false);
    }
    expect(landCount(mask.land)).toBeGreaterThan(360 * 19);
    expect(landCount(mask.land)).toBeLessThan(360 * 25);
  });

  it("fills a polar cap whose ring winds once around the pole", () => {
    const ring: Ring = [
      [0, -70],
      [90, -65],
      [180, -68],
      [-90, -66],
      [0, -70],
    ];
    const mask = rasterizeLandMask({ background: collection(feature(polygon(ring))) }, WIDTH);
    for (const lng of [-170, -90, 0, 90, 170]) {
      expect(sampleLandMask(mask, lng, -85).land).toBe(true);
      expect(sampleLandMask(mask, lng, -50).land).toBe(false);
    }
    expect(sampleLandMask(mask, 0, 80).land).toBe(false);
  });

  it("unions the background and political layers and every MultiPolygon part", () => {
    const mask = rasterizeLandMask(
      {
        background: collection(
          feature({
            type: "MultiPolygon",
            coordinates: [[box(0, 0, 10, 10)], [box(50, 50, 60, 60)]],
          })
        ),
        political: collection(
          feature(polygon(box(5, 5, 20, 20))),
          feature(polygon(box(-60, -60, -50, -50)))
        ),
      },
      WIDTH
    );
    // 10x10 + 15x15 - 5x5 overlap + 10x10 + 10x10
    expect(landCount(mask.land)).toBe(100 + 225 - 25 + 100 + 100);
    expect(sampleLandMask(mask, 55, 55).land).toBe(true);
    expect(sampleLandMask(mask, -55, -55).land).toBe(true);
    expect(sampleLandMask(mask, 15, 15).land).toBe(true);
    expect(sampleLandMask(mask, 30, 30).land).toBe(false);
  });

  it("does not count altitude layers as land", () => {
    const mask = rasterizeLandMask(
      { altitudes: collection(feature(polygon(box(10, 10, 30, 30)), { zone: "zone_2" })) },
      WIDTH
    );
    expect(landCount(mask.land)).toBe(0);
  });
});

describe("rasterizeLandMask altitude zones", () => {
  const land = feature(polygon(box(0, 0, 60, 60)));
  it("stores the highest band covering each pixel", () => {
    const mask = rasterizeLandMask(
      {
        background: collection(land),
        altitudes: collection(
          feature(polygon(box(0, 0, 60, 60)), { zone: "zone_0" }),
          feature(polygon(box(0, 0, 40, 60)), { zone: "zone_1" }),
          feature(polygon(box(0, 0, 20, 60)), { zone: "zone_3" })
        ),
      },
      WIDTH
    );
    expect(mask.zone).toBeDefined();
    expect(sampleLandMask(mask, 10, 30)).toEqual({ land: true, zone: 3 });
    expect(sampleLandMask(mask, 30, 30)).toEqual({ land: true, zone: 1 });
    expect(sampleLandMask(mask, 50, 30)).toEqual({ land: true, zone: 0 });
    expect(sampleLandMask(mask, 100, 30)).toEqual({ land: false, zone: 0 });
  });

  it("reads Ixnay-style bands from ixmap-subgroup and from the band colour", () => {
    const mask = rasterizeLandMask(
      {
        background: collection(land),
        altitudes: collection(
          feature(polygon(box(0, 0, 60, 60)), { "ixmap-subgroup": "coastlines" }),
          feature(polygon(box(0, 0, 40, 60)), { "ixmap-subgroup": "Altitude-4" }),
          feature(polygon(box(0, 0, 20, 60)), { fill: "#9c7b50" })
        ),
      },
      WIDTH
    );
    expect(sampleLandMask(mask, 50, 30).zone).toBe(0);
    expect(sampleLandMask(mask, 30, 30).zone).toBe(4);
    expect(sampleLandMask(mask, 10, 30).zone).toBe(6);
  });
});
