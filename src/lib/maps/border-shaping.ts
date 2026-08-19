/**
 * Border Editor — Aesthetic Shaping (Smooth / Naturalize)
 */

import type { Polygon, MultiPolygon, Position } from "geojson";
import { makeRng } from "~/lib/worldgen/rng";
import { getAllRings, rebuildGeometry } from "./border-editor";

function isRingClosed(ring: Position[]): boolean {
  if (ring.length === 0) return false;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] === last[0] && first[1] === last[1];
}

/**
 * Chaikin corner-cutting smoothing. For each pair of consecutive vertices
 * `[p, q]`, the pair is replaced with two new vertices
 * `[0.75*p + 0.25*q, 0.25*p + 0.75*q]`. `iterations` passes (1–2 typical)
 * — each pass roughly doubles the vertex count.
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
 * organic coastline.
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
