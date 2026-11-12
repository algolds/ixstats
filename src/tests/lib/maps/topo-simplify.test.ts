import { polygon } from "@turf/helpers";
import { kinks } from "@turf/kinks";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { simplifyProvinceBatch } from "~/lib/maps/province-importer/topo-simplify";

// A bowtie, one ring crossing itself at (0.5, 0.5), with 100 points per edge so the batch
// simplifies it (a province already under target is returned untouched, unrepaired).
const corners = [
  [0, 0],
  [1, 1],
  [1, 0],
  [0, 1],
];
const ring = corners.flatMap(([x0, y0], i) => {
  const [x1, y1] = corners[(i + 1) % corners.length]!;
  return Array.from({ length: 100 }, (_, k) => [
    x0! + ((x1! - x0!) * k) / 100,
    y0! + ((y1! - y0!) * k) / 100,
  ]);
});
const bowtie: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "Bowtie" },
  geometry: { type: "Polygon", coordinates: [[...ring, ring[0]!]] },
};

describe("simplifyProvinceBatch", () => {
  it("splits a self-intersecting ring into simple parts", () => {
    const geometry = simplifyProvinceBatch([bowtie]).features[0]!.geometry;
    expect(geometry.type).toBe("MultiPolygon");
    const parts = (geometry as MultiPolygon).coordinates;
    expect(parts).toHaveLength(2);
    for (const coordinates of parts) {
      expect(kinks(polygon(coordinates)).features).toHaveLength(0);
    }
  });
});
