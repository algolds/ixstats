/**
 * Tectonic Elevation — Computes elevation from plate tectonics.
 *
 * Ported from World Orogen's elevation.js, adapted for equirectangular grid.
 *
 * Core formula:
 *   elev = (1/mountainDist - 1/oceanDist) / (1/mountainDist + 1/oceanDist + 1/coastDist)
 *
 * Enhanced with:
 *   - Stress propagation from collision boundaries
 *   - Subduction asymmetry
 *   - Rift valleys at divergent boundaries
 *   - Back-arc basins behind subduction zones
 *   - Hotspot chains (mantle plumes)
 *   - Coastal roughening with stress-dependent amplitude
 */

import type { PlateSimulationResult } from "./plate-simulation";
import { getNeighbors4 } from "./plate-simulation";
import { createNoise, fractalNoise, ridgeNoise } from "./noise";
import { makeRng } from "./rng";

// ─── Types ───────────────────────────────────────────────────

export interface TectonicElevationResult {
  /** Elevation grid [0, 1] normalized */
  elevation: Float32Array;
  /** Ocean mask (1 = ocean, 0 = land) */
  isOcean: Uint8Array;
  /** Stress field [0, 1] normalized */
  stress: Float32Array;
  /** Boundary type per cell: 0=interior, 1=convergent, 2=divergent, 3=transform */
  boundaryType: Int8Array;
}

// ─── Main Entry ──────────────────────────────────────────────

/**
 * Compute elevation from plate simulation results.
 */
