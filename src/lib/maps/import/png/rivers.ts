/**
 * Rivers from a geography map: the art's river colour on land, thinned to centre lines and traced into lines.
 *
 *   river-coloured land pixels, none within `coastMargin` px of water (a lake's outline, a coast's stroke)
 *   → grown by one pixel, so a river broken by a border, a symbol or a label's gap of up to two pixels is joined
 *   → thinned to one pixel (Zhang-Suen, then the corner pixels of its steps dropped) → traced as a graph: a line
 *     between every two ends or forks (touching fork pixels are one fork)
 *   → spurs (a branch shorter than `spurLength` px off a fork: a letter's stub where a label touched the river)
 *     dropped → river systems (connected lines) shorter than `minLength` px dropped (labels, symbols, specks)
 *   → lines that meet end to end joined → each simplified (Douglas-Peucker, `simplify` px) and smoothed
 *     (Chaikin, its ends kept); a line of no length (a fork's own loop simplified away) dropped.
 *
 * Works on the river pixels only (a few per cent of a map), never on the whole raster, apart from one pass to
 * find them. Lines are in pixel coordinates (pixel centres); the caller georeferences them. Pure.
 */
import { chaikin } from "~/lib/maps/topology-smooth";
import { hexToRgb } from "../colour";
import type { DecodedImage } from "./decode";

export interface RiverOptions {
  /** The art's river colours. */
  colours: readonly string[];
  /** Largest RGB distance from a river colour that is still river. */
  tolerance: number;
  /** River pixels this close (px) to water are the water's outline, not a river. */
  coastMargin: number;
  /** Shortest river system kept, in px of line. */
  minLength: number;
  /** Longest branch off a fork that is a spur, in px. */
  spurLength: number;
  /** Douglas-Peucker tolerance, px. */
  simplify: number;
  /** Rounds of corner cutting after simplifying. */
  smooth: number;
  /** A corner cut is at most this many px. */
  maxCut: number;
}

/** One river system: the lines of one connected river network, in pixel coordinates. */
type RiverSystem = number[][][];

const NEIGHBOURS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
] as const;

/** Grid of the river pixels: the mask and its size. */
interface Grid {
  mask: Uint8Array;
  width: number;
  height: number;
}

const at = (g: Grid, x: number, y: number) =>
  x >= 0 && y >= 0 && x < g.width && y < g.height ? g.mask[y * g.width + x]! : 0;

/** The pixels of `image` within `tolerance` (RGB distance) of a river colour, on land (`isLand`). */
function riverPixels(
  image: DecodedImage,
  isLand: (p: number) => boolean,
  options: Pick<RiverOptions, "colours" | "tolerance">
): number[] {
  const targets = options.colours.map(hexToRgb);
  const max = options.tolerance * options.tolerance;
  const { data } = image;
  const out: number[] = [];
  for (let p = 0; p < image.width * image.height; p++) {
    const o = p * 4;
    const near = targets.some(([r, g, b]) => {
      const dr = data[o]! - r;
      const dg = data[o + 1]! - g;
      const db = data[o + 2]! - b;
      return dr * dr + dg * dg + db * db <= max;
    });
    if (near && isLand(p)) out.push(p);
  }
  return out;
}

/** Whether a pixel has water (not land) within `margin` px. */
function nearWater(
  p: number,
  width: number,
  height: number,
  margin: number,
  isLand: (p: number) => boolean
) {
  const x0 = p % width;
  const y0 = (p - x0) / width;
  for (let y = Math.max(0, y0 - margin); y <= Math.min(height - 1, y0 + margin); y++) {
    for (let x = Math.max(0, x0 - margin); x <= Math.min(width - 1, x0 + margin); x++) {
      if (!isLand(y * width + x)) return true;
    }
  }
  return false;
}

