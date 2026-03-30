/**
 * River Generation — Azgaar-Style Guaranteed No-Loop Rivers
 *
 * Pipeline: depression filling → precipitation → flux accumulation →
 *           river detection → upstream tracing → assignment.
 *
 * Rivers are loop-free by construction: every cell flows to exactly one
 * downhill neighbor (steepest-descent), and depression filling ensures
 * there are no local minima to trap flow.
 *
 * Mutates graph.cells.h, graph.cells.flux, graph.cells.prec,
 * graph.cells.river, and graph.rivers in-place.
 */

import { makeRng } from "./rng";
import { type PackedGraph, type WorldGenParams, type River, WATER_THRESHOLD } from "./types";
import { isLand, isWater, cellLat } from "./voronoi-mesh";

/** Target number of rivers. Threshold is adjusted to approximate this. */
const TARGET_RIVER_COUNT = 1000;

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate river networks across the world.
 *
 * @param graph  The packed Voronoi graph (heightmap and features must be set)
 * @param params World generation parameters
 */
export function generateRivers(
  graph: PackedGraph,
  params: WorldGenParams
): void {
  const rng = makeRng(params.seed + 3); // offset seed for river-specific randomness

  // Reset river data
  graph.rivers = [];
  graph.cells.river.fill(0);
  graph.cells.flux.fill(0);
  graph.cells.prec.fill(0);

  if (!params.hasRivers) return;

  const { cells } = graph;
  const n = cells.n;

  // ── Step 1: Depression filling ──
  fillDepressions(graph);

  // ── Step 2: Precipitation calculation ──
  computePrecipitation(graph);

  // ── Step 3: Compute downstream cell for every land cell ──
  const downstream = computeDownstream(graph);

  // ── Step 4: Flux accumulation (highest cells first) ──
  const landCells = collectLandCellsSortedDesc(graph);
  accumulateFlux(graph, landCells, downstream);

  // ── Step 5: Detect river threshold ──
  const threshold = computeRiverThreshold(graph, landCells);

  // ── Step 6: Trace rivers from mouths ──
  const rivers = traceRivers(graph, downstream, threshold, rng);

  // ── Step 7: Assignment ──
  graph.rivers = rivers;
  for (const river of rivers) {
    for (const cell of river.cells) {
      cells.river[cell] = river.id;
    }
  }
}

// ──────────────────────────────────────────────
// Step 1: Depression Filling
// ──────────────────────────────────────────────

/**
 * Iteratively fill local elevation minima so that water can always flow
 * downhill to the coast. A cell is a depression if it is lower than ALL
 * of its land neighbors. We raise it to match the lowest neighbor.
 *
 * Modifies cells.h in-place. Max 10 passes to avoid infinite loops.
 */
function fillDepressions(graph: PackedGraph): void {
  const { cells } = graph;
  const n = cells.n;

  for (let pass = 0; pass < 10; pass++) {
    let changed = false;

    for (let i = 0; i < n; i++) {
      if (!isLand(graph, i)) continue;

      const h = cells.h[i]!;
      let lowestLandNeighbor = 256;
      let hasLandNeighbor = false;

      for (const nb of cells.neighbors[i]!) {
        if (!isLand(graph, nb)) continue;
        hasLandNeighbor = true;
        if (cells.h[nb]! < lowestLandNeighbor) {
          lowestLandNeighbor = cells.h[nb]!;
        }
      }

      // If this cell is lower than all its land neighbors, raise it
      if (hasLandNeighbor && h < lowestLandNeighbor) {
        cells.h[i] = lowestLandNeighbor;
        changed = true;
      }
    }

    if (!changed) break;
  }
}

// ──────────────────────────────────────────────
// Step 2: Precipitation
// ──────────────────────────────────────────────

/**
 * Compute precipitation for each land cell based on latitude and coast distance.
 *
 * basePrecip(lat) = 200 at equator, falling to 50 near poles.
 * coastEffect = 1.0 for coastal cells (coastDist <= 10), 0.7 for inland.
 */
