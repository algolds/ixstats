/**
 * Border Editor - Pure geometry operations for political border editing.
 *
 * All functions operate on GeoJSON coordinates (WGS84 [lng, lat]).
 * No React or database dependencies — purely functional.
 */

import type { Position, Polygon, MultiPolygon } from "geojson";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface VertexRef {
  ringIndex: number;
  vertexIndex: number;
  coord: Position;
}

export interface EdgeRef {
  ringIndex: number;
  startIndex: number;
  endIndex: number;
  midpoint: Position;
}

export interface NearestResult<T> {
  ref: T;
  distance: number; // degrees (approximate)
}

export type BorderEditAction =
  | { type: "move_vertex"; ref: VertexRef; to: Position }
  | { type: "add_vertex"; edge: EdgeRef; at: Position }
  | { type: "remove_vertex"; ref: VertexRef }
  | { type: "replace_geometry"; geometry: Polygon | MultiPolygon };

export interface UndoEntry {
  action: BorderEditAction;
  previousGeometry: Polygon | MultiPolygon;
  resultGeometry: Polygon | MultiPolygon;
}

// ──────────────────────────────────────────────
// Ring / Coordinate Helpers
// ──────────────────────────────────────────────

/** Get all rings from a Polygon or MultiPolygon as flat arrays. */
export function getAllRings(geometry: Polygon | MultiPolygon): Position[][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates;
  }
  return geometry.coordinates.flat();
}

/** Rebuild a Polygon/MultiPolygon from modified rings (preserving original structure). */
export function rebuildGeometry(
  original: Polygon | MultiPolygon,
  rings: Position[][]
): Polygon | MultiPolygon {
  if (original.type === "Polygon") {
    return { type: "Polygon", coordinates: rings };
  }

  // Reconstruct MultiPolygon ring groupings
  const result: Position[][][] = [];
  let ringIdx = 0;
  for (const polygon of original.coordinates) {
    const polyRings: Position[][] = [];
    for (let r = 0; r < polygon.length; r++) {
      if (ringIdx < rings.length) {
        polyRings.push(rings[ringIdx]!);
        ringIdx++;
      }
    }
    if (polyRings.length > 0) result.push(polyRings);
  }
  return { type: "MultiPolygon", coordinates: result };
}

// ──────────────────────────────────────────────
// Vertex Operations
// ──────────────────────────────────────────────

/** Get all vertices from a geometry (excluding ring-closing duplicates). */
export function getVertices(geometry: Polygon | MultiPolygon): VertexRef[] {
  const rings = getAllRings(geometry);
  const vertices: VertexRef[] = [];
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri]!;
    // Skip last vertex if it duplicates the first (ring closure)
    const len = isRingClosed(ring) ? ring.length - 1 : ring.length;
    for (let vi = 0; vi < len; vi++) {
      vertices.push({ ringIndex: ri, vertexIndex: vi, coord: ring[vi]! });
    }
  }
  return vertices;
}

/** Move a vertex to a new position, returning new geometry. */
export function moveVertex(
  geometry: Polygon | MultiPolygon,
  ref: VertexRef,
  to: Position
): Polygon | MultiPolygon {
  const rings = getAllRings(geometry).map((r) => [...r.map((c) => [...c])]);
  const ring = rings[ref.ringIndex];
  if (!ring) return geometry;

  ring[ref.vertexIndex] = to;

  // If this is the first vertex and ring is closed, update the closing vertex too
  if (ref.vertexIndex === 0 && isRingClosed(ring)) {
    ring[ring.length - 1] = [...to];
  }
  // If this is the last-before-close vertex, also handled by the check above
  if (ref.vertexIndex === ring.length - 2 && isRingClosed(ring)) {
    // noop — moving second-to-last doesn't affect closure
  }

  return rebuildGeometry(geometry, rings);
}

