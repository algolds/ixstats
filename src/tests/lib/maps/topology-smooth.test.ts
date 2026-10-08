/** @jest-environment node */
import type { Feature, Polygon } from "geojson";
import { chaikin, smoothTopology } from "~/lib/maps/topology-smooth";

const topoServer = require("topojson-server") as {
  topology: (objects: Record<string, unknown>) => {
    arcs: number[][][];
    objects: Record<string, unknown>;
  };
};
const topoClient = require("topojson-client") as {
  feature: (
    topology: unknown,
    object: unknown
  ) => { features: Array<Feature<Polygon, { key: string }>> };
};

const square = (key: string, x: number, size = 4): Feature<Polygon, { key: string }> => ({
  type: "Feature",
  properties: { key },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [x, 0],
        [x + size, 0],
        [x + size, size],
        [x, size],
        [x, 0],
      ],
    ],
  },
});

describe("chaikin", () => {
  it("cuts the corners of an open line and keeps its end points", () => {
    expect(
      chaikin(
        [
          [0, 0],
          [4, 0],
          [4, 4],
        ],
        1,
        false
      )
    ).toEqual([
      [0, 0],
      [3, 0],
      [4, 1],
      [4, 4],
    ]);
  });

  it("cuts every corner of a closed ring and closes it again", () => {
    const ring = chaikin(square("a", 0).geometry.coordinates[0]!, 1, true);
    expect(ring).toHaveLength(9);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring).not.toContainEqual([0, 0]);
    expect(ring).toContainEqual([1, 0]);
    expect(ring).toContainEqual([3, 0]);
  });

  it("leaves a straight segment alone and doubles the cuts each round", () => {
    const segment = [
      [0, 0],
      [1, 1],
    ];
    expect(chaikin(segment, 3, false)).toEqual(segment);
    const line = [
      [0, 0],
      [4, 0],
      [4, 4],
      [8, 4],
    ];
    expect(chaikin(line, 1, false)).toHaveLength(6);
    expect(chaikin(line, 2, false)).toHaveLength(10);
  });
});

describe("smoothTopology", () => {
  const twoSquares = () =>
    topoServer.topology({
      regions: { type: "FeatureCollection", features: [square("a", 0), square("b", 4)] },
    });

  it("smooths shared borders once, so neighbours still meet exactly, and keeps the junctions", () => {
    const smoothed = smoothTopology(twoSquares(), { iterations: 2 });
    const [a, b] = topoClient.feature(smoothed, smoothed.objects.regions).features;
    const ringA = a!.geometry.coordinates[0]!;
    const ringB = b!.geometry.coordinates[0]!;
    const shared = ringA.filter((p) => ringB.some((q) => q[0] === p[0] && q[1] === p[1]));
    // The shared edge x = 4 is a straight arc between two junctions: unchanged, both ends kept.
    expect(shared).toEqual(expect.arrayContaining([[4, 0]]));
    expect(shared).toEqual(expect.arrayContaining([[4, 4]]));
    // Outer corners are cut.
    expect(ringA).not.toContainEqual([0, 0]);
    expect(ringB).not.toContainEqual([8, 4]);
  });

  it("smooths an island's coast all the way round", () => {
    const island = topoServer.topology({
      regions: { type: "FeatureCollection", features: [square("a", 0)] },
    });
    const smoothed = smoothTopology(island, { iterations: 1 });
    const ring = topoClient.feature(smoothed, smoothed.objects.regions).features[0]!.geometry
      .coordinates[0]!;
    expect(ring).not.toContainEqual([0, 0]);
    expect(ring).toHaveLength(9);
  });

  it("prunes vertices that span less than the given area, never an arc's end points", () => {
    const smoothed = smoothTopology(twoSquares(), { iterations: 3 });
    const pruned = smoothTopology(twoSquares(), { iterations: 3, prune: 0.05 });
    const count = (t: { arcs: number[][][] }) => t.arcs.reduce((n, arc) => n + arc.length, 0);
    expect(count(pruned)).toBeLessThan(count(smoothed));
    for (let i = 0; i < pruned.arcs.length; i++) {
      expect(pruned.arcs[i]![0]).toEqual(smoothed.arcs[i]![0]);
    }
  });

  it("returns the topology unchanged with no rounds", () => {
    const topology = twoSquares();
    expect(smoothTopology(topology, { iterations: 0 })).toBe(topology);
  });
});
