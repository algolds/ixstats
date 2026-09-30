import {
  findNearestBorderRing,
  snapGeometryToBorder,
} from "~/lib/maps/province-importer/alignment";
import { findClosestPointOnBoundary } from "~/lib/maps/province-importer/topology";
import type { Polygon, MultiPolygon } from "geojson";

describe("alignment optimization tests", () => {
  const squareBorder: Polygon = {
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

  const islandBorder: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: [
      // Main island
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ],
      // Sub island
      [
        [
          [20, 20],
          [22, 20],
          [22, 22],
          [20, 22],
          [20, 20],
        ],
      ],
    ],
  };

  it("findNearestBorderRing correctly identifies the closest island ring", () => {
    // A province located close to the main island
    const provinceNearMain: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
          [1, 1],
        ],
      ],
    };
    const ringNearMain = findNearestBorderRing(provinceNearMain, islandBorder);
    expect(ringNearMain[0]).toEqual([0, 0]);

    // A province located close to the sub island
    const provinceNearSub: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [20.5, 20.5],
          [21.5, 20.5],
          [21.5, 21.5],
          [20.5, 21.5],
          [20.5, 20.5],
        ],
      ],
    };
    const ringNearSub = findNearestBorderRing(provinceNearSub, islandBorder);
    expect(ringNearSub[0]).toEqual([20, 20]);
  });

  it("findClosestPointOnBoundary correctly finds nearest boundary point", () => {
    // Point [5, -1] is closest to segment [0,0]-[10,0] at [5,0]
    const p1: [number, number] = [5, -1];
    const closest1 = findClosestPointOnBoundary(p1, squareBorder);
    expect(closest1).toEqual([5, 0]);

    // Point [11, 5] is closest to segment [10,0]-[10,10] at [10,5]
    const p2: [number, number] = [11, 5];
    const closest2 = findClosestPointOnBoundary(p2, squareBorder);
    expect(closest2).toEqual([10, 5]);
  });

  it("snapGeometryToBorder snaps geometry correctly", () => {
    // Define target border edges
    const borderEdges: Array<[[number, number], [number, number]]> = [
      [
        [0, 0],
        [10, 0],
      ],
      [
        [10, 0],
        [10, 10],
      ],
      [
        [10, 10],
        [0, 10],
      ],
      [
        [0, 10],
        [0, 0],
      ],
    ];
    const borderRing = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];

    // A province shape that slightly goes outside the border (e.g. at longitude 10.01)
    const provinceGeom: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [2, 2],
          [10.01, 2],
          [10.01, 8],
          [2, 8],
          [2, 2],
        ],
      ],
    };

    const snapped = snapGeometryToBorder(provinceGeom, borderEdges, borderRing, 0.05);
    // The point [10.01, 2] should be snapped to [10, 2] since 0.01 <= tolerance (0.05)
    // The point [10.01, 8] should be snapped to [10, 8]
    expect(snapped.type).toBe("Polygon");
    const snappedRing = snapped.coordinates[0]!;
    expect(snappedRing[1]).toEqual([10, 2]);
    expect(snappedRing[2]).toEqual([10, 8]);
  });
});
