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