/** Add a vertex on an edge (between two existing vertices), returning new geometry. */
export function addVertex(
  geometry: Polygon | MultiPolygon,
  edge: EdgeRef,
  at: Position
): Polygon | MultiPolygon {
  const rings = getAllRings(geometry).map((r) => [...r.map((c) => [...c])]);
  const ring = rings[edge.ringIndex];
  if (!ring) return geometry;

  // Insert after startIndex
  ring.splice(edge.startIndex + 1, 0, at);

  return rebuildGeometry(geometry, rings);
}

/** Remove a vertex, returning new geometry. Returns null if ring would become invalid (<4 points). */
export function removeVertex(
  geometry: Polygon | MultiPolygon,
  ref: VertexRef
): Polygon | MultiPolygon | null {
  const rings = getAllRings(geometry).map((r) => [...r.map((c) => [...c])]);
  const ring = rings[ref.ringIndex];
  if (!ring) return geometry;

  const effectiveLen = isRingClosed(ring) ? ring.length - 1 : ring.length;
  if (effectiveLen <= 3) return null; // Minimum polygon is a triangle

  ring.splice(ref.vertexIndex, 1);

  // Re-close ring if needed
  if (isRingClosed(rings[ref.ringIndex]!) && ring.length > 0) {
    // After splice, ensure closure
    if (ref.vertexIndex === 0) {
      // Removed first vertex — update closing vertex to new first
      ring[ring.length - 1] = [...ring[0]!];
    }
  } else if (ring.length > 0 && !coordsEqual(ring[0]!, ring[ring.length - 1]!)) {
    ring.push([...ring[0]!]);
  }

  return rebuildGeometry(geometry, rings);
}

// ──────────────────────────────────────────────
// Nearest Finding
// ──────────────────────────────────────────────

/** Find the nearest vertex to a point. */
export function findNearestVertex(
  geometry: Polygon | MultiPolygon,
  point: Position
): NearestResult<VertexRef> | null {
  const vertices = getVertices(geometry);
  if (vertices.length === 0) return null;

  let best: NearestResult<VertexRef> | null = null;
  for (const v of vertices) {
    const d = distanceDeg(point, v.coord);
    if (!best || d < best.distance) {
      best = { ref: v, distance: d };
    }
  }
  return best;
}

/** Find the nearest edge to a point (for inserting a new vertex). */
export function findNearestEdge(
  geometry: Polygon | MultiPolygon,
  point: Position
): NearestResult<EdgeRef> | null {
  const rings = getAllRings(geometry);
  let best: NearestResult<EdgeRef> | null = null;

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri]!;
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]!;
      const b = ring[i + 1]!;
      const proj = projectPointToSegment(point, a, b);
      const d = distanceDeg(point, proj);
      const mid: Position = [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];

      if (!best || d < best.distance) {
        best = {
          ref: { ringIndex: ri, startIndex: i, endIndex: i + 1, midpoint: mid },
          distance: d,
        };
      }
    }
  }
  return best;
}

// ──────────────────────────────────────────────
// Shared Border Detection
// ──────────────────────────────────────────────

/**
 * Find shared border segments between two features.
 * Returns pairs of edges that are within `tolerance` degrees of each other.
 */
export function findSharedBorders(
  geometryA: Polygon | MultiPolygon,
  geometryB: Polygon | MultiPolygon,
  tolerance = 0.01
): Array<{ edgeA: EdgeRef; edgeB: EdgeRef }> {
  const ringsA = getAllRings(geometryA);
  const ringsB = getAllRings(geometryB);
  const shared: Array<{ edgeA: EdgeRef; edgeB: EdgeRef }> = [];

  for (let riA = 0; riA < ringsA.length; riA++) {
    const ringA = ringsA[riA]!;
    for (let iA = 0; iA < ringA.length - 1; iA++) {
      const a1 = ringA[iA]!;
      const a2 = ringA[iA + 1]!;

      for (let riB = 0; riB < ringsB.length; riB++) {
        const ringB = ringsB[riB]!;
        for (let iB = 0; iB < ringB.length - 1; iB++) {
          const b1 = ringB[iB]!;
          const b2 = ringB[iB + 1]!;

          // Check if edges overlap (same segment, possibly reversed)
          if (
            (distanceDeg(a1, b1) < tolerance && distanceDeg(a2, b2) < tolerance) ||
            (distanceDeg(a1, b2) < tolerance && distanceDeg(a2, b1) < tolerance)
          ) {
            const midA: Position = [(a1[0]! + a2[0]!) / 2, (a1[1]! + a2[1]!) / 2];
            const midB: Position = [(b1[0]! + b2[0]!) / 2, (b1[1]! + b2[1]!) / 2];
            shared.push({
              edgeA: { ringIndex: riA, startIndex: iA, endIndex: iA + 1, midpoint: midA },
              edgeB: { ringIndex: riB, startIndex: iB, endIndex: iB + 1, midpoint: midB },
            });
          }
        }
      }
    }
  }

  return shared;
}

