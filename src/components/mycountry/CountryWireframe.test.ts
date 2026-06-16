import { extractRings } from "./CountryWireframe";
import type { Geometry } from "geojson";

describe("extractRings", () => {
  it("returns [] for null / unsupported geometry", () => {
    expect(extractRings(null)).toEqual([]);
    expect(extractRings({ type: "Point", coordinates: [0, 0] } as Geometry)).toEqual([]);
  });

  it("flattens a Polygon into its rings", () => {
    const geo: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const rings = extractRings(geo);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    expect(rings[0][1]).toEqual([1, 0]);
  });

  it("flattens a MultiPolygon into all rings of all polygons", () => {
    const geo: Geometry = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [1, 0], [0, 0]]],
        [
          [[5, 5], [6, 5], [5, 5]],
          [[5.2, 5.2], [5.3, 5.2], [5.2, 5.2]],
        ],
      ],
    };
    expect(extractRings(geo)).toHaveLength(3);
  });
});