/** The river mask: the pixels away from water, grown by one pixel on land. */
function riverMask(
  pixels: readonly number[],
  width: number,
  height: number,
  isLand: (p: number) => boolean,
  coastMargin: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const p of pixels) {
    if (nearWater(p, width, height, coastMargin, isLand)) continue;
    const x = p % width;
    const y = (p - x) / width;
    for (const [dx, dy] of [[0, 0], ...NEIGHBOURS]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && isLand(ny * width + nx)) {
        mask[ny * width + nx] = 1;
      }
    }
  }
  return mask;
}

/** The 8 neighbours of (x, y), clockwise from north-west, as 0/1. */
const ring = (g: Grid, x: number, y: number) => NEIGHBOURS.map(([dx, dy]) => at(g, x + dx, y + dy));

/** Zhang-Suen: whether the pixel is removed in this sub-iteration (`step` 0 or 1). Ring: P2..P9 from north. */
function removable(g: Grid, x: number, y: number, step: number): boolean {
  // Zhang-Suen's P2..P9 run clockwise from north: N, NE, E, SE, S, SW, W, NW.
  const n = ring(g, x, y);
  const p = [n[1]!, n[2]!, n[3]!, n[4]!, n[5]!, n[6]!, n[7]!, n[0]!];
  const count = p.reduce((s, v) => s + v, 0);
  if (count < 2 || count > 6) return false;
  let transitions = 0;
  for (let i = 0; i < 8; i++) if (p[i] === 0 && p[(i + 1) % 8] === 1) transitions++;
  if (transitions !== 1) return false;
  const [p2 = 0, , p4 = 0, , p6 = 0, , p8 = 0] = p;
  return step === 0
    ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0
    : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
}

/** Thin the mask to one-pixel lines in place (Zhang-Suen), visiting only its set pixels. */
export function thin(mask: Uint8Array, width: number, height: number): void {
  const g: Grid = { mask, width, height };
  let live: number[] = [];
  for (let p = 0; p < mask.length; p++) if (mask[p]) live.push(p);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const gone = live.filter((p) => removable(g, p % width, Math.floor(p / width), step));
      for (const p of gone) mask[p] = 0;
      if (gone.length > 0) changed = true;
      live = live.filter((p) => mask[p]);
    }
  }
}

/** Set neighbours of a skeleton pixel, as pixel indices. */
function neighbours(g: Grid, p: number): number[] {
  const x = p % g.width;
  const y = (p - x) / g.width;
  const out: number[] = [];
  for (const [dx, dy] of NEIGHBOURS) {
    if (at(g, x + dx, y + dy)) out.push((y + dy) * g.width + x + dx);
  }
  return out;
}

/**
 * Drop the corner pixels of the skeleton's steps: a pixel whose only two neighbours are a horizontal and a vertical
 * one (which touch diagonally without it). Thinning leaves them, and they would read as forks.
 */
export function removeCorners(mask: Uint8Array, width: number, height: number): void {
  const g: Grid = { mask, width, height };
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const around = neighbours(g, p);
    if (around.length !== 2) continue;
    const [a, b] = around.map((n) => n - p);
    const straight = (d: number) => d === 1 || d === -1 || d === width || d === -width;
    const horizontal = (d: number) => d === 1 || d === -1;
    if (straight(a!) && straight(b!) && horizontal(a!) !== horizontal(b!)) mask[p] = 0;
  }
}

/** A traced line of the skeleton: its pixel centres, and the junctions (or free ends) it runs between. */
export interface SkeletonLine {
  points: number[][];
  from: number;
  to: number;
}

const centre = (p: number, width: number) => [(p % width) + 0.5, Math.floor(p / width) + 0.5];
const stepKey = (a: number, b: number) => `${a}>${b}`;