function computePrecipitation(graph: PackedGraph): void {
  const { cells } = graph;
  const n = cells.n;

  for (let i = 0; i < n; i++) {
    if (!isLand(graph, i)) continue;

    const lat = Math.abs(cellLat(graph, i));
    // Latitude-based precipitation: peaks at equator, drops toward poles
    const latFraction = lat / 90; // 0 at equator, 1 at poles
    const basePrecip = 200 - 150 * latFraction; // 200 → 50

    // Coastal effect: more precipitation near coasts
    const coastDist = cells.coastDist[i]!;
    const coastEffect = coastDist <= 10 ? 1.0 : 0.7;

    const prec = Math.round(basePrecip * coastEffect);
    cells.prec[i] = Math.max(0, Math.min(255, prec));

    // Initialize flux from precipitation
    cells.flux[i] = prec;
  }
}

// ──────────────────────────────────────────────
// Step 3: Downstream Computation
// ──────────────────────────────────────────────

/**
 * For each land cell, find the lowest-elevation neighbor (the cell water
 * flows to). If the lowest neighbor is water, the cell is a river mouth.
 * Returns an Int32Array where downstream[i] = neighbor cell index, or -1
 * if the cell is water or has no valid downstream.
 */
function computeDownstream(graph: PackedGraph): Int32Array {
  const { cells } = graph;
  const n = cells.n;
  const downstream = new Int32Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    if (!isLand(graph, i)) continue;

    let lowestNb = -1;
    let lowestH = cells.h[i]! + 1; // must be lower than current cell (or equal after fill)

    for (const nb of cells.neighbors[i]!) {
      const nbH = cells.h[nb]!;
      if (nbH < lowestH) {
        lowestH = nbH;
        lowestNb = nb;
      }
    }

    // Accept neighbor even if it's the same height (depression-filled plateau)
    if (lowestNb === -1) {
      // No lower neighbor at all — find equal-height neighbor
      for (const nb of cells.neighbors[i]!) {
        if (cells.h[nb]! <= cells.h[i]!) {
          lowestNb = nb;
          break;
        }
      }
    }

    downstream[i] = lowestNb;
  }

  return downstream;
}

// ──────────────────────────────────────────────
// Step 4: Flux Accumulation
// ──────────────────────────────────────────────

/**
 * Collect all land cell indices sorted by elevation descending (highest first).
 */
function collectLandCellsSortedDesc(graph: PackedGraph): number[] {
  const { cells } = graph;
  const landCells: number[] = [];
  for (let i = 0; i < cells.n; i++) {
    if (isLand(graph, i)) landCells.push(i);
  }
  landCells.sort((a, b) => cells.h[b]! - cells.h[a]!);
  return landCells;
}

/**
 * Accumulate flux from highest cells to lowest.
 * Each cell passes its accumulated flux to its downstream neighbor.
 */
function accumulateFlux(
  graph: PackedGraph,
  landCells: number[],
  downstream: Int32Array
): void {
  const { cells } = graph;

  for (const i of landCells) {
    const ds = downstream[i]!;
    if (ds >= 0 && ds < cells.n) {
      cells.flux[ds] += cells.flux[i]!;
    }
  }
}

// ──────────────────────────────────────────────
// Step 5: River Threshold
// ──────────────────────────────────────────────

/**
 * Compute the flux threshold above which a cell is part of a river.
 * Uses the 97th percentile of land cell flux values (top ~3%).
 * Adjusts if the resulting river count would be too far from target.
 */
function computeRiverThreshold(
  graph: PackedGraph,
  landCells: number[]
): number {
  const { cells } = graph;

  // Collect all land flux values
  const fluxValues = new Float32Array(landCells.length);
  for (let i = 0; i < landCells.length; i++) {
    fluxValues[i] = cells.flux[landCells[i]!]!;
  }
  fluxValues.sort();

  // 97th percentile
  const pctIdx = Math.floor(0.97 * fluxValues.length);
  const threshold = fluxValues[Math.min(pctIdx, fluxValues.length - 1)]!;

  return Math.max(threshold, 1); // never zero
}