export function computeTectonicElevation(
  sim: PlateSimulationResult,
  seed: number,
  terrainRoughness: number,
  _oceanPercentage: number
): TectonicElevationResult {
  const { plateAssignment, oceanPlates, collisions, width, height } = sim;
  const totalCells = width * height;

  const rng = makeRng(seed + 500);
  const noise = createNoise(seed + 600);
  const detailNoise = createNoise(seed + 601);
  const coastalNoise = createNoise(seed + 602);

  // Build ocean mask
  const isOcean = new Uint8Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    if (oceanPlates.has(plateAssignment[i]!)) isOcean[i] = 1;
  }

  // ── Step 1: Identify boundary cells and compute stress ──

  const stress = new Float32Array(totalCells);
  const boundaryType = new Int8Array(totalCells);
  const subductFactor = new Float32Array(totalCells).fill(0.5);

  // Mark boundary cells from collision data
  for (const collision of collisions) {
    const bt = collision.boundaryType === "convergent" ? 1
      : collision.boundaryType === "divergent" ? 2 : 3;

    for (const [bx, by] of collision.boundaryCells) {
      const idx = by * width + bx;
      if (idx >= 0 && idx < totalCells) {
        boundaryType[idx] = bt;
        stress[idx] = Math.max(stress[idx]!, collision.stress);

        if (collision.subductingSide === -1) {
          // Plate A subducts — cells on plate A side get higher subduct factor
          if (plateAssignment[idx] === collision.plateA) subductFactor[idx] = 0.8;
          else subductFactor[idx] = 0.2;
        } else if (collision.subductingSide === 1) {
          if (plateAssignment[idx] === collision.plateB) subductFactor[idx] = 0.8;
          else subductFactor[idx] = 0.2;
        }
      }
    }
  }

  // ── Step 2: Propagate stress inward from boundaries ──

  propagateStress(stress, subductFactor, plateAssignment, isOcean, width, height);

  // ── Step 3: Build distance fields ──

  // Identify seed sets
  const mountainSeeds: number[] = [];
  const coastlineSeeds: number[] = [];
  const oceanSeeds: number[] = [];

  for (let i = 0; i < totalCells; i++) {
    if (boundaryType[i] === 1 && stress[i]! > 0.1) {
      mountainSeeds.push(i);
    }
    if (isOcean[i]) {
      oceanSeeds.push(i);
    }
  }

  // Coastline: land cells adjacent to ocean
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;
      const neighbors = getNeighbors4(x, y, width, height);
      for (const n of neighbors) {
        if (isOcean[n]) {
          coastlineSeeds.push(idx);
          break;
        }
      }
    }
  }

  // If no mountains detected, use collision cells as fallback
  if (mountainSeeds.length === 0) {
    for (let i = 0; i < totalCells; i++) {
      if (boundaryType[i] !== 0) mountainSeeds.push(i);
    }
  }

  const distMountain = bfsDistanceField(mountainSeeds, oceanSeeds, width, height, seed + 10);
  const distOcean = bfsDistanceField(oceanSeeds, coastlineSeeds, width, height, seed + 11);
  const distCoastline = bfsDistanceField(coastlineSeeds, [], width, height, seed + 12);

  // Distance from coast through land only (for interior uplift)
  const distCoastLand = bfsDistanceField(coastlineSeeds, oceanSeeds.map(i => i), width, height, seed + 13);

  // ── Step 4: Compute elevation using distance-blend formula ──

  const elevation = new Float32Array(totalCells);

  // Normalize stress to 97th percentile
  const stressValues = Array.from(stress).filter(v => v > 0.01).sort((a, b) => a - b);
  const maxStress = stressValues.length > 0
    ? stressValues[Math.min(stressValues.length - 1, Math.floor(stressValues.length * 0.97))]!
    : 1;

  const scaleFactor = Math.sqrt(totalCells / 100000);
  const interiorBand = Math.max(4, Math.round(16 * scaleFactor));

  for (let i = 0; i < totalCells; i++) {
    const x = i % width;
    const y = (i - x) / width;

    if (isOcean[i]) {
      // Ocean floor: base depth with variations
      const coastDist = distCoastline[i]!;
      const oceanDepth = -0.3 - 0.2 * Math.min(1, coastDist / (interiorBand * 2));

      // Mid-ocean ridge boost at divergent boundaries
      if (boundaryType[i] === 2) {
        elevation[i] = oceanDepth + 0.15;
      } else {
        elevation[i] = oceanDepth;
      }

      // Trench deepening at convergent boundaries
      if (boundaryType[i] === 1 && subductFactor[i]! > 0.5) {
        elevation[i] = Math.min(elevation[i]!, oceanDepth - 0.2);
      }
      continue;
    }

    // Land cell: distance-blend formula
    const dm = Math.max(1, distMountain[i]!);
    const doc = Math.max(1, distOcean[i]!);
    const dc = Math.max(1, distCoastline[i]!);

    const invM = 1 / dm;
    const invO = 1 / doc;
    const invC = 1 / dc;

    let elev = (invM - invO) / (invM + invO + invC);

    // Scale to [0, 1] range (formula gives roughly [-1, 1])
    elev = (elev + 1) / 2;

    // Stress amplification at collision zones
    const normalizedStress = Math.min(1, stress[i]! / maxStress);
    elev += normalizedStress * normalizedStress * 0.3;

    // Interior uplift: gradual rise from coast
    const coastLandDist = distCoastLand[i]!;
    const interiorT = Math.min(1, coastLandDist / interiorBand);
    elev += interiorT * 0.08;

    // Subduction asymmetry: steeper on subducting side
    if (boundaryType[i] === 1) {
      const sf = subductFactor[i]!;
      if (sf > 0.5) {
        // Subducting side: compressed profile
        elev *= 0.8;
      } else {
        // Overriding side: enhanced mountain building
        elev += normalizedStress * 0.15;
      }
    }

    // Rift valleys at divergent continental boundaries
    if (boundaryType[i] === 2 && !isOcean[i]) {
      const riftDepth = 0.15 * normalizedStress;
      elev -= riftDepth;
      // Shoulder uplift at edges
      const riftEdgeDist = distCoastline[i]!;
      if (riftEdgeDist > 1 && riftEdgeDist < 5) {
        elev += 0.05 * (1 - (riftEdgeDist - 1) / 4);
      }
    }

    // Add fractal noise for detail
    const nx = x / width;
    const ny = y / height;
    const noiseAmp = 0.08 + normalizedStress * 0.12;
    const detail = fractalNoise(noise, nx * 8, ny * 8, 4 + Math.round(terrainRoughness * 2), 2.0, 0.5);
    elev += detail * noiseAmp * terrainRoughness;

    // Ridge noise near mountains
    if (dm < interiorBand * 0.5) {
      const ridgeAmp = (1 - dm / (interiorBand * 0.5)) * 0.12 * terrainRoughness;
      elev += ridgeNoise(detailNoise, nx * 12, ny * 12, 3, 2.0, 0.5) * ridgeAmp;
    }

    // Coastal roughening
    if (dc < 5) {
      const coastT = dc / 5;
      const coastNoise = fractalNoise(coastalNoise, nx * 20, ny * 20, 3, 2.0, 0.5);
      elev += coastNoise * 0.04 * (1 - coastT);
    }

    // Latitude factor (slight suppression at poles for more realistic distribution)
    const latRad = ((y / height) - 0.5) * Math.PI;
    const latFactor = 0.85 + 0.15 * Math.cos(latRad);
    elev *= latFactor;

    elevation[i] = Math.max(0, Math.min(1, elev));
  }

  // ── Step 5: Add hotspot chains ──

  addHotspots(elevation, isOcean, width, height, seed, rng);

  // ── Step 6: Normalize land elevation to [0, 1] ──

  let landMin = Infinity, landMax = -Infinity;
  for (let i = 0; i < totalCells; i++) {
    if (!isOcean[i]) {
      if (elevation[i]! < landMin) landMin = elevation[i]!;
      if (elevation[i]! > landMax) landMax = elevation[i]!;
    }
  }

  const landRange = landMax - landMin;
  if (landRange > 0.001) {
    for (let i = 0; i < totalCells; i++) {
      if (!isOcean[i]) {
        elevation[i] = (elevation[i]! - landMin) / landRange;
      } else {
        // Map ocean to a small negative range for clarity
        elevation[i] = Math.max(0, elevation[i]! * 0.1);
      }
    }
  }

  return { elevation, isOcean, stress, boundaryType };
}