/** The skeleton's junctions: touching pixels that are not plain line pixels are one junction, at their centre. */
function junctions(g: Grid, degree: ReadonlyMap<number, number>) {
  const junctionOf = new Map<number, number>();
  const centres: number[][] = [];
  for (const [p, d] of degree) {
    if (d === 2 || junctionOf.has(p)) continue;
    const id = centres.length;
    const members = [p];
    junctionOf.set(p, id);
    for (let i = 0; i < members.length; i++) {
      for (const n of neighbours(g, members[i]!)) {
        if (degree.get(n) === 2 || junctionOf.has(n)) continue;
        junctionOf.set(n, id);
        members.push(n);
      }
    }
    const cs = members.map((m) => centre(m, g.width));
    centres.push([0, 1].map((k) => cs.reduce((s, c) => s + c[k]!, 0) / cs.length));
  }
  return { junctionOf, centres };
}

/** Walk from `from` through `first` to the next junction pixel (or round a loop back to `from`). */
function walk(
  g: Grid,
  from: number,
  first: number,
  isJunction: (p: number) => boolean,
  used: Set<string>
) {
  const path = [from, first];
  let prev = from;
  let cur = first;
  while (!isJunction(cur) && cur !== from) {
    const next = neighbours(g, cur).find((n) => n !== prev && !used.has(stepKey(cur, n)));
    if (next === undefined) break;
    used.add(stepKey(cur, next)).add(stepKey(next, cur));
    path.push(next);
    prev = cur;
    cur = next;
  }
  return path;
}

/**
 * The skeleton as lines between its junctions and free ends (each a junction of one pixel), with loops that have
 * none. A line's end points are its junctions' centres, so lines meeting at a fork meet exactly.
 */
export function skeletonLines(mask: Uint8Array, width: number, height: number): SkeletonLine[] {
  const g: Grid = { mask, width, height };
  const degree = new Map<number, number>();
  for (let p = 0; p < mask.length; p++) if (mask[p]) degree.set(p, neighbours(g, p).length);
  const { junctionOf, centres } = junctions(g, degree);
  const used = new Set<string>();
  const lines: SkeletonLine[] = [];
  const endAt = (p: number) => {
    const known = junctionOf.get(p);
    if (known !== undefined) return known;
    junctionOf.set(p, centres.length);
    centres.push(centre(p, width));
    return centres.length - 1;
  };
  const start = (p: number) => {
    for (const n of neighbours(g, p)) {
      if (used.has(stepKey(p, n)) || (junctionOf.has(n) && junctionOf.get(n) === junctionOf.get(p)))
        continue;
      used.add(stepKey(p, n)).add(stepKey(n, p));
      const path = walk(g, p, n, (q) => junctionOf.has(q), used);
      const from = endAt(p);
      const to = endAt(path[path.length - 1]!);
      const points = path.map((q) => centre(q, width));
      points[0] = centres[from]!;
      points[points.length - 1] = centres[to]!;
      lines.push({ points, from, to });
    }
  };
  // The walks add free ends as junctions; start from the junctions found before them.
  const seeds = Array.from(junctionOf.keys());
  for (const p of seeds) start(p);
  for (const [p] of degree) start(p); // loops: plain line pixels none of whose steps were walked
  return lines;
}

const lineLength = (points: readonly number[][]) => {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += Math.hypot(points[i]![0]! - points[i - 1]![0]!, points[i]![1]! - points[i - 1]![1]!);
  }
  return sum;
};

/** How many line ends meet at each junction. */
function endCounts(lines: readonly SkeletonLine[]): Map<number, number> {
  const ends = new Map<number, number>();
  for (const { from, to } of lines) for (const j of [from, to]) ends.set(j, (ends.get(j) ?? 0) + 1);
  return ends;
}

/** Drop the branches shorter than `spurLength` that end free on one side and at a fork on the other. */
export function pruneSpurs(lines: SkeletonLine[], spurLength: number): SkeletonLine[] {
  const ends = endCounts(lines);
  return lines.filter(({ from, to, points }) => {
    const a = ends.get(from)!;
    const b = ends.get(to)!;
    const spur = (a === 1 && b >= 3) || (b === 1 && a >= 3);
    return !spur || lineLength(points) >= spurLength;
  });
}

