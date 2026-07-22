/**
 * Feature Classification — Azgaar-Style Flood-Fill
 *
 * Identifies connected components of water/land cells and classifies them
 * as ocean, lake, or land mass. Also computes coastal distance via BFS.
 *
 * Mutates graph.cells.f, graph.cells.coastDist, and graph.features in-place.
 */

import { type PackedGraph, type Feature } from "./types";
import { isLand, isWater, cellAreaKm2 } from "./voronoi-mesh";

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Classify all cells into geographic features (ocean basins, land masses, lakes)
 * and compute coastal distance for every cell.
 *
 * @param graph The packed Voronoi graph with heightmap already applied
 */
export function classifyFeatures(graph: PackedGraph): void {
  const { cells } = graph;
  const n = cells.n;

  // Reset
  graph.features = [];
  cells.f.fill(0);
  cells.coastDist.fill(65535);

  // ── Step 1: Flood-fill connected components ──
  const visited = new Uint8Array(n);
  let featureId = 0;

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const isWaterCell = isWater(graph, i);
    const component: number[] = [];

    // BFS to find all connected cells of the same type
    const queue: number[] = [i];
    visited[i] = 1;

    while (queue.length > 0) {
      const cell = queue.shift()!;
      component.push(cell);

      for (const nb of cells.neighbors[cell]!) {
        if (visited[nb]) continue;

        // Only connect to cells of the same type (water-water or land-land)
        const nbIsWater = isWater(graph, nb);
        if (nbIsWater !== isWaterCell) continue;

        visited[nb] = 1;
        queue.push(nb);
      }
    }

    // ── Step 2: Classify the component ──
    let type: Feature["type"];
    let touchesBoundary = false;

    if (isWaterCell) {
      // Check if any cell in this water body touches the grid boundary
      for (const c of component) {
        if (cells.boundary[c]) {
          touchesBoundary = true;
          break;
        }
      }
      type = !touchesBoundary || (component.length <= 15 && !cells.boundary[component[0]!]) ? "lake" : "ocean";
    } else {
      type = "land";
      // Check if land touches boundary (for metadata)
      for (const c of component) {
        if (cells.boundary[c]) {
          touchesBoundary = true;
          break;
        }
      }
    }

    // Compute feature area
    let area = 0;
    for (const c of component) {
      area += cellAreaKm2(graph, c);
    }

    // ── Step 3: Create feature and assign to cells ──
    const feature: Feature = {
      id: featureId,
      type,
      cellCount: component.length,
      area: Math.round(area),
      name: "",
      border: touchesBoundary,
    };
    graph.features.push(feature);

    for (const c of component) {
      cells.f[c] = featureId;
    }

    featureId++;
  }

  // ── Step 4: Compute coastal distance via multi-source BFS ──
  computeCoastalDistance(graph);
}

// ──────────────────────────────────────────────
// Internal: Coastal Distance BFS
// ──────────────────────────────────────────────

/**
 * BFS from all land cells adjacent to water.
 * Each land cell gets its distance (in cell hops) from the nearest coast.
 * Coastal cells (land cells with at least one water neighbor) get distance 0.
 */
function computeCoastalDistance(graph: PackedGraph): void {
  const { cells } = graph;
  const n = cells.n;

  // Find all coastal land cells (seeds for BFS)
  const queue: number[] = [];

  for (let i = 0; i < n; i++) {
    if (!isLand(graph, i)) continue;

    // Check if any neighbor is water
    let isCoastal = false;
    for (const nb of cells.neighbors[i]!) {
      if (isWater(graph, nb)) {
        isCoastal = true;
        break;
      }
    }

    if (isCoastal) {
      cells.coastDist[i] = 0;
      queue.push(i);
    }
  }

  // BFS expansion — only through land cells
  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++]!;
    const nextDist = cells.coastDist[cell]! + 1;

    for (const nb of cells.neighbors[cell]!) {
      if (!isLand(graph, nb)) continue;
      if (cells.coastDist[nb]! <= nextDist) continue;

      cells.coastDist[nb] = nextDist;
      queue.push(nb);
    }
  }
}
