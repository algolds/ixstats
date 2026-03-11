/**
 * Country Generator — Divides landmasses into country-sized regions.
 *
 * Pipeline:
 *   1. Dense Poisson disk sampling on land → seed points
 *   2. d3-delaunay Voronoi tessellation
 *   3. Lloyd relaxation (2 iterations) for even cell sizes
 *   4. Cell land/ocean classification
 *   5. Capital placement + weighted flood-fill territory expansion
 *   6. Border extraction with noisy edges for organic appearance
 *   7. Polygon assembly into GeoJSON
 */

import { Delaunay } from "d3-delaunay";
import type { Position, Polygon, MultiPolygon, Feature, FeatureCollection } from "geojson";
import type { HeightmapResult } from "./landmass-generator";
import { noisyRing } from "./noisy-edges";
import type { WorldProfile } from "./world-profile";
import { sampleCountryAreas } from "./world-profile";
import { generateWeightedSeeds, expandWithBudgets } from "./weighted-voronoi";
import { extractGridOutline, douglasPeuckerSimplify } from "./grid-outline";

export interface CountryGenParams {
  seed: number;
  countryCountRange: [number, number];
  landPolygons: Array<{ geometry: Polygon | MultiPolygon; areaKm2: number }>;
  heightmap: HeightmapResult;
  /** World profile for statistical guidance */
  profile?: WorldProfile;
  /** 0=fully random (legacy), 1=tightly match profile */
  similarity?: number;
}

export interface GeneratedCountry {
  id: string;
  name: string;
  geometry: Polygon;
  centroid: Position;
  areaKm2: number;
  elevation: number;
  coastalPerimeter: number;
  neighbors: string[];
}

export interface CountryResult {
  countries: GeneratedCountry[];
  featureCollection: FeatureCollection;
  /** Voronoi mesh data for reuse by terrain generator */
  mesh: VoronoiMesh | null;
}

/** Exported mesh for cross-stage reuse */
export interface VoronoiMesh {
  points: Float64Array;  // flat [x0,y0, x1,y1, ...]
  cellCount: number;
  /** For each cell, the country index it belongs to (-1 = ocean) */
  cellCountry: Int32Array;
  /** Cell land/ocean classification */
  cellIsLand: Uint8Array;
  bounds: [number, number, number, number];
}

// ─── Main Entry ─────────────────────────────────────────────

