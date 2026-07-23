/**
 * UPG v2 — BFS / Flood-Fill Utilities
 *
 * Reusable graph traversal primitives for the unified Voronoi mesh.
 */

import type { WorldGraph } from "../types";

/**
 * Flood-fill from a starting cell, visiting all connected cells that
 * satisfy the predicate. Returns the list of visited cell IDs.
 */
export function floodFill(
  graph: WorldGraph,
  startCell: number,
  predicate: (cellId: number) => boolean
): number[] {
  const { cells } = graph;
  const visited = new Uint8Array(cells.n);
  const component: number[] = [];
  const queue: number[] = [startCell];
  visited[startCell] = 1;

  while (queue.length > 0) {
    const cell = queue.pop()!;
    if (!predicate(cell)) continue;
    component.push(cell);

    for (const nb of cells.neighbors[cell]!) {
      if (!visited[nb]) {
        visited[nb] = 1;
        queue.push(nb);
      }
    }
  }

  return component;
}

/**
 * Multi-source BFS spread from seed cells.
 * Assigns every reachable cell the ID of the nearest seed (by hop distance).
 * Returns per-cell assignment and per-cell distance.
 */
export function bfsAssign(
  graph: WorldGraph,
  seeds: number[],
  seedIds: number[],
  canTraverse: (cellId: number) => boolean = () => true
): { assignment: Uint16Array; distance: Uint16Array } {
  const { cells } = graph;
  const n = cells.n;
  const assignment = new Uint16Array(n);
  const distance = new Uint16Array(n).fill(65535);
  const queue: number[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const cell = seeds[i]!;
    assignment[cell] = seedIds[i]!;
    distance[cell] = 0;
    queue.push(cell);
  }

  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++]!;
    const nextDist = distance[cell]! + 1;

    for (const nb of cells.neighbors[cell]!) {
      if (distance[nb]! <= nextDist) continue;
      if (!canTraverse(nb)) continue;

      assignment[nb] = assignment[cell]!;
      distance[nb] = nextDist;
      queue.push(nb);
    }
  }

  return { assignment, distance };
}

/**
 * Find all connected components within a set of cell IDs.
 * Returns an array of components, each being an array of cell IDs.
 */
export function findConnectedComponents(
  graph: WorldGraph,
  cellSet: Set<number>
): number[][] {
  const { cells } = graph;
  const visited = new Set<number>();
  const components: number[][] = [];

  for (const cell of cellSet) {
    if (visited.has(cell)) continue;

    const component: number[] = [];
    const queue = [cell];
    visited.add(cell);

    while (queue.length > 0) {
      const c = queue.pop()!;
      component.push(c);

      for (const nb of cells.neighbors[c]!) {
        if (!visited.has(nb) && cellSet.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Compute coastal distance via multi-source BFS from land-water boundaries.
 * Mutates graph.cells.coastDist in-place.
 */
export function computeCoastalDistance(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;
  cells.coastDist.fill(65535);

  const queue: number[] = [];

  // Seed: all land cells adjacent to water
  for (let i = 0; i < n; i++) {
    if (!cells.isLand[i]) continue;
    let isCoastal = false;
    for (const nb of cells.neighbors[i]!) {
      if (!cells.isLand[nb]) {
        isCoastal = true;
        break;
      }
    }
    if (isCoastal) {
      cells.coastDist[i] = 0;
      queue.push(i);
    }
  }

  // BFS spread through land only
  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++]!;
    const nextDist = cells.coastDist[cell]! + 1;

    for (const nb of cells.neighbors[cell]!) {
      if (!cells.isLand[nb]) continue;
      if (cells.coastDist[nb]! <= nextDist) continue;
      cells.coastDist[nb] = nextDist;
      queue.push(nb);
    }
  }
}

/**
 * Dijkstra shortest path from multiple sources with custom edge cost.
 * Returns per-cell cost and per-cell predecessor.
 */
export function dijkstraMultiSource(
  graph: WorldGraph,
  sources: { cell: number; id: number }[],
  edgeCost: (from: number, to: number) => number,
  canTraverse: (cellId: number) => boolean = () => true
): { cost: Float32Array; sourceId: Uint16Array } {
  const { cells } = graph;
  const n = cells.n;
  const cost = new Float32Array(n).fill(Infinity);
  const sourceId = new Uint16Array(n);

  // Simple priority queue using sorted insertion (adequate for 50K cells)
  // For production perf, swap to a proper binary heap.
  const pq: { cell: number; cost: number }[] = [];

  for (const s of sources) {
    cost[s.cell] = 0;
    sourceId[s.cell] = s.id;
    pq.push({ cell: s.cell, cost: 0 });
  }

  // Sort ascending by cost
  pq.sort((a, b) => a.cost - b.cost);

  while (pq.length > 0) {
    const { cell, cost: currentCost } = pq.shift()!;
    if (currentCost > cost[cell]!) continue; // stale entry

    for (const nb of cells.neighbors[cell]!) {
      if (!canTraverse(nb)) continue;
      const newCost = currentCost + edgeCost(cell, nb);
      if (newCost < cost[nb]!) {
        cost[nb] = newCost;
        sourceId[nb] = sourceId[cell]!;
        // Binary search insert to maintain sorted order
        let lo = 0, hi = pq.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (pq[mid]!.cost < newCost) lo = mid + 1;
          else hi = mid;
        }
        pq.splice(lo, 0, { cell: nb, cost: newCost });
      }
    }
  }

  return { cost, sourceId };
}
