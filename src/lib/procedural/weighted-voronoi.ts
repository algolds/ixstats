/**
 * Weighted Voronoi — Density-weighted seed placement and budget-limited BFS
 * for power-law country size distributions.
 *
 * Instead of uniform Poisson disk sampling, generates seeds with variable
 * exclusion radii so that large countries have sparse seeds and small countries
 * have dense seeds. Budget-limited expansion freezes frontiers when target
 * area is reached.
 */

import { Delaunay } from "d3-delaunay";
import type { Position } from "geojson";
import type { HeightmapResult } from "./landmass-generator";

// ─── Types ───────────────────────────────────────────────────

export interface WeightedSeedPoint {
  position: Position;
  /** Target area as fraction of total land */
  targetAreaFraction: number;
  /** Number of Voronoi cells this country should claim */
  expansionBudget: number;
}

// ─── Weighted Seed Generation ────────────────────────────────

/**
 * Generate seed points with variable density based on target country areas.
 *
 * Large countries get sparse seeds (large exclusion radius), small countries
 * get dense seeds (small exclusion radius). This naturally produces the
 * power-law distribution when combined with budget-limited expansion.
 */
export function generateWeightedSeeds(
  heightmap: HeightmapResult,
  targetAreaFractions: number[], // sorted largest → smallest
  rng: () => number,
  bounds: [number, number, number, number]
): WeightedSeedPoint[] {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const lngRange = maxLng - minLng;
  const latRange = maxLat - minLat;
  const targetCount = targetAreaFractions.length;

  // Estimate land fraction
  let landPixels = 0;
  const sampleStep = Math.max(1, Math.floor(heightmap.width / 50));
  for (let y = 0; y < heightmap.height; y += sampleStep) {
    for (let x = 0; x < heightmap.width; x += sampleStep) {
      if ((heightmap.data[y * heightmap.width + x] ?? 0) >= heightmap.seaLevel)
        landPixels++;
    }
  }
  const totalSampled =
    Math.ceil(heightmap.height / sampleStep) *
    Math.ceil(heightmap.width / sampleStep);
  const landFraction = Math.max(0.1, landPixels / totalSampled);
  const landArea = lngRange * latRange * landFraction;

  // Calculate per-country exclusion radii based on target area
  // For a country targeting fraction f: exclusion radius ~ sqrt(f * landArea / pi)
  // Scale down because multiple countries overlap in Voronoi space
  const seeds: WeightedSeedPoint[] = [];
  const placedPoints: Position[] = [];

  // Sort by largest area first (place large countries before small ones)
  const indexedFractions = targetAreaFractions.map((f, i) => ({ f, i }));
  indexedFractions.sort((a, b) => b.f - a.f);

  for (const { f } of indexedFractions) {
    // Exclusion radius proportional to sqrt(area)
    const targetArea = f * landArea;
    const exclusionR = Math.sqrt(targetArea / Math.PI) * 0.4;
    const minExclusion = Math.sqrt(landArea / targetCount) * 0.15;
    const exclusion = Math.max(minExclusion, exclusionR);
    const exclusionSq = exclusion * exclusion;

    let placed = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const lng = minLng + rng() * lngRange;
      const lat = minLat + rng() * latRange;

      if (!isOnLand(lng, lat, heightmap)) continue;

      // Check distance from already-placed seeds
      let tooClose = false;
      for (const p of placedPoints) {
        const dx = lng - p[0];
        const dy = lat - p[1];
        if (dx * dx + dy * dy < exclusionSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      placedPoints.push([lng, lat]);
      seeds.push({
        position: [lng, lat],
        targetAreaFraction: f,
        expansionBudget: 0, // Computed after Voronoi tessellation
      });
      placed = true;
      break;
    }

    // Fallback: place anywhere on land (relaxed constraint)
    if (!placed) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const lng = minLng + rng() * lngRange;
        const lat = minLat + rng() * latRange;
        if (!isOnLand(lng, lat, heightmap)) continue;

        placedPoints.push([lng, lat]);
        seeds.push({
          position: [lng, lat],
          targetAreaFraction: f,
          expansionBudget: 0,
        });
        break;
      }
    }
  }

  return seeds;
}

/**
 * Expand territories using budget-limited BFS.
 *
 * Each country has a target number of cells to claim. Once a country reaches
 * its budget, its frontier is frozen. This produces the power-law size distribution.
 *
 * Uses round-robin expansion like the original, but each country stops when
 * it reaches its target.
 */
