import type { Geometry, MultiPolygon, Polygon, Position } from "geojson";

/**
 * Reduce a geometry to a Polygon or MultiPolygon, dropping line strings, points and other
 * non-polygon parts of a GeometryCollection (as returned by PostGIS and turf clipping). Null
 * when no polygon remains.
 */
export function toPolygonal(
  geometry:
    Geometry | { type: string; coordinates?: any; geometries?: Geometry[] } | null | undefined
): Polygon | MultiPolygon | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return geometry as Polygon | MultiPolygon;
  }
  if (geometry.type !== "GeometryCollection") return null;

  const polygons: Position[][][] = [];
  for (const g of ("geometries" in geometry && geometry.geometries) || []) {
    if (g.type === "Polygon") polygons.push(g.coordinates);
    else if (g.type === "MultiPolygon") polygons.push(...g.coordinates);
  }
  if (polygons.length === 0) return null;
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0]! }
    : { type: "MultiPolygon", coordinates: polygons };
}
