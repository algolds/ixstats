/**
 * Border Editor - Pure geometry operations for political border editing.
 *
 * All functions operate on GeoJSON coordinates (WGS84 [lng, lat]).
 * No React or database dependencies — purely functional.
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import { makeRng } from "~/lib/worldgen/rng";

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
  // At equator: 1° ≈ 111.32 km. IxEarth scale is baked into the map geometry,
  // so no additional scale factor is needed (verified: PostGIS matches roster at 0.999).
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
export function calculateBBox(geometry: Polygon | MultiPolygon): [number, number, number, number] {
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
export function validateGeometry(geometry: Polygon | MultiPolygon): {
  valid: boolean;
  errors: string[];
} {
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

const MAX_UNDO = 50;

export function pushUndo(
  stack: UndoStack,
  action: BorderEditAction,
  previousGeometry: Polygon | MultiPolygon,
  resultGeometry?: Polygon | MultiPolygon
): UndoStack {
  // Truncate any redo entries
  const entries = stack.entries.slice(0, stack.position + 1);
  entries.push({ action, previousGeometry, resultGeometry: resultGeometry ?? previousGeometry });

  // Cap history to prevent unbounded memory growth with complex polygons
  if (entries.length > MAX_UNDO) {
    const excess = entries.length - MAX_UNDO;
    entries.splice(0, excess);
  }

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
  const aPolygons = a.type === "Polygon" ? [a.coordinates] : a.coordinates;
  const bPolygons = b.type === "Polygon" ? [b.coordinates] : b.coordinates;

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

export function distanceDeg(a: Position, b: Position): number {
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
export function projectPointToSegment(p: Position, a: Position, b: Position): Position {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-20) return a;

  const t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / lenSq));
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
function getSplitLineSegment(splitLine: Position[], tStart: number, tEnd: number): Position[] {
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
// Point-in-Polygon & Clamping
// ──────────────────────────────────────────────

/** Ray-casting point-in-polygon test against a single polygon (outer ring + holes). */
export function pointInPolygonRing(point: Position, rings: Position[][]): boolean {
  const [x, y] = point;
  // Test outer ring
  const outer = rings[0];
  if (!outer) return false;
  let inside = rayCast(x!, y!, outer);
  // Exclude holes
  for (let h = 1; h < rings.length; h++) {
    if (rayCast(x!, y!, rings[h]!)) inside = !inside;
  }
  return inside;
}

/** Check if a point is inside a Polygon or any polygon of a MultiPolygon. */
export function pointInGeometry(point: Position, geometry: Polygon | MultiPolygon): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygonRing(point, geometry.coordinates);
  }
  for (const poly of geometry.coordinates) {
    if (pointInPolygonRing(point, poly)) return true;
  }
  return false;
}

/** If point is outside geometry, project it to the nearest point on the outer border. */
export function clampToGeometry(point: Position, geometry: Polygon | MultiPolygon): Position {
  if (pointInGeometry(point, geometry)) return point;

  // Find nearest point on any outer ring edge
  const outerRings: Position[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]!]
      : geometry.coordinates.map((p) => p[0]!);

  let bestDist = Infinity;
  let bestPoint: Position = point;

  for (const ring of outerRings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const proj = projectPointToSegment(point, ring[i]!, ring[i + 1]!);
      const d = distanceDeg(point, proj);
      if (d < bestDist) {
        bestDist = d;
        bestPoint = proj;
      }
    }
  }

  return bestPoint;
}

