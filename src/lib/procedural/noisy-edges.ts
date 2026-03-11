/**
 * Noisy Edges — Fractal midpoint displacement for organic borders.
 *
 * Takes straight line segments and adds recursive midpoint displacement
 * to create natural-looking coastlines, country borders, and terrain boundaries.
 * Deterministic: same inputs always produce same output.
 */

import type { Position } from "geojson";

/**
 * Subdivide a straight edge into a noisy polyline.
 *
 * Uses recursive midpoint displacement constrained perpendicular to the edge.
 * Amplitude decays by 0.5× per recursion level for fractal appearance.
 *
 * @param p1 Start point [lng, lat]
 * @param p2 End point [lng, lat]
 * @param seed Deterministic seed for this edge
 * @param depth Recursion levels (3-4 recommended)
 * @param amplitude Maximum displacement as fraction of edge length
 * @returns Array of points from p1 to p2 (inclusive)
 */
export function noisyEdge(
  p1: Position,
  p2: Position,
  seed: number,
  depth: number,
  amplitude: number
): Position[] {
  if (depth <= 0 || amplitude < 0.0001) return [p1, p2];

  const result: Position[] = [p1];
  subdivide(p1, p2, depth, amplitude, seed, result);
  return result;
}

function subdivide(
  p1: Position,
  p2: Position,
  depth: number,
  amplitude: number,
  seed: number,
  out: Position[]
): void {
  if (depth <= 0) {
    out.push(p2);
    return;
  }

  // Midpoint
  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;

  // Perpendicular direction (normalized)
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) {
    out.push(p2);
    return;
  }
  const nx = -dy / len;
  const ny = dx / len;

  // Deterministic displacement from seed
  const disp = (hashFloat(seed) - 0.5) * 2 * amplitude * len;

  const displaced: Position = [mx + nx * disp, my + ny * disp];

  // Recurse left and right halves with decaying amplitude
  subdivide(p1, displaced, depth - 1, amplitude * 0.5, hash(seed, 1), out);
  subdivide(displaced, p2, depth - 1, amplitude * 0.5, hash(seed, 2), out);
}

/**
 * Apply noisy edges to an entire polygon ring.
 * Each edge gets its own seed derived from vertex indices.
 */
export function noisyRing(
  ring: Position[],
  baseSeed: number,
  depth: number,
  amplitude: number
): Position[] {
  const result: Position[] = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const edgeSeed = hash(baseSeed, i * 7919 + 31);
    const noisy = noisyEdge(ring[i]!, ring[i + 1]!, edgeSeed, depth, amplitude);
    // Add all points except the last (it's the start of the next edge)
    for (let j = 0; j < noisy.length - 1; j++) {
      result.push(noisy[j]!);
    }
  }

  // Close ring
  if (result.length > 0) {
    result.push(result[0]!);
  }

  return result;
}

// ─── Hash Utilities ─────────────────────────────────────────

/** Integer hash combining two values */
function hash(a: number, b: number): number {
  let h = (a * 2654435761) ^ (b * 2246822519);
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return h >>> 0;
}

/** Hash to float in [0, 1] */
function hashFloat(seed: number): number {
  const h = hash(seed, 0x9e3779b9);
  return (h >>> 0) / 0xffffffff;
}
