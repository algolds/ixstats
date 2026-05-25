/**
 * Landmass Generator - Converts noise heightmap into coastline polygons.
 *
 * Pipeline: seeded noise → heightmap grid → flood fill → angular boundary → polygons
 *
 * Memory-optimized: uses typed arrays, flood fill with angular boundary extraction,
 * and filters tiny islands. Targets <10MB for 256 resolution.
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import { createNoise, fractalNoise } from "./noise";
import { noisyRing } from "./noisy-edges";
import type { WorldProfile } from "./world-profile";
import { generateTectonicPlates, tectonicInfluence, type CollisionZone } from "./tectonic-shapes";
import { extractGridOutline, douglasPeuckerSimplify } from "./grid-outline";

export interface LandmassParams {
  seed: number;
  gridResolution: number; // 128-512
  continentCount: number; // 1-8
  oceanPercentage: number; // 0.4-0.8
  terrainRoughness: number; // 0-1
  hasIcecaps: boolean;
  /** World profile for statistical guidance */
  profile?: WorldProfile;
  /** 0=fully random (legacy), 1=tightly match profile */
  similarity?: number;
}

/** Collision zones detected during landmass generation (for terrain mountain chains) */
export interface LandmassExtra {
  collisionZones: CollisionZone[];
}

export interface HeightmapResult {
  width: number;
  height: number;
  data: Float32Array; // Normalized [0, 1]
  seaLevel: number; // Threshold for land vs ocean
}

export interface LandmassResult {
  heightmap: HeightmapResult;
  landPolygons: Array<{ geometry: Polygon | MultiPolygon; areaKm2: number }>;
  coastlineLength: number;
  landPercentage: number;
}

/**
 * Generate a heightmap grid using multi-octave noise with continent placement.
 *
 * When profile + similarity are provided, uses tectonic-plate-inspired shapes
 * with Perlin-warped boundaries instead of simple ellipses.
 */
