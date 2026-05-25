/**
 * Erosion Pipeline — Multi-stage terrain post-processing.
 *
 * Ported from World Orogen's terrain-post.js, adapted for equirectangular grid.
 *
 * Stages:
 *   1. Priority-flood pit resolution (Barnes et al.) with canyon carving
 *   2. Domain warping (fBm displacement for organic shapes)
 *   3. Bilateral smoothing (elevation-aware, preserves ridges)
 *   4. Hydraulic erosion (Braun-Willett implicit stream power)
 *   5. Thermal erosion (slope-driven talus transport)
 *   6. Glacial erosion (U-valley carving, fjord enhancement)
 *   7. Ridge sharpening + soil creep
 */

import { createNoise, domainWarp2D } from "./noise";
import { getNeighbors4 } from "./plate-simulation";

// ─── Types ───────────────────────────────────────────────────

export interface ErosionParams {
  seed: number;
  /** 0 = skip, 0.5 = default (3+2 passes), 1.0 = full (5+3+1) */
  intensity: number;
  width: number;
  height: number;
}

// ─── Main Entry ──────────────────────────────────────────────

/**
 * Apply the full erosion pipeline to a heightmap.
 * Modifies the elevation array in-place.
 */
export function applyErosion(
  elevation: Float32Array,
  isOcean: Uint8Array,
  params: ErosionParams
): void {
  const { seed, intensity, width, height } = params;
  if (intensity <= 0) return;

  // Scale iterations by intensity
  const hydraulicIters = Math.round(3 + intensity * 2); // 3-5
  const thermalIters = Math.round(2 + intensity * 1); // 2-3
  const glacialIters = intensity > 0.3 ? Math.round(intensity * 2) : 0; // 0-2

  // Stage 1: Priority-flood pit resolution
  priorityFloodCarve(elevation, isOcean, width, height, 0.5);

  // Stage 2: Domain warping
  if (intensity > 0.2) {
    domainWarpElevation(elevation, isOcean, width, height, seed, intensity * 0.6);
  }

  // Stage 3: Bilateral smoothing (1-2 passes)
  const smoothPasses = intensity > 0.5 ? 2 : 1;
  bilateralSmooth(elevation, isOcean, width, height, smoothPasses, 0.4);

  // Stage 4-6: Composite erosion (interleaved)
  erodeComposite(
    elevation,
    isOcean,
    width,
    height,
    seed,
    hydraulicIters,
    thermalIters,
    glacialIters,
    intensity
  );

  // Stage 7: Ridge sharpening + soil creep
  if (intensity > 0.3) {
    ridgeSharpen(elevation, isOcean, width, height, intensity * 0.3);
    soilCreep(elevation, isOcean, width, height, 0.1);
  }

  // Re-normalize land elevation to [0, 1]
  normalizeLandElevation(elevation, isOcean);
}

// ─── Priority-Flood Pit Resolution ───────────────────────────

/**
 * MinHeap backed by Float32Array keys for O(log n) priority queue.
 */
class MinHeap {
  private keys: Float32Array;
  private data: number[] = [];

  constructor(keys: Float32Array) {
    this.keys = keys;
  }

  get size(): number {
    return this.data.length;
  }