// ──────────────────────────────────────────────
// Geometry Metrics
// ──────────────────────────────────────────────

/** Calculate approximate area of a geometry in square kilometers. */
export function calculateArea(geometry: Polygon | MultiPolygon): number {
  const rings = getAllRings(geometry);
  let totalArea = 0;

  for (const ring of rings) {
    const area = shoelaceArea(ring);
    totalArea += Math.abs(area);
  }

  // Convert from square degrees to approximate sq km
  // At equator: 1° ≈ 111.32 km. Use cos(centroidLat) correction.
  const centroid = calculateCentroid(geometry);
  const cosLat = Math.cos((centroid[1] * Math.PI) / 180);
  const degToKm = 111.32;

  return totalArea * degToKm * degToKm * cosLat;
}

/** Calculate centroid of a geometry. */
export function calculateCentroid(geometry: Polygon | MultiPolygon): Position {
  const rings = getAllRings(geometry);
  let totalLng = 0;
  let totalLat = 0;
  let count = 0;

  for (const ring of rings) {
    for (const coord of ring) {
      totalLng += coord[0]!;
      totalLat += coord[1]!;
      count++;
    }
  }

  return count > 0 ? [totalLng / count, totalLat / count] : [0, 0];
}

/** Calculate bounding box [minLng, minLat, maxLng, maxLat]. */
export function calculateBBox(
  geometry: Polygon | MultiPolygon
): [number, number, number, number] {
  const rings = getAllRings(geometry);
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  for (const ring of rings) {
    for (const coord of ring) {
      if (coord[0]! < minLng) minLng = coord[0]!;
      if (coord[0]! > maxLng) maxLng = coord[0]!;
      if (coord[1]! < minLat) minLat = coord[1]!;
      if (coord[1]! > maxLat) maxLat = coord[1]!;
    }
  }

  return [minLng, minLat, maxLng, maxLat];
}

