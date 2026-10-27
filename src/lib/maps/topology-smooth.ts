/**
 * Coverage-preserving smoothing: Chaikin corner cutting on the arcs of a TopoJSON topology (unquantized, absolute
 * coordinates), so two shapes that share a border share its smoothed course too. An arc's end points stay where
 * they are (the junctions where three shapes meet, and where the arc starts on a ring); a closed arc that meets no
 * other arc (an island's whole coast) is smoothed all the way round. A cut is a quarter of the segment, at most
 * `maxCut`, so a long straight edge keeps a tight corner. Each round of cutting doubles an arc's
 * vertices; `prune` then drops the vertices that span less than that triangle area (Visvalingam, as
 * topojson-simplify does), which leaves the curves and thins the straight runs. Pure.
 */

// TopoJSON packages are CommonJS.
const topoSimplify = require("topojson-simplify") as {
  presimplify: <T extends ArcTopology>(topology: T) => T;
  simplify: <T extends ArcTopology>(topology: T, minWeight?: number) => T;
};

export interface ArcTopology {
  arcs: number[][][];
}

/** The point `distance` along a → b. */
const along = (a: readonly number[], b: readonly number[], distance: number): number[] => {
  const length = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) || 1;
  const t = distance / length;
  return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t];
};

/** Where a segment is cut: a quarter in from each end, at most `maxCut` (a long edge keeps a tight corner). */
function cuts(a: readonly number[], b: readonly number[], maxCut: number): [number[], number[]] {
  const length = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
  const d = Math.min(length / 4, maxCut);
  return [along(a, b, d), along(a, b, length - d)];
}

/** One round of corner cutting on an open line: both end points kept. */
function cutOpen(points: readonly number[][], maxCut: number): number[][] {
  const last = points.length - 1;
  const out: number[][] = [points[0]!];
  for (let i = 0; i < last; i++) {
    const [q, r] = cuts(points[i]!, points[i + 1]!, maxCut);
    if (i > 0) out.push(q);
    if (i < last - 1) out.push(r);
  }
  out.push(points[last]!);
  return out;
}

/** One round of corner cutting on a closed ring (first position repeated last): every corner cut. */
function cutClosed(points: readonly number[][], maxCut: number): number[][] {
  const n = points.length - 1;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) out.push(...cuts(points[i]!, points[(i + 1) % n]!, maxCut));
  out.push(out[0]!);
  return out;
}

/**
 * Chaikin's corner cutting, `iterations` rounds, each cut at most `maxCut` from the corner. A line of two points
 * (or a ring of three) is left as it is.
 */
export function chaikin(
  points: readonly number[][],
  iterations: number,
  closed: boolean,
  maxCut = Infinity
): number[][] {
  let out = points.map((p) => [p[0]!, p[1]!]);
  if (out.length < (closed ? 4 : 3)) return out;
  for (let i = 0; i < iterations; i++) out = closed ? cutClosed(out, maxCut) : cutOpen(out, maxCut);
  return out;
}

const pointKey = (p: readonly number[]) => `${p[0]},${p[1]}`;
const isClosed = (arc: readonly number[][]) =>
  arc.length > 3 && pointKey(arc[0]!) === pointKey(arc[arc.length - 1]!);

/** The topology with every arc smoothed (see the module comment); its objects are untouched. */
export function smoothTopology<T extends ArcTopology>(
  topology: T,
  options: { iterations: number; prune?: number; maxCut?: number }
): T {
  if (options.iterations <= 0) return topology;
  const ends = new Map<string, number>();
  for (const arc of topology.arcs) {
    if (arc.length === 0) continue;
    for (const p of [arc[0]!, arc[arc.length - 1]!]) {
      ends.set(pointKey(p), (ends.get(pointKey(p)) ?? 0) + 1);
    }
  }
  const arcs = topology.arcs.map((arc) => {
    const ring = isClosed(arc) && ends.get(pointKey(arc[0]!)) === 2;
    return chaikin(arc, options.iterations, ring, options.maxCut);
  });
  const smoothed = { ...topology, arcs };
  return options.prune && options.prune > 0
    ? topoSimplify.simplify(topoSimplify.presimplify(smoothed), options.prune)
    : smoothed;
}