  push(cell: number): void {
    this.data.push(cell);
    let i = this.data.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[this.data[i]!]! >= this.keys[this.data[parent]!]!) break;
      const tmp = this.data[i]!;
      this.data[i] = this.data[parent]!;
      this.data[parent] = tmp;
      i = parent;
    }
  }

  pop(): number {
    const top = this.data[0]!;
    const last = this.data.pop();
    if (this.data.length > 0 && last !== undefined) {
      this.data[0] = last;
      let i = 0;
      const n = this.data.length;
      for (;;) {
        let smallest = i;
        const l = 2 * i + 1,
          r = 2 * i + 2;
        if (l < n && this.keys[this.data[l]!]! < this.keys[this.data[smallest]!]!) smallest = l;
        if (r < n && this.keys[this.data[r]!]! < this.keys[this.data[smallest]!]!) smallest = r;
        if (smallest === i) break;
        const tmp = this.data[i]!;
        this.data[i] = this.data[smallest]!;
        this.data[smallest] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Priority-flood with canyon carving.
 * Ensures every land cell has a monotonically descending path to ocean.
 */
function priorityFloodCarve(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  carveStrength: number
): void {
  const N = width * height;
  const EPS = 1e-7;

  // Small noise for meandering paths
  const cellNoise = (r: number) => {
    let h = (r * 2654435761) >>> 0;
    h = (((h >>> 16) ^ h) * 0x45d9f3b) >>> 0;
    return ((h >>> 0) / 0xffffffff) * 0.01;
  };

  const surface = new Float32Array(elevation);
  const drainTo = new Int32Array(N).fill(-1);
  const visited = new Uint8Array(N);

  // Priority key: elevation + small noise
  const key = new Float32Array(N);
  for (let r = 0; r < N; r++) key[r] = elevation[r]! + cellNoise(r);

  const heap = new MinHeap(key);

  // Seed: land cells adjacent to ocean
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) {
        visited[idx] = 1;
        continue;
      }

      const neighbors = getNeighbors4(x, y, width, height);
      for (const n of neighbors) {
        if (isOcean[n]) {
          visited[idx] = 1;
          drainTo[idx] = n;
          heap.push(idx);
          break;
        }
      }
    }
  }

  // Pass 1: Priority-flood fill
  while (heap.size > 0) {
    const r = heap.pop();
    const surfR = surface[r]!;
    const x = r % width;
    const y = (r - x) / width;
    const neighbors = getNeighbors4(x, y, width, height);

    for (const nb of neighbors) {
      if (visited[nb]) continue;
      visited[nb] = 1;
      drainTo[nb] = r;

      if (elevation[nb]! < surfR + EPS) {
        // Pit detected — fill
        surface[nb] = surfR + EPS;
        key[nb] = surface[nb]! + cellNoise(nb);
      }
      heap.push(nb);
    }
  }

  // Pass 2: Carve-bias redistribution
  for (let r = 0; r < N; r++) {
    if (isOcean[r]) continue;
    const deficit = surface[r]! - elevation[r]!;
    if (deficit <= EPS) continue;

    // Trace drainTo path to find spill point
    const path: number[] = [];
    let peakIdx = -1;
    let peakElev = -Infinity;
    let cur = r;
    while (cur >= 0 && !isOcean[cur] && path.length < 1000) {
      path.push(cur);
      if (elevation[cur]! > peakElev) {
        peakElev = elevation[cur]!;
        peakIdx = path.length - 1;
      }
      cur = drainTo[cur]!;
    }

    if (peakIdx < 0 || path.length === 0) continue;

    // Carve near the spill point
    const carveAmount = deficit * carveStrength;
    const radius = Math.max(3, Math.ceil(path.length * 0.3));
    const startIdx = Math.max(0, peakIdx - radius);
    const endIdx = Math.min(path.length - 1, peakIdx + radius);

    let kernelSum = 0;
    for (let k = startIdx; k <= endIdx; k++) {
      kernelSum += 1 - Math.abs(k - peakIdx) / (radius + 1);
    }
    if (kernelSum > 0) {
      for (let k = startIdx; k <= endIdx; k++) {
        const dist = Math.abs(k - peakIdx);
        const weight = (1 - dist / (radius + 1)) / kernelSum;
        elevation[path[k]!]! -= carveAmount * weight;
        if (elevation[path[k]!]! < 0) elevation[path[k]!] = 0;
      }
    }

    // Fill remaining
    const fillAmount = deficit * (1 - carveStrength);
    elevation[r] += fillAmount;
  }

  // Pass 3: Enforce monotonic drainage
  const order: number[] = [];
  for (let r = 0; r < N; r++) {
    if (!isOcean[r]) order.push(r);
  }
  order.sort((a, b) => surface[a]! - surface[b]!);

  for (const r of order) {
    const target = drainTo[r]!;
    if (target < 0) continue;
    const targetElev = isOcean[target] ? 0 : elevation[target]!;
    if (elevation[r]! <= targetElev) {
      elevation[r] = targetElev + EPS;
    }
  }
}

