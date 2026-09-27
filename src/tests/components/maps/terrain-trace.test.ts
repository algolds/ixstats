import { describe, it, expect } from "@jest/globals";
import type { FeatureCollection, Position } from "geojson";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import {
  capRun,
  geometryToTracePaths,
  traceBetween,
  traceTerrainPath,
} from "~/components/maps/editor/utils/terrain-trace";

const TOL = 0.001;

const river = geometryToTracePaths({
  type: "LineString",
  coordinates: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ],
});

// Square coastline ring, stored with its closing vertex like real GeoJSON
const square = geometryToTracePaths({
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ],
});

describe("geometryToTracePaths", () => {
  it("treats polygon rings as closed paths without the repeated closing vertex", () => {
    expect(square).toHaveLength(1);
    expect(square[0]).toMatchObject({ closed: true, size: 4 });
  });

  it("splits multi-geometries and drops degenerate parts", () => {
    const paths = geometryToTracePaths({
      type: "MultiLineString",
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
        [[5, 5]],
      ],
    });
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({ closed: false, size: 2 });
  });

  it("ignores points", () => {
    expect(geometryToTracePaths({ type: "Point", coordinates: [1, 1] })).toEqual([]);
  });
});

describe("traceBetween — open line", () => {
  it("returns the vertices between two points going downstream", () => {
    expect(traceBetween([0.5, 0], [3.5, 0], river, TOL)).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
  });

  it("returns them in reverse order going upstream", () => {
    expect(traceBetween([3.5, 0], [0.5, 0], river, TOL)).toEqual([
      [3, 0],
      [2, 0],
      [1, 0],
    ]);
  });

  it("does not repeat a clicked point that sits exactly on a vertex", () => {
    expect(traceBetween([1, 0], [3, 0], river, TOL)).toEqual([[2, 0]]);
  });

  it("returns nothing when both points are on the same segment", () => {
    expect(traceBetween([1.2, 0], [1.8, 0], river, TOL)).toEqual([]);
  });

  it("returns nothing when a point is off the line", () => {
    expect(traceBetween([0.5, 0], [3.5, 0.5], river, TOL)).toEqual([]);
  });

  it("returns nothing when the points are on different features", () => {
    const other = geometryToTracePaths({
      type: "LineString",
      coordinates: [
        [0, 10],
        [4, 10],
      ],
    });
    expect(traceBetween([0.5, 0], [3.5, 10], [...river, ...other], TOL)).toEqual([]);
  });
});

describe("traceBetween — closed ring", () => {
  it("goes forward round the ring when that is shorter", () => {
    expect(traceBetween([2, 0], [4, 2], square, TOL)).toEqual([[4, 0]]);
  });

  it("goes backward round the ring when that is shorter", () => {
    expect(traceBetween([4, 2], [2, 0], square, TOL)).toEqual([[4, 0]]);
  });

  it("wraps across the ring's start vertex for the shorter way", () => {
    expect(traceBetween([2, 0], [0, 2], square, TOL)).toEqual([[0, 0]]);
    expect(traceBetween([0, 2], [2, 0], square, TOL)).toEqual([[0, 0]]);
  });

  it("takes the longer vertex count when it is the shorter distance", () => {
    // Long thin ring: one side has a single far vertex, the other several close ones
    const ring = geometryToTracePaths({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0.1],
          [2, 0.1],
          [3, 0.1],
          [4, 0],
          [2, 10],
          [0, 0],
        ],
      ],
    });
    // Forward: 4 close vertices; backward: 2 vertices via the far tip at [2, 10]
    expect(traceBetween([0.5, 0.05], [3.9, 0.5], ring, TOL)).toEqual([
      [1, 0.1],
      [2, 0.1],
      [3, 0.1],
      [4, 0],
    ]);
  });
});

describe("vertex cap", () => {
  const wiggle: Position[] = Array.from({ length: 3000 }, (_, i) => [
    i * 0.01,
    Math.sin(i * 0.05) * 0.5,
  ]);

  it("caps a long trace at the vertex limit and keeps its ends", () => {
    const paths = geometryToTracePaths({ type: "LineString", coordinates: wiggle });
    const start: Position = [0.005, (wiggle[0]![1]! + wiggle[1]![1]!) / 2];
    const traced = traceBetween(start, wiggle[2999]!, paths, 0.05, 500);
    expect(traced.length).toBeLessThanOrEqual(500);
    expect(traced.length).toBeGreaterThan(2);
    expect(traced[0]).toEqual(wiggle[1]);
    expect(traced[traced.length - 1]).toEqual(wiggle[2998]);
  });

  it("leaves short runs untouched", () => {
    const run = wiggle.slice(0, 10);
    expect(capRun(run, 500)).toBe(run);
  });
});

describe("traceTerrainPath", () => {
  const riverLayer: MapLayerData = {
    type: "rivers",
    visible: true,
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 0],
              [2, 0],
            ],
          },
        },
      ],
    } satisfies FeatureCollection,
  };
  const altitudeLayer: MapLayerData = { ...riverLayer, type: "altitudes" };

  it("traces along an enabled river layer", () => {
    expect(traceTerrainPath([0.5, 0], [1.5, 0], [riverLayer], new Set(["rivers"]), TOL)).toEqual([
      [1, 0],
    ]);
  });

  it("skips river layers the user switched off", () => {
    expect(traceTerrainPath([0.5, 0], [1.5, 0], [riverLayer], new Set(["lakes"]), TOL)).toEqual([]);
  });

  it("never traces elevation contours", () => {
    expect(
      traceTerrainPath([0.5, 0], [1.5, 0], [altitudeLayer], new Set(["altitudes"]), TOL)
    ).toEqual([]);
  });
});
