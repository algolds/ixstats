import type { MultiPolygon, Polygon } from "geojson";
import { vkey, buildTopologyIndex, cascadeMoveVertex } from "~/lib/maps/topology-engine";

// Two adjacent unit squares sharing the edge at x=1:
//   A: (0,0)-(1,0)-(1,1)-(0,1)
//   B: (1,0)-(2,0)-(2,1)-(1,1)
const SQUARE_A: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};
const SQUARE_B: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 0],
    ],
  ],
};

describe("vkey", () => {
  it("quantizes to 5 decimal places", () => {
    expect(vkey([1.123456789, -2.987654321])).toBe("1.12346,-2.98765");
  });

  it("produces identical keys for coordinates within rounding", () => {
    // Both round to 1.00001, 2.00001
    expect(vkey([1.000006, 2.000006])).toBe(vkey([1.000014, 2.000014]));
  });

  it("produces different keys for coordinates beyond rounding", () => {
    expect(vkey([1.00001, 2.00001])).not.toBe(vkey([1.00002, 2.00002]));
  });
});

describe("buildTopologyIndex", () => {
  it("indexes all vertices (excluding ring closures)", () => {
    const index = buildTopologyIndex([{ id: "a", geometry: SQUARE_A }]);
    // 4 unique vertices (ring closure skipped)
    expect(index.size).toBe(4);
  });

  it("shared vertices appear in the same bucket with both refs", () => {
    const index = buildTopologyIndex([
      { id: "a", geometry: SQUARE_A },
      { id: "b", geometry: SQUARE_B },
    ]);

    // Shared vertices: (1,0) and (1,1)
    const key10 = vkey([1, 0]);
    const key11 = vkey([1, 1]);

    const refs10 = index.get(key10)!;
    expect(refs10).toBeDefined();
    expect(refs10.length).toBe(2);
    expect(refs10.map((r) => r.featureId).sort()).toEqual(["a", "b"]);

    const refs11 = index.get(key11)!;
    expect(refs11).toBeDefined();
    expect(refs11.length).toBe(2);
    expect(refs11.map((r) => r.featureId).sort()).toEqual(["a", "b"]);

    // Non-shared vertices: (0,0) only has ref to "a"
    const key00 = vkey([0, 0]);
    const refs00 = index.get(key00)!;
    expect(refs00.length).toBe(1);
    expect(refs00[0]!.featureId).toBe("a");
  });

  it("returns correct ring and vertex indices", () => {
    const index = buildTopologyIndex([{ id: "a", geometry: SQUARE_A }]);

    // (1,0) is vertex index 1 in square A's ring 0
    const key10 = vkey([1, 0]);
    const refs = index.get(key10)!;
    expect(refs[0]).toEqual({
      featureId: "a",
      ringIndex: 0,
      vertexIndex: 1,
    });
  });
});

describe("cascadeMoveVertex", () => {
  it("moves a shared vertex in both features", () => {
    const index = buildTopologyIndex([
      { id: "a", geometry: SQUARE_A },
      { id: "b", geometry: SQUARE_B },
    ]);
    const geometries = new Map([
      ["a", structuredClone(SQUARE_A) as Polygon],
      ["b", structuredClone(SQUARE_B) as Polygon],
    ]);

    const oldKey = vkey([1, 0]); // shared vertex
    const newCoord = [1.1, 0.05];
    const updated = cascadeMoveVertex(index, geometries, oldKey, newCoord);

    expect(updated.size).toBe(2);

    // Check that both geometries have the new coordinate
    const geoA = updated.get("a")!;
    const geoB = updated.get("b")!;

    // In A, (1,0) was vertex index 1
    expect(geoA.coordinates[0]![1]).toEqual([1.1, 0.05]);
    // Non-shared vertices unchanged
    expect(geoA.coordinates[0]![0]).toEqual([0, 0]);
    expect(geoA.coordinates[0]![2]).toEqual([1, 1]);
    expect(geoA.coordinates[0]![3]).toEqual([0, 1]);

    // In B, (1,0) was vertex index 0 — ring closure should also update
    expect(geoB.coordinates[0]![0]).toEqual([1.1, 0.05]);
    expect(geoB.coordinates[0]![4]).toEqual([1.1, 0.05]); // closing vertex
    // Non-shared vertices unchanged
    expect(geoB.coordinates[0]![1]).toEqual([2, 0]);
    expect(geoB.coordinates[0]![2]).toEqual([2, 1]);
  });

  it("returns empty map when oldKey has no refs", () => {
    const index = buildTopologyIndex([{ id: "a", geometry: SQUARE_A }]);
    const geometries = new Map([["a", structuredClone(SQUARE_A) as Polygon]]);

    const updated = cascadeMoveVertex(index, geometries, vkey([99, 99]), [100, 100]);
    expect(updated.size).toBe(0);
  });

  it("updates the topology index after a move", () => {
    const index = buildTopologyIndex([
      { id: "a", geometry: SQUARE_A },
      { id: "b", geometry: SQUARE_B },
    ]);
    const geometries = new Map([
      ["a", structuredClone(SQUARE_A) as Polygon],
      ["b", structuredClone(SQUARE_B) as Polygon],
    ]);

    const oldKey = vkey([1, 0]);
    const newCoord = [1.5, 0.5];
    cascadeMoveVertex(index, geometries, oldKey, newCoord);

    // Old key should be gone
    expect(index.has(oldKey)).toBe(false);
    // New key should have both refs
    const newKey = vkey(newCoord);
    expect(index.get(newKey)!.length).toBe(2);
  });

  it("handles a non-shared vertex (only one feature updated)", () => {
    const index = buildTopologyIndex([
      { id: "a", geometry: SQUARE_A },
      { id: "b", geometry: SQUARE_B },
    ]);
    const geometries = new Map([
      ["a", structuredClone(SQUARE_A) as Polygon],
      ["b", structuredClone(SQUARE_B) as Polygon],
    ]);

    // (0,0) is only in feature "a"
    const oldKey = vkey([0, 0]);
    const updated = cascadeMoveVertex(index, geometries, oldKey, [-0.1, -0.1]);

    expect(updated.size).toBe(1);
    expect(updated.has("a")).toBe(true);
    expect(updated.has("b")).toBe(false);

    // Verify the move
    const geoA = updated.get("a")!;
    expect(geoA.coordinates[0]![0]).toEqual([-0.1, -0.1]);
    // Ring closure: first vertex moved, so last should also move
    expect(geoA.coordinates[0]![4]).toEqual([-0.1, -0.1]);
  });
});