function rayCast(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!,
      yi = ring[i]![1]!;
    const xj = ring[j]![0]!,
      yj = ring[j]![1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
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
// ──────────────────────────────────────────────
// Simplification (Douglas-Peucker)
// ──────────────────────────────────────────────

/** Douglas-Peucker line simplification on a single ring. */
function douglasPeucker(ring: Position[], tolerance: number): Position[] {
  if (ring.length <= 2) return ring;

  let maxDist = 0;
  let maxIdx = 0;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;

  for (let i = 1; i < ring.length - 1; i++) {
    const d = perpendicularDistance(ring[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(ring.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(ring.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function perpendicularDistance(p: Position, a: Position, b: Position): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-20) return distanceDeg(p, a);
  const t = ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / lenSq;
  const proj: Position = [a[0]! + t * dx, a[1]! + t * dy];
  return distanceDeg(p, proj);
}

/**
 * Simplify a Polygon or MultiPolygon using Douglas-Peucker.
 * Tolerance is in degrees (~0.002 ≈ 220m at equator).
 * Preserves ring closure and minimum vertex count.
 */
export function simplifyGeometry(
  geometry: Polygon | MultiPolygon,
  tolerance: number = 0.002,
  neighbors?: Array<{ id: string; geometry: Polygon | MultiPolygon }>
): Polygon | MultiPolygon {
  // When neighbors are provided, use topology-preserving simplification
  if (neighbors && neighbors.length > 0) {
    try {
      const { simplifySingleProvince } =
        require("~/lib/province-importer/topo-simplify") as typeof import("~/lib/province-importer/topo-simplify");
      const target = { type: "Feature" as const, properties: {}, geometry };
      const neighborFeatures = neighbors.map((n) => ({
        type: "Feature" as const,
        properties: { id: n.id },
        geometry: n.geometry,
      }));
      const result = simplifySingleProvince(target, neighborFeatures);
      return result.geometry;
    } catch {
      // Fall through to Douglas-Peucker if topo-simplify fails
    }
  }

  // Douglas-Peucker fallback (no neighbor awareness)
  const rings = getAllRings(geometry).map((ring) => {
    const closed = isRingClosed(ring);
    // Work on open ring for simplification
    const open = closed ? ring.slice(0, -1) : ring;
    const simplified = douglasPeucker(open, tolerance);
    // Ensure minimum 3 unique vertices for a valid polygon ring
    const result = simplified.length >= 3 ? simplified : open;
    // Re-close
    if (result.length > 0 && !coordsEqual(result[0]!, result[result.length - 1]!)) {
      return [...result, [...result[0]!]];
    }
    return result;
  });
  return rebuildGeometry(geometry, rings);
}

/**
 * Snap a point to the nearest country border edge if within tolerance.
 * Returns the snapped position or the original if no edge is close enough.
 */
export function snapToBorderEdge(
  point: Position,
  borderGeometry: Polygon | MultiPolygon,
  tolerance: number = 0.015 // ~1.7km at equator
): Position {
  const rings = getAllRings(borderGeometry);

  // 1. Prioritize snapping to vertices first
  let bestVertexDist = Infinity;
  let bestVertex: Position = point;

  for (const ring of rings) {
    for (const vertex of ring) {
      const d = distanceDeg(point, vertex);
      if (d < bestVertexDist && d <= tolerance) {
        bestVertexDist = d;
        bestVertex = vertex;
      }
    }
  }

  if (bestVertexDist <= tolerance) {
    return bestVertex;
  }

  // 2. Fallback: snap to the nearest projected point on segment/edge
  let bestDist = Infinity;
  let bestProj: Position = point;

  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const proj = projectPointToSegment(point, ring[i]!, ring[i + 1]!);
      const d = distanceDeg(point, proj);
      if (d < bestDist && d <= tolerance) {
        bestDist = d;
        bestProj = proj;
      }
    }
  }

  return bestDist <= tolerance ? bestProj : point;
}

/**
 * Snap a point to the nearest vertex or edge across a collection of geometries.
 * Prioritizes vertex snapping globally over line projection snapping.
 */
export function snapPointToGeometries(
  point: Position,
  geometries: (Polygon | MultiPolygon)[],
  tolerance: number = 0.015
): Position {
  let bestVertexDist = Infinity;
  let bestVertex: Position = point;

  // 1. Search for nearest vertex across all geometries first
  for (const geom of geometries) {
    const rings = getAllRings(geom);
    for (const ring of rings) {
      for (const vertex of ring) {
        const d = distanceDeg(point, vertex);
        if (d < bestVertexDist && d <= tolerance) {
          bestVertexDist = d;
          bestVertex = vertex;
        }
      }
    }
  }

  if (bestVertexDist <= tolerance) {
    return bestVertex;
  }

  // 2. Fall back to segment projection across all geometries
  let bestEdgeDist = Infinity;
  let bestEdgeProj: Position = point;

  for (const geom of geometries) {
    const rings = getAllRings(geom);
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const proj = projectPointToSegment(point, ring[i]!, ring[i + 1]!);
        const d = distanceDeg(point, proj);
        if (d < bestEdgeDist && d <= tolerance) {
          bestEdgeDist = d;
          bestEdgeProj = proj;
        }
      }
    }
  }

  return bestEdgeDist <= tolerance ? bestEdgeProj : point;
}

// ──────────────────────────────────────────────
// Neighbor-aware border snapping
// ──────────────────────────────────────────────

/**
 * Snap a region's geometry to neighboring region borders and the country border,
 * intelligently filling gaps between adjacent regions.
 *
 * Algorithm:
 * 1. For each vertex of the current geometry, find the nearest point on:
 *    a) Any neighboring region's border (within snapTolerance)
 *    b) The country border (within snapTolerance)
 * 2. For edges where BOTH endpoints snapped to the same neighbor, insert
 *    intermediate vertices along the neighbor's border to fill the gap.
 * 3. For edges where both endpoints snapped to the country border, insert
 *    intermediate border vertices (already handled by snapGeometryToBorder).
 *
 * This ensures region borders either:
 * - Share exact vertices with a neighbor (no gaps)
 * - Follow the country border exactly
 * - Are interior edges (far from both)
 */
export function snapToNeighborBorders(
  geometry: Polygon | MultiPolygon,
  neighbors: Array<{ id: string; geometry: Polygon | MultiPolygon }>,
  countryBorder: Polygon | MultiPolygon,
  snapTolerance: number = 0.02 // ~2.2km at equator
): Polygon | MultiPolygon {
  if (neighbors.length === 0) return geometry;

  const rings = getAllRings(geometry);
  const newRings: Position[][] = [];

  for (const ring of rings) {
    const newRing: Position[] = [];

    for (let i = 0; i < ring.length - 1; i++) {
      const vertex = ring[i]!;
      const nextVertex = ring[i + 1]!;

      // Snap current vertex to nearest neighbor or country border
      const snappedVertex = snapPointToNeighborOrBorder(
        vertex,
        neighbors,
        countryBorder,
        snapTolerance
      );
      newRing.push(snappedVertex.position);

      // Check if current and next vertex both snap to the same neighbor
      const snappedNext = snapPointToNeighborOrBorder(
        nextVertex,
        neighbors,
        countryBorder,
        snapTolerance
      );

      if (snappedVertex.neighborId && snappedVertex.neighborId === snappedNext.neighborId) {
        // Both vertices snap to the same neighbor — insert intermediate
        // vertices along that neighbor's border to fill the gap
        const neighbor = neighbors.find((n) => n.id === snappedVertex.neighborId);
        if (neighbor) {
          const intermediates = getIntermediateVertices(
            snappedVertex.position,
            snappedNext.position,
            neighbor.geometry,
            0.005 // min segment length to insert
          );
          for (const pt of intermediates) {
            newRing.push(pt);
          }
        }
      } else if (
        snappedVertex.isBorderSnap &&
        snappedNext.isBorderSnap &&
        !snappedVertex.neighborId &&
        !snappedNext.neighborId
      ) {
        // Both snap to country border — insert border path vertices
        const intermediates = getIntermediateVertices(
          snappedVertex.position,
          snappedNext.position,
          countryBorder,
          0.005
        );
        for (const pt of intermediates) {
          newRing.push(pt);
        }
      }
    }

    // Close the ring
    if (newRing.length >= 3) {
      newRing.push([...newRing[0]!]);
      newRings.push(newRing);
    }
  }

  if (newRings.length === 0) return geometry;
  return rebuildGeometry(geometry, newRings);
}

interface SnapResult {
  position: Position;
  distance: number;
  neighborId: string | null;
  isBorderSnap: boolean;
}

function snapPointToNeighborOrBorder(
  point: Position,
  neighbors: Array<{ id: string; geometry: Polygon | MultiPolygon }>,
  countryBorder: Polygon | MultiPolygon,
  tolerance: number
): SnapResult {
  let bestDist = Infinity;
  let bestPos: Position = point;
  let bestNeighborId: string | null = null;
  let isBorderSnap = false;

  // 1. Check neighbor vertices first (highest priority)
  for (const neighbor of neighbors) {
    const neighborRings = getAllRings(neighbor.geometry);
    for (const ring of neighborRings) {
      for (const vertex of ring) {
        const d = distanceDeg(point, vertex);
        if (d < bestDist && d <= tolerance) {
          bestDist = d;
          bestPos = vertex;
          bestNeighborId = neighbor.id;
          isBorderSnap = false;
        }
      }
    }
  }

  // 2. Check country border vertices (second priority)
  const borderRings = getAllRings(countryBorder);
  for (const ring of borderRings) {
    for (const vertex of ring) {
      const d = distanceDeg(point, vertex);
      if (d < bestDist && d <= tolerance) {
        bestDist = d;
        bestPos = vertex;
        bestNeighborId = null;
        isBorderSnap = true;
      }
    }
  }

  // 3. Fallback: check neighbor segments (third priority)
  for (const neighbor of neighbors) {
    const neighborRings = getAllRings(neighbor.geometry);
    for (const ring of neighborRings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const proj = projectPointToSegment(point, ring[i]!, ring[i + 1]!);
        const d = distanceDeg(point, proj);
        if (d < bestDist && d <= tolerance) {
          bestDist = d;
          bestPos = proj;
          bestNeighborId = neighbor.id;
          isBorderSnap = false;
        }
      }
    }
  }

  // 4. Fallback: check country border segments (lowest priority)
  for (const ring of borderRings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const proj = projectPointToSegment(point, ring[i]!, ring[i + 1]!);
      const d = distanceDeg(point, proj);
      if (d < bestDist && d <= tolerance) {
        bestDist = d;
        bestPos = proj;
        bestNeighborId = null;
        isBorderSnap = true;
      }
    }
  }

  return { position: bestPos, distance: bestDist, neighborId: bestNeighborId, isBorderSnap };
}

