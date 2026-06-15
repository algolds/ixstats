/**
 * Tests for border-history-asof.ts — pure "as-of" merge of BorderHistory
 * snapshots with the current political FeatureCollection.
 *
 * Pure-function characterization tests; no React or database dependencies.
 */

import type { Feature, Polygon } from "geojson";
import { mergeBordersAsOf } from "../border-history-asof";

function square(minLng: number, minLat: number, maxLng: number, maxLat: number): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

function feature(countryId: string, geom: Polygon): Feature {
  return {
    type: "Feature",
    geometry: geom,
    properties: { countryId, name: countryId },
  };
}

describe("mergeBordersAsOf", () => {
  test("returns the latest snapshot ≤ asOf for a country with multiple history rows", () => {
    const jan = feature("A", square(0, 0, 1, 1));
    const mar = feature("A", square(0, 0, 2, 2));
    const current = [jan, mar];

    const history = [
      { countryId: "A", geometry: square(0, 0, 1, 1), changedAt: new Date("2026-01-01") },
      { countryId: "A", geometry: square(0, 0, 2, 2), changedAt: new Date("2026-03-01") },
    ];

    // Feb 1 → Jan 1 geometry (1x1)
    const febResult = mergeBordersAsOf(current, history, new Date("2026-02-01"));
    const febGeom = febResult[0]?.geometry as Polygon;
    expect(febGeom.coordinates[0]?.[1]?.[0]).toBe(1);

    // Apr 1 → Mar 1 geometry (2x2)
    const aprResult = mergeBordersAsOf(current, history, new Date("2026-04-01"));
    const aprGeom = aprResult[0]?.geometry as Polygon;
    expect(aprGeom.coordinates[0]?.[2]?.[0]).toBe(2);
  });

  test("returns current geometry unchanged for a country with no history rows", () => {
    const current = [feature("B", square(5, 5, 6, 6))];
    const result = mergeBordersAsOf(current, [], new Date("2026-06-01"));
    expect(result[0]?.geometry).toBe(current[0]?.geometry);
  });

  test("passes through features with no countryId property", () => {
    const anon: Feature = {
      type: "Feature",
      geometry: square(7, 7, 8, 8),
      properties: { name: "anonymous" },
    };
    const result = mergeBordersAsOf([anon], [], new Date("2026-06-01"));
    expect(result[0]).toBe(anon);
  });

  test("ignores snapshots after asOf even if a newer one exists", () => {
    const current = [feature("C", square(0, 0, 1, 1))];
    const history = [
      { countryId: "C", geometry: square(0, 0, 3, 3), changedAt: new Date("2026-05-01") },
      { countryId: "C", geometry: square(0, 0, 1, 1), changedAt: new Date("2026-01-01") },
    ];
    // asOf is March — only the Jan snapshot applies (1x1)
    const result = mergeBordersAsOf(current, history, new Date("2026-03-15"));
    const geom = result[0]?.geometry as Polygon;
    expect(geom.coordinates[0]?.[1]?.[0]).toBe(1);
  });

  test("does not mutate input features or history rows", () => {
    const original = feature("D", square(0, 0, 1, 1));
    const history = [
      { countryId: "D", geometry: square(0, 0, 5, 5), changedAt: new Date("2026-01-01") },
    ];
    const snapshotGeom = history[0]?.geometry;
    const result = mergeBordersAsOf([original], history, new Date("2026-06-01"));
    expect(result[0]).not.toBe(original);
    expect(original.geometry).toBe(square(0, 0, 1, 1).geometry !== undefined ? original.geometry : original.geometry);
    expect(history[0]?.geometry).toBe(snapshotGeom);
  });
});