/** Validate geometry: check ring closure, minimum vertices, etc. */
export function validateGeometry(
  geometry: Polygon | MultiPolygon
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const rings = getAllRings(geometry);

  if (rings.length === 0) {
    errors.push("Geometry has no rings");
    return { valid: false, errors };
  }

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i]!;
    if (ring.length < 4) {
      errors.push(`Ring ${i} has fewer than 4 coordinates (minimum for a valid polygon)`);
    }
    if (!isRingClosed(ring)) {
      errors.push(`Ring ${i} is not closed (first and last coordinates differ)`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ──────────────────────────────────────────────
// Undo/Redo Stack
// ──────────────────────────────────────────────

export interface UndoStack {
  entries: UndoEntry[];
  position: number; // Index of current state (-1 = at base)
}

export function createUndoStack(): UndoStack {
  return { entries: [], position: -1 };
}

export function pushUndo(
  stack: UndoStack,
  action: BorderEditAction,
  previousGeometry: Polygon | MultiPolygon,
  resultGeometry?: Polygon | MultiPolygon
): UndoStack {
  // Truncate any redo entries
  const entries = stack.entries.slice(0, stack.position + 1);
  entries.push({ action, previousGeometry, resultGeometry: resultGeometry ?? previousGeometry });
  return { entries, position: entries.length - 1 };
}

export function canUndo(stack: UndoStack): boolean {
  return stack.position >= 0;
}

export function canRedo(stack: UndoStack): boolean {
  return stack.position < stack.entries.length - 1;
}

export function getUndoGeometry(stack: UndoStack): Polygon | MultiPolygon | null {
  if (!canUndo(stack)) return null;
  return stack.entries[stack.position]!.previousGeometry;
}

export function undo(stack: UndoStack): UndoStack {
  if (!canUndo(stack)) return stack;
  return { ...stack, position: stack.position - 1 };
}

export function getRedoGeometry(stack: UndoStack): Polygon | MultiPolygon | null {
  if (!canRedo(stack)) return null;
  return stack.entries[stack.position + 1]!.resultGeometry;
}

export function redo(stack: UndoStack): UndoStack {
  if (!canRedo(stack)) return stack;
  return { ...stack, position: stack.position + 1 };
}

// ──────────────────────────────────────────────
// Split / Merge Operations
// ──────────────────────────────────────────────

/**
 * Split a polygon along a line defined by a series of points.
 * Returns two new geometries, or null if the split line doesn't intersect properly.
 *
 * Uses a simple approach: classify ring vertices as "left" or "right" of the split line,
 * then build two new rings from the classified groups.
 */
export function splitPolygon(
  geometry: Polygon | MultiPolygon,
  splitLine: Position[]
): [Polygon, Polygon] | null {
  if (splitLine.length < 2) return null;

  // For MultiPolygon, only split the largest polygon
  let targetCoords: Position[][];
  if (geometry.type === "MultiPolygon") {
    let maxArea = 0;
    let maxIdx = 0;
    for (let i = 0; i < geometry.coordinates.length; i++) {
      const area = Math.abs(shoelaceArea(geometry.coordinates[i]![0]!));
      if (area > maxArea) {
        maxArea = area;
        maxIdx = i;
      }
    }
    targetCoords = geometry.coordinates[maxIdx]!;
  } else {
    targetCoords = geometry.coordinates;
  }

  const outerRing = targetCoords[0]!;

  // Find intersection points of split line with outer ring
  const intersections: Array<{
    segIdx: number;
    point: Position;
    t: number; // parameter along split line
  }> = [];

  for (let si = 0; si < splitLine.length - 1; si++) {
    const s1 = splitLine[si]!;
    const s2 = splitLine[si + 1]!;

    for (let ri = 0; ri < outerRing.length - 1; ri++) {
      const r1 = outerRing[ri]!;
      const r2 = outerRing[ri + 1]!;
      const ix = segmentIntersection(s1, s2, r1, r2);
      if (ix) {
        intersections.push({ segIdx: ri, point: ix.point, t: si + ix.t1 });
      }
    }
  }

  if (intersections.length < 2) return null;

  // Sort by ring segment index
  intersections.sort((a, b) => a.segIdx - b.segIdx);

  // Take first and last intersection to define the split
  const enter = intersections[0]!;
  const exit = intersections[intersections.length - 1]!;

  // Build two halves
  const ringA: Position[] = [];
  const ringB: Position[] = [];

  // Side A: from enter to exit along the ring
  ringA.push(enter.point);
  for (let i = enter.segIdx + 1; i <= exit.segIdx; i++) {
    ringA.push([...outerRing[i]!]);
  }
  ringA.push(exit.point);

  // Add split line points between exit and enter (reversed)
  const splitPointsBetween = getSplitLineSegment(splitLine, enter.t, exit.t);
  ringA.push(...splitPointsBetween.reverse());
  ringA.push([...ringA[0]!]); // close

  // Side B: from exit to enter along the ring (wrapping around)
  ringB.push(exit.point);
  for (let i = exit.segIdx + 1; i < outerRing.length - 1; i++) {
    ringB.push([...outerRing[i]!]);
  }
  for (let i = 0; i <= enter.segIdx; i++) {
    ringB.push([...outerRing[i]!]);
  }
  ringB.push(enter.point);

  // Add split line points between enter and exit
  ringB.push(...getSplitLineSegment(splitLine, enter.t, exit.t));
  ringB.push([...ringB[0]!]); // close

  if (ringA.length < 4 || ringB.length < 4) return null;

  return [
    { type: "Polygon", coordinates: [ringA] },
    { type: "Polygon", coordinates: [ringB] },
  ];
}

/** Merge two geometries into one MultiPolygon / Polygon. */
export function mergeGeometries(
  a: Polygon | MultiPolygon,
  b: Polygon | MultiPolygon
): MultiPolygon {
  const aPolygons =
    a.type === "Polygon" ? [a.coordinates] : a.coordinates;
  const bPolygons =
    b.type === "Polygon" ? [b.coordinates] : b.coordinates;

  return {
    type: "MultiPolygon",
    coordinates: [...aPolygons, ...bPolygons],
  };
}

// ──────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────

function isRingClosed(ring: Position[]): boolean {
  if (ring.length < 2) return false;
  return coordsEqual(ring[0]!, ring[ring.length - 1]!);
}

function coordsEqual(a: Position, b: Position): boolean {
  return Math.abs(a[0]! - b[0]!) < 1e-10 && Math.abs(a[1]! - b[1]!) < 1e-10;
}

function distanceDeg(a: Position, b: Position): number {
  const dx = a[0]! - b[0]!;
  const dy = a[1]! - b[1]!;
  return Math.sqrt(dx * dx + dy * dy);
}

function shoelaceArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return area / 2;
}

/** Project a point onto a line segment, returning the closest point on the segment. */
function projectPointToSegment(
  p: Position,
  a: Position,
  b: Position
): Position {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-20) return a;

  const t = Math.max(
    0,
    Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / lenSq)
  );
  return [a[0]! + t * dx, a[1]! + t * dy];
}

