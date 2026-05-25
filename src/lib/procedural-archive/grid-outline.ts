/**
 * Grid Outline Extraction — Converts a binary cell mask into closed polygon rings.
 *
 * Works by collecting oriented boundary edges (between filled and empty cells),
 * then chaining them into closed rings. Produces non-self-intersecting outlines
 * that correctly represent concave shapes, holes, and multi-part regions.
 *
 * Used by: landmass-generator, terrain-generator, country-generator
 */

import type { Position } from "geojson";

/**
 * Extract closed polygon rings from a binary grid mask.
 *
 * Each ring is in grid corner coordinates: cell (x,y) occupies corners (x,y)-(x+1,y+1).
 * Outer boundaries wind clockwise, holes wind counter-clockwise.
 *
 * @param mask - Binary grid (0 = empty, non-zero = filled)
 * @param w - Grid width
 * @param h - Grid height
 * @returns Array of closed rings (each ring ends with a copy of its first point)
 */
export function extractGridOutline(mask: Uint8Array, w: number, h: number): Position[][] {
  // Collect oriented boundary edges (clockwise around filled region)
  // Uses grid corner coordinates: corner index = cy * cw + cx
  const fromMap = new Map<number, number>();
  const cw = w + 1; // corner grid width

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      if (!mask[cy * w + cx]) continue;

      // Top edge: cell above absent
      if (cy === 0 || !mask[(cy - 1) * w + cx]) {
        fromMap.set(cy * cw + cx, cy * cw + (cx + 1));
      }
      // Right edge: cell right absent
      if (cx === w - 1 || !mask[cy * w + (cx + 1)]) {
        fromMap.set(cy * cw + (cx + 1), (cy + 1) * cw + (cx + 1));
      }
      // Bottom edge: cell below absent
      if (cy === h - 1 || !mask[(cy + 1) * w + cx]) {
        fromMap.set((cy + 1) * cw + (cx + 1), (cy + 1) * cw + cx);
      }
      // Left edge: cell left absent
      if (cx === 0 || !mask[cy * w + (cx - 1)]) {
        fromMap.set((cy + 1) * cw + cx, cy * cw + cx);
      }
    }
  }

  if (fromMap.size === 0) return [];

  // Chain edges into closed rings
  const visited = new Set<number>();
  const rings: Position[][] = [];

  for (const [startCorner] of fromMap) {
    if (visited.has(startCorner)) continue;

    const ring: Position[] = [];
    let current = startCorner;

    for (let safety = 0; safety < fromMap.size + 1; safety++) {
      if (visited.has(current) && current !== startCorner) break;
      visited.add(current);

      const cx = current % cw;
      const cy = (current - cx) / cw;
      ring.push([cx, cy]);

      const next = fromMap.get(current);
      if (next === undefined) break;
      current = next;
      if (current === startCorner) break;
    }

    if (ring.length >= 4) {
      ring.push(ring[0]!); // Close the ring
      rings.push(ring);
    }
  }

  return rings;
}

/**
 * Douglas-Peucker line simplification (recursive).
 * Reduces vertex count while preserving shape within tolerance.
 */
export function douglasPeuckerSimplify(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeuckerSimplify(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeuckerSimplify(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpDist(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.sqrt((p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2);
}