// ─── Domain Warping ──────────────────────────────────────────

/**
 * Displace elevation by fBm noise for organic coastlines and ridges.
 */
function domainWarpElevation(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  seed: number,
  strength: number
): void {
  if (strength <= 0) return;

  const N = width * height;
  const noise = createNoise(seed + 9999);
  const maxDisp = Math.round(width * 0.03 * strength); // Max displacement in pixels

  const out = new Float32Array(elevation);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;

      const nx = x / width;
      const ny = y / height;

      // Compute warp displacement
      const [dx, dy] = domainWarp2D(noise, nx, ny, 4, maxDisp / width, 4.0);

      // Source pixel
      let srcX = Math.round(x + dx * width);
      let srcY = Math.round(y + dy * height);

      // Wrap horizontally, clamp vertically
      srcX = ((srcX % width) + width) % width;
      srcY = Math.max(0, Math.min(height - 1, srcY));

      const srcIdx = srcY * width + srcX;
      if (!isOcean[srcIdx]) {
        out[idx] = elevation[srcIdx]!;
      }
    }
  }

  // Blend: pick whichever elevation is more interesting
  const warpBias = 0.25 + 0.5 * strength;
  for (let i = 0; i < N; i++) {
    if (isOcean[i]) continue;
    const orig = elevation[i]!;
    const warped = out[i]!;
    if (warped > orig) {
      elevation[i] = orig + (warped - orig) * warpBias;
    } else {
      elevation[i] = warped + (orig - warped) * (1 - warpBias);
    }
  }
}

// ─── Bilateral Smoothing ─────────────────────────────────────

/**
 * Elevation-aware smoothing that preserves ridges and trenches.
 * Neighbors with similar elevation receive more weight.
 */
function bilateralSmooth(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  iterations: number,
  strength: number
): void {
  const N = width * height;
  const tmp = new Float32Array(N);

  // Pre-compute coastline lock
  const locked = new Uint8Array(N);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;
      const neighbors = getNeighbors4(x, y, width, height);
      for (const n of neighbors) {
        if (isOcean[n]) {
          locked[idx] = 1;
          break;
        }
      }
    }
  }

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (isOcean[idx] || locked[idx]) {
          tmp[idx] = elevation[idx]!;
          continue;
        }

        const h = elevation[idx]!;
        let wSum = 0,
          hSum = 0;
        const neighbors = getNeighbors4(x, y, width, height);

        for (const n of neighbors) {
          const nh = elevation[n]!;
          const diff = Math.abs(nh - h);
          const w = 1 / (1 + diff * 8);
          wSum += w;
          hSum += nh * w;
        }

        if (wSum > 0) {
          const avg = hSum / wSum;
          tmp[idx] = h + (avg - h) * strength;
        } else {
          tmp[idx] = h;
        }
      }
    }

    // Copy back
    for (let i = 0; i < N; i++) elevation[i] = tmp[i]!;
  }
}

// ─── Composite Erosion (Hydraulic + Thermal + Glacial) ───────

/**
 * Interleaved erosion: each iteration runs hydraulic, then thermal, then glacial.
 */
