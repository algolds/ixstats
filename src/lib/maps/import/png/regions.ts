/**
 * Connected regions of the label raster, found on its runs (a row's stretches of one label) rather than pixel by
 * pixel: a map has a few hundred runs per row, so labelling and merging stay cheap at 64 megapixels. Regions are
 * 4-connected. A region smaller than the minimum (a speck of colour, a sliver left by anti-aliasing, an island too
 * small to keep) is merged into its largest neighbour and takes its label. Pure.
 */
import type { EngineContext } from "../progress";

export interface RegionStats {
  /** Separate pieces per label (index = label) after merging. */
  partsPerLabel: Map<number, number>;
  /** Pieces merged away, per label they had. */
  mergedPerLabel: Map<number, number>;
  mergedCount: number;
  mergedPixels: number;
}

interface Runs {
  start: Int32Array;
  end: Int32Array;
  label: Uint16Array;
  /** First run of each row; row y's runs are rowStart[y] .. rowStart[y + 1] - 1. */
  rowStart: Int32Array;
  row: Int32Array;
  count: number;
}

function buildRuns(labels: Uint16Array, width: number, height: number): Runs {
  let count = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    count++;
    for (let x = 1; x < width; x++) if (labels[row + x] !== labels[row + x - 1]) count++;
  }
  const runs: Runs = {
    start: new Int32Array(count),
    end: new Int32Array(count),
    label: new Uint16Array(count),
    rowStart: new Int32Array(height + 1),
    row: new Int32Array(count),
    count,
  };
  let r = 0;
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    runs.rowStart[y] = r;
    let x0 = 0;
    for (let x = 1; x <= width; x++) {
      if (x === width || labels[rowOffset + x] !== labels[rowOffset + x0]) {
        runs.start[r] = x0;
        runs.end[r] = x;
        runs.label[r] = labels[rowOffset + x0]!;
        runs.row[r] = y;
        r++;
        x0 = x;
      }
    }
  }
  runs.rowStart[height] = r;
  return runs;
}

function find(parent: Int32Array, i: number): number {
  let root = i;
  while (parent[root] !== root) root = parent[root]!;
  while (parent[i] !== root) {
    const next = parent[i]!;
    parent[i] = root;
    i = next;
  }
  return root;
}

/** Visit each pair of overlapping runs in rows y and y + 1 (overlap length > 0). */
function forOverlaps(runs: Runs, y: number, visit: (upper: number, lower: number, overlap: number) => void) {
  let a = runs.rowStart[y]!;
  const aEnd = runs.rowStart[y + 1]!;
  let b = runs.rowStart[y + 1]!;
  const bEnd = runs.rowStart[y + 2]!;
  while (a < aEnd && b < bEnd) {
    const overlap = Math.min(runs.end[a]!, runs.end[b]!) - Math.max(runs.start[a]!, runs.start[b]!);
    if (overlap > 0) visit(a, b, overlap);
    if (runs.end[a]! <= runs.end[b]!) a++;
    else b++;
  }
}

/**
 * Merge every region smaller than `minPixels` into its largest neighbour (label 0, unfilled, never merges and
 * never absorbs), rewriting the label raster in place.
 */
export async function mergeSmallRegions(
  labels: Uint16Array,
  width: number,
  height: number,
  minPixels: number,
  ctx: EngineContext
): Promise<RegionStats> {
  const runs = buildRuns(labels, width, height);
  const parent = new Int32Array(runs.count);
  for (let i = 0; i < runs.count; i++) parent[i] = i;
  for (let y = 0; y + 1 < height; y++) {
    forOverlaps(runs, y, (a, b) => {
      if (runs.label[a] !== runs.label[b]) return;
      const ra = find(parent, a);
      const rb = find(parent, b);
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    });
    if ((y & 255) === 0) await ctx.tick();
  }

  // Regions: one per union-find root.
  const region = new Int32Array(runs.count);
  const rootRegion = new Map<number, number>();
  const area: number[] = [];
  const regionLabel: number[] = [];
  for (let i = 0; i < runs.count; i++) {
    const root = find(parent, i);
    let id = rootRegion.get(root);
    if (id === undefined) {
      id = area.length;
      rootRegion.set(root, id);
      area.push(0);
      regionLabel.push(runs.label[i]!);
    }
    region[i] = id;
    area[id]! += runs.end[i]! - runs.start[i]!;
  }

  // Each region's runs (counting sort).
  const regionCount = area.length;
  const firstRun = new Int32Array(regionCount + 1);
  for (let i = 0; i < runs.count; i++) firstRun[region[i]! + 1]!++;
  for (let r = 0; r < regionCount; r++) firstRun[r + 1]! += firstRun[r]!;
  const fill = firstRun.slice(0, regionCount);
  const runsOf = new Int32Array(runs.count);
  for (let i = 0; i < runs.count; i++) runsOf[fill[region[i]!]!++] = i;

  const mergedInto = new Int32Array(regionCount);
  for (let r = 0; r < regionCount; r++) mergedInto[r] = r;
  const current = (r: number) => find(mergedInto, r);
  const stats: RegionStats = { partsPerLabel: new Map(), mergedPerLabel: new Map(), mergedCount: 0, mergedPixels: 0 };

  const small = [...Array(regionCount).keys()]
    .filter((r) => area[r]! < minPixels && regionLabel[r] !== 0)
    .sort((a, b) => area[a]! - area[b]!);
  const neighbourArea = new Map<number, number>();
  for (const r of small) {
    if (current(r) !== r || area[r]! >= minPixels) continue;
    neighbourArea.clear();
    const note = (run: number) => {
      const n = current(region[run]!);
      if (n !== r && regionLabel[n] !== 0) neighbourArea.set(n, area[n]!);
    };
    for (let k = firstRun[r]!; k < firstRun[r + 1]!; k++) {
      const run = runsOf[k]!;
      const y = runs.row[run]!;
      if (runs.start[run]! > 0) note(run - 1);
      if (runs.end[run]! < width) note(run + 1);
      for (const yy of [y - 1, y + 1]) {
        if (yy < 0 || yy >= height) continue;
        for (let o = runs.rowStart[yy]!; o < runs.rowStart[yy + 1]!; o++) {
          if (runs.start[o]! >= runs.end[run]!) break;
          if (runs.end[o]! > runs.start[run]!) note(o);
        }
      }
    }
    let target = -1;
    for (const [n, a] of neighbourArea) if (target < 0 || a > area[target]!) target = n;
    if (target < 0) continue;
    mergedInto[r] = target;
    area[target]! += area[r]!;
    stats.mergedCount++;
    stats.mergedPixels += area[r]!;
    stats.mergedPerLabel.set(regionLabel[r]!, (stats.mergedPerLabel.get(regionLabel[r]!) ?? 0) + 1);
    await ctx.tick();
  }

  // Rewrite merged runs with their new label; count the pieces left.
  for (let r = 0; r < regionCount; r++) {
    const target = current(r);
    if (target === r) {
      if (regionLabel[r] !== 0) {
        stats.partsPerLabel.set(regionLabel[r]!, (stats.partsPerLabel.get(regionLabel[r]!) ?? 0) + 1);
      }
      continue;
    }
    const label = regionLabel[target]!;
    if (label === regionLabel[r]) continue;
    for (let k = firstRun[r]!; k < firstRun[r + 1]!; k++) {
      const run = runsOf[k]!;
      labels.fill(label, runs.row[run]! * width + runs.start[run]!, runs.row[run]! * width + runs.end[run]!);
    }
  }
  return stats;
}