export function generateCountries(params: CountryGenParams): CountryResult {
  const { seed, countryCountRange, heightmap, profile, similarity = 0 } = params;
  const rng = seededRandom(seed + 200);
  const [minC, maxC] = countryCountRange;
  const targetCountries = minC + Math.floor(rng() * (maxC - minC + 1));

  const useWeighted = similarity > 0.01 && profile;

  // We need many more Voronoi cells than countries for good shapes.
  // Each country will own multiple cells via territory expansion.
  const cellMultiplier = Math.max(6, Math.min(15, Math.round(800 / targetCountries)));
  const targetCells = Math.min(targetCountries * cellMultiplier, 4000);

  const bounds: [number, number, number, number] = [-180, -85, 180, 85];

  // Step 1: Seed point generation
  let seedPoints: Position[];
  let weightedSeeds: ReturnType<typeof generateWeightedSeeds> | null = null;

  if (useWeighted) {
    // Profile-guided: generate weighted seeds with variable density
    const targetAreas = sampleCountryAreas(profile, targetCountries, similarity, rng);
    weightedSeeds = generateWeightedSeeds(heightmap, targetAreas, rng, bounds);
    seedPoints = weightedSeeds.map((s) => s.position);

    // Also need additional Voronoi cells beyond just the seed points
    // Add extra points on land for finer tessellation
    const extraCells = Math.max(0, targetCells - seedPoints.length);
    if (extraCells > 0) {
      const extraRng = seededRandom(seed + 250);
      const extraPoints = poissonDiskOnLand(heightmap, extraCells, extraRng, bounds);
      seedPoints = [...seedPoints, ...extraPoints];
    }
  } else {
    // Legacy: uniform Poisson disk sampling
    seedPoints = poissonDiskOnLand(heightmap, targetCells, rng, bounds);
  }


  if (seedPoints.length < 3) {
    return { countries: [], featureCollection: emptyFC(), mesh: null };
  }

  // Step 2: Voronoi tessellation
  let points = new Float64Array(seedPoints.length * 2);
  for (let i = 0; i < seedPoints.length; i++) {
    points[i * 2] = seedPoints[i]![0];
    points[i * 2 + 1] = seedPoints[i]![1];
  }

  // Step 3: Lloyd relaxation (2 iterations)
  for (let iter = 0; iter < 2; iter++) {
    const del = new Delaunay(points);
    const vor = del.voronoi(bounds);
    const newPoints = new Float64Array(points.length);

    for (let i = 0; i < points.length / 2; i++) {
      const cell = vor.cellPolygon(i);
      if (!cell || cell.length < 3) {
        newPoints[i * 2] = points[i * 2]!;
        newPoints[i * 2 + 1] = points[i * 2 + 1]!;
        continue;
      }
      // Centroid of cell polygon
      const c = polygonCentroid(cell);
      // Only move toward centroid if it's on land, else keep original
      if (isOnLand(c[0], c[1], heightmap)) {
        newPoints[i * 2] = c[0];
        newPoints[i * 2 + 1] = c[1];
      } else {
        newPoints[i * 2] = points[i * 2]!;
        newPoints[i * 2 + 1] = points[i * 2 + 1]!;
      }
    }
    points = newPoints;
  }

  // Add tiny jitter to prevent d3-delaunay issues with near-collinear
  // or degenerate point configurations after Lloyd relaxation
  const jitterRng = seededRandom(seed + 999);
  for (let i = 0; i < points.length; i++) {
    points[i] += (jitterRng() - 0.5) * 1e-6;
  }

  // Final Voronoi
  const delaunay = new Delaunay(points);
  const voronoi = delaunay.voronoi(bounds);
  const cellCount = points.length / 2;

  // Step 4: Classify cells as land/ocean
  const cellIsLand = new Uint8Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    cellIsLand[i] = isOnLand(points[i * 2]!, points[i * 2 + 1]!, heightmap) ? 1 : 0;
  }

  const landCellCount = cellIsLand.reduce((a, b) => a + b, 0);
  if (landCellCount < 2) {
    return { countries: [], featureCollection: emptyFC(), mesh: null };
  }

  // Step 5: Pick capitals + expand territories
  let cellCountry: Int32Array;
  const capitals: Map<number, number> = new Map(); // countryIdx → capital cell

  if (useWeighted && weightedSeeds) {
    // Profile-guided: budget-limited expansion for power-law sizes
    cellCountry = expandWithBudgets(
      points, cellCount, cellIsLand, weightedSeeds, delaunay, heightmap
    );
    // Derive capitals: for each seed, find its nearest Voronoi cell
    for (let si = 0; si < weightedSeeds.length; si++) {
      const cellIdx = delaunay.find(weightedSeeds[si]!.position[0], weightedSeeds[si]!.position[1]);
      capitals.set(si, cellIdx);
    }
  } else {
    // Legacy: uniform expansion
    const actualCountries = Math.min(targetCountries, landCellCount);
    const capitalArr = pickCapitals(points, cellIsLand, actualCountries, heightmap, rng);
    cellCountry = expandTerritories(
      points, cellCount, cellIsLand, capitalArr, delaunay, heightmap
    );
    for (let ci = 0; ci < capitalArr.length; ci++) {
      capitals.set(ci, capitalArr[ci]!);
    }
  }

  // Step 6: Build country polygons via rasterized grid extraction
  //
  // Instead of fragile Voronoi edge chaining with float keys, we rasterize
  // the country assignments onto a grid using delaunay.find(), then extract
  // outlines from the grid. This correctly preserves concave shapes.

  const nameGen = createNameGenerator(seed + 300);
  const countries: GeneratedCountry[] = [];

  // Collect cells per country for neighbor detection and coastal perimeter
  const countryCells: Map<number, number[]> = new Map();
  for (let i = 0; i < cellCount; i++) {
    const cid = cellCountry[i]!;
    if (cid < 0) continue;
    if (!countryCells.has(cid)) countryCells.set(cid, []);
    countryCells.get(cid)!.push(i);
  }

  // Find inter-country edges for neighbor detection
  const countryNeighborSets: Map<number, Set<number>> = new Map();
  for (let i = 0; i < cellCount; i++) {
    const ci = cellCountry[i]!;
    if (ci < 0) continue;
    for (const j of delaunay.neighbors(i)) {
      const cj = cellCountry[j]!;
      if (cj >= 0 && cj !== ci) {
        if (!countryNeighborSets.has(ci)) countryNeighborSets.set(ci, new Set());
        countryNeighborSets.get(ci)!.add(cj);
      }
    }
  }

  // Rasterize country assignments onto a grid
  // IxWorld countries avg 506 vertices — use higher raster resolution for more detail
  const rasterW = Math.min(800, heightmap.width * 2);
  const rasterH = Math.min(480, heightmap.height * 2);
  const rasterGrid = new Int32Array(rasterW * rasterH).fill(-1);
  const [bxMin, byMin, bxMax, byMax] = bounds;
  const bxRange = bxMax - bxMin;
  const byRange = byMax - byMin;

  for (let ry = 0; ry < rasterH; ry++) {
    for (let rx = 0; rx < rasterW; rx++) {
      const lng = bxMin + (rx + 0.5) / rasterW * bxRange;
      const lat = byMin + (ry + 0.5) / rasterH * byRange;

      // Only rasterize on land
      if (!isOnLand(lng, lat, heightmap)) continue;

      const cell = delaunay.find(lng, lat);
      const cid = cellCountry[cell]!;
      if (cid >= 0) {
        rasterGrid[ry * rasterW + rx] = cid;
      }
    }
  }

  // Extract outline for each country from rasterized grid
  for (const [countryIdx, cells] of countryCells) {
    if (cells.length === 0) continue;

    // Build binary mask for this country
    const mask = new Uint8Array(rasterW * rasterH);
    let maskCount = 0;
    for (let i = 0; i < rasterGrid.length; i++) {
      if (rasterGrid[i] === countryIdx) {
        mask[i] = 1;
        maskCount++;
      }
    }
    if (maskCount < 3) continue;

    // Extract outline
    const rings = extractGridOutline(mask, rasterW, rasterH);
    if (rings.length === 0) continue;

    // Find the largest ring (outer boundary)
    let bestRing = rings[0]!;
    for (let r = 1; r < rings.length; r++) {
      if (rings[r]!.length > bestRing.length) bestRing = rings[r]!;
    }

    // Convert grid coordinates to WGS84
    let ring: Position[] = bestRing.map(([gx, gy]) => [
      bxMin + (gx / rasterW) * bxRange,
      byMin + (gy / rasterH) * byRange,
    ]);

    // Douglas-Peucker simplification — lighter to keep more detail
    // IxWorld countries: avg 506 vertices, median 258
    const dpTolerance = (1 / rasterW) * bxRange * 0.15;
    ring = douglasPeuckerSimplify(ring, dpTolerance);
    if (ring.length < 4) continue;

    // Ensure ring is closed
    const f = ring[0]!, l = ring[ring.length - 1]!;
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);

    // Apply noisy edges for organic borders
    const noisy = noisyRing(ring, seed + countryIdx * 137, 3, 0.15);
    if (noisy.length < 4) continue;

    // Compute centroid from polygon
    const cx = noisy.reduce((s, p) => s + p[0], 0) / (noisy.length - 1);
    const cy = noisy.reduce((s, p) => s + p[1], 0) / (noisy.length - 1);

    // Area
    const areaKm2 = Math.abs(shoelaceArea(noisy)) * 12321;
    if (areaKm2 < 50) continue;

    // Average elevation from capital cell
    const capCell = capitals.get(countryIdx);
    let elevation = 0.5;
    if (capCell !== undefined) {
      const gx = Math.floor(((points[capCell * 2]! + 180) / 360) * heightmap.width);
      const gy = Math.floor(((90 - points[capCell * 2 + 1]!) / 180) * heightmap.height);
      elevation = heightmap.data[gy * heightmap.width + gx] ?? 0.5;
    }

    // Coastal perimeter: fraction of raster boundary cells touching ocean/edge
    // (Voronoi-based detection fails because all seed points are on land)
    let coastPixels = 0, borderPixels = 0;
    for (let ry = 0; ry < rasterH; ry++) {
      for (let rx = 0; rx < rasterW; rx++) {
        if (rasterGrid[ry * rasterW + rx] !== countryIdx) continue;
        // Check 4 neighbors for ocean adjacency
        let onBorder = false;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          const nx = rx + dx, ny = ry + dy;
          if (nx < 0 || nx >= rasterW || ny < 0 || ny >= rasterH) {
            onBorder = true; // Edge of grid
            continue;
          }
          const nid = rasterGrid[ny * rasterW + nx]!;
          if (nid !== countryIdx) onBorder = true;
          if (nid === -1) coastPixels++; // Adjacent to ocean
        }
        if (onBorder) borderPixels++;
      }
    }

    const id = `gen-country-${countryIdx}`;
    const neighbors = countryNeighborSets.get(countryIdx);

    countries.push({
      id,
      name: nameGen(),
      geometry: { type: "Polygon", coordinates: [noisy] },
      centroid: [cx, cy],
      areaKm2,
      elevation,
      coastalPerimeter: borderPixels > 0 ? coastPixels / (borderPixels * 4) : 0,
      neighbors: neighbors
        ? [...neighbors].map((n) => `gen-country-${n}`)
        : [],
    });
  }

  // Build GeoJSON
  const features: Feature[] = countries.map((c) => ({
    type: "Feature",
    id: c.id,
    geometry: c.geometry,
    properties: {
      featureId: c.id,
      displayName: c.name,
      elevation: c.elevation,
      areaKm2: c.areaKm2,
      neighbors: c.neighbors,
    },
  }));

  return {
    countries,
    featureCollection: { type: "FeatureCollection", features },
    mesh: { points, cellCount, cellCountry, cellIsLand, bounds },
  };
}