function erodeComposite(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  seed: number,
  hIters: number,
  tIters: number,
  gIters: number,
  intensity: number
): void {
  const N = width * height;
  const totalIters = Math.max(hIters, tIters, gIters);
  if (totalIters <= 0) return;

  // Collect land cells
  const landCells: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!isOcean[i]) landCells.push(i);
  }
  if (landCells.length === 0) return;

  // Shared buffers
  const drainTarget = new Int32Array(N);
  const flow = new Float32Array(N);

  // Hydraulic erosion parameters
  const K = 0.005 * intensity; // Erosion coefficient
  const m = 0.5; // Area exponent
  const dt = 0.5; // Timestep

  // Thermal parameters
  const talusSlope = 0.04 / intensity; // Maximum stable slope
  const kThermal = 0.3;

  // Glacial parameters
  const glacialStrength = intensity * 0.5;

  // Precompute glaciation index
  let glacIdx: Float32Array | null = null;
  if (gIters > 0 && glacialStrength > 0) {
    glacIdx = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (isOcean[i]) continue;
      const y = Math.floor(i / width);
      const latRad = Math.abs((y / height - 0.5) * Math.PI);
      const latFactor = smoothstep(latRad, Math.PI / 4, Math.PI / 2);
      const elevFactor = smoothstep(elevation[i]!, 0.5, 0.9);
      glacIdx[i] = Math.max(latFactor, elevFactor * 0.3) * glacialStrength;
    }
  }

  for (let iter = 0; iter < totalIters; iter++) {
    // Sort land cells by descending elevation
    landCells.sort((a, b) => elevation[b]! - elevation[a]!);

    // ── Hydraulic erosion step ──
    if (iter < hIters) {
      // Build drainage graph
      drainTarget.fill(-1);
      for (const r of landCells) {
        const x = r % width;
        const y = (r - x) / width;
        const h = elevation[r]!;
        let bestNb = -1,
          bestDrop = 0;
        const neighbors = getNeighbors4(x, y, width, height);
        for (const nb of neighbors) {
          const drop = h - elevation[nb]!;
          if (drop > bestDrop) {
            bestDrop = drop;
            bestNb = nb;
          }
        }
        drainTarget[r] = bestNb;
      }

      // Accumulate flow (downstream order = ascending elevation)
      flow.fill(0);
      for (let i = 0; i < N; i++) {
        if (!isOcean[i]) flow[i] = 1; // Each cell contributes 1 unit
      }
      // Process in descending elevation (landCells is already sorted descending)
      for (const r of landCells) {
        const target = drainTarget[r]!;
        if (target >= 0) flow[target] += flow[r]!;
      }

      // Stream power erosion: E = K * A^m * S
      for (const r of landCells) {
        const target = drainTarget[r]!;
        if (target < 0) continue;

        const slope = elevation[r]! - elevation[target]!;
        if (slope <= 0) continue;

        const erosion = K * Math.pow(flow[r]!, m) * slope * dt;
        elevation[r] = Math.max(elevation[target]! + 1e-7, elevation[r]! - erosion);
      }
    }

    // ── Thermal erosion step ──
    if (iter < tIters) {
      const delta = new Float32Array(N);

      for (const r of landCells) {
        const x = r % width;
        const y = (r - x) / width;
        const h = elevation[r]!;
        const neighbors = getNeighbors4(x, y, width, height);

        let totalExcess = 0;
        const excesses: Array<[number, number]> = [];

        for (const nb of neighbors) {
          const slope = h - elevation[nb]!;
          if (slope > talusSlope) {
            const excess = slope - talusSlope;
            excesses.push([nb, excess]);
            totalExcess += excess;
          }
        }

        if (totalExcess > 0) {
          const move = Math.min(totalExcess * kThermal * 0.5, h * 0.1);
          delta[r] -= move;
          for (const [nb, excess] of excesses) {
            delta[nb] += move * (excess / totalExcess);
          }
        }
      }

      // Apply delta simultaneously
      for (const r of landCells) {
        elevation[r] = Math.max(0, elevation[r]! + delta[r]!);
      }
    }

    // ── Glacial erosion step ──
    if (iter < gIters && glacIdx) {
      const gScale = 1.0 / gIters;
      const gCarveRate = 0.02 * gScale;
      const gConvergenceBonus = 0.01 * gScale;

      // Build ice drainage
      const iceTarget = new Int32Array(N).fill(-1);
      const iceFlow = new Float32Array(N);
      const numIceUpstream = new Uint8Array(N);

      for (let i = 0; i < N; i++) iceFlow[i] = glacIdx[i]!;

      for (const r of landCells) {
        if (glacIdx[r]! <= 0) continue;
        const x = r % width;
        const y = (r - x) / width;
        const h = elevation[r]!;
        let bestNb = -1,
          bestDrop = 0;
        const neighbors = getNeighbors4(x, y, width, height);
        for (const nb of neighbors) {
          const drop = h - elevation[nb]!;
          if (drop > bestDrop) {
            bestDrop = drop;
            bestNb = nb;
          }
        }
        iceTarget[r] = bestNb;
      }

      // Accumulate ice flow
      for (const r of landCells) {
        const target = iceTarget[r]!;
        if (target >= 0 && iceFlow[r]! > 0) {
          iceFlow[target] += iceFlow[r]!;
          numIceUpstream[target]++;
        }
      }

      // Carve U-valleys
      for (const r of landCells) {
        if (iceFlow[r]! < 0.1) continue;

        const flowFactor = Math.min(1, iceFlow[r]! / 2);
        let carve = gCarveRate * flowFactor;

        // Over-deepening at convergence
        if (numIceUpstream[r]! >= 2) {
          carve += gConvergenceBonus * Math.min(numIceUpstream[r]!, 4);
        }

        // U-valley widening: also lower adjacent cells slightly
        const x = r % width;
        const y = (r - x) / width;
        elevation[r] = Math.max(0, elevation[r]! - carve);

        const neighbors = getNeighbors4(x, y, width, height);
        for (const nb of neighbors) {
          if (!isOcean[nb] && iceFlow[nb]! < iceFlow[r]! * 0.3) {
            elevation[nb] = Math.max(0, elevation[nb]! - carve * 0.3);
          }
        }
      }
    }
  }
}

