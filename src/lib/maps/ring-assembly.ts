/**
 * Polygon assembly from a flat list of rings: an SVG path's subpaths, a potrace trace, a flattened GeoJSON
 * geometry. A ring's role comes from containment, never from its winding alone, so a lake is a hole whichever way
 * the drawing tool wound it:
 *   - "evenodd" (the default, also used when a path names no fill rule): a ring inside an odd number of other
 *     rings is a hole of the smallest ring containing it; an island in that lake is an outer ring again.
 *   - "nonzero" (only when the SVG says so): the windings decide what is filled, as a browser draws it, so a ring
 *     wound like its container adds nothing and is dropped.
 * The result follows RFC 7946: outer rings counter-clockwise (positive signed area with y up), holes clockwise.
 * Pure, client-safe.
 */
import type { MultiPolygon, Polygon, Position } from "geojson";

export type FillRule = "evenodd" | "nonzero";

type Ring = Position[];
type Box = [number, number, number, number];

/** Signed planar area of a closed ring (shoelace): positive when counter-clockwise with y up. */
export function signedRingArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    area += x1! * y2! - x2! * y1!;
  }
  return area / 2;
}

function closeRing(ring: Ring): Ring {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first && last && (first[0] !== last[0] || first[1] !== last[1]) ? [...ring, first] : ring;
}

function boxOf(ring: Ring): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    box[0] = Math.min(box[0], x!);
    box[1] = Math.min(box[1], y!);
    box[2] = Math.max(box[2], x!);
    box[3] = Math.max(box[3], y!);
  }
  return box;
}

const boxWithin = (inner: Box, outer: Box) =>
  inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];

/** 1 inside the closed ring, -1 outside, 0 on its boundary. */
function locatePoint(x: number, y: number, ring: Ring): 1 | 0 | -1 {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]! as [number, number];
    const [xj, yj] = ring[j]! as [number, number];
    const cross = (xj - xi) * (y - yi) - (yj - yi) * (x - xi);
    const onSegment =
      Math.abs(cross) <= 1e-12 * Math.max(1, Math.abs(xj - xi) + Math.abs(yj - yi)) ** 2 &&
      x >= Math.min(xi, xj) &&
      x <= Math.max(xi, xj) &&
      y >= Math.min(yi, yj) &&
      y <= Math.max(yi, yj);
    if (onSegment) return 0;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? 1 : -1;
}

/**
 * Whether `inner` lies inside `outer`. Rings from one drawing don't cross, so the first vertex (or, failing that,
 * edge midpoint) not on `outer`'s boundary decides; rings that touch at a corner still classify correctly.
 */
function ringWithin(inner: Ring, outer: Ring): boolean {
  for (let i = 0; i < inner.length - 1; i++) {
    const location = locatePoint(inner[i]![0]!, inner[i]![1]!, outer);
    if (location !== 0) return location === 1;
  }
  for (let i = 0; i < inner.length - 1; i++) {
    const mx = (inner[i]![0]! + inner[i + 1]![0]!) / 2;
    const my = (inner[i]![1]! + inner[i + 1]![1]!) / 2;
    const location = locatePoint(mx, my, outer);
    if (location !== 0) return location === 1;
  }
  return false; // the same ring twice
}

const oriented = (ring: Ring, area: number, counterClockwise: boolean): Ring =>
  area > 0 === counterClockwise ? ring : ring.slice().reverse();

/**
 * Build a Polygon (one outer ring) or MultiPolygon from rings, classifying outer rings and holes by containment
 * under `fillRule`. Rings are closed if needed; rings with no area are dropped (unless nothing else is left).
 * Polygons keep the input order of their outer rings, and holes the input order within their polygon.
 */
export function assembleRings(
  rings: Position[][],
  fillRule: FillRule = "evenodd"
): Polygon | MultiPolygon {
  const all = rings.map(closeRing).map((ring) => {
    const area = signedRingArea(ring);
    return { ring, area, size: Math.abs(area), box: boxOf(ring) };
  });
  const usable = all.filter((r) => r.size > 0);
  if (usable.length === 0) {
    return all.length === 1
      ? { type: "Polygon", coordinates: [all[0]!.ring] }
      : { type: "MultiPolygon", coordinates: all.map((r) => [r.ring]) };
  }

  // Each ring's parent is the smallest larger ring containing it: scan larger rings from the smallest up.
  const bySize = usable.map((_, i) => i).sort((a, b) => usable[b]!.size - usable[a]!.size);
  const parent = new Array<number>(usable.length).fill(-1);
  bySize.forEach((i, rank) => {
    const r = usable[i]!;
    for (let k = rank - 1; k >= 0; k--) {
      const candidate = usable[bySize[k]!]!;
      if (
        candidate.size > r.size &&
        boxWithin(r.box, candidate.box) &&
        ringWithin(r.ring, candidate.ring)
      ) {
        parent[i] = bySize[k]!;
        break;
      }
    }
  });

  // Fill state of the region just inside each ring (parents come first in size order).
  const level = new Array<number>(usable.length).fill(0);
  for (const i of bySize) {
    const up = parent[i]! >= 0 ? level[parent[i]!]! : 0;
    level[i] = fillRule === "nonzero" ? up + Math.sign(usable[i]!.area) : up + 1;
  }
  const filled = (i: number) => (fillRule === "nonzero" ? level[i] !== 0 : level[i]! % 2 === 1);

  const role = usable.map((_, i) => {
    const inFill = parent[i]! >= 0 && filled(parent[i]!);
    if (filled(i) && !inFill) return "outer";
    if (!filled(i) && inFill) return "hole";
    return "none"; // a ring that changes nothing under the fill rule
  });

  const polygons = new Map<number, Ring[]>();
  usable.forEach((r, i) => {
    if (role[i] === "outer") polygons.set(i, [oriented(r.ring, r.area, true)]);
  });
  usable.forEach((r, i) => {
    if (role[i] !== "hole") return;
    let owner = parent[i]!;
    while (owner >= 0 && role[owner] !== "outer") owner = parent[owner]!;
    if (owner >= 0) polygons.get(owner)!.push(oriented(r.ring, r.area, false));
  });

  const coordinates = [...polygons.values()];
  return coordinates.length === 1
    ? { type: "Polygon", coordinates: coordinates[0]! }
    : { type: "MultiPolygon", coordinates };
}