// ─── Poisson Disk Sampling ──────────────────────────────────

function poissonDiskOnLand(
  heightmap: HeightmapResult,
  targetCount: number,
  rng: () => number,
  bounds: [number, number, number, number]
): Position[] {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const lngRange = maxLng - minLng;
  const latRange = maxLat - minLat;

  // Estimate land fraction from heightmap to scale minimum distance correctly
  let landPixels = 0;
  const sampleStep = Math.max(1, Math.floor(heightmap.width / 50));
  for (let y = 0; y < heightmap.height; y += sampleStep) {
    for (let x = 0; x < heightmap.width; x += sampleStep) {
      if ((heightmap.data[y * heightmap.width + x] ?? 0) >= heightmap.seaLevel) landPixels++;
    }
  }
  const totalSampled = Math.ceil(heightmap.height / sampleStep) * Math.ceil(heightmap.width / sampleStep);
  const landFraction = Math.max(0.1, landPixels / totalSampled);

  // Scale distance by land fraction — points only go on land, so effective area is smaller
  const landArea = lngRange * latRange * landFraction;
  const minDist = Math.sqrt(landArea / targetCount) * 0.5;
  const minDistSq = minDist * minDist;

  // Spatial grid storing point indices per cell for O(1) neighbor lookup
  const gridSize = minDist;
  const cols = Math.ceil(lngRange / gridSize);
  const rows = Math.ceil(latRange / gridSize);
  const grid: Array<number[]> = new Array(cols * rows);
  for (let i = 0; i < grid.length; i++) grid[i] = [];

  const points: Position[] = [];
  const maxAttempts = targetCount * 100;

  for (let attempt = 0; attempt < maxAttempts && points.length < targetCount; attempt++) {
    const lng = minLng + rng() * lngRange;
    const lat = minLat + rng() * latRange;

    if (!isOnLand(lng, lat, heightmap)) continue;

    const gc = Math.min(cols - 1, Math.floor((lng - minLng) / gridSize));
    const gr = Math.min(rows - 1, Math.floor((lat - minLat) / gridSize));

    // Check neighboring grid cells for proximity
    let tooClose = false;
    for (let dr = -2; dr <= 2 && !tooClose; dr++) {
      for (let dc = -2; dc <= 2 && !tooClose; dc++) {
        const r = gr + dr;
        const c = gc + dc;
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const cellPoints = grid[r * cols + c]!;
        for (const idx of cellPoints) {
          const dx = lng - points[idx]![0];
          const dy = lat - points[idx]![1];
          if (dx * dx + dy * dy < minDistSq) { tooClose = true; break; }
        }
      }
    }
    if (tooClose) continue;

    const idx = points.length;
    points.push([lng, lat]);
    grid[gr * cols + gc]!.push(idx);
  }

  return points;
}

