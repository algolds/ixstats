/**
 * Heightmap Generation — Organic Multi-Fractal Terrain
 *
 * Creates realistic continent elevation data combining multi-octave
 * harmonic noise, continent seed placement, mountain ridges, and
 * ocean percentage normalization.
 *
 * Mutates graph.cells.h and graph.cells.elevZone in-place.
 */

import { makeRng } from "./rng";
import { type PackedGraph, type WorldGenParams } from "./types";

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export function generateHeightmap(
  graph: PackedGraph,
  params: WorldGenParams,
  template?: Uint8Array | null
): void {
  const rng = makeRng(params.seed + 1);
  const { cells } = graph;
  const n = cells.n;

  const hFloat = new Float64Array(n);

  // 1. Place continent centers using farthest-point sampling
  const blobCenters = farthestPointSample(graph, params.continentCount, rng);

  // Seed-derived noise rotation angles & frequencies for true procedural diversity
  const angle1 = rng() * Math.PI * 2;
  const angle2 = rng() * Math.PI * 2;
  const freq1 = 0.025 + rng() * 0.025;
  const freq2 = 0.07 + rng() * 0.05;
  const freq3 = 0.18 + rng() * 0.12;
  const offX1 = rng() * 500;
  const offY1 = rng() * 500;
  const offX2 = rng() * 500;
  const offY2 = rng() * 500;

  // 2. Base continent distance field + seed-driven rotated multi-harmonic noise
  for (let i = 0; i < n; i++) {
    const lng = cells.p[i * 2]!;
    const lat = cells.p[i * 2 + 1]!;

    // Find distance to closest continent center
    let minDistSq = Infinity;
    for (const cIdx of blobCenters) {
      const cx = cells.p[cIdx * 2]!;
      const cy = cells.p[cIdx * 2 + 1]!;
      const dx = lng - cx;
      const dy = lat - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDistSq) minDistSq = d2;
    }

    const distToCenter = Math.sqrt(minDistSq);
    const continentBase = Math.max(0, 110 - distToCenter * 1.6);

    const rx1 = lng * Math.cos(angle1) - lat * Math.sin(angle1);
    const ry1 = lng * Math.sin(angle1) + lat * Math.cos(angle1);
    const rx2 = lng * Math.cos(angle2) - lat * Math.sin(angle2);
    const ry2 = lng * Math.sin(angle2) + lat * Math.cos(angle2);

    const n1 = Math.sin((rx1 + offX1) * freq1) * Math.cos((ry1 + offY1) * freq1) * 50;
    const n2 = Math.sin((rx2 + offX2) * freq2) * Math.cos((ry2 + offY2) * freq2) * 28;
    const n3 = Math.sin(lng * freq3 + offX1) * Math.cos(lat * freq3 + offY1) * 14;

    const baseNoise = continentBase + n1 + n2 + n3;

    if (template && template.length === n) {
      const strength = params.templateStrength ?? 0.6;
      hFloat[i] = baseNoise * (1 - strength) + template[i]! * strength + n3;
    } else {
      hFloat[i] = baseNoise;
    }
  }

  // 3. Add tectonic mountain ridges on land distributed across ALL continents
  for (const cIdx of blobCenters) {
    const cx = cells.p[cIdx * 2]!;
    const cy = cells.p[cIdx * 2 + 1]!;

    const continentLandCells: number[] = [];
    for (let i = 0; i < n; i++) {
      if (hFloat[i]! > 50) {
        const dx = cells.p[i * 2]! - cx;
        const dy = cells.p[i * 2 + 1]! - cy;
        if (dx * dx + dy * dy < 2500) {
          continentLandCells.push(i);
        }
      }
    }

    if (continentLandCells.length === 0) continue;

    const numRidges = Math.floor(2 + rng() * 3);
    for (let m = 0; m < numRidges; m++) {
      const start = continentLandCells[Math.floor(rng() * continentLandCells.length)]!;
      const angle = rng() * Math.PI * 2;
      const length = Math.floor(12 + rng() * 22);
      const peakHeight = 45 + rng() * 45;

      addMountainRidge(graph, hFloat, start, length, peakHeight, angle, rng);
    }
  }

  // 4. Evaluate 4-octave continuous topographic noise across 100% of all land cells
  const oct1Freq = 0.015 + rng() * 0.01;
  const oct2Freq = 0.04 + rng() * 0.02;
  const oct3Freq = 0.09 + rng() * 0.04;
  const oct4Freq = 0.22 + rng() * 0.08;

  for (let i = 0; i < n; i++) {
    if (hFloat[i]! > 50) {
      const lng = cells.p[i * 2]!;
      const lat = cells.p[i * 2 + 1]!;

      // Octave 1: Macro Relief (continental shields & interior plateaus)
      const oct1 = Math.sin(lng * oct1Freq + offX1) * Math.cos(lat * oct1Freq + offY1) * 35;
      // Octave 2: Tectonic Fault Belts
      const oct2 = Math.abs(Math.sin((lng + lat) * oct2Freq + offX2)) * 25;
      // Octave 3: Hills & Valleys
      const oct3 = Math.cos((lng - lat) * oct3Freq + offY2) * 15;
      // Octave 4: Micro Relief
      const oct4 = Math.sin((lng * 2 + lat) * oct4Freq) * 8;

      hFloat[i] += oct1 + oct2 + oct3 + oct4;
    }
  }

  // 5. Normalize heightmap to target ocean percentage
  normalizeForOcean(hFloat, n, params.oceanPercentage);

  // 6. Write back to typed array
  for (let i = 0; i < n; i++) {
    cells.h[i] = Math.max(0, Math.min(255, Math.round(hFloat[i]!)));
  }

  // 7. Assign elevation zones
  assignElevationZones(graph);
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function farthestPointSample(graph: PackedGraph, count: number, rng: () => number): number[] {
  const { cells } = graph;
  const n = cells.n;
  const centers: number[] = [Math.floor(rng() * n)];
  const dist = new Float64Array(n).fill(Infinity);

  for (let k = 1; k < count; k++) {
    const lastCenter = centers[k - 1]!;
    const cx = cells.p[lastCenter * 2]!;
    const cy = cells.p[lastCenter * 2 + 1]!;

    for (let i = 0; i < n; i++) {
      const dx = cells.p[i * 2]! - cx;
      const dy = cells.p[i * 2 + 1]! - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < dist[i]!) dist[i] = d2;
    }

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

function addMountainRidge(
  graph: PackedGraph,
  hFloat: Float64Array,
  startCell: number,
  length: number,
  heightPeak: number,
  initialAngle: number,
  rng: () => number
): void {
  const { cells } = graph;
  let currCell = startCell;
  let currAngle = initialAngle;

  for (let step = 0; step < length; step++) {
    const frac = 1 - Math.abs(step - length / 2) / (length / 2);
    const elev = heightPeak * (0.4 + 0.6 * frac);

    hFloat[currCell] = Math.max(hFloat[currCell]!, hFloat[currCell]! + elev);
    for (const nb of cells.neighbors[currCell]!) {
      hFloat[nb] = Math.max(hFloat[nb]!, hFloat[nb]! + elev * 0.6);
      for (const nb2 of cells.neighbors[nb]!) {
        hFloat[nb2] = Math.max(hFloat[nb2]!, hFloat[nb2]! + elev * 0.3);
      }
    }

    currAngle += (rng() - 0.5) * 0.5;
    const targetLng = (cells.p[currCell * 2]! || 0) + Math.cos(currAngle) * 3;
    const targetLat = (cells.p[currCell * 2 + 1]! || 0) + Math.sin(currAngle) * 3;

    let bestNb = currCell;
    let bestDist = Infinity;
    for (const nb of cells.neighbors[currCell]!) {
      const dx = cells.p[nb * 2]! - targetLng;
      const dy = cells.p[nb * 2 + 1]! - targetLat;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestNb = nb;
      }
    }
    if (bestNb === currCell) break;
    currCell = bestNb;
  }
}