describe("cascadeMoveVertex ring-level copies", () => {
  // Two polygons; the first has a hole. Rings: [0] A outer, [1] A hole, [2] B outer.
  const MULTI: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [2, 2],
          [2, 4],
          [4, 4],
          [4, 2],
          [2, 2],
        ],
      ],
      [
        [
          [20, 0],
          [30, 0],
          [30, 10],
          [20, 10],
          [20, 0],
        ],
      ],
    ],
  };

  const move = (geometry: MultiPolygon, ringIndex: number, vertexIndex: number, to: number[]) => {
    const key = vkey(to);
    const refs = [{ featureId: "m", ringIndex, vertexIndex }];
    return cascadeMoveVertex(new Map([[key, refs]]), new Map([["m", geometry]]), key, to).get(
      "m"
    ) as MultiPolygon;
  };

  it("copies only the touched ring; every other ring keeps its identity", () => {
    const result = move(MULTI, 2, 1, [31, 1]);

    expect(result.coordinates[0]![0]).toBe(MULTI.coordinates[0]![0]);
    expect(result.coordinates[0]![1]).toBe(MULTI.coordinates[0]![1]);
    expect(result.coordinates[1]![0]).not.toBe(MULTI.coordinates[1]![0]);
    expect(result.coordinates[1]![0]![1]).toEqual([31, 1]);
  });

  it("leaves the input geometry untouched", () => {
    const before = JSON.stringify(MULTI);
    move(MULTI, 0, 0, [-1, -1]);
    expect(JSON.stringify(MULTI)).toBe(before);
  });

  it("copies a ring once when several refs of one feature land in it", () => {
    const key = vkey([0, 0]);
    // The same coordinate is both the first and the closing vertex of the ring
    const refs = [
      { featureId: "m", ringIndex: 0, vertexIndex: 0 },
      { featureId: "m", ringIndex: 0, vertexIndex: 4 },
    ];
    const result = cascadeMoveVertex(
      new Map([[key, refs]]),
      new Map([["m", MULTI]]),
      key,
      [-5, -5]
    ).get("m") as MultiPolygon;

    expect(result.coordinates[0]![0]![0]).toEqual([-5, -5]);
    expect(result.coordinates[0]![0]![4]).toEqual([-5, -5]);
    expect(result.coordinates[0]![1]).toBe(MULTI.coordinates[0]![1]);
  });

  it("shares the unmoved vertices of the touched ring with the input", () => {
    const result = move(MULTI, 0, 0, [-1, -1]);
    expect(result.coordinates[0]![0]![1]).toBe(MULTI.coordinates[0]![0]![1]);
  });

  it("works on a Polygon without altering its ring array", () => {
    const poly = structuredClone(SQUARE_A);
    const key = vkey([1, 1]);
    const out = cascadeMoveVertex(
      new Map([[key, [{ featureId: "a", ringIndex: 0, vertexIndex: 2 }]]]),
      new Map([["a", poly]]),
      key,
      [1.2, 1.2]
    ).get("a") as Polygon;
    expect(out.coordinates).not.toBe(poly.coordinates);
    expect(poly.coordinates[0]![2]).toEqual([1, 1]);
    expect(out.coordinates[0]![2]).toEqual([1.2, 1.2]);
  });
});
