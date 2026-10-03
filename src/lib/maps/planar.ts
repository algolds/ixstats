import type { Position } from "geojson";

/** Euclidean distance between two positions treated as planar degrees. */
export function distanceDeg(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const dx = a[0]! - b[0]!;
  const dy = a[1]! - b[1]!;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Squared distance from point (px, py) to the bounding box of segment a-b; a cheap lower bound for pruning. */
export function boxDistanceSq(
  px: number,
  py: number,
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  const dx = Math.max(Math.min(a[0]!, b[0]!) - px, 0, px - Math.max(a[0]!, b[0]!));
  const dy = Math.max(Math.min(a[1]!, b[1]!) - py, 0, py - Math.max(a[1]!, b[1]!));
  return dx * dx + dy * dy;
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