export function generateHeightmap(
  params: LandmassParams
): HeightmapResult & { extra?: LandmassExtra } {
  const {
    seed,
    gridResolution,
    continentCount,
    oceanPercentage,
    terrainRoughness,
    profile,
    similarity = 0,
  } = params;
  const width = gridResolution;
  const height = Math.round(gridResolution * 0.6); // ~60% height for equirectangular
  const data = new Float32Array(width * height);

  const baseNoise = createNoise(seed);
  const detailNoise = createNoise(seed + 1);
  const coastalNoise = createNoise(seed + 5);
  const rng = seededRandom(seed + 100);

  const octaves = Math.min(6, 4 + Math.round(terrainRoughness * 2));

  // Choose continent shape strategy based on similarity
  const useTectonics = similarity > 0.01 && profile;
  let tecInfluenceFn: ((nx: number, ny: number) => number) | null = null;
  let collisionZones: CollisionZone[] = [];

  if (useTectonics) {
    // Profile-guided: tectonic plates with Perlin-warped boundaries
    const tecResult = generateTectonicPlates(params, profile, similarity, rng);
    tecInfluenceFn = tectonicInfluence(tecResult.plates, tecResult.collisions, detailNoise);
    collisionZones = tecResult.collisions;
  } else {
    // Legacy: elliptical continent shapes (backward compatible)
    interface ContinentShape {
      x: number;
      y: number;
      rx: number;
      ry: number;
      angle: number;
    }
    const centers: ContinentShape[] = [];
    for (let i = 0; i < continentCount; i++) {
      const baseRadius = 0.1 + rng() * 0.15;
      const aspect = 1.0 + rng() * 1.5;
      centers.push({
        x: 0.08 + rng() * 0.84,
        y: 0.12 + rng() * 0.76,
        rx: baseRadius * aspect,
        ry: baseRadius / aspect,
        angle: rng() * Math.PI,
      });
    }

    tecInfluenceFn = (nx: number, ny: number): number => {
      let continentInfluence = 0;
      for (const c of centers) {
        const dx = nx - c.x;
        const dy = ny - c.y;
        const cosA = Math.cos(c.angle);
        const sinA = Math.sin(c.angle);
        const rx = dx * cosA + dy * sinA;
        const ry = -dx * sinA + dy * cosA;
        const dist = Math.sqrt((rx / c.rx) ** 2 + (ry / c.ry) ** 2);
        const influence = Math.max(0, 1 - dist);
        continentInfluence = Math.max(continentInfluence, influence * influence);
      }

      // Bridge bonus
      let bridgeBonus = 0;
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          const ci = centers[i]!,
            cj = centers[j]!;
          const dxi = nx - ci.x,
            dyi = ny - ci.y;
          const dxj = nx - cj.x,
            dyj = ny - cj.y;
          const di = Math.sqrt(dxi * dxi + dyi * dyi);
          const dj = Math.sqrt(dxj * dxj + dyj * dyj);
          const maxR = Math.max(ci.rx, ci.ry, cj.rx, cj.ry);
          if (di < maxR * 1.5 && dj < maxR * 1.5) {
            const proximity = (1 - di / (maxR * 1.5)) * (1 - dj / (maxR * 1.5));
            bridgeBonus = Math.max(bridgeBonus, proximity * 0.3);
          }
        }
      }

      return continentInfluence + bridgeBonus;
    };
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;

      // Base terrain
      let value = fractalNoise(baseNoise, nx * 4, ny * 4, octaves, 2.0, 0.5);

      // Continent influence (tectonic or elliptical)
      const contInfluence = tecInfluenceFn(nx, ny);
      value = value * 0.55 + contInfluence * 0.45;

      // Detail noise
      value += fractalNoise(detailNoise, nx * 12, ny * 12, 3, 2.0, 0.4) * 0.15 * terrainRoughness;

      // Coastal noise enhancement (Patel technique)
      const coastalDetail =
        fractalNoise(coastalNoise, nx * 20, ny * 20, 3, 2.0, 0.5) * 0.08 +
        fractalNoise(coastalNoise, nx * 40, ny * 40, 2, 2.0, 0.5) * 0.04;
      const rawNorm = (value + 1) / 2;
      const coastalProximity = 1 - Math.min(1, Math.abs(rawNorm - 0.5) * 6);
      value += coastalDetail * coastalProximity;

      // Latitude factor
      const latFactor = Math.sin(ny * Math.PI);
      value *= 0.7 + latFactor * 0.3;

      // Edge fade
      const edgeFadeX = Math.min(nx * 8, (1 - nx) * 8, 1);
      const edgeFadeY = Math.min(ny * 6, (1 - ny) * 6, 1);
      value *= edgeFadeX * edgeFadeY;

      data[y * width + x] = Math.max(0, Math.min(1, (value + 1) / 2));
    }
  }

  // Find sea level that gives desired ocean percentage
  const sorted = Float32Array.from(data).sort();
  const seaLevelIndex = Math.floor(oceanPercentage * sorted.length);
  const seaLevel = sorted[seaLevelIndex]!;

  return {
    width,
    height,
    data,
    seaLevel,
    extra: collisionZones.length > 0 ? { collisionZones } : undefined,
  };
}

/**
 * Extract land polygons using pixel-level flood fill + grid outline extraction.
 *
 * Pipeline:
 *   1. Build binary land grid from heightmap
 *   2. Pixel-level flood fill to find connected land regions
 *   3. Grid outline extraction for each region (preserves concave coastlines)
 *   4. Douglas-Peucker simplification + noisy edges for natural appearance
 */
