import type { Geometry } from "geojson";
import { polygonAreaSqKm, ringAreaSqKm } from "~/lib/maps/planet";

/** Recursively extract all [lng, lat] positions from a GeoJSON geometry */
export function extractAllPositions(geometry: Geometry): [number, number][] {
  const positions: [number, number][] = [];
  function scan(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      positions.push([coords[0] as number, coords[1] as number]);
      return;
    }
    for (const c of coords) scan(c);
  }
  if ("coordinates" in geometry) {
    scan((geometry as { coordinates: unknown }).coordinates);
  }
  return positions;
}

/** A ring closed if needed, or null when it has too few points to enclose anything. */
function closedRing(ring: [number, number][]): [number, number][] | null {
  if (ring.length < 3) return null;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] !== last[0] || first[1] !== last[1] ? [...ring, [first[0], first[1]]] : ring;
}

/** A polygon's rings closed, with too-short rings left out (a polygon with no outer ring is empty). */
function closedPolygon(rings: [number, number][][]): [number, number][][] {
  const closed = rings.map(closedRing);
  return closed[0] ? closed.filter((ring): ring is [number, number][] => ring !== null) : [];
}

/**
 * Approximate area in square kilometers using the Shoelace formula
 * with a latitude-dependent scaling factor. Polygon holes are subtracted;
 * a line's rings are measured as if closed.
 */
export function computeApproxAreaForFeature(geometry: Geometry): number {
  try {
    let totalArea = 0;
    if (geometry.type === "Polygon") {
      totalArea = polygonAreaSqKm(closedPolygon(geometry.coordinates as [number, number][][]));
    } else if (geometry.type === "MultiPolygon") {
      totalArea = (geometry.coordinates as [number, number][][][]).reduce(
        (sum, polygon) => sum + polygonAreaSqKm(closedPolygon(polygon)),
        0
      );
    } else if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      const lines =
        geometry.type === "LineString"
          ? [geometry.coordinates as [number, number][]]
          : (geometry.coordinates as [number, number][][]);
      for (const line of lines) {
        const ring = closedRing(line);
        if (ring) totalArea += ringAreaSqKm(ring);
      }
    }
    return Math.round(totalArea * 100) / 100;
  } catch {
    return 0;
  }
}

/**
 * Compute the visual center of a polygon ring (approximate center of its bounding box).
 * Handles antimeridian wrapping by normalizing longitudes.
 */
export function computeVisualCenter(geometry: any): [number, number] {
  const rings: number[][][] = [];
  const geomType = geometry?.type;
  const coords = geometry?.coordinates;
  if (geomType === "Polygon" && coords) {
    rings.push(coords[0]);
  } else if (geomType === "MultiPolygon" && coords) {
    for (const poly of coords) rings.push(poly[0]);
  }
  if (rings.length === 0) return [0, 0];

  let largestRing = rings[0];
  for (let i = 1; i < rings.length; i++) {
    if (rings[i].length > largestRing.length) largestRing = rings[i];
  }

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of largestRing) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Handle antimeridian wrap: if bbox width > 300deg, it likely wraps
  if (maxLng - minLng > 300) {
    minLng = Infinity;
    maxLng = -Infinity;
    for (const [lng] of largestRing) {
      const norm = lng < 0 ? lng + 360 : lng;
      if (norm < minLng) minLng = norm;
      if (norm > maxLng) maxLng = norm;
    }
    let centerLng = (minLng + maxLng) / 2;
    if (centerLng > 180) centerLng -= 360;
    return [centerLng, (minLat + maxLat) / 2];
  }

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

/**
 * Estimate the fractional overlap between a GeoJSON geometry and a bounding box.
 * Returns 0–1 representing approximate area overlap.
 * This is a rough heuristic; PostGIS ST_Intersection would be precise.
 */
export function estimateBboxOverlap(
  geometry: import("geojson").Geometry,
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): number {
  // Extract coordinates to compute feature bbox
  const coords = extractCoords(geometry);
  if (coords.length === 0) return 0;

  let fMinLng = Infinity,
    fMinLat = Infinity,
    fMaxLng = -Infinity,
    fMaxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < fMinLng) fMinLng = lng;
    if (lng > fMaxLng) fMaxLng = lng;
    if (lat < fMinLat) fMinLat = lat;
    if (lat > fMaxLat) fMaxLat = lat;
  }

  // Compute intersection of the two bboxes
  const iMinLng = Math.max(minLng, fMinLng);
  const iMinLat = Math.max(minLat, fMinLat);
  const iMaxLng = Math.min(maxLng, fMaxLng);
  const iMaxLat = Math.min(maxLat, fMaxLat);

  if (iMinLng >= iMaxLng || iMinLat >= iMaxLat) return 0;

  const iArea = (iMaxLng - iMinLng) * (iMaxLat - iMinLat);
  const fArea = (fMaxLng - fMinLng) * (fMaxLat - fMinLat);

  if (fArea <= 0) return 0;
  return Math.min(1, iArea / fArea);
}

/** Extract all coordinate pairs from a GeoJSON geometry (first 200 for performance). */
function extractCoords(geometry: import("geojson").Geometry): [number, number][] {
  const result: [number, number][] = [];
  const limit = 200;

  function walk(coords: any): void {
    if (result.length >= limit) return;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      result.push([coords[0] as number, coords[1] as number]);
    } else {
      for (const c of coords) walk(c);
    }
  }

  if ("coordinates" in geometry) walk(geometry.coordinates);
  return result;
}

/** Centroid stored as [lng, lat] or { coordinates: [lng, lat] } (GeoJSON Point); [0, 0] when absent. */
export function centroidLngLat(raw: unknown): [number, number] {
  const centroid = raw as [number, number] | { coordinates?: [number, number] } | null;
  if (Array.isArray(centroid) && centroid.length >= 2) return [centroid[0], centroid[1]];
  if (centroid && "coordinates" in centroid && Array.isArray(centroid.coordinates)) {
    return [centroid.coordinates[0], centroid.coordinates[1]];
  }
  return [0, 0];
}

/** Percentile rank (0-1, ties broken by input order) per id so colours distribute evenly. */
export function percentileRanks(items: Array<{ id: string; value: number }>) {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  return new Map(
    sorted.map(({ id }, i) => [id, sorted.length > 1 ? i / (sorted.length - 1) : 0.5])
  );
}
