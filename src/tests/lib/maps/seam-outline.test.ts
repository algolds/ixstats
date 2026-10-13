/**
 * The draft's political outline: every polygon edge but the antimeridian cut, which the globe would draw across the land.
 */

import type { FeatureCollection } from "geojson";
import { seamlessOutline } from "~/lib/maps/seam-outline";

const square = (coordinates: number[][][]): FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "A" }, geometry: { type: "Polygon", coordinates } },
  ],
});

describe("seamlessOutline", () => {
  it("keeps every edge of a polygon away from the antimeridian, closed", () => {
    const ring = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const out = seamlessOutline(square([ring]));
    expect(out.features[0]!.geometry.coordinates).toEqual([ring]);
    expect(out.features[0]!.properties).toEqual({ name: "A" });
  });

  it("drops the edge along +180 and the edge along -180, keeping the rest", () => {
    const east = [
      [170, 0],
      [180, 0],
      [180, 10],
      [170, 10],
      [170, 0],
    ];
    const west = [
      [-180, 0],
      [-170, 0],
      [-170, 10],
      [-180, 10],
      [-180, 0],
    ];
    const [eastLines, westLines] = [east, west].map(
      (ring) => seamlessOutline(square([ring])).features[0]!.geometry.coordinates
    );
    expect(eastLines).toEqual([
      [
        [170, 0],
        [180, 0],
      ],
      [
        [180, 10],
        [170, 10],
        [170, 0],
      ],
    ]);
    expect(westLines).toEqual([
      [
        [-180, 0],
        [-170, 0],
        [-170, 10],
        [-180, 10],
      ],
    ]);
  });

  it("treats a vertex within a thousandth of a degree of the seam as on it, and keeps an edge that crosses no seam", () => {
    const ring = [
      [179.9995, 0],
      [179.9999, 5],
      [175, 5],
      [179.9995, 0],
    ];
    expect(seamlessOutline(square([ring])).features[0]!.geometry.coordinates).toEqual([
      [
        [179.9999, 5],
        [175, 5],
        [179.9995, 0],
      ],
    ]);
  });

  it("outlines a MultiPolygon's holes and parts, and skips other geometry", () => {
    const out = seamlessOutline({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [0, 0],
                  [4, 0],
                  [4, 4],
                  [0, 0],
                ],
                [
                  [1, 1],
                  [2, 1],
                  [2, 2],
                  [1, 1],
                ],
              ],
              [
                [
                  [5, 5],
                  [6, 5],
                  [6, 6],
                  [5, 5],
                ],
              ],
            ],
          },
        },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
      ],
    });
    expect(out.features).toHaveLength(1);
    expect(out.features[0]!.geometry.coordinates).toHaveLength(3);
  });
});
