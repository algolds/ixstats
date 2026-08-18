/**
 * Map Utility Functions
 *
 * Antimeridian splitting, GeoJSON helpers, and spatial utilities
 * for the IxEarth fictional world map.
 */

import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

// ──────────────────────────────────────────────
// Antimeridian splitting
// ──────────────────────────────────────────────

/**
 * Interpolate the latitude where a segment crosses lng=180.
 */
function interpolateAtMeridian(a: [number, number], b: [number, number]): [number, number] {
  const t = (180 - a[0]) / (b[0] - a[0]);
  return [180, a[1] + t * (b[1] - a[1])];
}

/**
 * Clip a polygon ring using the Sutherland-Hodgman algorithm
 * against the line lng=180, keeping the specified side.
 * side="left" keeps lng <= 180, side="right" keeps lng >= 180.
 */
function clipRing(ring: Position[], side: "left" | "right"): Position[] {
  const result: Position[] = [];
  const inside = (lng: number) => (side === "left" ? lng <= 180 : lng >= 180);

  for (let i = 0; i < ring.length; i++) {
    const curr = ring[i] as [number, number];
    const prev = ring[(i + ring.length - 1) % ring.length] as [number, number];
    const currIn = inside(curr[0]);
    const prevIn = inside(prev[0]);

    if (currIn) {
      if (!prevIn) {
        // Entering: add intersection then current
        result.push(interpolateAtMeridian(prev, curr));
      }
      result.push(curr);
    } else if (prevIn) {
      // Leaving: add intersection
      result.push(interpolateAtMeridian(prev, curr));
    }
  }

  // Close the ring
  if (result.length > 0) {
    const first = result[0];
    const last = result[result.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      result.push([...first]);
    }
  }

  return result;
}

/**
 * Check if a ring crosses the antimeridian. Handles two cases:
 * 1. Raw data: coordinates > 180
 * 2. Pre-normalized data: consecutive coords jump from ~180 to ~-180
 */
function ringCrossesAntimeridian(ring: Position[]): boolean {
  for (let i = 0; i < ring.length; i++) {
    if (ring[i][0] > 180) return true;
    const next = ring[(i + 1) % ring.length];
    if (Math.abs(ring[i][0] - next[0]) > 180) return true;
  }
  return false;
}

/**
 * Unwrap a ring so all coordinates are continuous (no jumps across antimeridian).
 * Each coordinate is adjusted to be within 180° of its predecessor.
 * E.g. [179, 180, -179.7] → [179, 180, 180.3]
 */
function unwrapRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;
  const result: Position[] = [ring[0]];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0] + offset;
    const prevLng = result[i - 1][0];
    // Adjust so lng is within 180° of previous unwrapped coordinate
    while (lng - prevLng > 180) lng -= 360;
    while (prevLng - lng > 180) lng += 360;
    offset = lng - ring[i][0];
    result.push([lng, ring[i][1], ...ring[i].slice(2)] as Position);
  }
  return result;
}

/**
 * Split a single Polygon's rings at the antimeridian.
 * Handles both raw (lng > 180) and pre-normalized (jumps across ±180) data.
 * Returns an array of Polygon coordinate sets (may be 1 or 2).
 */
function splitPolygonRings(rings: Position[][]): Position[][][] {
  if (!rings.some(ringCrossesAntimeridian)) {
    return [rings];
  }

  // First unwrap so all coordinates are continuous
  const unwrapped = rings.map(unwrapRing);

  // Clip to the left side (lng <= 180)
  const leftRings = unwrapped.map((ring) => clipRing(ring, "left")).filter((r) => r.length >= 4);

  // Clip to the right side (lng >= 180), then shift by -360
  const rightRings = unwrapped
    .map((ring) => {
      const clipped = clipRing(ring, "right");
      return clipped.map((c) => [c[0] - 360, c[1], ...c.slice(2)] as Position);
    })
    .filter((r) => r.length >= 4);

  const result: Position[][][] = [];
  if (leftRings.length > 0) result.push(leftRings);
  if (rightRings.length > 0) result.push(rightRings);

  return result.length > 0 ? result : [rings];
}

/**
 * Split a GeoJSON Feature at the antimeridian (lng=180).
 * Polygons that cross 180° are split into MultiPolygons with
 * one part on each side. This prevents rendering artifacts in MapLibre.
 */