// ─── Capital Placement ──────────────────────────────────────

function pickCapitals(
  points: Float64Array,
  cellIsLand: Uint8Array,
  targetCountries: number,
  heightmap: HeightmapResult,
  rng: () => number
): number[] {
  // Collect land cell indices
  const landCells: number[] = [];
  for (let i = 0; i < cellIsLand.length; i++) {
    if (cellIsLand[i]) landCells.push(i);
  }

  if (landCells.length <= targetCountries) return landCells;

  // Score each land cell: prefer mid-elevation, away from coast
  const scores: Array<{ cell: number; score: number }> = landCells.map((i) => {
    const lng = points[i * 2]!;
    const lat = points[i * 2 + 1]!;
    const gx = Math.floor(((lng + 180) / 360) * heightmap.width);
    const gy = Math.floor(((90 - lat) / 180) * heightmap.height);
    const elev = heightmap.data[gy * heightmap.width + gx] ?? 0;
    const normElev = (elev - heightmap.seaLevel) / (1 - heightmap.seaLevel);

    // Prefer mid-elevation (not too coastal, not mountain peak)
    const elevScore = 1 - Math.abs(normElev - 0.3) * 2;
    // Add randomness for variety
    const score = elevScore * 0.6 + rng() * 0.4;
    return { cell: i, score };
  });

  scores.sort((a, b) => b.score - a.score);

  // Pick capitals with minimum spacing
  const capitals: number[] = [];
  const minCapDist = Math.sqrt(
    (360 * 170) / targetCountries
  ) * 0.4;

  for (const { cell } of scores) {
    if (capitals.length >= targetCountries) break;

    const lng = points[cell * 2]!;
    const lat = points[cell * 2 + 1]!;

    let tooClose = false;
    for (const cap of capitals) {
      const dx = lng - points[cap * 2]!;
      const dy = lat - points[cap * 2 + 1]!;
      if (dx * dx + dy * dy < minCapDist * minCapDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    capitals.push(cell);
  }

  return capitals;
}

// ─── Territory Expansion ────────────────────────────────────

/**
 * Expand territories from capitals using round-robin BFS.
 * Each round, every country frontier tries to claim its best neighbor.
 * Elevation gradients influence expansion cost (mountains = borders).
 */
function expandTerritories(
  points: Float64Array,
  cellCount: number,
  cellIsLand: Uint8Array,
  capitals: number[],
  delaunay: InstanceType<typeof Delaunay>,
  heightmap: HeightmapResult
): Int32Array {
  const cellCountry = new Int32Array(cellCount).fill(-1);

  // Initialize frontiers: one queue per country
  const frontiers: Array<number[]> = capitals.map(() => []);
  for (let ci = 0; ci < capitals.length; ci++) {
    const cell = capitals[ci]!;
    cellCountry[cell] = ci;
    frontiers[ci]!.push(cell);
  }

  // Round-robin expansion until all land is claimed
  let changed = true;
  let safety = 0;
  while (changed && safety++ < cellCount) {
    changed = false;

    for (let ci = 0; ci < frontiers.length; ci++) {
      const frontier = frontiers[ci]!;
      if (frontier.length === 0) continue;

      const nextFrontier: number[] = [];

      for (const cell of frontier) {
        for (const neighbor of delaunay.neighbors(cell)) {
          if (!cellIsLand[neighbor] || cellCountry[neighbor] !== -1) continue;

          // Cost check: prefer expansion along gentle terrain
          const clng = points[cell * 2]!;
          const clat = points[cell * 2 + 1]!;
          const nlng = points[neighbor * 2]!;
          const nlat = points[neighbor * 2 + 1]!;

          const gx1 = Math.floor(((clng + 180) / 360) * heightmap.width);
          const gy1 = Math.floor(((90 - clat) / 180) * heightmap.height);
          const gx2 = Math.floor(((nlng + 180) / 360) * heightmap.width);
          const gy2 = Math.floor(((90 - nlat) / 180) * heightmap.height);
          const e1 = heightmap.data[gy1 * heightmap.width + gx1] ?? 0;
          const e2 = heightmap.data[gy2 * heightmap.width + gx2] ?? 0;
          const elevDiff = Math.abs(e2 - e1);

          // Skip very steep transitions (creates natural mountain borders)
          if (elevDiff > 0.15 && e2 > 0.7) continue;

          cellCountry[neighbor] = ci;
          nextFrontier.push(neighbor);
          changed = true;
        }
      }

      frontiers[ci] = nextFrontier;
    }
  }

  // Claim any remaining unclaimed land cells (isolated by mountains)
  for (let i = 0; i < cellCount; i++) {
    if (cellIsLand[i] && cellCountry[i] === -1) {
      // Assign to nearest country by checking neighbors
      for (const n of delaunay.neighbors(i)) {
        if (cellCountry[n] >= 0) {
          cellCountry[i] = cellCountry[n];
          break;
        }
      }
    }
  }

  return cellCountry;
}

// ─── Utility Functions ──────────────────────────────────────

function emptyFC(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function isOnLand(lng: number, lat: number, hm: HeightmapResult): boolean {
  const gx = Math.floor(((lng + 180) / 360) * hm.width);
  const gy = Math.floor(((90 - lat) / 180) * hm.height);
  if (gx < 0 || gx >= hm.width || gy < 0 || gy >= hm.height) return false;
  return (hm.data[gy * hm.width + gx] ?? 0) >= hm.seaLevel;
}

function polygonCentroid(poly: number[][]): [number, number] {
  let cx = 0, cy = 0, area = 0;
  for (let i = 0, j = poly.length - 2; i < poly.length - 1; j = i++) {
    const xi = poly[i]![0], yi = poly[i]![1];
    const xj = poly[j]![0], yj = poly[j]![1];
    const cross = xi * yj - xj * yi;
    area += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-10) {
    // Degenerate polygon — simple average
    let sx = 0, sy = 0;
    for (let i = 0; i < poly.length - 1; i++) { sx += poly[i]![0]; sy += poly[i]![1]; }
    return [sx / (poly.length - 1), sy / (poly.length - 1)];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

function shoelaceArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  }
  return area / 2;
}

/**
 * Procedural name generator using syllable combinations.
 */
function createNameGenerator(seed: number): () => string {
  const rng = seededRandom(seed);
  const onsets = ["", "b", "br", "c", "ch", "d", "f", "g", "gr", "h", "j", "k", "kr", "l", "m", "n", "p", "pr", "r", "s", "sh", "st", "t", "th", "tr", "v", "w", "z"];
  const nuclei = ["a", "e", "i", "o", "u", "ai", "ei", "ou", "au", "ea", "ia", "io"];
  const codas = ["", "d", "k", "l", "m", "n", "nd", "ng", "r", "s", "sh", "st", "t", "th", "x"];

  const used = new Set<string>();

  return () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const syllableCount = 2 + Math.floor(rng() * 2);
      let name = "";
      for (let s = 0; s < syllableCount; s++) {
        name += onsets[Math.floor(rng() * onsets.length)]!;
        name += nuclei[Math.floor(rng() * nuclei.length)]!;
        if (s < syllableCount - 1 || rng() > 0.5) {
          name += codas[Math.floor(rng() * codas.length)]!;
        }
      }
      name = name.charAt(0).toUpperCase() + name.slice(1);
      if (!used.has(name) && name.length >= 3) {
        used.add(name);
        return name;
      }
    }
    return `Region-${Math.floor(rng() * 1000)}`;
  };
}
