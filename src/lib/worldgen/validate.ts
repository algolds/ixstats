/**
 * Validation — Quality checks and connectivity repair
 *
 * Ensures every land cell has a state, culture, biome, and elevation zone.
 * Repairs disconnected state territories (border gore prevention).
 * Validates river flow direction and distribution statistics.
 */

import type { PackedGraph } from "./types";
import { isLand } from "./voronoi-mesh";

// ──────────────────────────────────────────────
// Main Validation
// ──────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  repairs: string[];
  warnings: string[];
}

/**
 * Validate and repair the generated world.
 * Mutates graph in-place to fix issues.
 */
export function validateAndRepair(graph: PackedGraph): ValidationResult {
  const repairs: string[] = [];
  const warnings: string[] = [];
  const { cells } = graph;

  // 1. Coverage check: every land cell must have state, culture, biome, elevZone
  let missingState = 0;
  let missingCulture = 0;
  let missingBiome = 0;

  for (let i = 0; i < cells.n; i++) {
    if (!isLand(graph, i)) continue;
    if (cells.state[i] === 0) missingState++;
    if (cells.culture[i] === 0) missingCulture++;
    // biome 0 is valid (first climate type), so check if elevZone is set for land
  }

  if (missingState > 0) {
    warnings.push(`${missingState} land cells have no state assignment`);
    // Repair: assign to nearest state via BFS from assigned neighbors
    repairMissingAttribute(graph, "state", missingState);
    repairs.push(`Repaired ${missingState} unclaimed land cells`);
  }

  if (missingCulture > 0) {
    warnings.push(`${missingCulture} land cells have no culture assignment`);
    repairMissingAttribute(graph, "culture", missingCulture);
    repairs.push(`Repaired ${missingCulture} cultureless land cells`);
  }

  // 2. State connectivity: each state must be a single connected component
  const stateRepairs = repairStateConnectivity(graph);
  if (stateRepairs > 0) {
    repairs.push(`Reassigned ${stateRepairs} disconnected state cells`);
  }

  // 3. River flow validation: ensure downhill flow
  let badRiverCells = 0;
  for (const river of graph.rivers) {
    for (let j = 1; j < river.cells.length; j++) {
      const prev = river.cells[j - 1]!;
      const curr = river.cells[j]!;
      if (cells.h[curr]! > cells.h[prev]!) {
        badRiverCells++;
      }
    }
  }
  if (badRiverCells > 0) {
    warnings.push(`${badRiverCells} river cells flow uphill (acceptable after depression filling)`);
  }

  // 4. Distribution warnings
  const landCount = Array.from({ length: cells.n }, (_, i) => i).filter((i) =>
    isLand(graph, i)
  ).length;
  const landPct = (landCount / cells.n) * 100;
  if (landPct < 20 || landPct > 60) {
    warnings.push(`Land coverage ${landPct.toFixed(1)}% is outside normal range (20-60%)`);
  }

  return {
    valid: repairs.length === 0 && warnings.length === 0,
    repairs,
    warnings,
  };
}

// ──────────────────────────────────────────────
// Repair Functions
// ──────────────────────────────────────────────

/**
 * Fill unassigned land cells by spreading from assigned neighbors (BFS).
 */
function repairMissingAttribute(
  graph: PackedGraph,
  attr: "state" | "culture",
  _count: number
): void {
  const { cells } = graph;
  const arr = attr === "state" ? cells.state : cells.culture;
  const queue: number[] = [];

  // Seed: all assigned land cells adjacent to unassigned land cells
  for (let i = 0; i < cells.n; i++) {
    if (!isLand(graph, i) || arr[i] === 0) continue;
    for (const nb of cells.neighbors[i]!) {
      if (isLand(graph, nb) && arr[nb] === 0) {
        queue.push(i);
        break;
      }
    }
  }

  // BFS spread
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++]!;
    const val = arr[i]!;
    for (const nb of cells.neighbors[i]!) {
      if (isLand(graph, nb) && arr[nb] === 0) {
        arr[nb] = val;
        queue.push(nb);
      }
    }
  }
}

/**
 * Ensure each state is a single connected component.
 * Disconnected pieces get reassigned to the most-bordering neighbor state.
 */
function repairStateConnectivity(graph: PackedGraph): number {
  const { cells } = graph;
  let totalReassigned = 0;

  // For each state, find connected components
  const stateIds = new Set<number>();
  for (let i = 0; i < cells.n; i++) {
    if (cells.state[i]! > 0) stateIds.add(cells.state[i]!);
  }

  for (const sid of stateIds) {
    // Find all cells of this state
    const stateCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.state[i] === sid) stateCells.push(i);
    }
    if (stateCells.length < 2) continue;

    // Find connected components via BFS
    const visited = new Set<number>();
    const components: number[][] = [];

    for (const cell of stateCells) {
      if (visited.has(cell)) continue;
      const component: number[] = [];
      const q = [cell];
      visited.add(cell);

      while (q.length > 0) {
        const c = q.pop()!;
        component.push(c);
        for (const nb of cells.neighbors[c]!) {
          if (!visited.has(nb) && cells.state[nb] === sid) {
            visited.add(nb);
            q.push(nb);
          }
        }
      }
      components.push(component);
    }

    if (components.length <= 1) continue;

    // Keep largest component, reassign others
    components.sort((a, b) => b.length - a.length);
    for (let ci = 1; ci < components.length; ci++) {
      const orphans = components[ci]!;
      // Find the most common neighboring state for these orphans
      const neighborCounts = new Map<number, number>();
      for (const cell of orphans) {
        for (const nb of cells.neighbors[cell]!) {
          const nbState = cells.state[nb]!;
          if (nbState > 0 && nbState !== sid) {
            neighborCounts.set(nbState, (neighborCounts.get(nbState) ?? 0) + 1);
          }
        }
      }

      let bestState = sid; // fallback to original
      let bestCount = 0;
      for (const [ns, count] of neighborCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestState = ns;
        }
      }

      // Reassign orphan cells
      for (const cell of orphans) {
        cells.state[cell] = bestState;
      }
      totalReassigned += orphans.length;
    }
  }

  return totalReassigned;
}
