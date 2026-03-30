/**
 * Trade Route Generator — A* pathfinding over terrain
 *
 * Generates trade routes between major cities using A* pathfinding
 * over a terrain cost grid. Routes prefer flat land, river corridors,
 * and coastal shipping lanes.
 *
 * Output: GeoJSON LineString features classified by route type
 */

import type { Feature, FeatureCollection, LineString, Position } from "geojson";
import type { HeightmapResult } from "./landmass-generator";
import type { City } from "./population-generator";
import { type BiomeGrid, BIOME_TYPES, BIOME_MOVEMENT_COST } from "./biomes";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type RouteType = "land" | "shipping" | "river";

export interface TradeRoute {
  id: string;
  from: string; // city ID
  to: string;   // city ID
  type: RouteType;
  path: Position[];
  cost: number;
  lengthKm: number;
}

export interface TradeRouteResult {
  routes: TradeRoute[];
  featureCollection: FeatureCollection;
}

export interface TradeRouteGenParams {
  heightmap: HeightmapResult;
  cities: City[];
  /** Max city pairs to connect (default: 50) */
  maxPairs?: number;
  /** Max route cost before giving up (default: 5000) */
  maxCost?: number;
  /** Biome grid for biome-aware terrain costs (optional) */
  biomeGrid?: BiomeGrid;
}

// ──────────────────────────────────────────────
// Terrain Cost Grid
// ──────────────────────────────────────────────

function buildCostGrid(heightmap: HeightmapResult, biomeGrid?: BiomeGrid): Float32Array {
  const { width, height, data, seaLevel } = heightmap;
  const cost = new Float32Array(width * height);

  for (let i = 0; i < data.length; i++) {
    const elev = data[i]!;

    if (elev <= seaLevel) {
      // Sea depth-dependent costs (Azgaar pattern)
      const depth = seaLevel - elev;
      if (depth < 0.05) cost[i] = 1.8;      // Coastal waters
      else if (depth < 0.15) cost[i] = 3;    // Shallow sea
      else cost[i] = 6;                       // Deep ocean
    } else if (biomeGrid && biomeGrid.data[i] !== 255) {
      // Biome-aware land cost (normalized to 1-100 range)
      const biomeIdx = biomeGrid.data[i]!;
      const biomeType = BIOME_TYPES[biomeIdx];
      if (biomeType) {
        cost[i] = BIOME_MOVEMENT_COST[biomeType] / 50;
      } else {
        cost[i] = 2; // fallback
      }
    } else {
      // Elevation-based fallback (no biome data)
      const elevNorm = (elev - seaLevel) / (1 - seaLevel);
      if (elevNorm < 0.1) cost[i] = 1;
      else if (elevNorm < 0.2) cost[i] = 1.5;
      else if (elevNorm < 0.35) cost[i] = 2.5;
      else if (elevNorm < 0.5) cost[i] = 5;
      else if (elevNorm < 0.7) cost[i] = 10;
      else cost[i] = 50;
    }
  }

  return cost;
}

// ──────────────────────────────────────────────
// A* Pathfinding
// ──────────────────────────────────────────────

interface AStarNode {
  idx: number;
  g: number; // cost from start
  f: number; // g + heuristic
}

function astar(
  costGrid: Float32Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  maxCost: number
): number[] | null {
  const startIdx = startY * width + startX;
  const endIdx = endY * width + endX;

  if (startIdx === endIdx) return [startIdx];

  const gScore = new Float32Array(width * height).fill(Infinity);
  const cameFrom = new Int32Array(width * height).fill(-1);
  gScore[startIdx] = 0;

  // Binary min-heap priority queue (O(log n) push/pop vs O(n) sorted array)
  const heap: AStarNode[] = [];
  const hPush = (node: AStarNode) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]!.f <= heap[i]!.f) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const hPop = (): AStarNode | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let s = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < heap.length && heap[l]!.f < heap[s]!.f) s = l;
        if (r < heap.length && heap[r]!.f < heap[s]!.f) s = r;
        if (s === i) break;
        [heap[i], heap[s]] = [heap[s]!, heap[i]!];
        i = s;
      }
    }
    return top;
  };

  const heuristic = (idx: number) => {
    const x = idx % width;
    const y = Math.floor(idx / width);
    return Math.abs(x - endX) + Math.abs(y - endY);
  };

  hPush({ idx: startIdx, g: 0, f: heuristic(startIdx) });
  const closed = new Uint8Array(width * height);

  while (heap.length > 0) {
    const current = hPop()!;

    if (current.idx === endIdx) {
      // Reconstruct path
      const path: number[] = [];
      let idx = endIdx;
      while (idx !== -1) {
        path.push(idx);
        idx = cameFrom[idx]!;
      }
      return path.reverse();
    }

    if (closed[current.idx]) continue;
    closed[current.idx] = 1;

    const cx = current.idx % width;
    const cy = Math.floor(current.idx / width);

    // 4-connected neighbors
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nidx = ny * width + nx;
      if (closed[nidx]) continue;

      const moveCost = costGrid[nidx]!;
      const tentG = current.g + moveCost;

      if (tentG > maxCost) continue;
      if (tentG >= gScore[nidx]!) continue;

      gScore[nidx] = tentG;
      cameFrom[nidx] = current.idx;
      hPush({ idx: nidx, g: tentG, f: tentG + heuristic(nidx) });
    }
  }

  return null; // No path found
}

