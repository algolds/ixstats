import type { Polygon } from "geojson";
import {
  insertVertexIfOnSegment,
  alignSharedVertices,
  getAllRings,
} from "~/lib/maps/border-editor";

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

describe("insertVertexIfOnSegment", () => {
  test("inserts vertex on edge of polygon", () => {
    const sq = square(0, 0, 2, 2);
    // Point lies exactly on top edge (y=2) between (0,2) and (2,2)
    const res = insertVertexIfOnSegment(sq, [1, 2], 1e-7);
    expect(res.modified).toBe(true);
    const ring = getAllRings(res.geometry)[0]!;
    // Should have 6 coordinates: (0,0), (2,0), (2,2), (1,2), (0,2), (0,0)
    expect(ring.length).toBe(6);
    expect(ring[3]).toEqual([1, 2]);
  });

  test("does not insert vertex if not on edge", () => {
    const sq = square(0, 0, 2, 2);
    // Point inside polygon
    const res = insertVertexIfOnSegment(sq, [1, 1], 1e-7);
    expect(res.modified).toBe(false);
  });

  test("does not insert vertex if already at endpoint", () => {
    const sq = square(0, 0, 2, 2);
    // Point exactly at one of the vertices (2,2)
    const res = insertVertexIfOnSegment(sq, [2, 2], 1e-7);
    expect(res.modified).toBe(false);
  });
});

describe("alignSharedVertices", () => {
  test("mutually inserts vertices where boundaries touch edges", () => {
    // A shares boundary with B. B has a vertex on A's boundary edge.
    const geomA = square(0, 0, 2, 2);
    const geomB = {
      type: "Polygon" as const,
      coordinates: [
        [
          [2, 0],
          [4, 0],
          [4, 2],
          [2, 1], // vertex on A's right boundary (x=2, y=0 to y=2)
          [2, 0],
        ],
      ],
    };

    const res = alignSharedVertices(geomA, geomB, 1e-7);
    expect(res.modifiedA).toBe(true); // geomA should have [2, 1] inserted
    expect(res.modifiedB).toBe(false); // geomB already has all of geomA's vertices as outer or endpoints

    const ringA = getAllRings(res.geomA)[0]!;
    expect(ringA.length).toBe(6); // (0,0), (2,0), (2,1), (2,2), (0,2), (0,0)
    expect(ringA[2]).toEqual([2, 1]);
  });
});
