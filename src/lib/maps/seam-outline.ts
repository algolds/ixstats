import type { Feature, FeatureCollection, MultiLineString, Position } from "geojson";

/** Within this of ±180° a vertex is on the antimeridian, where the generator's polygons are cut. */
const SEAM_TOLERANCE = 1e-3;

const onSide = (p: Position, side: number): boolean => Math.abs(p[0]! - side) < SEAM_TOLERANCE;

/** Whether the edge a to b is the antimeridian cut: both ends on the same side of ±180°. */
const isCut = (a: Position, b: Position): boolean =>
  (onSide(a, 180) && onSide(b, 180)) || (onSide(a, -180) && onSide(b, -180));

/** The ring's edges as lines, broken where an edge is the antimeridian cut. */
function ringLines(ring: Position[]): Position[][] {
  const lines: Position[][] = [];
  let line: Position[] = [];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]!;
    const b = ring[i]!;
    if (isCut(a, b)) {
      if (line.length > 1) lines.push(line);
      line = [];
      continue;
    }
    if (line.length === 0) line.push(a);
    line.push(b);
  }
  if (line.length > 1) lines.push(line);
  return lines;
}

/**
 * The polygons' outlines as lines, without the edges where a polygon is cut at the antimeridian. The flat map hides
 * the cut at its edge; on the globe it would be a line drawn across the land from pole to pole.
 */
export function seamlessOutline(collection: FeatureCollection): FeatureCollection<MultiLineString> {
  const features: Feature<MultiLineString>[] = [];
  for (const { geometry, properties } of collection.features) {
    const polygons =
      geometry?.type === "Polygon"
        ? [geometry.coordinates]
        : geometry?.type === "MultiPolygon"
          ? geometry.coordinates
          : [];
    const lines = polygons.flatMap((polygon) => polygon.flatMap(ringLines));
    if (lines.length === 0) continue;
    features.push({
      type: "Feature",
      properties,
      geometry: { type: "MultiLineString", coordinates: lines },
    });
  }
  return { type: "FeatureCollection", features };
}