// ──────────────────────────────────────────────
// Route Generation
// ──────────────────────────────────────────────

export function generateTradeRoutes(params: TradeRouteGenParams): TradeRouteResult {
  const { heightmap, cities } = params;
  const { width, height, seaLevel } = heightmap;
  const maxPairs = params.maxPairs ?? 50;
  const maxCost = params.maxCost ?? 5000;

  const costGrid = buildCostGrid(heightmap, params.biomeGrid);
  const routes: TradeRoute[] = [];

  // Select city pairs to connect: prioritize capitals and large cities
  const sortedCities = [...cities].sort((a, b) => b.population - a.population);
  const topCities = sortedCities.slice(0, Math.min(20, sortedCities.length));

  // Build pairs: each top city connects to its nearest neighbors
  const pairs: Array<[City, City]> = [];
  const pairSet = new Set<string>();

  for (const city of topCities) {
    // Sort other cities by distance
    const others = topCities
      .filter((c) => c.id !== city.id)
      .map((c) => ({
        city: c,
        dist: Math.hypot(c.x - city.x, c.y - city.y),
      }))
      .sort((a, b) => a.dist - b.dist);

    // Connect to 3 nearest
    for (const other of others.slice(0, 3)) {
      const key = [city.id, other.city.id].sort().join("-");
      if (pairSet.has(key)) continue;
      pairSet.add(key);
      pairs.push([city, other.city]);
      if (pairs.length >= maxPairs) break;
    }
    if (pairs.length >= maxPairs) break;
  }

  // Run A* for each pair
  for (const [from, to] of pairs) {
    const path = astar(costGrid, width, height, from.x, from.y, to.x, to.y, maxCost);
    if (!path || path.length < 2) continue;

    // Convert path to WGS84 coordinates and simplify
    const coordinates: Position[] = [];
    let totalCost = 0;
    let oceanCells = 0;
    let landCells = 0;

    for (let i = 0; i < path.length; i++) {
      const idx = path[i]!;
      totalCost += costGrid[idx]!;

      if (heightmap.data[idx]! <= seaLevel) oceanCells++;
      else landCells++;

      // Simplify: only keep every Nth point (smooth the path)
      if (i === 0 || i === path.length - 1 || i % 3 === 0) {
        const x = idx % width;
        const y = Math.floor(idx / width);
        const lng = -180 + (x / width) * 360;
        const lat = -90 + (y / height) * 180;
        coordinates.push([lng, lat]);
      }
    }

    // Classify route type (fixed: >10% ocean is mixed coastal, not duplicate shipping)
    const oceanFraction = oceanCells / (oceanCells + landCells);
    let type: RouteType;
    if (oceanFraction > 0.5) type = "shipping";
    else if (oceanFraction > 0.1) type = "river"; // Mixed coastal/river route
    else type = "land";

    // Approximate length in km (haversine approximation)
    let lengthKm = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const [lng1, lat1] = coordinates[i - 1]!;
      const [lng2, lat2] = coordinates[i]!;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      lengthKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    routes.push({
      id: `route-${routes.length}`,
      from: from.id,
      to: to.id,
      type,
      path: coordinates,
      cost: totalCost,
      lengthKm: Math.round(lengthKm),
    });
  }

  // Build GeoJSON
  const ROUTE_COLORS: Record<RouteType, string> = {
    land: "#8B4513",     // brown
    shipping: "#1E90FF", // blue
    river: "#4682B4",    // steel blue
  };

  const features: Feature[] = routes.map((route) => ({
    type: "Feature" as const,
    id: route.id,
    geometry: {
      type: "LineString" as const,
      coordinates: route.path,
    } as LineString,
    properties: {
      featureId: route.id,
      routeType: route.type,
      from: route.from,
      to: route.to,
      lengthKm: route.lengthKm,
      cost: route.cost,
      fill: ROUTE_COLORS[route.type],
      stroke: ROUTE_COLORS[route.type],
    },
  }));

  return {
    routes,
    featureCollection: { type: "FeatureCollection", features },
  };
}
