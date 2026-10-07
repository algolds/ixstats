/**
 * The per-feature metrics the SVG parser computes (svg/feature-extraction: centroid, bounding box, approximate
 * area with holes subtracted), recomputed from a polygon geometry so an import can persist them.
 */
import type { Geometry, Position } from "geojson";
import {
  calculateBoundingBox,
  calculateCentroid,
  roundedAreaSqKm,
} from "~/lib/flags/svg/topology-flattener";

interface PolygonMetrics {
  centroid: [number, number];
  boundingBox: [number, number, number, number];
  areaSqKm: number;
}

function polygonRings(geometry: Geometry | null | undefined): Position[][] {
  if (geometry?.type === "Polygon") return geometry.coordinates;
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

/** Metrics of a Polygon/MultiPolygon; null for any other geometry (nothing to measure). */
export function polygonMetrics(geometry: Geometry | null | undefined): PolygonMetrics | null {
  const rings = polygonRings(geometry);
  if (rings.length === 0) return null;
  return {
    centroid: calculateCentroid(rings),
    boundingBox: calculateBoundingBox(rings),
    areaSqKm: roundedAreaSqKm(geometry!),
  };
}
