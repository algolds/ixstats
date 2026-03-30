/**
 * Water Generator - Creates rivers and lakes from heightmap data.
 *
 * Rivers: Flow accumulation from highlands to coastline.
 * Lakes: Depression filling in low-elevation inland areas.
 */

import type { Position, Feature, FeatureCollection, LineString, Polygon } from "geojson";
import { createNoise, fractalNoise } from "./noise";
import type { HeightmapResult } from "./landmass-generator";
import { LAYER_CONFIGS } from "../map-config";

export interface WaterParams {
  seed: number;
  heightmap: HeightmapResult;
  hasRivers: boolean;
  hasLakes: boolean;
}

export interface WaterResult {
  riverFeatures: FeatureCollection;
  lakeFeatures: FeatureCollection;
}

/**
 * Generate rivers and lakes from heightmap.
 */
export function generateWater(params: WaterParams): WaterResult {
  const { seed, heightmap, hasRivers, hasLakes } = params;

  const riverFeatures: Feature[] = [];
  const lakeFeatures: Feature[] = [];

  if (hasRivers) {
    const rivers = generateRivers(heightmap, seed);
    for (let i = 0; i < rivers.length; i++) {
      riverFeatures.push({
        type: "Feature",
        id: `river-${i}`,
        geometry: rivers[i]!,
        properties: {
          featureId: `river-${i}`,
          displayName: generateRiverName(seed + i),
          type: "river",
          fill: LAYER_CONFIGS.rivers.strokeColor ?? LAYER_CONFIGS.rivers.fillColor as string,
        },
      });
    }
  }

  if (hasLakes) {
    const lakes = generateLakes(heightmap, seed);
    for (let i = 0; i < lakes.length; i++) {
      lakeFeatures.push({
        type: "Feature",
        id: `lake-${i}`,
        geometry: lakes[i]!,
        properties: {
          featureId: `lake-${i}`,
          displayName: generateLakeName(seed + i + 500),
          type: "lake",
          fill: LAYER_CONFIGS.lakes.fillColor as string,
        },
      });
    }
  }

  return {
    riverFeatures: { type: "FeatureCollection", features: riverFeatures },
    lakeFeatures: { type: "FeatureCollection", features: lakeFeatures },
  };
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

/**
 * Generate rivers using flow accumulation.
 * Start from elevated land points, follow steepest descent to ocean.
 *
 * IxWorld reference: 1041 rivers, avg 130 vertices, median 97 vertices.
 * Rivers range from short coastal streams to long continental rivers.
 */
function generateRivers(heightmap: HeightmapResult, seed: number): LineString[] {
  const { width, height, data, seaLevel } = heightmap;
  const rng = seededRandom(seed + 400);
  const rivers: LineString[] = [];

  // Find river source candidates — any elevated land point
  const candidates: Array<{ x: number; y: number; elev: number }> = [];
  const step = Math.max(1, Math.floor(width / 200)); // Very fine sampling for IxWorld density

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const elev = data[y * width + x]!;
      if (elev >= seaLevel + 0.01) {
        candidates.push({ x, y, elev });
      }
    }
  }

  // Sort by elevation (highest first) and pick sources
  candidates.sort((a, b) => b.elev - a.elev);
  // Target ~1000+ rivers (IxWorld has 1041)
  const maxRivers = Math.min(1200, Math.floor(candidates.length * 0.5));
  const sourceCandidates = candidates.slice(0, maxRivers * 8);

  // Filter to spread out river sources — tight spacing for dense river network
  const sources: Array<{ x: number; y: number }> = [];
  const minSourceDist = width * 0.006; // ~3 pixels at 512 resolution

  for (const c of sourceCandidates) {
    if (sources.length >= maxRivers) break;
    const tooClose = sources.some((s) => {
      const dx = c.x - s.x;
      const dy = c.y - s.y;
      return dx * dx + dy * dy < minSourceDist * minSourceDist;
    });
    if (!tooClose) {
      sources.push({ x: c.x, y: c.y });
    }
  }

  // Create noise for river meander subdivision
  const meanderNoise = createNoise(seed + 410);

  // Trace each river downhill and subdivide for vertex density
  for (let ri = 0; ri < sources.length; ri++) {
    const source = sources[ri]!;
    const path = traceRiver(data, width, height, source.x, source.y, seaLevel);
    if (path.length < 2) continue;

    // Subdivide pixel path into detailed WGS84 coordinates with smooth meander
    // Each pixel step → 4 vertices (3 intermediate + 1 original)
    // IxWorld: avg 130 vertices, median 97
    const coordinates = detailRiverPath(path, width, height, meanderNoise, ri);
    if (coordinates.length >= 2) {
      rivers.push({ type: "LineString", coordinates });
    }
  }

  return rivers;
}