export function splitFeatureAtAntimeridian(feature: Feature): Feature[] {
  const geom = feature.geometry;

  if (geom.type === "Polygon") {
    const parts = splitPolygonRings(geom.coordinates);
    // Always use the unwrapped/clipped geometry — even when only 1 part,
    // the coordinates may have been fixed (e.g. jumps from -180 to +180 unwrapped)
    return parts.map((rings) => ({
      ...feature,
      geometry: { type: "Polygon" as const, coordinates: rings },
    }));
  }

  if (geom.type === "MultiPolygon") {
    const allParts: Position[][][] = [];
    for (const polygon of geom.coordinates) {
      allParts.push(...splitPolygonRings(polygon));
    }
    return [
      {
        ...feature,
        geometry: { type: "MultiPolygon" as const, coordinates: allParts },
      },
    ];
  }

  // Other geometry types: return as-is
  return [feature];
}

/**
 * Split all features in a FeatureCollection at the antimeridian.
 */
export function splitCollectionAtAntimeridian(fc: FeatureCollection): FeatureCollection {
  return {
    ...fc,
    features: fc.features.flatMap(splitFeatureAtAntimeridian),
  };
}

/**
 * Convert a feature ID from GeoJSON format to display name.
 * "New_Harren" -> "New Harren"
 * "Chenango_Confederacy" -> "Chenango Confederacy"
 */
export function featureIdToDisplayName(id: string): string {
  return id.replace(/_/g, " ");
}

/**
 * Convert a display name to feature ID format.
 * "New Harren" -> "New_Harren"
 */
export function displayNameToFeatureId(name: string): string {
  return name.replace(/ /g, "_");
}

/**
 * Calculate the centroid of a GeoJSON feature geometry.
 * Simple average of all coordinates (sufficient for display purposes).
 */
export function calculateSimpleCentroid(geometry: Geometry): [number, number] | null {
  const coords: Position[] = [];

  function extractCoords(c: unknown): void {
    if (!Array.isArray(c)) return;
    if (c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      coords.push(c as Position);
      return;
    }
    for (const item of c) {
      extractCoords(item);
    }
  }

  extractCoords((geometry as Geometry & { coordinates: unknown }).coordinates);

  if (coords.length === 0) return null;

  const sumLng = coords.reduce((s, c) => s + c[0], 0);
  const sumLat = coords.reduce((s, c) => s + c[1], 0);

  return [sumLng / coords.length, sumLat / coords.length];
}

/**
 * Calculate bounding box of a geometry.
 * Returns [minLng, minLat, maxLng, maxLat].
 */
export function calculateBBox(geometry: Geometry): [number, number, number, number] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function scan(c: unknown): void {
    if (!Array.isArray(c)) return;
    if (c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      minLng = Math.min(minLng, c[0] as number);
      minLat = Math.min(minLat, c[1] as number);
      maxLng = Math.max(maxLng, c[0] as number);
      maxLat = Math.max(maxLat, c[1] as number);
      return;
    }
    for (const item of c) {
      scan(item);
    }
  }

  scan((geometry as Geometry & { coordinates: unknown }).coordinates);

  if (minLng === Infinity) return null;
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Assign a stable color to each political feature based on its ID.
 * Uses the fill property from GeoJSON if available, otherwise generates
 * a pastel color from a predefined palette.
 */
export function getFeatureFillColor(feature: Feature, fallbackPalette: string[]): string {
  const fill = feature.properties?.fill;
  if (fill && fill !== "#ffffff") {
    return fill;
  }

  // Generate from feature ID
  const id = feature.properties?.id || feature.id || "";
  let hash = 0;
  for (let i = 0; i < String(id).length; i++) {
    hash = String(id).charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return fallbackPalette[Math.abs(hash) % fallbackPalette.length];
}

/**
 * Prepare a political FeatureCollection for MapLibre rendering.
 * - Splits features at the antimeridian to prevent wrapping artifacts
 * - Assigns fill colors and display names
 */
export function preparePoliticalFeatures(
  fc: FeatureCollection,
  colorPalette: string[]
): FeatureCollection {
  const split = splitCollectionAtAntimeridian(fc);

  return {
    ...split,
    features: split.features.map((feature, index) => {
      const id = feature.properties?.id || `feature-${index}`;
      const displayName = featureIdToDisplayName(id);
      const fillColor = getFeatureFillColor(feature, colorPalette);
      const centroid = calculateSimpleCentroid(feature.geometry);

      return {
        ...feature,
        id: index,
        properties: {
          ...feature.properties,
          _id: id,
          _displayName: displayName,
          _fillColor: fillColor,
          _centroidLng: centroid?.[0] ?? 0,
          _centroidLat: centroid?.[1] ?? 0,
        },
      };
    }),
  };
}
