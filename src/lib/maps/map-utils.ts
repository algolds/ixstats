/**
 * Map Utility Functions
 *
 * Antimeridian splitting, GeoJSON helpers, and spatial utilities
 * for the IxEarth fictional world map.
 */

import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

/**
 * Interpolate the latitude where a segment crosses lng=`meridian` (180 unless given).
 */
function interpolateAtMeridian(
  a: [number, number],
  b: [number, number],
  meridian = 180
): [number, number] {
  const t = (meridian - a[0]) / (b[0] - a[0]);
  return [meridian, a[1] + t * (b[1] - a[1])];
}

/**
 * Clip a polygon ring using the Sutherland-Hodgman algorithm
 * against the line lng=`meridian` (180 unless given), keeping the specified side.
 * side="left" keeps lng <= meridian, side="right" keeps lng >= meridian.
 */
function clipRing(ring: Position[], side: "left" | "right", meridian = 180): Position[] {
  const result: Position[] = [];
  const inside = (lng: number) => (side === "left" ? lng <= meridian : lng >= meridian);

  for (let i = 0; i < ring.length; i++) {
    const curr = ring[i] as [number, number];
    const prev = ring[(i + ring.length - 1) % ring.length] as [number, number];
    const currIn = inside(curr[0]);
    const prevIn = inside(prev[0]);

    if (currIn) {
      if (!prevIn) {
        // Entering: add intersection then current
        result.push(interpolateAtMeridian(prev, curr, meridian));
      }
      result.push(curr);
    } else if (prevIn) {
      // Leaving: add intersection
      result.push(interpolateAtMeridian(prev, curr, meridian));
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

/** Below this distance from ±90° a vertex counts as on the pole. */
const POLE_EPSILON = 1e-6;
/** Longest straight edge (degrees) left on a polar cap's cut and pole edges; longer ones get vertices added so they
 * follow the meridian / pole on the globe rather than cutting across it. */
const POLAR_DENSIFY_STEP = 1;

/** The ring's longitude change from one vertex to the next, each step taken the short way round. */
function shortLngStep(from: Position, to: Position): number {
  const d = to[0] - from[0];
  return d > 180 ? d - 360 : d < -180 ? d + 360 : d;
}

/**
 * Whether a ring circles a pole: the longitude it travels, each step taken the short way round, nets ±360° instead
 * of 0. A polar cap stored as a band (crossing ±180 once, closed through a slit up to the pole) is such a ring; the
 * antimeridian splitter can't clip it (unwrapped, it does not close), so it closed the cap along a parallel and
 * left coordinates hundreds of degrees past ±180, which MapLibre draws as smeared bands.
 */
function isPolarRing(ring: Position[]): boolean {
  let net = 0;
  for (let i = 0; i < ring.length - 1; i++) net += shortLngStep(ring[i]!, ring[i + 1]!);
  return Math.abs(net) > 180;
}

/** Adds vertices so no edge of the closed ring is longer than `step` degrees in longitude or latitude. */
function densifyRing(ring: Position[], step: number): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    out.push(a);
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step);
    for (let k = 1; k < n; k++) {
      out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
  }
  if (ring.length > 0) out.push(ring[ring.length - 1]!);
  return out;
}

/** Twice the ring's planar signed area: positive when it runs counter-clockwise. */
function signedArea2(ring: Position[]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return a;
}

/** The ring wound counter-clockwise (RFC 7946 exterior) or clockwise (hole). */
function windRing(ring: Position[], ccw: boolean): Position[] {
  return signedArea2(ring) > 0 === ccw ? ring : [...ring].reverse();
}

/**
 * A polygon whose outer ring circles a pole, as polygons that each lie within [-180, 180]:
 * - vertices on the pole are dropped (the stored ring reaches it through a zero-width slit, a self-intersection);
 * - the remaining ring is unwrapped into one continuous 360° line and closed through the pole itself, along a
 *   densified pole edge and densified meridians;
 * - the cap is cut at ±180 into pieces shifted back into range, each densified (its cut edges run along ±180) and
 *   wound counter-clockwise; holes, wound clockwise, go to the piece holding them.
 */
function splitPolarPolygon(rings: Position[][]): Position[][][] {
  const outer = rings[0]!;
  const closed =
    outer.length > 1 &&
    outer[0]![0] === outer[outer.length - 1]![0] &&
    outer[0]![1] === outer[outer.length - 1]![1];
  const ringVertices = closed ? outer.slice(0, -1) : outer;
  const offPole = ringVertices.filter((c) => Math.abs(c[1]!) < 90 - POLE_EPSILON);
  if (offPole.length < 3) return [rings];

  // The pole the cap holds: the one the stored ring touches, else the side the ring lies on
  const onPole = ringVertices.find((c) => Math.abs(c[1]!) >= 90 - POLE_EPSILON);
  const meanLat = offPole.reduce((sum, c) => sum + c[1]!, 0) / offPole.length;
  const pole = (onPole ? Math.sign(onPole[1]!) : Math.sign(meanLat) || 1) * 90;

  const path = unwrapRing(offPole);
  const first = path[0]!;
  const last = path[path.length - 1]!;
  const endLng = last[0]! + shortLngStep(last, first);
  if (Math.abs(endLng - first[0]!) < 180) return [rings]; // without its pole vertices it no longer circles the pole
  const cap = densifyRing(
    [...path, [endLng, first[1]!], [endLng, pole], [first[0]!, pole], [first[0]!, first[1]!]],
    POLAR_DENSIFY_STEP
  );

  // Shift so the cap starts within [-180, 180), then cut it into 360°-wide windows shifted back into range
  const minLng = Math.min(...cap.map((c) => c[0]!));
  const shift = Math.ceil((-180 - minLng) / 360) * 360;
  const shifted = cap.map((c) => [c[0]! + shift, c[1]!] as Position);
  const maxLng = Math.max(...shifted.map((c) => c[0]!));
  const pieces: Position[][] = [];
  for (let west = -180; west < maxLng; west += 360) {
    const clipped = clipRing(clipRing(shifted, "right", west), "left", west + 360);
    if (clipped.length < 4) continue;
    const back = west + 180;
    const piece = clipped.map((c) => [c[0]! - back, c[1]!] as Position);
    pieces.push(windRing(densifyRing(piece, POLAR_DENSIFY_STEP), true));
  }
  if (pieces.length === 0) return [rings];

  const polygons: Position[][][] = pieces.map((piece) => [piece]);
  for (const hole of rings.slice(1)) {
    for (const [part] of splitPolygonRings([hole])) {
      if (!part || part.length < 4) continue;
      const [lng, lat] = part[0]!;
      const owner =
        polygons.find(([p]) => {
          const lngs = p!.map((c) => c[0]!);
          const lats = p!.map((c) => c[1]!);
          return (
            lng! >= Math.min(...lngs) &&
            lng! <= Math.max(...lngs) &&
            lat! >= Math.min(...lats) &&
            lat! <= Math.max(...lats)
          );
        }) ?? polygons[0]!;
      owner.push(windRing(part, false));
    }
  }
  return polygons;
}

/**
 * Split a single Polygon's rings at the antimeridian.
 * Handles both raw (lng > 180) and pre-normalized (jumps across ±180) data.
 * Returns an array of Polygon coordinate sets (may be 1 or 2).
 */
function splitPolygonRings(rings: Position[][]): Position[][][] {
  if (rings[0] && isPolarRing(rings[0])) {
    return splitPolarPolygon(rings);
  }
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
function splitFeatureAtAntimeridian(feature: Feature): Feature[] {
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
 * Assign a stable color to each political feature based on its ID.
 * Uses the fill property from GeoJSON if available, otherwise generates
 * a pastel color from a predefined palette.
 */
function getFeatureFillColor(feature: Feature, fallbackPalette: string[]): string {
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