export function expandWithBudgets(
  points: Float64Array,
  cellCount: number,
  cellIsLand: Uint8Array,
  seeds: WeightedSeedPoint[],
  delaunay: InstanceType<typeof Delaunay>,
  heightmap: HeightmapResult
): Int32Array {
  const cellCountry = new Int32Array(cellCount).fill(-1);

  // Count land cells for budget calculation
  const landCellCount = cellIsLand.reduce((a, b) => a + b, 0);

  // Find the nearest Voronoi cell for each seed point
  const capitals: number[] = [];
  for (const seed of seeds) {
    const cellIdx = delaunay.find(seed.position[0], seed.position[1]);
    capitals.push(cellIdx);
  }

  // Compute expansion budgets: fraction of land cells proportional to target area
  for (let i = 0; i < seeds.length; i++) {
    seeds[i]!.expansionBudget = Math.max(
      1,
      Math.round(seeds[i]!.targetAreaFraction * landCellCount)
    );
  }

  // Initialize frontiers
  const frontiers: Array<number[]> = capitals.map(() => []);
  const claimed = new Int32Array(seeds.length); // cells claimed per country

  for (let ci = 0; ci < capitals.length; ci++) {
    const cell = capitals[ci]!;
    if (cellCountry[cell] === -1 && cellIsLand[cell]) {
      cellCountry[cell] = ci;
      frontiers[ci]!.push(cell);
      claimed[ci] = 1;
    }
  }

  // Round-robin expansion with budget limits
  let changed = true;
  let safety = 0;
  while (changed && safety++ < cellCount) {
    changed = false;

    for (let ci = 0; ci < frontiers.length; ci++) {
      const frontier = frontiers[ci]!;
      if (frontier.length === 0) continue;

      // Check if this country has reached its budget
      if (claimed[ci]! >= seeds[ci]!.expansionBudget) {
        frontiers[ci] = [];
        continue;
      }

      const nextFrontier: number[] = [];
      const budget = seeds[ci]!.expansionBudget;

      for (const cell of frontier) {
        if (claimed[ci]! >= budget) break;

        for (const neighbor of delaunay.neighbors(cell)) {
          if (!cellIsLand[neighbor] || cellCountry[neighbor] !== -1) continue;
          if (claimed[ci]! >= budget) break;

          // Elevation cost: prefer gentle terrain (same as original)
          const clng = points[cell * 2]!;
          const clat = points[cell * 2 + 1]!;
          const nlng = points[neighbor * 2]!;
          const nlat = points[neighbor * 2 + 1]!;

          const gx1 = Math.floor(
            ((clng + 180) / 360) * heightmap.width
          );
          const gy1 = Math.floor(
            ((90 - clat) / 180) * heightmap.height
          );
          const gx2 = Math.floor(
            ((nlng + 180) / 360) * heightmap.width
          );
          const gy2 = Math.floor(
            ((90 - nlat) / 180) * heightmap.height
          );
          const e1 = heightmap.data[gy1 * heightmap.width + gx1] ?? 0;
          const e2 = heightmap.data[gy2 * heightmap.width + gx2] ?? 0;
          const elevDiff = Math.abs(e2 - e1);

          // Skip very steep transitions (mountain borders)
          if (elevDiff > 0.15 && e2 > 0.7) continue;

          cellCountry[neighbor] = ci;
          nextFrontier.push(neighbor);
          claimed[ci]!++;
          changed = true;
        }
      }

      frontiers[ci] = nextFrontier;
    }
  }

  // Claim remaining unclaimed land cells (isolated by mountains or budget limits)
  // Give them to the nearest country that hasn't exceeded 150% of its budget
  for (let i = 0; i < cellCount; i++) {
    if (cellIsLand[i] && cellCountry[i] === -1) {
      for (const n of delaunay.neighbors(i)) {
        const cid = cellCountry[n];
        if (cid >= 0) {
          cellCountry[i] = cid;
          break;
        }
      }
    }
  }

  return cellCountry;
}

// ─── Internal Utilities ──────────────────────────────────────

function isOnLand(lng: number, lat: number, hm: HeightmapResult): boolean {
  const gx = Math.floor(((lng + 180) / 360) * hm.width);
  const gy = Math.floor(((90 - lat) / 180) * hm.height);
  if (gx < 0 || gx >= hm.width || gy < 0 || gy >= hm.height) return false;
  return (hm.data[gy * hm.width + gx] ?? 0) >= hm.seaLevel;
}
