/**
 * Culture Generation — Farthest-Point Seeding + Dijkstra Expansion
 *
 * Places culture seeds on land cells using farthest-point sampling, then
 * expands them via weighted Dijkstra so borders follow natural barriers
 * (mountains, climate zone edges).
 */

import type { PackedGraph, WorldGenParams, Culture } from "./types";
import { makeRng } from "./rng";
import { isLand, cellLat } from "./voronoi-mesh";
import { getLanguageFamilies } from "../procedural-archive/language-families";

// ──────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────

export function generateCultures(graph: PackedGraph, params: WorldGenParams): void {
  const { cells } = graph;
  const n = cells.n;
  const rng = makeRng(params.seed + 300);

  // Collect land cells
  const landCells: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isLand(graph, i)) landCells.push(i);
  }
  if (landCells.length === 0) return;

  // Target culture count
  const cultureCount = Math.min(20, Math.max(6, Math.floor(landCells.length / 1000)));

  // ── Farthest-Point Sampling ────────────────
  const seeds = farthestPointSample(graph, landCells, cultureCount, rng);

  // ── Assign language families ───────────────
  const families = getLanguageFamilies();
  const familyCount = families.length;

  const cultures: Culture[] = [];
  for (let c = 0; c < seeds.length; c++) {
    cultures.push({
      id: c + 1, // 0 = no culture
      name: families[c % familyCount]!.name + " Culture " + (c + 1),
      familyId: families[c % familyCount]!.id,
      center: seeds[c]!,
      cellCount: 0,
    });
  }

  // ── Dijkstra Expansion ─────────────────────
  // Binary min-heap: [cost, cellId, cultureId]
  const heap: [number, number, number][] = [];
  const assigned = new Uint8Array(n); // 1 if cell has been assigned

  function heapPush(cost: number, cell: number, culture: number) {
    heap.push([cost, cell, culture]);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]![0] <= heap[i]![0]) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  }

  function heapPop(): [number, number, number] | undefined {
    if (heap.length === 0) return undefined;
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1,
          r = 2 * i + 2;
        if (l < heap.length && heap[l]![0] < heap[smallest]![0]) smallest = l;
        if (r < heap.length && heap[r]![0] < heap[smallest]![0]) smallest = r;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest]!, heap[i]!];
        i = smallest;
      }
    }
    return top;
  }

  // Initialize seeds
  for (let c = 0; c < seeds.length; c++) {
    const cell = seeds[c]!;
    cells.culture[cell] = c + 1;
    assigned[cell] = 1;
    heapPush(0, cell, c + 1);
  }

  // Expand
  while (heap.length > 0) {
    const [cost, cell, cultureId] = heapPop()!;
    // Skip if already assigned to a different culture (stale entry)
    if (assigned[cell] && cells.culture[cell] !== cultureId) continue;

    const nbrs = cells.neighbors[cell]!;
    for (const nb of nbrs) {
      if (assigned[nb] || !isLand(graph, nb)) continue;

      // Cost function: base distance + terrain penalties
      let edgeCost = 1;
      // Mountain penalty
      const elevDiff = Math.abs((cells.h[nb]! as number) - (cells.h[cell]! as number));
      if (elevDiff > 30) edgeCost += 3;
      // Biome change penalty
      if (cells.b[nb] !== cells.b[cell]) edgeCost += 2;

      const newCost = cost + edgeCost;
      cells.culture[nb] = cultureId;
      assigned[nb] = 1;
      heapPush(newCost, nb, cultureId);
    }
  }

  // ── Count cells per culture ────────────────
  for (let i = 0; i < n; i++) {
    const cId = cells.culture[i]!;
    if (cId > 0 && cId <= cultures.length) {
      cultures[cId - 1]!.cellCount++;
    }
  }

  graph.cultures = cultures;
}

// ──────────────────────────────────────────────
// Farthest-Point Sampling
// ──────────────────────────────────────────────

/**
 * Select `k` seed cells from landCells using farthest-point sampling.
 * First seed is chosen randomly; each subsequent seed is the land cell
 * farthest from any existing seed (measured in cell-hop BFS distance).
 */
function farthestPointSample(
  graph: PackedGraph,
  landCells: number[],
  k: number,
  rng: () => number
): number[] {
  const { cells } = graph;
  const n = cells.n;
  const seeds: number[] = [];

  // Distance from nearest seed (in cell hops)
  const dist = new Uint16Array(n).fill(65535);

  // Pick first seed randomly
  const first = landCells[Math.floor(rng() * landCells.length)]!;
  seeds.push(first);
  bfsUpdateDist(graph, first, dist);

  for (let s = 1; s < k; s++) {
    // Find land cell with maximum distance from any seed
    let bestCell = landCells[0]!;
    let bestDist = 0;
    for (const c of landCells) {
      if (dist[c]! > bestDist) {
        bestDist = dist[c]!;
        bestCell = c;
      }
    }
    seeds.push(bestCell);
    bfsUpdateDist(graph, bestCell, dist);
  }

  return seeds;
}

/**
 * BFS from a seed cell, updating `dist` array to track minimum distance
 * from any seed. Only traverses land cells.
 */
function bfsUpdateDist(graph: PackedGraph, seed: number, dist: Uint16Array): void {
  const { cells } = graph;
  const queue: number[] = [seed];
  const visited = new Uint8Array(cells.n);
  visited[seed] = 1;
  const seedDist = new Uint16Array(cells.n).fill(65535);
  seedDist[seed] = 0;

  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++]!;
    const d = seedDist[cell]!;

    // Update global minimum distance
    if (d < dist[cell]!) dist[cell] = d;

    for (const nb of cells.neighbors[cell]!) {
      if (visited[nb] || !isLand(graph, nb)) continue;
      visited[nb] = 1;
      seedDist[nb] = d + 1;
      queue.push(nb);
    }
  }
}