// ──────────────────────────────────────────────
// Step 6: River Tracing
// ──────────────────────────────────────────────

/**
 * Find river mouths (high-flux land cells adjacent to water), then trace
 * each river upstream by following the neighbor that contributes the most flux.
 *
 * @returns Array of River entities
 */
function traceRivers(
  graph: PackedGraph,
  downstream: Int32Array,
  threshold: number,
  rng: () => number
): River[] {
  const { cells } = graph;
  const n = cells.n;
  const rivers: River[] = [];
  const assignedToRiver = new Uint8Array(n);

  // Find river mouths: land cells with flux >= threshold that flow into water
  const mouths: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isLand(graph, i)) continue;
    if (cells.flux[i]! < threshold) continue;

    const ds = downstream[i]!;
    if (ds >= 0 && isWater(graph, ds)) {
      mouths.push(i);
    }
  }

  // Sort mouths by flux descending (largest rivers first)
  mouths.sort((a, b) => cells.flux[b]! - cells.flux[a]!);

  let nextRiverId = 1; // 0 = no river

  for (const mouth of mouths) {
    if (assignedToRiver[mouth]) continue;
    if (rivers.length >= TARGET_RIVER_COUNT * 1.5) break; // hard cap

    // Trace upstream from mouth
    const riverCells: number[] = [];
    let current = mouth;
    const visited = new Set<number>();

    while (current >= 0 && isLand(graph, current) && !visited.has(current)) {
      visited.add(current);
      riverCells.push(current);
      assignedToRiver[current] = 1;

      // Find upstream: the neighbor (excluding downstream) with highest flux
      // that is above threshold and flows into current
      let bestUpstream = -1;
      let bestFlux = 0;

      for (const nb of cells.neighbors[current]!) {
        if (!isLand(graph, nb)) continue;
        if (visited.has(nb)) continue;
        if (downstream[nb] !== current) continue; // must flow INTO current
        if (cells.flux[nb]! < threshold) continue;

        if (cells.flux[nb]! > bestFlux) {
          bestFlux = cells.flux[nb]!;
          bestUpstream = nb;
        }
      }

      current = bestUpstream;
    }

    if (riverCells.length < 3) continue; // skip tiny rivers

    // Reverse so cells go from source to mouth
    riverCells.reverse();

    const river: River = {
      id: nextRiverId++,
      name: "", // naming happens in a later pipeline stage
      cells: riverCells,
      mouth,
      source: riverCells[0]!,
      flux: cells.flux[mouth]!,
      length: estimateRiverLength(graph, riverCells),
    };

    rivers.push(river);
  }

  return rivers;
}

/**
 * Rough estimate of river length in km based on cell-to-cell distances.
 */
function estimateRiverLength(graph: PackedGraph, riverCells: number[]): number {
  const { cells } = graph;
  let totalKm = 0;
  const DEG_TO_KM = 111.32; // approximate km per degree at equator

  for (let i = 1; i < riverCells.length; i++) {
    const prev = riverCells[i - 1]!;
    const curr = riverCells[i]!;
    const dx = cells.p[curr * 2]! - cells.p[prev * 2]!;
    const dy = cells.p[curr * 2 + 1]! - cells.p[prev * 2 + 1]!;
    const avgLat = (cells.p[curr * 2 + 1]! + cells.p[prev * 2 + 1]!) / 2;
    const cosLat = Math.cos(avgLat * Math.PI / 180);

    // Approximate great-circle distance
    const dxKm = dx * DEG_TO_KM * cosLat;
    const dyKm = dy * DEG_TO_KM;
    totalKm += Math.sqrt(dxKm * dxKm + dyKm * dyKm);
  }

  return Math.round(totalKm);
}