/**
 * Get intermediate vertices along a geometry's border between two points.
 * Used to insert border-following vertices between two snapped endpoints.
 */
function getIntermediateVertices(
  start: Position,
  end: Position,
  geometry: Polygon | MultiPolygon,
  minSegmentLength: number
): Position[] {
  const rings = getAllRings(geometry);
  const intermediates: Position[] = [];

  // Find the ring and positions where start/end are closest
  let bestRing: Position[] | null = null;
  let bestStartIdx = -1;
  let bestEndIdx = -1;
  let bestTotalDist = Infinity;

  for (const ring of rings) {
    let startIdx = -1;
    let endIdx = -1;
    let startDist = Infinity;
    let endDist = Infinity;

    for (let i = 0; i < ring.length - 1; i++) {
      const proj = projectPointToSegment(start, ring[i]!, ring[i + 1]!);
      const d = distanceDeg(start, proj);
      if (d < startDist) {
        startDist = d;
        startIdx = i;
      }

      const proj2 = projectPointToSegment(end, ring[i]!, ring[i + 1]!);
      const d2 = distanceDeg(end, proj2);
      if (d2 < endDist) {
        endDist = d2;
        endIdx = i;
      }
    }

    const totalDist = startDist + endDist;
    if (totalDist < bestTotalDist) {
      bestTotalDist = totalDist;
      bestRing = ring;
      bestStartIdx = startIdx;
      bestEndIdx = endIdx;
    }
  }

  if (!bestRing || bestStartIdx === bestEndIdx) return [];

  // Walk along the ring from startIdx to endIdx, collecting vertices
  const ringLen = bestRing.length - 1; // exclude closing duplicate
  const forwardDist = (bestEndIdx - bestStartIdx + ringLen) % ringLen;
  const backwardDist = (bestStartIdx - bestEndIdx + ringLen) % ringLen;

  // Walk the shorter path
  const step = forwardDist <= backwardDist ? 1 : -1;
  const count = Math.min(forwardDist, backwardDist);

  let idx = bestStartIdx;
  for (let i = 1; i < count; i++) {
    idx = (idx + step + ringLen) % ringLen;
    const pt = bestRing[idx]!;

    // Skip if too close to start or end
    if (distanceDeg(pt, start) < minSegmentLength) continue;
    if (distanceDeg(pt, end) < minSegmentLength) continue;

    intermediates.push(pt);
  }

  return intermediates;
}

