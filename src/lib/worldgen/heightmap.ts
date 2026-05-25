/**
 * Heightmap Generation — Azgaar-Style Blob-Based Terrain
 *
 * Creates elevation data by placing overlapping Gaussian-like blobs
 * via BFS, then normalizing to hit a target ocean percentage.
 *
 * Pipeline: blob placement → BFS expansion → template blending →
 *           noise → normalization → elevation zone assignment.
 *
 * Mutates graph.cells.h and graph.cells.elevZone in-place.
 */

import { makeRng } from "./rng";
import { type PackedGraph, type WorldGenParams, WATER_THRESHOLD } from "./types";
import { ELEVATION_ZONES, getZoneForNormalizedValue } from "../elevation-config";

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate heightmap elevations for every cell in the graph.
 *
 * @param graph   The packed Voronoi graph (cells.h will be written)
 * @param params  World generation parameters (seed, continentCount, oceanPercentage, terrainRoughness)
 * @param template Optional pre-existing elevation template to blend toward
 */
export function generateHeightmap(
  graph: PackedGraph,
  params: WorldGenParams,
  template?: Uint8Array | null
): void {
  const rng = makeRng(params.seed + 1); // offset seed so heightmap differs from mesh
  const { cells } = graph;
  const n = cells.n;

  // Working buffer — float to avoid clamping until the end
  const hFloat = new Float64Array(n);

  // ── Step 1: Place continent blobs using farthest-point sampling ──
  const blobCenters = farthestPointSample(graph, params.continentCount, rng);
  const gridExtent = 360; // longitude span

  for (const center of blobCenters) {
    const radius = (1 / 6 + rng() * (1 / 3 - 1 / 6)) * gridExtent;
    const intensity = 60 + rng() * 30; // 60-90
    const decay = 0.97;
    expandBlob(graph, hFloat, center, radius, intensity, decay);
  }

  // ── Step 2: Add mountain blobs on existing land ──
  const mountainCount = Math.round(50 + params.terrainRoughness * 150);
  const landCandidates = getLandCandidates(hFloat, n);

  for (let m = 0; m < mountainCount; m++) {
    if (landCandidates.length === 0) break;
    const center = landCandidates[Math.floor(rng() * landCandidates.length)]!;
    const radius = (1 / 20 + rng() * (1 / 10 - 1 / 20)) * gridExtent;
    const intensity = 40 + rng() * 40; // 40-80
    const decay = 0.97;
    expandBlob(graph, hFloat, center, radius, intensity, decay);
  }

  // ── Step 3: Blend with template if provided ──
  if (template && template.length === n) {
    const blendWeight = params.templateStrength * 0.6;
    for (let i = 0; i < n; i++) {
      hFloat[i] = lerp(hFloat[i]!, template[i]!, blendWeight);
    }
  }

  // ── Step 4: Add noise ──
  for (let i = 0; i < n; i++) {
    hFloat[i] += (rng() - 0.5) * 20 * params.terrainRoughness;
  }

  // ── Step 5: Normalize to hit target ocean percentage ──
  normalizeForOcean(hFloat, n, params.oceanPercentage);

  // ── Step 6: Write back to typed arrays ──
  for (let i = 0; i < n; i++) {
    cells.h[i] = Math.max(0, Math.min(255, Math.round(hFloat[i]!)));
  }

  // ── Step 7: Assign elevation zones for land cells ──
  assignElevationZones(graph);
}

// ──────────────────────────────────────────────
// Internal: Blob Placement & Expansion
// ──────────────────────────────────────────────

/**
 * Farthest-point sampling: pick well-spaced blob centers.
 * Starts from a random cell, then greedily picks the cell farthest
 * from all already-selected centers (using squared-distance on coordinates).
 */
function farthestPointSample(graph: PackedGraph, count: number, rng: () => number): number[] {
  const { cells } = graph;
  const n = cells.n;
  const centers: number[] = [];

  // First center is random
  centers.push(Math.floor(rng() * n));

  // Distance-to-nearest-center for each cell
  const dist = new Float64Array(n).fill(Infinity);

  for (let k = 1; k < count; k++) {
    const lastCenter = centers[k - 1]!;
    const cx = cells.p[lastCenter * 2]!;
    const cy = cells.p[lastCenter * 2 + 1]!;

    // Update distances with the newest center
    for (let i = 0; i < n; i++) {
      const dx = cells.p[i * 2]! - cx;
      const dy = cells.p[i * 2 + 1]! - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < dist[i]!) dist[i] = d2;
    }

    // Pick the cell with the greatest minimum distance
    let best = 0;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (dist[i]! > bestDist) {
        bestDist = dist[i]!;
        best = i;
      }
    }
    centers.push(best);
  }

  return centers;
}

