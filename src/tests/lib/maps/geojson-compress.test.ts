import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { compressFeatureCollection } from "~/lib/maps/geojson-compress";

/** A closed ring of `n` points on a circle: dense enough that any tolerance above 0.001 removes some. */
function circle(cx: number, cy: number, radius: number, n: number): Position[] {
  const ring: Position[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    ring.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  ring.push([...ring[0]!]);
  return ring;
}

/** Three collinear points: a ring with no area, which turf's cleanCoords rejects. */
const SLIVER: Position[] = [
  [5, 5],
  [6, 6],
  [7, 7],
  [5, 5],
];

const feature = (geometry: Polygon | MultiPolygon): Feature => ({
  type: "Feature",
  properties: { name: "x" },
  geometry,
});

const OPTIONS = { simplifyTolerance: 0.05, coordinatePrecision: 4 };

const ringsOf = (geometry: Polygon | MultiPolygon): Position[][] =>
  geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();

describe("compressFeatureCollection", () => {
  it("simplifies a polygon whose hole is degenerate, rather than keeping it whole", () => {
    const outer = circle(0, 0, 1, 360);
    const input = feature({ type: "Polygon", coordinates: [outer, SLIVER] });

    const out = compressFeatureCollection(
      { type: "FeatureCollection", features: [input] },
      OPTIONS
    );
    const rings = ringsOf(out.features[0]!.geometry as Polygon);

    expect(rings[0]!.length).toBeLessThan(outer.length / 4);
    // only the ring turf rejects stays as it was
    expect(rings[1]).toEqual(SLIVER);
  });

  it("simplifies the good polygons of a multipolygon that also holds a degenerate one", () => {
    const first = circle(0, 0, 1, 360);
    const second = circle(10, 10, 1, 360);
    const input = feature({
      type: "MultiPolygon",
      coordinates: [[first], [SLIVER], [second]],
    });

    const out = compressFeatureCollection(
      { type: "FeatureCollection", features: [input] },
      OPTIONS
    );
    const polygons = (out.features[0]!.geometry as MultiPolygon).coordinates;

    expect(polygons).toHaveLength(3);
    expect(polygons[0]![0]!.length).toBeLessThan(first.length / 4);
    expect(polygons[1]![0]).toEqual(SLIVER);
    expect(polygons[2]![0]!.length).toBeLessThan(second.length / 4);
  });

  it("gives the same result as before for geometry turf accepts", () => {
    const ring = circle(0, 0, 1, 360);
    const out = compressFeatureCollection(
      { type: "FeatureCollection", features: [feature({ type: "Polygon", coordinates: [ring] })] },
      OPTIONS
    );
    const simplified = (out.features[0]!.geometry as Polygon).coordinates[0]!;

    expect(simplified.length).toBeGreaterThan(8);
    expect(simplified[0]).toEqual(simplified[simplified.length - 1]);
  });

  it("leaves a feature the caller already simplified at its vertices, truncating only", () => {
    const ring = circle(0, 0, 1, 360);
    const done = feature({ type: "Polygon", coordinates: [ring] });
    const other = feature({ type: "Polygon", coordinates: [circle(10, 10, 1, 360)] });

    const out = compressFeatureCollection(
      { type: "FeatureCollection", features: [done, other] },
      OPTIONS,
      (f) => f === done
    );
    const kept = (out.features[0]!.geometry as Polygon).coordinates[0]!;
    const simplified = (out.features[1]!.geometry as Polygon).coordinates[0]!;

    expect(kept).toHaveLength(ring.length);
    expect(kept[1]).toEqual(ring[1]!.map((n) => Math.round(n * 1e4) / 1e4));
    expect(simplified.length).toBeLessThan(ring.length / 4);
  });
});