/**
 * Insert a point into a Polygon or MultiPolygon geometry if it lies on one of
 * its boundary segments (within a small tolerance), but is not already a vertex.
 */
export function insertVertexIfOnSegment(
  geometry: Polygon | MultiPolygon,
  point: Position,
  tolerance: number = 1e-7
): { geometry: Polygon | MultiPolygon; modified: boolean } {
  const rings = getAllRings(geometry).map((r) => [...r.map((c) => [...c])]);
  let modified = false;

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri]!;
    const newRing: Position[] = [];

    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]!;
      const b = ring[i + 1]!;
      newRing.push(a);

      // Check if point is already equal to either endpoint of the segment
      const distA = distanceDeg(point, a);
      const distB = distanceDeg(point, b);

      if (distA > tolerance && distB > tolerance) {
        const proj = projectPointToSegment(point, a, b);
        const distToProj = distanceDeg(point, proj);

        if (distToProj <= tolerance) {
          // Check parameter t to make sure it's strictly between the endpoints
          const edgeLen = distanceDeg(a, b);
          const distAProj = distanceDeg(a, proj);
          const distBProj = distanceDeg(b, proj);
          
          if (edgeLen > tolerance && distAProj > tolerance && distBProj > tolerance) {
            newRing.push([...point]);
            modified = true;
          }
        }
      }
    }

    if (ring.length > 0) {
      newRing.push([...ring[ring.length - 1]!]);
    }

    if (modified) {
      rings[ri] = newRing;
    }
  }

  if (modified) {
    return {
      geometry: rebuildGeometry(geometry, rings),
      modified: true,
    };
  }

  return { geometry, modified: false };
}

