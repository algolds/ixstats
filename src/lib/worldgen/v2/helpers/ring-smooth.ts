/**
 * UPG v2 — Ring smoothing
 *
 * Smooths a merged ring so that borders the ring shares with its neighbours come out identical on both
 * sides. The ring is cut at its corners (where a third region meets it) into chains; each chain is
 * simplified, splined and oriented the same way whichever ring it is read from, so two rings that share a
 * chain get the same curve for it. A ring without corners is a closed chain of its own, started at its
 * lowest vertex and read counter-clockwise.
 */

import { RING_LATITUDE, type MergedRing } from "./polygon-merge";
import {
  catmullRomSmooth,
  catmullRomSmoothChain,
  perturbRing,
  simplifyRing,
  type Bounds,
} from "./chaikin";

type Point = [number, number];

/** Fine decimation of collinear/duplicate points (0.001° ≈ 100m) */
const SIMPLIFY_TOLERANCE = 0.001;
/** A splined point that would cross the edge of the map is put this far inside it instead. */
const EDGE_INSET = 0.01;
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

function smoothChain(chain: Point[], passes: number): Point[] {
  const backwards = runsBackwards(chain);
  const ordered = backwards ? chain.slice().reverse() : chain;
  const smoothed = catmullRomSmoothChain(simplifyRing(ordered, SIMPLIFY_TOLERANCE), passes, BOUNDS);
  return backwards ? smoothed.reverse() : smoothed;
}

/** Signed area, positive counter-clockwise. */
function orientation(ring: Point[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += (ring[i]![0] - ring[i + 1]![0]) * (ring[i + 1]![1] + ring[i]![1]);
  }
  return area;
}

/** Smooth a closed ring that has no corners: from its lowest vertex, counter-clockwise. */
function smoothLoop(ring: Point[], passes: number): Point[] {
  const open = ring.slice(0, -1);
  let lowest = 0;
  for (let i = 1; i < open.length; i++) if (compare(open[i]!, open[lowest]!) < 0) lowest = i;
  const started = [...open.slice(lowest), ...open.slice(0, lowest)];
  started.push([started[0]![0], started[0]![1]]);

  const clockwise = orientation(started) < 0;
  const ordered = clockwise ? started.reverse() : started;
  const smoothed = catmullRomSmooth(simplifyRing(ordered, SIMPLIFY_TOLERANCE), passes, BOUNDS);
  return clockwise ? smoothed.reverse() : smoothed;
}

/** The chain of `ring` from vertex `from` to vertex `to`, going forward round the ring; a full turn when equal. */
function chainBetween(open: Point[], from: number, to: number): Point[] {
  const length = (to - from + open.length) % open.length;
  const steps = length === 0 ? open.length : length;
  const chain: Point[] = [];
  for (let k = 0; k <= steps; k++) chain.push(open[(from + k) % open.length]!);
  return chain;
}

/** True when b is the tip of a spike: the ring comes in along a → b and goes straight back along b → c. */
function isSpike(a: Point, b: Point, c: Point): boolean {
  const [abx, aby, bcx, bcy] = [b[0] - a[0], b[1] - a[1], c[0] - b[0], c[1] - b[1]];
  return abx * bcy - aby * bcx === 0 && abx * bcx + aby * bcy <= 0;
}

/**
 * Drop the vertices that rounding has turned into repeats or spike tips, where a thin sliver of the ring
 * (a splined border running just beside an edge chain) has been squeezed flat onto its own line.
 */
function tidyRing(ring: Point[]): Point[] {
  const kept: Point[] = [];
  for (const point of ring.slice(0, -1)) {
    kept.push(point);
    while (kept.length >= 3 && isSpike(kept.at(-3)!, kept.at(-2)!, kept.at(-1)!)) {
      kept.splice(kept.length - 2, 1);
    }
  }
  // The start of the ring is not special: the spike can sit across it
  while (kept.length >= 3) {
    if (isSpike(kept.at(-2)!, kept.at(-1)!, kept[0]!)) kept.pop();
    else if (isSpike(kept.at(-1)!, kept[0]!, kept[1]!)) kept.shift();
    else break;
  }
  return kept.length < 3 ? kept : [...kept, [kept[0]![0], kept[0]![1]]];
}

/**
 * Smooth one merged ring: its chains between corners, then the harmonic perturbation of cartographic
 * detail, which moves a point by a function of where it is, so shared points stay shared. Returns a ring
 * with fewer than 4 points when the ring has collapsed.
 */
export function smoothRing(ring: MergedRing, passes: number): Point[] {
  const points = ring.coordinates as Point[];
  const { corners } = ring;
  let smoothed: Point[];
  if (corners.length === 0) {
    smoothed = smoothLoop(points, passes);
  } else {
    const open = points.slice(0, -1);
    smoothed = [];
    corners.forEach((corner, k) => {
      const chain = smoothChain(
        chainBetween(open, corner, corners[(k + 1) % corners.length]!),
        passes
      );
      smoothed.push(...chain.slice(0, -1));
    });
    smoothed.push([smoothed[0]![0], smoothed[0]![1]]);
  }
  return tidyRing(perturbRing(smoothed, PERTURB_SEED, PERTURB_FREQUENCY, PERTURB_AMPLITUDE));
}