/**
 * BFS blob expansion from a center cell.
 * Each ring of neighbors gets elevation += intensity * decay^distance.
 * Stops when the contribution is < 0.5 or the BFS exceeds the radius
 * (measured in coordinate-space distance from center).
 */
function expandBlob(
  graph: PackedGraph,
  hFloat: Float64Array,
  center: number,
  radius: number,
  intensity: number,
  decay: number
): void {
  const { cells } = graph;
  const cx = cells.p[center * 2]!;
  const cy = cells.p[center * 2 + 1]!;
  const radiusSq = radius * radius;

  // BFS with distance tracking
  const visited = new Uint8Array(cells.n);
  const queue: Array<{ cell: number; ring: number }> = [{ cell: center, ring: 0 }];
  visited[center] = 1;

  while (queue.length > 0) {
    const { cell, ring } = queue.shift()!;

    // Contribution at this ring distance
    const contribution = intensity * Math.pow(decay, ring);
    if (contribution < 0.5) continue;

    hFloat[cell] += contribution;

    // Expand to neighbors
    for (const nb of cells.neighbors[cell]!) {
      if (visited[nb]) continue;

      // Check coordinate distance from blob center
      const dx = cells.p[nb * 2]! - cx;
      const dy = cells.p[nb * 2 + 1]! - cy;
      if (dx * dx + dy * dy > radiusSq) continue;

      visited[nb] = 1;
      queue.push({ cell: nb, ring: ring + 1 });
    }
  }
}

/**
 * Collect cell indices that currently have "land-like" elevation.
 * Used to scatter mountain blobs only on existing continent mass.
 */
function getLandCandidates(hFloat: Float64Array, n: number): number[] {
  const candidates: number[] = [];
  // Estimate a rough threshold — cells with above-median elevation
  const sorted = Array.from(hFloat).sort((a, b) => a - b);
  const median = sorted[Math.floor(n * 0.5)]!;
  for (let i = 0; i < n; i++) {
    if (hFloat[i]! > median) candidates.push(i);
  }
  return candidates;
}

// ──────────────────────────────────────────────
// Internal: Normalization
// ──────────────────────────────────────────────

/**
 * Scale the float elevation buffer so that exactly `oceanPct` fraction of
 * cells end up below the WATER_THRESHOLD (51).
 *
 * Strategy: find the value at the `oceanPct` percentile. Linearly scale
 * so that value maps to 50 (just below threshold).
 */
function normalizeForOcean(hFloat: Float64Array, n: number, oceanPct: number): void {
  // Sort a copy to find the percentile value
  const sorted = Float64Array.from(hFloat).sort();
  const idx = Math.floor(oceanPct * n);
  const pivotValue = sorted[Math.min(idx, n - 1)]!;

  // Find min/max for scaling
  const minH = sorted[0]!;
  const maxH = sorted[n - 1]!;

  if (maxH - minH < 0.01) {
    // Flat terrain — fill with half ocean half land
    for (let i = 0; i < n; i++) {
      hFloat[i] = i < n * oceanPct ? 25 : 128;
    }
    return;
  }

  // Scale: values <= pivotValue map to [0, 50], values above map to [51, 255]
  const waterTarget = WATER_THRESHOLD - 1; // 50
  for (let i = 0; i < n; i++) {
    const raw = hFloat[i]!;
    if (raw <= pivotValue) {
      // Map [minH, pivotValue] → [0, waterTarget]
      const t = pivotValue > minH ? (raw - minH) / (pivotValue - minH) : 0;
      hFloat[i] = t * waterTarget;
    } else {
      // Map (pivotValue, maxH] → [WATER_THRESHOLD, 255]
      const t = maxH > pivotValue ? (raw - pivotValue) / (maxH - pivotValue) : 0;
      hFloat[i] = WATER_THRESHOLD + t * (255 - WATER_THRESHOLD);
    }
  }
}

// ──────────────────────────────────────────────
// Internal: Elevation Zone Assignment
// ──────────────────────────────────────────────

/**
 * Map each land cell's 0-255 elevation to one of the 9 canonical elevation zones.
 * Water cells get zone 0 by default (array is already zeroed).
 */
function assignElevationZones(graph: PackedGraph): void {
  const { cells } = graph;
  const landRange = 255 - WATER_THRESHOLD; // 204

  for (let i = 0; i < cells.n; i++) {
    const h = cells.h[i]!;
    if (h < WATER_THRESHOLD) {
      cells.elevZone[i] = 0;
      continue;
    }

    // Normalize land elevation to [0, 1]
    const normalized = (h - WATER_THRESHOLD) / landRange;
    const zone = getZoneForNormalizedValue(normalized);
    if (zone) {
      const zoneIdx = ELEVATION_ZONES.indexOf(zone);
      cells.elevZone[i] = zoneIdx >= 0 ? zoneIdx : 0;
    } else {
      cells.elevZone[i] = 0;
    }
  }
}

// ──────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────

/** Linear interpolation between a and b */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