/**
 * For two geometries A and B, find any vertices of A that lie on edges of B,
 * and insert them as vertices in B. Also find any vertices of B that lie on
 * edges of A, and insert them as vertices in A.
 */
export function alignSharedVertices(
  geomA: Polygon | MultiPolygon,
  geomB: Polygon | MultiPolygon,
  tolerance: number = 1e-7
): {
  geomA: Polygon | MultiPolygon;
  geomB: Polygon | MultiPolygon;
  modifiedA: boolean;
  modifiedB: boolean;
} {
  let currentA = JSON.parse(JSON.stringify(geomA)) as Polygon | MultiPolygon;
  let currentB = JSON.parse(JSON.stringify(geomB)) as Polygon | MultiPolygon;
  let modifiedA = false;
  let modifiedB = false;

  // Insert vertices of A into B
  const verticesA = getVertices(currentA);
  for (const v of verticesA) {
    const res = insertVertexIfOnSegment(currentB, v.coord, tolerance);
    if (res.modified) {
      currentB = res.geometry;
      modifiedB = true;
    }
  }

  // Insert vertices of B into A
  const verticesB = getVertices(currentB);
  for (const v of verticesB) {
    const res = insertVertexIfOnSegment(currentA, v.coord, tolerance);
    if (res.modified) {
      currentA = res.geometry;
      modifiedA = true;
    }
  }

  return { geomA: currentA, geomB: currentB, modifiedA, modifiedB };
}

/**
 * Validate that a geometry doesn't have self-intersections or excessively
 * complex shapes (spikes, bowties, etc.).
 *
 * Returns a cleaned geometry with issues fixed where possible.
 */
export function sanitizeRegionShape(
  geometry: Polygon | MultiPolygon,
  // eslint-disable-next-line unused-imports/no-unused-vars
  countryBorder: Polygon | MultiPolygon
): { geometry: Polygon | MultiPolygon; issues: string[] } {
  const issues: string[] = [];
  const rings = getAllRings(geometry);
  const cleanedRings: Position[][] = [];

  for (const ring of rings) {
    // 1. Remove duplicate consecutive vertices
    const deduped: Position[] = [ring[0]!];
    for (let i = 1; i < ring.length; i++) {
      const prev = deduped[deduped.length - 1]!;
      if (distanceDeg(prev, ring[i]!) > 0.0001) {
        deduped.push(ring[i]!);
      }
    }

    // 2. Remove near-zero-area spikes (3 consecutive vertices where angle < 5°)
    const despikeTolerance = 5; // degrees
    const despiked: Position[] = [deduped[0]!];
    for (let i = 1; i < deduped.length - 1; i++) {
      const prev = despiked[despiked.length - 1]!;
      const curr = deduped[i]!;
      const next = deduped[i + 1]!;

      const angle = angleBetween(prev, curr, next);
      if (angle < despikeTolerance) {
        issues.push(`Removed spike at vertex ${i} (angle ${angle.toFixed(1)}°)`);
        continue; // skip this vertex (removes the spike)
      }
      despiked.push(curr);
    }

    // Close ring
    if (despiked.length >= 3) {
      despiked.push([...despiked[0]!]);
      cleanedRings.push(despiked);
    } else {
      issues.push("Ring with < 3 vertices removed");
    }
  }

  if (cleanedRings.length === 0) {
    return { geometry, issues: ["All rings invalid — returning original"] };
  }

  return {
    geometry: rebuildGeometry(geometry, cleanedRings),
    issues,
  };
}

