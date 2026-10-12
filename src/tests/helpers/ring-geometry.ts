/**
 * Pure-TS ring checks for the exported polygons: orientation, containment and self-intersection.
 * A ring is closed (the last position repeats the first); shells run counter-clockwise, holes clockwise.
 */

import type { Geometry, Position } from "geojson";

/** Shoelace area: positive for a counter-clockwise ring, negative for a clockwise one. */
export function signedArea(ring: readonly Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return area / 2;
}

/** Even-odd ray cast. Points exactly on the ring are not defined. */
export function pointInRing(ring: readonly Position[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

/** The polygons of a (Multi)Polygon geometry as [shell, ...holes]. */
export function polygonsOf(geometry: Geometry): Position[][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function side(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return cross > 0 ? 1 : cross < 0 ? -1 : 0;
}

function within(a: number, b: number, c: number): boolean {
  return c >= Math.min(a, b) && c <= Math.max(a, b);
}

/** True when the closed segments ab and cd share a point (crossing, touching or overlapping). */
function segmentsMeet(a: Position, b: Position, c: Position, d: Position): boolean {
  const [ax, ay] = [a[0]!, a[1]!];
  const [bx, by] = [b[0]!, b[1]!];
  const [cx, cy] = [c[0]!, c[1]!];
  const [dx, dy] = [d[0]!, d[1]!];
  const o1 = side(ax, ay, bx, by, cx, cy);
  const o2 = side(ax, ay, bx, by, dx, dy);
  const o3 = side(cx, cy, dx, dy, ax, ay);
  const o4 = side(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && within(ax, bx, cx) && within(ay, by, cy)) ||
    (o2 === 0 && within(ax, bx, dx) && within(ay, by, dy)) ||
    (o3 === 0 && within(cx, dx, ax) && within(cy, dy, ay)) ||
    (o4 === 0 && within(cx, dx, bx) && within(cy, dy, by))
  );
}

/** Adjacent segments share an end point; they only meet again when the second doubles back over the first. */
function adjacentOverlap(a: Position, b: Position, c: Position): boolean {
  const cross = (b[0]! - a[0]!) * (c[1]! - b[1]!) - (b[1]! - a[1]!) * (c[0]! - b[0]!);
  const dot = (b[0]! - a[0]!) * (c[0]! - b[0]!) + (b[1]! - a[1]!) * (c[1]! - b[1]!);
  return cross === 0 && dot < 0;
}

interface SegmentGrid {
  grid: number;
  /** Per segment: [firstCol, lastCol, firstRow, lastRow] of the grid cells its bounding box covers */
  spans: Int32Array;
  /** Segments by grid cell (row * grid + col) */
  buckets: Map<number, number[]>;
}

function bucketSegments(ring: readonly Position[]): SegmentGrid {
  const n = ring.length - 1;
  const xs = ring.map((p) => p[0]!);
  const ys = ring.map((p) => p[1]!);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const grid = Math.max(1, Math.min(512, Math.ceil(Math.sqrt(n))));
  const cw = (Math.max(...xs) - minX || 1) / grid;
  const ch = (Math.max(...ys) - minY || 1) / grid;
  const col = (x: number) => Math.min(grid - 1, Math.floor((x - minX) / cw));
  const row = (y: number) => Math.min(grid - 1, Math.floor((y - minY) / ch));

  const spans = new Int32Array(n * 4);
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const [a, b] = [ring[i]!, ring[i + 1]!];
    spans.set(
      [
        col(Math.min(a[0]!, b[0]!)),
        col(Math.max(a[0]!, b[0]!)),
        row(Math.min(a[1]!, b[1]!)),
        row(Math.max(a[1]!, b[1]!)),
      ],
      i * 4
    );
    for (let c = spans[i * 4]!; c <= spans[i * 4 + 1]!; c++) {
      for (let r = spans[i * 4 + 2]!; r <= spans[i * 4 + 3]!; r++) {
        const bucket = buckets.get(r * grid + c);
        if (bucket) bucket.push(i);
        else buckets.set(r * grid + c, [i]);
      }
    }
  }
  return { grid, spans, buckets };
}

/**
 * Number of pairs of segments of the ring that meet where they should not: two segments that are not neighbours
 * and share a point, or neighbours that fold back onto each other. Zero for a simple ring. Segments are bucketed
 * on a grid so a ring of tens of thousands of vertices checks in milliseconds.
 */
export function selfIntersections(ring: readonly Position[]): number {
  const n = ring.length - 1;
  if (n < 3) return 0;
  const { grid, spans, buckets } = bucketSegments(ring);

  let found = 0;
  for (let i = 0; i < n; i++) {
    if (adjacentOverlap(ring[i]!, ring[i + 1]!, ring[i + 2 <= n ? i + 2 : 1]!)) found++;
  }
  for (const [key, bucket] of buckets) {
    const [cellCol, cellRow] = [key % grid, Math.floor(key / grid)];
    for (let p = 0; p < bucket.length; p++) {
      for (let q = p + 1; q < bucket.length; q++) {
        const [i, j] = [bucket[p]!, bucket[q]!];
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        // Count a pair once: in the lowest bucket both segments reach
        if (cellCol !== Math.max(spans[i * 4]!, spans[j * 4]!)) continue;
        if (cellRow !== Math.max(spans[i * 4 + 2]!, spans[j * 4 + 2]!)) continue;
        if (segmentsMeet(ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!)) found++;
      }
    }
  }
  return found;
}

/** Why a (Multi)Polygon is not a valid set of rings, or null when its rings are all sound. */
export function ringFault(geometry: Geometry): string | null {
  const polygons = polygonsOf(geometry);
  for (const [shell, ...holes] of polygons) {
    if (shell!.length < 4) return "too few points";
    if (signedArea(shell!) <= 0) return "shell is not counter-clockwise";
    if (selfIntersections(shell!) > 0) return "shell self-intersects";
    for (const hole of holes) {
      if (hole.length < 4) return "too few points";
      if (signedArea(hole) >= 0) return "hole is not clockwise";
      if (selfIntersections(hole) > 0) return "hole self-intersects";
      const [a, b] = [hole[0]!, hole[1]!];
      if (!pointInRing(shell!, (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2))
        return "hole outside its shell";
    }
  }
  return null;
}
