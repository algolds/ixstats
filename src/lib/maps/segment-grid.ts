/**
 * Uniform grid of line segments for "nearest point on any segment within tolerance" queries, so the
 * editor's snapping looks at the few segments near the cursor instead of every segment of every layer.
 * Answers match a full scan in run order exactly, ties included (the first nearest segment wins).
 */

import type { Position } from "geojson";
import { distanceDeg, projectPointToSegment } from "./planar";

/** Cell size in degrees: snap tolerances are ~0.015°, so a query touches one to four cells. */
const CELL_DEG = 0.25;
/** Offset so the latitude cell index never borrows into the longitude part of the numeric key
 * (holds for any latitude within ±1000°; any longitude works). */
const KEY_OFFSET = 4096;
/** A segment whose box spans more cells than this is checked on every query instead of filed. */
const MAX_CELLS_PER_SEGMENT = 10_000;

export interface SegmentGrid {
  /** Segment endpoints, four numbers per segment, in scan order (the segment id is its index). */
  coords: Float64Array;
  cells: Map<number, number[]>;
  /** Segments too large to file per cell. */
  large: number[];
  /** The query that last visited each segment, so one found in several cells is measured once. */
  seen: Uint32Array;
  query: number;
}

const cellOf = (deg: number) => Math.floor(deg / CELL_DEG);
const cellKey = (gx: number, gy: number) => (gx + KEY_OFFSET) * (2 * KEY_OFFSET) + gy + KEY_OFFSET;

function fileSegment(
  cells: Map<number, number[]>,
  large: number[],
  id: number,
  a: Position,
  b: Position
) {
  const [x0, x1] = [cellOf(Math.min(a[0]!, b[0]!)), cellOf(Math.max(a[0]!, b[0]!))];
  const [y0, y1] = [cellOf(Math.min(a[1]!, b[1]!)), cellOf(Math.max(a[1]!, b[1]!))];
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS_PER_SEGMENT) {
    large.push(id);
    return;
  }
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const key = cellKey(gx, gy);
      const list = cells.get(key);
      if (list) list.push(id);
      else cells.set(key, [id]);
    }
  }
}

/** Index every segment of the given runs (lines and rings), in order. */
export function buildSegmentGrid(runs: Iterable<Position[]>): SegmentGrid {
  const coords: number[] = [];
  const cells = new Map<number, number[]>();
  const large: number[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const a = run[i]!;
      const b = run[i + 1]!;
      fileSegment(cells, large, coords.length / 4, a, b);
      coords.push(a[0]!, a[1]!, b[0]!, b[1]!);
    }
  }
  const count = coords.length / 4;
  return {
    coords: Float64Array.from(coords),
    cells,
    large,
    seen: new Uint32Array(count),
    query: 0,
  };
}

interface Nearest {
  point: Position;
  dist: number;
  id: number;
}

/** The nearest point on any indexed segment within `tolerance` of `p`, or null. */
export function nearestSegmentPoint(
  grid: SegmentGrid,
  p: Position,
  tolerance: number
): Nearest | null {
  // A new stamp per query; on wrap-around, forget every old stamp
  const q = (grid.query = grid.query === 0xffffffff ? 1 : grid.query + 1);
  if (q === 1) grid.seen.fill(0);
  const { coords, seen } = grid;
  let best: Nearest | null = null;

  const visit = (id: number) => {
    if (seen[id] === q) return;
    seen[id] = q;
    const o = id * 4;
    const proj = projectPointToSegment(
      p,
      [coords[o]!, coords[o + 1]!],
      [coords[o + 2]!, coords[o + 3]!]
    );
    const dist = distanceDeg(p, proj);
    if (dist > tolerance) return;
    if (!best || dist < best.dist || (dist === best.dist && id < best.id))
      best = { point: proj, dist, id };
  };

  for (let gx = cellOf(p[0]! - tolerance); gx <= cellOf(p[0]! + tolerance); gx++) {
    for (let gy = cellOf(p[1]! - tolerance); gy <= cellOf(p[1]! + tolerance); gy++) {
      grid.cells.get(cellKey(gx, gy))?.forEach(visit);
    }
  }
  grid.large.forEach(visit);
  return best;
}