// ─── Ridge Sharpening ────────────────────────────────────────

/**
 * Selectively amplify ridge cells (cells above their neighborhood average).
 */
function ridgeSharpen(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  strength: number
): void {
  const N = width * height;
  const boost = new Float32Array(N);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;

      const h = elevation[idx]!;
      const neighbors = getNeighbors4(x, y, width, height);
      let avg = 0;
      for (const n of neighbors) avg += elevation[n]!;
      avg /= neighbors.length;

      if (h > avg) {
        boost[idx] = (h - avg) * strength;
      }
    }
  }

  for (let i = 0; i < N; i++) {
    elevation[i] = Math.min(1, elevation[i]! + boost[i]!);
  }
}

// ─── Soil Creep ──────────────────────────────────────────────

/**
 * Uniform Laplacian diffusion for gentle interior smoothing.
 */
function soilCreep(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  strength: number
): void {
  const N = width * height;
  const tmp = new Float32Array(elevation);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;

      const neighbors = getNeighbors4(x, y, width, height);
      let avg = 0;
      for (const n of neighbors) avg += elevation[n]!;
      avg /= neighbors.length;

      tmp[idx] = elevation[idx]! + (avg - elevation[idx]!) * strength;
    }
  }

  for (let i = 0; i < N; i++) elevation[i] = tmp[i]!;
}

// ─── Utilities ───────────────────────────────────────────────

function smoothstep(x: number, edge0: number, edge1: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function normalizeLandElevation(elevation: Float32Array, isOcean: Uint8Array): void {
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < elevation.length; i++) {
    if (!isOcean[i]) {
      if (elevation[i]! < min) min = elevation[i]!;
      if (elevation[i]! > max) max = elevation[i]!;
    }
  }
  const range = max - min;
  if (range > 0.001) {
    for (let i = 0; i < elevation.length; i++) {
      if (!isOcean[i]) {
        elevation[i] = (elevation[i]! - min) / range;
      }
    }
  }
}