/** Join lines that meet end to end at a junction no third line reaches, so a river is one line between forks. */
export function chainLines(lines: readonly SkeletonLine[]): SkeletonLine[] {
  const ends = endCounts(lines);
  const byJunction = new Map<number, number[]>();
  lines.forEach((line, i) => {
    for (const j of [line.from, line.to]) byJunction.set(j, [...(byJunction.get(j) ?? []), i]);
  });
  const done = new Uint8Array(lines.length);
  const out: SkeletonLine[] = [];
  /** Extend `chain` past its `to` end while the junction there joins exactly two lines. */
  const extend = (chain: SkeletonLine) => {
    while (ends.get(chain.to) === 2 && chain.to !== chain.from) {
      const next = byJunction.get(chain.to)!.find((i) => !done[i]);
      if (next === undefined) break;
      done[next] = 1;
      const line = lines[next]!;
      const forward = line.from === chain.to;
      const points = forward ? line.points : [...line.points].reverse();
      chain.points.push(...points.slice(1));
      chain.to = forward ? line.to : line.from;
    }
  };
  lines.forEach((line, i) => {
    if (done[i]) return;
    done[i] = 1;
    const chain = { points: [...line.points], from: line.from, to: line.to };
    extend(chain);
    const back = { points: [...chain.points].reverse(), from: chain.to, to: chain.from };
    extend(back);
    out.push(back);
  });
  return out;
}

/** The lines grouped by river system (lines that meet at a junction), each system's length with it. */
function systems(lines: readonly SkeletonLine[]) {
  const parent = new Map<number, number>();
  const find = (j: number): number => {
    const p = parent.get(j) ?? j;
    if (p === j) return j;
    const root = find(p);
    parent.set(j, root);
    return root;
  };
  for (const { from, to } of lines) parent.set(find(from), find(to));
  const groups = new Map<number, { lines: number[][][]; length: number }>();
  for (const line of lines) {
    const root = find(line.from);
    const group = groups.get(root) ?? { lines: [], length: 0 };
    group.lines.push(line.points);
    group.length += lineLength(line.points);
    groups.set(root, group);
  }
  return [...groups.values()];
}

/** A point's distance from the line through a and b (from a itself when they coincide: a loop). */
function offset(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0]! - a[0]!, p[1]! - a[1]!);
  return Math.abs(dx * (a[1]! - p[1]!) - (a[0]! - p[0]!) * dy) / len;
}

/** Douglas-Peucker on a polyline (its ends kept; a loop keeps its far side). */
export function simplifyLine(points: number[][], tolerance: number): number[][] {
  if (points.length < 3 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = offset(points[i]!, points[a]!, points[b]!);
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst < 0) continue;
    keep[worst] = 1;
    stack.push([a, worst], [worst, b]);
  }
  return points.filter((_, i) => keep[i]);
}

/** Trace the rivers of a geography map (see the module comment): river systems of pixel-coordinate lines. */
export function traceRivers(
  image: DecodedImage,
  isLand: (p: number) => boolean,
  options: RiverOptions
): { systems: RiverSystem[]; pixels: number; dropped: number } {
  const { width, height } = image;
  const pixels = riverPixels(image, isLand, options);
  const mask = riverMask(pixels, width, height, isLand, options.coastMargin);
  thin(mask, width, height);
  removeCorners(mask, width, height);
  const lines = chainLines(pruneSpurs(skeletonLines(mask, width, height), options.spurLength));
  const all = systems(lines);
  const kept = all.filter((s) => s.length >= options.minLength);
  return {
    pixels: pixels.length,
    dropped: all.length - kept.length,
    systems: kept
      .sort((a, b) => b.length - a.length)
      .map((s) =>
        s.lines
          .map((line) =>
            chaikin(simplifyLine(line, options.simplify), options.smooth, false, options.maxCut)
          )
          .filter((line) => lineLength(line) > 0)
      )
      .filter((system) => system.length > 0),
  };
}
