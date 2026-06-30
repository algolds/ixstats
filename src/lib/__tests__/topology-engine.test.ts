import type { Polygon } from "geojson";
import { vkey, buildTopologyIndex, cascadeMoveVertex } from "../topology-engine";

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
      ["a", JSON.parse(JSON.stringify(SQUARE_A)) as Polygon],
      ["b", JSON.parse(JSON.stringify(SQUARE_B)) as Polygon],
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
    const geometries = new Map([["a", JSON.parse(JSON.stringify(SQUARE_A)) as Polygon]]);

    const updated = cascadeMoveVertex(index, geometries, vkey([99, 99]), [100, 100]);
    expect(updated.size).toBe(0);
  });

  it("updates the topology index after a move", () => {
    const index = buildTopologyIndex([
      { id: "a", geometry: SQUARE_A },
      { id: "b", geometry: SQUARE_B },
    ]);
    const geometries = new Map([
      ["a", JSON.parse(JSON.stringify(SQUARE_A)) as Polygon],
      ["b", JSON.parse(JSON.stringify(SQUARE_B)) as Polygon],
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
      ["a", JSON.parse(JSON.stringify(SQUARE_A)) as Polygon],
      ["b", JSON.parse(JSON.stringify(SQUARE_B)) as Polygon],
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
