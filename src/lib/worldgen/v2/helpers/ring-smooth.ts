/**
 * UPG v2 — Ring smoothing
 *
 * Smooths a merged ring so that borders the ring shares with its neighbours come out identical on both
 * sides. The ring is cut at its corners (where a third region meets it, a map edge begins, or the merge
 * flagged the vertex) into chains; each chain is simplified, splined and oriented the same way whichever
 * ring it is read from, so two rings that cut a border at the same corners get the same curve for it. A
 * ring without corners is a closed chain of its own, started at its lowest vertex and read counter-clockwise.
 *
 * Within a layer the corners are the same on both sides of every border. Across layers they are the same
 * along a coast (the export flags the vertices where a coast changes what it borders in every layer), so
 * the coast is one curve in the background, altitude, climate and political layers. Other borders of one
 * layer (a state border, a contour) are not shared with another layer's borders and need not be.
 */

import { RING_LATITUDE, ringArea, type MergedRing } from "./polygon-merge";
import {
  EDGE_INSET,
  perturbPoints,
  simplifyRing,
  splineSmooth,
  splineSmoothChain,
  type Bounds,
} from "./chaikin";

type Point = [number, number];

/** Fine decimation of collinear/duplicate points (0.001° ≈ 100m) */
const SIMPLIFY_TOLERANCE = 0.001;
const BOUNDS: Bounds = {
  minX: -180,
  maxX: 180,
  minY: -RING_LATITUDE,
  maxY: RING_LATITUDE,
  inset: EDGE_INSET,
};
const PERTURB_SEED = 42;
const PERTURB_FREQUENCY = 0.08;
const PERTURB_AMPLITUDE = 0.004;

/** Lexicographic order of two points. */
function compare(a: Point, b: Point): number {
  return a[0] - b[0] || a[1] - b[1];
}

/** True when the chain, read as given, runs against the canonical direction (lowest end point first). */
function runsBackwards(chain: Point[]): boolean {
  const last = chain.length - 1;
  return (compare(chain[0]!, chain[last]!) || compare(chain[1]!, chain[last - 1]!)) > 0;
}

/** The chain of `ring` from vertex `from` to vertex `to`, going forward round the ring; a full turn when equal. */
function chainBetween<T>(open: readonly T[], from: number, to: number): T[] {
  const length = (to - from + open.length) % open.length;
  const steps = length === 0 ? open.length : length;
  const chain: T[] = [];
  for (let k = 0; k <= steps; k++) chain.push(open[(from + k) % open.length]!);
  return chain;
}

/** True when b is the tip of a spike: the ring comes in along a → b and goes straight back along b → c. */
function isSpike(a: Point, b: Point, c: Point): boolean {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const bcx = c[0] - b[0];
  const bcy = c[1] - b[1];
  return abx * bcy - aby * bcx === 0 && abx * bcx + aby * bcy <= 0;
}

/**
 * Drop the vertices that rounding has turned into repeats or spike tips, where a thin sliver of the ring
 * (a splined border running just beside an edge chain) has been squeezed flat onto its own line.
 */
function tidyRing(ring: Point[]): Point[] {
  const kept: Point[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    kept.push(ring[i]!);
    // A spike tip is the point before the last: the last takes its place
    for (let k = kept.length; k >= 3 && isSpike(kept[k - 3]!, kept[k - 2]!, kept[k - 1]!); k--) {
      kept[k - 2] = kept[k - 1]!;
      kept.pop();
    }
  }
  // The start of the ring is not special: the spike can sit across it
  while (kept.length >= 3) {
    if (isSpike(kept.at(-2)!, kept.at(-1)!, kept[0]!)) kept.pop();
    else if (isSpike(kept.at(-1)!, kept[0]!, kept[1]!)) kept.shift();
    else break;
  }
  if (kept.length >= 3) kept.push([kept[0]![0], kept[0]![1]]);
  return kept;
}

/** A smoothed chain or loop, in its canonical direction, and its perturbation once a ring has asked for it. */
interface SmoothedRun {
  points: Point[];
  perturbed: Point[] | null;
}

/**
 * Smoothed chains and corner-free loops of one mesh, by the vertex ids they run through. Smoothing depends on
 * the points alone (a chain is read in its canonical direction whichever ring it comes from), and equal ids
 * are equal points, so a run smoothed once serves every ring that has it: a border is read from both sides, a
 * coast in every layer. Use one cache per graph.
 */
