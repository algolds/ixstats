import { polygonMetrics } from "~/lib/maps/feature-metrics";

describe("polygonMetrics", () => {
  it("measures a polygon's rings: centroid, bounding box and approximate area", () => {
    const metrics = polygonMetrics({
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
    });
    expect(metrics).toMatchObject({ centroid: [4, 4], boundingBox: [0, 0, 10, 10] });
    expect(metrics!.areaSqKm).toBeGreaterThan(1_000_000);
  });

  it("measures every polygon of a multipolygon", () => {
    const metrics = polygonMetrics({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
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
    });
    expect(metrics!.boundingBox).toEqual([0, 0, 6, 6]);
  });

  it("has nothing to measure for points, lines or no geometry", () => {
    expect(polygonMetrics({ type: "Point", coordinates: [1, 1] })).toBeNull();
    expect(polygonMetrics(null)).toBeNull();
  });
});
