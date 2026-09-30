/**
 * Unit tests for the map editor's pure geometry helpers (scatter, snap, interior
 * point, empty-region detection) and the GeoJSON import/export transforms.
 */

import type { Polygon } from "geojson";
import {
  featuresToGeoJSON,
  findContainingRegion,
  findEmptyRegions,
  interiorPoint,
  nearestPointOnBoundary,
  nudgeToward,
  planGeoJSONImport,
  pointInGeometry,
  randomPointsInPolygon,
  seededRandom,
} from "~/hooks/map-editor/editor-geo-ops";
import type { EditorFeature } from "~/hooks/map-editor/editor-types";

const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
};

// A "C" shape whose vertex centroid falls outside the polygon.
const cShape: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
      [2, 8],
      [10, 8],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
};

const region = (
  id: string,
  geometry: Polygon,
  props: Record<string, unknown> = {}
): EditorFeature => ({
  id,
  type: "subdivision",
  name: `Region ${id}`,
  geometry,
  properties: props as EditorFeature["properties"],
});

const city = (
  id: string,
  coordinates: [number, number],
  props: Record<string, unknown> = {}
): EditorFeature => ({
  id,
  type: "city",
  name: `City ${id}`,
  coordinates,
  properties: props as EditorFeature["properties"],
});

describe("randomPointsInPolygon", () => {
  it("returns the requested number of points, all inside the shape", () => {
    const pts = randomPointsInPolygon(square, 12, { random: seededRandom(42) });
    expect(pts).toHaveLength(12);
    for (const p of pts) expect(pointInGeometry(p, square)).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const a = randomPointsInPolygon(square, 5, { random: seededRandom(7) });
    const b = randomPointsInPolygon(square, 5, { random: seededRandom(7) });
    expect(a).toEqual(b);
  });

  it("keeps points inside concave shapes", () => {
    const pts = randomPointsInPolygon(cShape, 20, { random: seededRandom(3) });
    for (const p of pts) expect(pointInGeometry(p, cShape)).toBe(true);
  });
});

describe("nearestPointOnBoundary / nudgeToward", () => {
  it("projects onto the closest edge", () => {
    expect(nearestPointOnBoundary([5, 1], square)).toEqual([5, 0]);
    expect(nearestPointOnBoundary([9, 5], square)).toEqual([10, 5]);
  });

  it("nudges a boundary point back inside", () => {
    const onEdge = nearestPointOnBoundary([5, 1], square);
    const nudged = nudgeToward(onEdge, [5, 1]);
    expect(pointInGeometry(nudged, square)).toBe(true);
  });
});

describe("interiorPoint", () => {
  it("uses the centroid when it is inside", () => {
    const p = interiorPoint(square)!;
    expect(p[0]).toBeCloseTo(5);
    expect(p[1]).toBeCloseTo(5);
  });

  it("falls back to a point that is actually inside for concave shapes", () => {
    const p = interiorPoint(cShape)!;
    expect(pointInGeometry(p, cShape)).toBe(true);
  });
});

describe("findEmptyRegions / findContainingRegion", () => {
  const a = region("a", square);
  const b = region("b", {
    type: "Polygon",
    coordinates: [
      [
        [20, 0],
        [30, 0],
        [30, 10],
        [20, 10],
        [20, 0],
      ],
    ],
  });

  it("treats a region with a city inside it (or linked to it) as occupied", () => {
    expect(findEmptyRegions([a, b, city("c1", [5, 5])]).map((r) => r.id)).toEqual(["b"]);
    expect(
      findEmptyRegions([a, b, city("c2", [50, 50], { subdivisionId: "b" })]).map((r) => r.id)
    ).toEqual(["a"]);
  });

  it("finds the region containing a point", () => {
    expect(findContainingRegion([25, 5], [a, b])?.id).toBe("b");
    expect(findContainingRegion([15, 5], [a, b])).toBeUndefined();
  });
});

describe("GeoJSON export / import", () => {
  it("exports points and shapes with their editor type", () => {
    const fc = featuresToGeoJSON([city("c1", [1, 2], { population: 10 }), region("r1", square)]);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.geometry).toEqual({ type: "Point", coordinates: [1, 2] });
    expect(fc.features[0]!.properties).toMatchObject({
      id: "c1",
      featureType: "city",
      population: 10,
    });
    expect(fc.features[1]!.properties).toMatchObject({ featureType: "subdivision" });
  });

  it("round-trips an export into an import plan", () => {
    const fc = featuresToGeoJSON([city("c1", [1, 2]), region("r1", square)]);
    const plan = planGeoJSONImport(fc);
    expect(plan.skipped).toBe(0);
    expect(plan.features.map((f) => f.kind)).toEqual(["city", "subdivision"]);
    expect(plan.features[0]!.name).toBe("City c1");
  });

  it("maps POIs, names from common keys, and skips lines", () => {
    const plan = planGeoJSONImport({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [3, 4] },
          properties: { NAME: "Fort", category: "military" },
        },
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          properties: {},
        },
        { type: "Feature", geometry: null, properties: {} },
      ],
    });
    expect(plan.features).toHaveLength(1);
    expect(plan.features[0]).toMatchObject({ kind: "poi", name: "Fort" });
    expect(plan.skipped).toBe(2);
  });

  it("accepts a bare geometry", () => {
    expect(planGeoJSONImport(square).features[0]?.kind).toBe("subdivision");
  });
});