function traceRiver(
  data: Float32Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  seaLevel: number
): Array<[number, number]> {
  const path: Array<[number, number]> = [[startX, startY]];
  const visited = new Set<number>();
  let cx = startX;
  let cy = startY;
  const maxSteps = width + height;

  for (let step = 0; step < maxSteps; step++) {
    const key = cy * width + cx;
    if (visited.has(key)) break;
    visited.add(key);

    // Check if we reached the ocean
    if (data[key]! < seaLevel) break;

    // Find all downhill neighbors, sorted by elevation
    const candidates: Array<{ x: number; y: number; elev: number }> = [];
    const currentElev = data[key]!;

    for (const [dx, dy] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const elev = data[ny * width + nx]!;
      if (elev < currentElev) {
        candidates.push({ x: nx, y: ny, elev });
      }
    }

    if (candidates.length === 0) break;

    // Pick steepest descent (meander by occasionally choosing 2nd best)
    candidates.sort((a, b) => a.elev - b.elev);
    // Use step-based pseudo-random to occasionally meander (deterministic)
    const meander = (step * 7 + cx * 13 + cy * 17) % 5;
    const pick = meander === 0 && candidates.length > 1 ? 1 : 0;
    const best = candidates[pick]!;

    cx = best.x;
    cy = best.y;
    path.push([cx, cy]);
  }

  return path;
}

/**
 * Subdivide a raw pixel river path into detailed WGS84 coordinates.
 * Adds 3 intermediate points per pixel step with smooth noise-based meander.
 * Result: ~4x the vertex count of the raw path.
 *
 * IxWorld reference: avg 130 vertices, median 97 per river.
 */
function detailRiverPath(
  path: Array<[number, number]>,
  width: number,
  height: number,
  noise: ReturnType<typeof createNoise>,
  riverIdx: number,
): Position[] {
  if (path.length < 2) return [];

  const coords: Position[] = [];
  const SUBS = 14; // 14 intermediate points per pixel segment for IxWorld vertex density (~130 avg)
  const rOff = riverIdx * 97.31; // unique noise offset per river
  const pathLen = path.length;
  // Scale meander amplitude with river length (longer rivers meander more)
  const meanderAmp = Math.min(0.08, 0.01 + pathLen * 0.001);

  for (let i = 0; i < pathLen; i++) {
    const [px, py] = path[i]!;
    const lng = (px / width) * 360 - 180;
    const lat = 90 - (py / height) * 180;

    // Add meander to non-endpoint vertices
    if (i > 0 && i < pathLen - 1) {
      const mx = fractalNoise(noise, i * 0.4 + rOff, 0.0, 2) * meanderAmp;
      const my = fractalNoise(noise, i * 0.4 + rOff, 50.0, 2) * meanderAmp * 0.6;
      coords.push([lng + mx, lat + my]);
    } else {
      coords.push([lng, lat]);
    }

    // Subdivide segment to next vertex
    if (i < pathLen - 1) {
      const [nx, ny] = path[i + 1]!;
      const nlng = (nx / width) * 360 - 180;
      const nlat = 90 - (ny / height) * 180;
      const dlng = nlng - lng;
      const dlat = nlat - lat;

      for (let s = 1; s <= SUBS; s++) {
        const t = s / (SUBS + 1);
        const mx = fractalNoise(noise, (i + t) * 0.4 + rOff, s * 3.1, 2) * meanderAmp;
        const my = fractalNoise(noise, (i + t) * 0.4 + rOff, s * 3.1 + 50, 2) * meanderAmp * 0.6;
        coords.push([
          lng + dlng * t + mx,
          lat + dlat * t + my,
        ]);
      }
    }
  }

  return coords;
}

/**
 * Generate lakes scattered across land.
 *
 * IxWorld reference: 350 lakes, avg 20 vertices, median 12 vertices.
 * Lakes are small features scattered across lowlands and mid-elevations.
 */