export class SmoothingCache {
  private readonly runs = new Map<number, Array<SmoothedRun & { ids: number[]; passes: number }>>();

  /** The run through `ids`, smoothed by `smooth` the first time it is asked for. */
  get(ids: number[], passes: number, smooth: () => Point[]): SmoothedRun {
    let hash = Math.imul(ids.length, 0x9e3779b1) ^ passes;
    for (const id of ids) hash = Math.imul(hash ^ id, 0x01000193);
    let bucket = this.runs.get(hash);
    if (bucket) {
      for (const run of bucket) if (run.passes === passes && sameIds(run.ids, ids)) return run;
    } else {
      bucket = [];
      this.runs.set(hash, bucket);
    }
    const run = { ids, passes, points: smooth(), perturbed: null };
    bucket.push(run);
    return run;
  }
}

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Smooth one merged ring: its chains between corners, then the harmonic perturbation of cartographic
 * detail, which moves a point by a function of where it is, so shared points stay shared. Returns a ring
 * with fewer than 4 points when the ring has collapsed.
 *
 * With a cache, a ring from `mergeCells` (which records its vertex ids) takes the chains other rings of the
 * mesh have smoothed already; the result is the same.
 */
export function smoothRing(ring: MergedRing, passes: number, cache?: SmoothingCache): Point[] {
  const open = (ring.coordinates as Point[]).slice(0, -1);
  const { corners } = ring;
  const ids = cache && ring.vertices?.length === open.length ? ring.vertices : undefined;
  const smoothRun = (runIds: number[] | undefined, smooth: () => Point[]): SmoothedRun =>
    cache && runIds ? cache.get(runIds, passes, smooth) : { points: smooth(), perturbed: null };

  // The runs the ring is made of, each with whether the ring reads it backwards
  const runs: { run: SmoothedRun; backwards: boolean }[] = [];
  if (corners.length === 0) {
    // A closed ring without corners: from its lowest vertex, counter-clockwise
    let lowest = 0;
    for (let i = 1; i < open.length; i++) if (compare(open[i]!, open[lowest]!) < 0) lowest = i;
    const started = [...open.slice(lowest), ...open.slice(0, lowest)];
    started.push([started[0]![0], started[0]![1]]);
    const startedIds = ids && [...ids.slice(lowest), ...ids.slice(0, lowest), ids[lowest]!];
    const clockwise = ringArea(started) < 0;
    if (clockwise) {
      started.reverse();
      startedIds?.reverse();
    }
    const run = smoothRun(startedIds, () =>
      splineSmooth(simplifyRing(started, SIMPLIFY_TOLERANCE), passes, BOUNDS)
    );
    runs.push({ run, backwards: clockwise });
  } else {
    corners.forEach((corner, k) => {
      const to = corners[(k + 1) % corners.length]!;
      const chain = chainBetween(open, corner, to);
      const chainIds = ids && chainBetween(ids, corner, to);
      const backwards = runsBackwards(chain);
      if (backwards) {
        chain.reverse();
        chainIds?.reverse();
      }
      const run = smoothRun(chainIds, () =>
        splineSmoothChain(simplifyRing(chain, SIMPLIFY_TOLERANCE), passes, BOUNDS)
      );
      runs.push({ run, backwards });
    });
  }

  // Each run without its last point (the next run's first; a loop's own first), in fresh points, then the
  // closing point. A ring of fewer than 3 points is left unperturbed.
  let length = 1;
  for (const { run } of runs) length += run.points.length - 1;
  const joined: Point[] = [];
  for (const { run, backwards } of runs) {
    const points = length >= 3 ? perturbedRun(run) : run.points;
    if (backwards) for (let j = points.length - 1; j >= 1; j--) joined.push(copy(points[j]!));
    else for (let j = 0; j < points.length - 1; j++) joined.push(copy(points[j]!));
  }
  joined.push(copy(joined[0]!));
  return tidyRing(joined);
}

const copy = (point: Point): Point => [point[0], point[1]];

function perturbedRun(run: SmoothedRun): Point[] {
  run.perturbed ??= perturbPoints(run.points, PERTURB_SEED, PERTURB_FREQUENCY, PERTURB_AMPLITUDE);
  return run.perturbed;
}