export function extractLandPolygons(heightmap: HeightmapResult): LandmassResult {
  const { width, height, data, seaLevel } = heightmap;

  // Create binary grid (1 = land, 0 = ocean)
  const binary = new Uint8Array(width * height);
  let landCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i]! >= seaLevel) {
      binary[i] = 1;
      landCount++;
    }
  }

  // Pixel-level flood fill to find connected land regions
  const visited = new Uint8Array(width * height);
  const polygons: Array<{ geometry: Polygon | MultiPolygon; areaKm2: number }> = [];
  const MIN_REGION_CELLS = 20; // Filter tiny islands
  const MAX_POLYGONS = 60;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || !binary[idx]) continue;

      // Flood fill to mark all pixels in this connected land region
      const regionMask = new Uint8Array(width * height);
      const stack: Array<number> = [idx]; // Store flat indices for speed
      let regionSize = 0;

      while (stack.length > 0) {
        const ci = stack.pop()!;
        if (visited[ci] || !binary[ci]) continue;

        visited[ci] = 1;
        regionMask[ci] = 1;
        regionSize++;

        const cx = ci % width;
        const cy = (ci - cx) / width;

        // 4-connected neighbors
        if (cx > 0) stack.push(ci - 1);
        if (cx < width - 1) stack.push(ci + 1);
        if (cy > 0) stack.push(ci - width);
        if (cy < height - 1) stack.push(ci + width);
      }

      if (regionSize < MIN_REGION_CELLS) continue;

      // Extract outline using grid cell boundary tracing
      const rings = extractGridOutline(regionMask, width, height);
      if (rings.length === 0) continue;

      // Find the largest ring (outer boundary)
      let bestRing = rings[0]!;
      let bestLen = bestRing.length;
      for (let r = 1; r < rings.length; r++) {
        if (rings[r]!.length > bestLen) {
          bestRing = rings[r]!;
          bestLen = rings[r]!.length;
        }
      }

      // Convert grid coordinates to WGS84
      let ring: Position[] = bestRing.map(([gx, gy]) => [
        (gx / width) * 360 - 180,
        90 - (gy / height) * 180,
      ]);

      // Douglas-Peucker simplification
      const dpTolerance = (1 / width) * 360 * 0.5;
      ring = douglasPeuckerSimplify(ring, dpTolerance);
      if (ring.length < 4) continue;

      // Ensure ring is closed
      const first = ring[0]!,
        last = ring[ring.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

      // Apply fractal subdivision to coastlines for natural appearance
      ring = noisyRing(ring, polygons.length * 97 + regionSize * 31, 3, 0.1);
      if (ring.length < 4) continue;

      // Ensure CCW winding
      const area = signedArea(ring);
      if (area < 0) ring.reverse();

      const areaKm2 = Math.abs(area) * 12321;

      polygons.push({
        geometry: { type: "Polygon", coordinates: [ring] },
        areaKm2,
      });

      if (polygons.length >= MAX_POLYGONS) break;
    }
    if (polygons.length >= MAX_POLYGONS) break;
  }

  // Sort by area descending
  polygons.sort((a, b) => b.areaKm2 - a.areaKm2);

  const landPercentage = landCount / data.length;
  const coastlineLength = polygons.reduce((sum, p) => {
    const coords = p.geometry.type === "Polygon" ? p.geometry.coordinates[0]! : [];
    return sum + coords.length;
  }, 0);

  return { heightmap, landPolygons: polygons, coastlineLength, landPercentage };
}

/**
 * Simplify polygons by removing vertices that are nearly collinear.
 */
export function simplifyPolygons(
  polygons: Array<{ geometry: Polygon | MultiPolygon; areaKm2: number }>,
  tolerance: number = 0.5
): Array<{ geometry: Polygon | MultiPolygon; areaKm2: number }> {
  return polygons
    .map((p) => {
      if (p.geometry.type === "Polygon") {
        return {
          ...p,
          geometry: {
            type: "Polygon" as const,
            coordinates: p.geometry.coordinates.map((ring) => douglasPeucker(ring, tolerance)),
          },
        };
      }
      return p;
    })
    .filter((p) => {
      const coords =
        p.geometry.type === "Polygon" ? p.geometry.coordinates : p.geometry.coordinates[0];
      return coords && coords[0] && coords[0].length >= 4;
    });
}

// ─── Internal Helpers ──────────────────────────────────────────

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

function signedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  }
  return area / 2;
}

/**
 * Douglas-Peucker line simplification (iterative to avoid stack overflow).
 */
function douglasPeucker(points: Position[], tolerance: number): Position[] {
  if (points.length <= 3) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // Iterative using explicit stack
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIdx = start;

    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i]!, points[start]!, points[end]!);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > tolerance) {
      keep[maxIdx] = 1;
      if (maxIdx - start > 1) stack.push([start, maxIdx]);
      if (end - maxIdx > 1) stack.push([maxIdx, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function perpendicularDistance(point: Position, lineStart: Position, lineEnd: Position): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0)
    return Math.sqrt((point[0] - lineStart[0]) ** 2 + (point[1] - lineStart[1]) ** 2);

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq)
  );
  const projX = lineStart[0] + t * dx;
  const projY = lineStart[1] + t * dy;
  return Math.sqrt((point[0] - projX) ** 2 + (point[1] - projY) ** 2);
}
