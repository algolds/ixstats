/**
 * UPG v2 — BFS / Flood-Fill Utilities
 *
 * Reusable graph traversal primitives for the unified Voronoi mesh.
 */

import type { WorldGraph } from "../types";
import { MinHeap } from "./heap";

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
): { cost: Float64Array; sourceId: Uint16Array } {
  const { cells } = graph;
  const n = cells.n;
  // Float64: Float32 rounding would make fresh heap entries look stale and skip their expansion
  const cost = new Float64Array(n).fill(Infinity);
  const sourceId = new Uint16Array(n);

  const pq = new MinHeap();
  for (const s of sources) {
    cost[s.cell] = 0;
    sourceId[s.cell] = s.id;
    pq.push(0, s.cell);
  }

  while (pq.size > 0) {
    const currentCost = pq.peekKey()!;
    const cell = pq.pop();
    if (currentCost > cost[cell]!) continue; // stale entry

    for (const nb of cells.neighbors[cell]!) {
      if (!canTraverse(nb)) continue;
      const newCost = currentCost + edgeCost(cell, nb);
      if (newCost < cost[nb]!) {
        cost[nb] = newCost;
        sourceId[nb] = sourceId[cell]!;
        pq.push(newCost, nb);
      }
    }
  }

  return { cost, sourceId };
}