/** Find intersection of two line segments. Returns null if no intersection. */
function segmentIntersection(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position
): { point: Position; t1: number; t2: number } | null {
  const dx1 = a2[0]! - a1[0]!;
  const dy1 = a2[1]! - a1[1]!;
  const dx2 = b2[0]! - b1[0]!;
  const dy2 = b2[1]! - b1[1]!;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) return null; // parallel

  const t1 = ((b1[0]! - a1[0]!) * dy2 - (b1[1]! - a1[1]!) * dx2) / denom;
  const t2 = ((b1[0]! - a1[0]!) * dy1 - (b1[1]! - a1[1]!) * dx1) / denom;

  if (t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1) return null; // outside segments

  return {
    point: [a1[0]! + t1 * dx1, a1[1]! + t1 * dy1],
    t1,
    t2,
  };
}

/** Get the split line points between two t-values. */
function getSplitLineSegment(
  splitLine: Position[],
  tStart: number,
  tEnd: number
): Position[] {
  const points: Position[] = [];
  const start = Math.ceil(Math.min(tStart, tEnd));
  const end = Math.floor(Math.max(tStart, tEnd));

  for (let i = start; i <= end; i++) {
    if (i >= 0 && i < splitLine.length) {
      points.push([...splitLine[i]!]);
    }
  }

  return points;
}

// ──────────────────────────────────────────────
// Altitude Snap
// ──────────────────────────────────────────────

export interface AltitudeSnapResult {
  position: Position;
  zoneId: string;
  distance: number;
}

/**
 * Find the nearest point on any altitude zone boundary within snap distance.
 * Searches all edges of altitude zone polygons for the closest point
 * to the given position.
 */
export function findNearestAltitudeSnap(
  point: Position,
  altitudeFeatures: Array<{ geometry: Polygon | MultiPolygon; properties: { zoneId?: string } }>,
  maxDistance: number = 0.01 // ~1.1km at equator
): AltitudeSnapResult | null {
  let best: AltitudeSnapResult | null = null;

  for (const feature of altitudeFeatures) {
    const rings = getAllRings(feature.geometry);
    const zoneId = feature.properties.zoneId ?? "unknown";

    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const projected = projectPointToSegment(point, ring[i]!, ring[i + 1]!);
        const d = distanceDeg(point, projected);

        if (d <= maxDistance && (!best || d < best.distance)) {
          best = { position: projected, zoneId, distance: d };
        }
      }
    }
  }

  return best;
}