function generateLakes(heightmap: HeightmapResult, seed: number): Polygon[] {
  const { width, height, data, seaLevel } = heightmap;
  const rng = seededRandom(seed + 500);
  const noise = createNoise(seed + 501);
  const lakes: Polygon[] = [];

  // Fine step for dense lake candidate sampling
  const step = Math.max(2, Math.floor(width / 128));
  const candidates: Array<{ x: number; y: number; elev: number }> = [];

  // Accept any land point in lake-suitable elevation range (no local minimum required)
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const elev = data[y * width + x]!;
      if (elev >= seaLevel + 0.01 && elev <= seaLevel + 0.6) {
        candidates.push({ x, y, elev });
      }
    }
  }

  // Shuffle and select lake sites with spacing filter
  const shuffled = candidates.sort(() => rng() - 0.5);
  // Scale lake count with resolution: ~350 at 512, ~150 at 256
  const maxLakes = Math.round(350 * (width / 512));
  const minLakeDist = width * 0.015; // ~8 pixels at 512 — more spacing between lakes
  const selectedSites: Array<{ x: number; y: number; elev: number }> = [];

  for (const c of shuffled) {
    if (selectedSites.length >= maxLakes) break;
    const tooClose = selectedSites.some((s) => {
      const dx = c.x - s.x;
      const dy = c.y - s.y;
      return dx * dx + dy * dy < minLakeDist * minLakeDist;
    });
    if (!tooClose) {
      selectedSites.push(c);
    }
  }

  for (const lake of selectedSites) {
    const centerLng = (lake.x / width) * 360 - 180;
    const centerLat = 90 - (lake.y / height) * 180;

    // Create organic-shaped lake polygon, clamped to land
    // IxWorld lakes are mostly small — median area 0.07 deg², avg 12 vertices
    const numPoints = 14 + Math.floor(rng() * 12); // IxWorld avg 20 vertices per lake
    const baseRadius = 0.1 + rng() * 0.4; // Much smaller (was 0.3-1.1)
    const ring: Position[] = [];
    let oceanPoints = 0;

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const jitter = fractalNoise(noise, Math.cos(angle) * 3 + lake.x, Math.sin(angle) * 3 + lake.y, 3);
      let radius = baseRadius * (0.7 + jitter * 0.3);

      // Clamp radius so the point stays on land
      const pLng = centerLng + Math.cos(angle) * radius;
      const pLat = centerLat + Math.sin(angle) * radius * 0.6;
      const px = Math.floor(((pLng + 180) / 360) * width);
      const py = Math.floor(((90 - pLat) / 180) * height);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        if (data[py * width + px]! < seaLevel) {
          // Shrink radius until on land (binary search)
          let lo = 0, hi = radius;
          for (let s = 0; s < 6; s++) {
            const mid = (lo + hi) / 2;
            const mx = Math.floor(((centerLng + Math.cos(angle) * mid + 180) / 360) * width);
            const my = Math.floor(((90 - (centerLat + Math.sin(angle) * mid * 0.6)) / 180) * height);
            if (mx >= 0 && mx < width && my >= 0 && my < height && data[my * width + mx]! >= seaLevel) {
              lo = mid;
            } else {
              hi = mid;
            }
          }
          radius = lo;
          if (radius < 0.05) { oceanPoints++; continue; }
        }
      } else {
        oceanPoints++;
        continue;
      }

      ring.push([
        centerLng + Math.cos(angle) * radius,
        centerLat + Math.sin(angle) * radius * 0.6,
      ]);
    }

    // Skip lakes where too many points are in ocean (relaxed for coastal lakes)
    if (oceanPoints > numPoints * 0.5 || ring.length < 3) continue;

    ring.push(ring[0]!);
    lakes.push({ type: "Polygon", coordinates: [ring] });
  }

  return lakes;
}

function simplifyPath(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpDist(points[i]!, first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpDist(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.sqrt((p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2);
}

function generateRiverName(seed: number): string {
  const rng = seededRandom(seed);
  const prefixes = ["Great", "Blue", "White", "Green", "Red", "Silver", "Golden", "Dark", "Clear", "Long"];
  const roots = ["water", "stream", "flow", "run", "brook", "bourne", "wye", "avon", "don", "ouse"];
  return `${prefixes[Math.floor(rng() * prefixes.length)]} ${roots[Math.floor(rng() * roots.length)]}`;
}

function generateLakeName(seed: number): string {
  const rng = seededRandom(seed);
  const prefixes = ["Lake", "Loch", "Lac", "Lago"];
  const names = ["Mirror", "Crystal", "Shadow", "Echo", "Dawn", "Mist", "Frost", "Thunder", "Silent", "Azure"];
  return `${prefixes[Math.floor(rng() * prefixes.length)]} ${names[Math.floor(rng() * names.length)]}`;
}