// ─── BFS Distance Field ──────────────────────────────────────

/**
 * Compute BFS distance from seed cells, stopping at barrier cells.
 * Uses randomized queue order for organic paths (matches Orogen's approach).
 */
function bfsDistanceField(
  seeds: number[],
  barriers: number[],
  width: number,
  height: number,
  seed: number
): Float32Array {
  const totalCells = width * height;
  const dist = new Float32Array(totalCells).fill(Infinity);

  const isBarrier = new Uint8Array(totalCells);
  for (const b of barriers) {
    if (b >= 0 && b < totalCells) isBarrier[b] = 1;
  }

  const queue: number[] = [];
  for (const s of seeds) {
    if (s >= 0 && s < totalCells) {
      dist[s] = 0;
      queue.push(s);
    }
  }

  // Simple hash for deterministic randomization
  const hash = (r: number) => {
    let h = (r * 2654435761) >>> 0;
    h = (((h >>> 16) ^ h) * 0x45d9f3b) >>> 0;
    return h;
  };

  for (let qi = 0; qi < queue.length; qi++) {
    // Randomized order: swap with random position ahead
    if (qi + 1 < queue.length) {
      const pos = qi + (hash(qi + seed) % (queue.length - qi));
      const tmp = queue[pos]!;
      queue[pos] = queue[qi]!;
      queue[qi] = tmp;
    }

    const cur = queue[qi]!;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    const neighbors = getNeighbors4(cx, cy, width, height);

    for (const nb of neighbors) {
      if (dist[nb] === Infinity && !isBarrier[nb]) {
        dist[nb] = dist[cur]! + 1;
        queue.push(nb);
      }
    }
  }

  return dist;
}

// ─── Stress Propagation ──────────────────────────────────────

/**
 * Propagate stress inward from boundary cells using frontier-based BFS.
 * Stress decays with distance, faster on the subducting side.
 */
function propagateStress(
  stress: Float32Array,
  subductFactor: Float32Array,
  plateAssignment: Uint16Array,
  isOcean: Uint8Array,
  width: number,
  height: number
): void {
  const totalCells = width * height;
  const scaleFactor = Math.sqrt(totalCells / 100000);
  const decayFactor = Math.pow(0.54, 1 / scaleFactor);
  const subductDecay = Math.pow(0.24, 1 / scaleFactor);
  const numPasses = Math.max(1, Math.round(3 * scaleFactor));

  let frontier: number[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (stress[i]! > 0.01) frontier.push(i);
  }

  for (let pass = 0; pass < numPasses && frontier.length > 0; pass++) {
    const next: number[] = [];

    for (const r of frontier) {
      const plate = plateAssignment[r]!;
      if (isOcean[r]) continue;

      const sf = subductFactor[r]!;
      const decay = sf > 0.5 ? subductDecay : decayFactor;
      const propagated = stress[r]! * decay;
      if (propagated < 0.005) continue;

      const x = r % width;
      const y = (r - x) / width;
      const neighbors = getNeighbors4(x, y, width, height);

      for (const nb of neighbors) {
        if (plateAssignment[nb] === plate && propagated > stress[nb]!) {
          stress[nb] = propagated;
          subductFactor[nb] = sf;
          next.push(nb);
        }
      }
    }

    frontier = next;
  }
}

// ─── Hotspot Chains ──────────────────────────────────────────

/**
 * Add hotspot volcanic chains (like Hawaii).
 * Places 3-5 mantle plumes with multi-segment trails.
 */
function addHotspots(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  _seed: number,
  rng: () => number
): void {
  const numHotspots = 3 + Math.floor(rng() * 3); // 3-5

  for (let h = 0; h < numHotspots; h++) {
    const cx = Math.floor(rng() * width);
    const cy = Math.floor(rng() * height);

    // Trail direction (simulating plate drift over hotspot)
    const trailAngle = rng() * Math.PI * 2;
    const trailDx = Math.cos(trailAngle);
    const trailDy = Math.sin(trailAngle);
    const trailLength = 5 + Math.floor(rng() * 15);

    for (let t = 0; t < trailLength; t++) {
      const px = Math.round(cx + trailDx * t * 2);
      const py = Math.round(cy + trailDy * t * 2);

      if (py < 0 || py >= height) continue;
      const wrappedX = ((px % width) + width) % width;

      // Gaussian peak, decaying with age (distance from source)
      const ageFactor = 1 - t / trailLength;
      const peakHeight = 0.15 * ageFactor * ageFactor;
      const radius = 2 + Math.floor(ageFactor * 3);

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = ((wrappedX + dx) % width + width) % width;
          const ny = py + dy;
          if (ny < 0 || ny >= height) continue;

          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;

          const falloff = Math.exp(-(dist * dist) / (radius * 0.7));
          const nIdx = ny * width + nx;
          elevation[nIdx] = Math.min(1, elevation[nIdx]! + peakHeight * falloff);
        }
      }
    }
  }
}