function getLandCandidates(hFloat: Float64Array, n: number): number[] {
  const candidates: number[] = [];
  for (let i = 0; i < n; i++) {
    if (hFloat[i]! > 51) candidates.push(i);
  }
  return candidates;
}

function normalizeForOcean(hFloat: Float64Array, n: number, oceanPercentage: number): void {
  const sorted = Array.from(hFloat).sort((a, b) => a - b);
  const thresholdIndex = Math.floor(n * oceanPercentage);
  const cutoff = sorted[thresholdIndex] ?? 50;
  const maxVal = sorted[n - 1] ?? 100;
  const range = Math.max(0.001, maxVal - cutoff);

  for (let i = 0; i < n; i++) {
    if (hFloat[i]! < cutoff) {
      // Map below cutoff to 0-50 (water)
      hFloat[i] = Math.max(0, (hFloat[i]! / Math.max(1, cutoff)) * 50);
    } else {
      // Map above cutoff to 52-255 (land) with realistic lowland curve (75% lowlands/hills)
      const linearFrac = Math.min(1, Math.max(0, (hFloat[i]! - cutoff) / range));
      const curvedFrac = Math.pow(linearFrac, 1.25); // Balanced 1.25 power curve gives rich elevation variation across all continents
      hFloat[i] = 52 + curvedFrac * 203;
    }
  }
}

export function assignElevationZones(graph: PackedGraph): void {
  const { cells } = graph;

  // Collect all land cell height values
  const landHeights: { cell: number; h: number }[] = [];
  for (let i = 0; i < cells.n; i++) {
    if (cells.h[i]! >= 51) {
      landHeights.push({ cell: i, h: cells.h[i]! });
    } else {
      cells.elevZone[i] = 0;
    }
  }

  if (landHeights.length === 0) return;

  // Sort land heights ascending to compute robust quantile percentiles
  landHeights.sort((a, b) => a.h - b.h);
  const totalLand = landHeights.length;

  // Quantile thresholds matching canonical IxEarth cartographic standards
  const zoneCutoffs = [0.18, 0.35, 0.5, 0.65, 0.77, 0.87, 0.94, 0.98, 1.0];

  for (let idx = 0; idx < totalLand; idx++) {
    const { cell } = landHeights[idx]!;
    const percentile = (idx + 1) / totalLand;

    let assignedZone = 0;
    for (let z = 0; z < zoneCutoffs.length; z++) {
      if (percentile <= zoneCutoffs[z]!) {
        assignedZone = z;
        break;
      }
    }
    cells.elevZone[cell] = assignedZone;
  }
}