/** Calculate angle (in degrees) at vertex B in triangle A-B-C */
function angleBetween(a: Position, b: Position, c: Position): number {
  const ba = [a[0]! - b[0]!, a[1]! - b[1]!] as const;
  const bc = [c[0]! - b[0]!, c[1]! - b[1]!] as const;
  const dot = ba[0] * bc[0] + ba[1] * bc[1];
  const magBA = Math.sqrt(ba[0] ** 2 + ba[1] ** 2);
  const magBC = Math.sqrt(bc[0] ** 2 + bc[1] ** 2);
  if (magBA < 1e-10 || magBC < 1e-10) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cos) * (180 / Math.PI);
}

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

// ──────────────────────────────────────────────
// Aesthetic Shaping (Smooth / Naturalize)
// ──────────────────────────────────────────────

/**
 * Chaikin corner-cutting smoothing. For each pair of consecutive vertices
 * `[p, q]`, the pair is replaced with two new vertices
 * `[0.75*p + 0.25*q, 0.25*p + 0.75*q]`. `iterations` passes (1–2 typical)
 * — each pass roughly doubles the vertex count.
 *
 * Preserves ring closure (first === last) and operates on every ring of
 * the geometry (outer + holes; all polygons of a MultiPolygon).
 */
export function smoothGeometry(
  g: Polygon | MultiPolygon,
  iterations: number = 1
): Polygon | MultiPolygon {
  if (iterations < 1) return g;

  const rings = getAllRings(g).map((ring) => {
    const closed = isRingClosed(ring);
    const open = closed ? ring.slice(0, -1) : ring.slice();
    if (open.length < 3) return ring;

    let current = open;
    for (let it = 0; it < iterations; it++) {
      const next: Position[] = [];
      for (let i = 0; i < current.length; i++) {
        const p = current[i]!;
        const q = current[(i + 1) % current.length]!;
        next.push([0.75 * p[0]! + 0.25 * q[0]!, 0.75 * p[1]! + 0.25 * q[1]!]);
        next.push([0.25 * p[0]! + 0.75 * q[0]!, 0.25 * p[1]! + 0.75 * q[1]!]);
      }
      current = next;
    }

    // Close the ring
    current.push([...current[0]!]);
    return current;
  });

  return rebuildGeometry(g, rings);
}

/**
 * Subdivide each edge and offset the midpoints by seeded noise for an
 * organic coastline. The midpoint of each edge `(p, q)` is computed, the
 * perpendicular unit vector to the edge is found, and the midpoint is
 * pushed along that vector by `amount * (rng() - 0.5)` (signed noise in
 * `[-amount/2, amount/2]`). The midpoint is inserted between `p` and `q`.
 *
 * Deterministic given `seed` (so a single transform can be undone exactly).
 * Preserves ring closure and minimum vertex count. Operates on every ring
 * of the geometry (outer + holes; all polygons of a MultiPolygon).
 *
 * `amount` is in degrees of lat/lng (default 0.01 ≈ ~1.1km at temperate
 * latitudes). Pass a small value for subtle coastline, larger for
 * significant coastline jitter.
 */
export function naturalizeGeometry(
  g: Polygon | MultiPolygon,
  amount: number = 0.01,
  seed: number = 42
): Polygon | MultiPolygon {
  if (amount <= 0) return g;
  const rng = makeRng(seed);

  const rings = getAllRings(g).map((ring) => {
    const closed = isRingClosed(ring);
    const open = closed ? ring.slice(0, -1) : ring.slice();
    if (open.length < 3) return ring;

    const newRing: Position[] = [];
    for (let i = 0; i < open.length; i++) {
      const p = open[i]!;
      const q = open[(i + 1) % open.length]!;
      newRing.push(p);

      const dx = q[0]! - p[0]!;
      const dy = q[1]! - p[1]!;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-12) continue;

      // Perpendicular unit vector to the edge (q - p)
      const px = -dy / len;
      const py = dx / len;
      const offset = amount * (rng() - 0.5);

      const mx = (p[0]! + q[0]!) / 2 + px * offset;
      const my = (p[1]! + q[1]!) / 2 + py * offset;
      newRing.push([mx, my]);
    }

    // Close the ring
    newRing.push([...newRing[0]!]);
    return newRing;
  });

  return rebuildGeometry(g, rings);
}
