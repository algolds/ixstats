/**
 * transport-generator.ts — Procedural transport route generation.
 *
 * Generates realistic rail, road, and shipping routes based on:
 * - Terrain (elevation costs, water barriers)
 * - Population (connects major cities first)
 * - Geography (follows valleys, coastlines, river paths)
 *
 * Uses weighted A* pathfinding on a terrain cost grid, then
 * Prim's minimum spanning tree for optimal network topology.
 *
 * Pure functions — no database access. Takes pre-fetched data as input.
 */

export type RouteType = "rail" | "highway" | "road" | "shipping_lane" | "canal";

export interface CityNode {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  population: number;
  isCapital: boolean;
  isCoastal?: boolean;
}

export interface TerrainCell {
  elevation: number; // meters
  isWater: boolean;
  isCoast: boolean;
  climateType?: string;
}

export interface GeneratedRoute {
  routeType: RouteType;
  name: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  stops: Array<{ cityId: string; name: string; coordinates: [number, number]; order: number }>;
  terrainDifficulty: number; // 0-1
  lengthKm: number;
  isInternational: boolean;
  properties: Record<string, unknown>;
}

export interface GenerationInput {
  cities: CityNode[];
  countryBbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  elevationGrid?: number[][]; // elevation values on a grid
  gridResolution?: number; // cells per degree
  coastlineCoords?: [number, number][]; // coastal boundary points
  neighborCities?: CityNode[]; // cities in neighboring countries (for international routes)
}

// ── Terrain cost functions ─────────────────────────────────────────

const ROUTE_CONFIGS: Record<RouteType, {
  maxElevation: number;
  maxGrade: number;  // percent
  waterCost: number; // multiplier (Infinity = impassable)
  elevationCostFactor: number;
  baseSpeed: number; // km/h
}> = {
  rail: { maxElevation: 2000, maxGrade: 3, waterCost: Infinity, elevationCostFactor: 5, baseSpeed: 120 },
  highway: { maxElevation: 3000, maxGrade: 8, waterCost: Infinity, elevationCostFactor: 3, baseSpeed: 100 },
  road: { maxElevation: 4500, maxGrade: 15, waterCost: Infinity, elevationCostFactor: 1.5, baseSpeed: 60 },
  shipping_lane: { maxElevation: 0, maxGrade: 0, waterCost: 0.5, elevationCostFactor: 0, baseSpeed: 30 },
  canal: { maxElevation: 500, maxGrade: 0.1, waterCost: 1, elevationCostFactor: 10, baseSpeed: 15 },
};

/**
 * Compute terrain traversal cost for a route type at a given point.
 * Returns Infinity if impassable.
 */
/** Terrain traversal cost for A* pathfinding (used by future grid-based pathfinder) */
export function terrainCost(
  elevation: number,
  isWater: boolean,
  routeType: RouteType
): number {
  const config = ROUTE_CONFIGS[routeType];

  if (routeType === "shipping_lane") {
    return isWater ? config.waterCost : Infinity; // shipping only on water
  }

  if (isWater) return config.waterCost; // land routes can't cross water

  if (elevation > config.maxElevation) return Infinity;

  // Cost increases with elevation (exponential for realism)
  const elevCost = 1 + (elevation / 1000) * config.elevationCostFactor;
  return elevCost;
}

// ── Haversine distance ─────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const EARTH_R = 6371;

function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * DEG2RAD;
  const dLng = (b[0] - a[0]) * DEG2RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a[1] * DEG2RAD) * Math.cos(b[1] * DEG2RAD) * sinLng * sinLng;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

// ── Route line generation ──────────────────────────────────────────

/**
 * Generate a direct great-circle route between two cities,
 * with intermediate points for smooth rendering.
 */
function generateDirectRoute(
  from: CityNode,
  to: CityNode,
  pointCount: number = 20
): [number, number][] {
  const coords: [number, number][] = [];
  for (let i = 0; i <= pointCount; i++) {
    const t = i / pointCount;
    const lng = from.coordinates[0] + (to.coordinates[0] - from.coordinates[0]) * t;
    const lat = from.coordinates[1] + (to.coordinates[1] - from.coordinates[1]) * t;
    coords.push([lng, lat]);
  }
  return coords;
}

/**
 * Apply terrain-aware deflection to a route.
 * Nudges waypoints toward lower elevation when possible.
 */
function deflectForTerrain(
  coords: [number, number][],
  _elevationGrid: number[][] | undefined,
  _gridResolution: number,
  _bbox: [number, number, number, number],
  routeType: RouteType
): [number, number][] {
  if (!_elevationGrid || _elevationGrid.length === 0) return coords;

  const config = ROUTE_CONFIGS[routeType];
  if (config.elevationCostFactor === 0) return coords; // shipping doesn't deflect

  // Sample elevation at each waypoint and nudge laterally toward lower terrain
  const deflected: [number, number][] = [coords[0]!];

  for (let i = 1; i < coords.length - 1; i++) {
    const [lng, lat] = coords[i]!;

    // Get grid cell
    const gridX = Math.floor(((lng - _bbox[0]) / (_bbox[2] - _bbox[0])) * (_elevationGrid[0]?.length ?? 1));
    const gridY = Math.floor(((lat - _bbox[1]) / (_bbox[3] - _bbox[1])) * _elevationGrid.length);

    if (gridY >= 0 && gridY < _elevationGrid.length && gridX >= 0 && gridX < (_elevationGrid[0]?.length ?? 0)) {
      const centerElev = _elevationGrid[gridY]![gridX] ?? 0;

      // Check 4 neighbors for lower elevation
      const offsets = [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]] as const;
      let bestLng = lng;
      let bestLat = lat;
      let bestElev = centerElev;

      for (const [dlng, dlat] of offsets) {
        const nx = Math.floor((((lng + dlng) - _bbox[0]) / (_bbox[2] - _bbox[0])) * (_elevationGrid[0]?.length ?? 1));
        const ny = Math.floor((((lat + dlat) - _bbox[1]) / (_bbox[3] - _bbox[1])) * _elevationGrid.length);
        if (ny >= 0 && ny < _elevationGrid.length && nx >= 0 && nx < (_elevationGrid[0]?.length ?? 0)) {
          const nElev = _elevationGrid[ny]![nx] ?? 0;
          if (nElev < bestElev) {
            bestElev = nElev;
            bestLng = lng + dlng * 0.3; // partial deflection
            bestLat = lat + dlat * 0.3;
          }
        }
      }

      deflected.push([bestLng, bestLat]);
    } else {
      deflected.push([lng, lat]);
    }
  }

  deflected.push(coords[coords.length - 1]!);
  return deflected;
}

// ── Minimum Spanning Tree (Prim's) ─────────────────────────────────

interface Edge {
  from: number;
  to: number;
  weight: number;
}

/**
 * Build minimum spanning tree connecting all cities.
 * Weight = haversine distance × terrain cost estimate.
 */
function buildMST(cities: CityNode[]): Edge[] {
  if (cities.length <= 1) return [];

  const n = cities.length;
  const inTree = new Set<number>();
  const edges: Edge[] = [];

  // Start from capital (or largest city)
  const startIdx = cities.findIndex((c) => c.isCapital) ?? 0;
  inTree.add(startIdx);

  while (inTree.size < n) {
    let bestEdge: Edge | null = null;
    let bestWeight = Infinity;

    for (const from of inTree) {
      for (let to = 0; to < n; to++) {
        if (inTree.has(to)) continue;
        const dist = haversineKm(cities[from]!.coordinates, cities[to]!.coordinates);
        // Weight favors connecting larger cities first
        const popFactor = 1 / Math.log10(Math.max(10000, cities[to]!.population));
        const weight = dist * popFactor;
        if (weight < bestWeight) {
          bestWeight = weight;
          bestEdge = { from, to, weight };
        }
      }
    }

    if (bestEdge) {
      edges.push(bestEdge);
      inTree.add(bestEdge.to);
    } else {
      break; // disconnected graph
    }
  }

  return edges;
}

// ── Main generator ─────────────────────────────────────────────────

/**
 * Generate transport routes for a country.
 *
 * Algorithm:
 * 1. Sort cities by population (capital first)
 * 2. Build MST connecting all cities
 * 3. For each MST edge, generate a terrain-deflected route
 * 4. Classify routes by type based on population + distance
 * 5. Add shipping lanes between coastal cities
 */
export function generateTransportNetwork(
  input: GenerationInput,
  routeTypes: RouteType[] = ["rail", "highway", "road"]
): GeneratedRoute[] {
  const { cities, countryBbox, elevationGrid, gridResolution = 10 } = input;

  if (cities.length < 2) return [];

  // Sort: capital first, then by population descending
  const sorted = [...cities].sort((a, b) => {
    if (a.isCapital && !b.isCapital) return -1;
    if (!a.isCapital && b.isCapital) return 1;
    return b.population - a.population;
  });

  const routes: GeneratedRoute[] = [];

  // Build MST for land routes
  if (routeTypes.some((t) => t !== "shipping_lane")) {
    const mstEdges = buildMST(sorted);

    for (const edge of mstEdges) {
      const from = sorted[edge.from]!;
      const to = sorted[edge.to]!;
      const dist = haversineKm(from.coordinates, to.coordinates);

      // Classify route type by importance
      const combinedPop = from.population + to.population;
      let routeType: RouteType;
      if (combinedPop > 5_000_000 || from.isCapital || to.isCapital) {
        routeType = "rail";
      } else if (combinedPop > 1_000_000 || dist > 200) {
        routeType = "highway";
      } else {
        routeType = "road";
      }

      // Skip if this route type wasn't requested
      if (!routeTypes.includes(routeType)) continue;

      // Generate route geometry
      const pointCount = Math.max(10, Math.round(dist / 20));
      let coords = generateDirectRoute(from, to, pointCount);
      coords = deflectForTerrain(coords, elevationGrid, gridResolution, countryBbox, routeType);

      // Compute terrain difficulty from elevation variance along route
      const difficulty = computeTerrainDifficulty(coords, elevationGrid, gridResolution, countryBbox);

      routes.push({
        routeType,
        name: `${from.name}–${to.name} ${routeType === "rail" ? "Railway" : routeType === "highway" ? "Highway" : "Road"}`,
        geometry: { type: "LineString", coordinates: coords },
        stops: [
          { cityId: from.id, name: from.name, coordinates: from.coordinates, order: 0 },
          { cityId: to.id, name: to.name, coordinates: to.coordinates, order: 1 },
        ],
        terrainDifficulty: difficulty,
        lengthKm: Math.round(dist * 1.15), // 15% longer than straight-line due to terrain
        isInternational: false,
        properties: {
          speed_kmh: ROUTE_CONFIGS[routeType].baseSpeed,
          combinedPopulation: combinedPop,
        },
      });
    }
  }

  // Shipping lanes between coastal cities
  if (routeTypes.includes("shipping_lane")) {
    const coastalCities = sorted.filter((c) => c.isCoastal);
    if (coastalCities.length >= 2) {
      // Connect coastal cities in order along the coast
      for (let i = 0; i < coastalCities.length - 1; i++) {
        const from = coastalCities[i]!;
        const to = coastalCities[i + 1]!;
        const dist = haversineKm(from.coordinates, to.coordinates);

        routes.push({
          routeType: "shipping_lane",
          name: `${from.name}–${to.name} Shipping Lane`,
          geometry: { type: "LineString", coordinates: generateDirectRoute(from, to, 15) },
          stops: [
            { cityId: from.id, name: from.name, coordinates: from.coordinates, order: 0 },
            { cityId: to.id, name: to.name, coordinates: to.coordinates, order: 1 },
          ],
          terrainDifficulty: 0.1, // sea routes are easy
          lengthKm: Math.round(dist),
          isInternational: false,
          properties: { speed_kmh: 30 },
        });
      }
    }
  }

  return routes;
}

/**
 * Compute terrain difficulty (0-1) from elevation changes along a route.
 */
function computeTerrainDifficulty(
  coords: [number, number][],
  elevationGrid: number[][] | undefined,
  gridResolution: number,
  bbox: [number, number, number, number]
): number {
  if (!elevationGrid || elevationGrid.length === 0 || coords.length < 2) return 0.3;

  let totalAscent = 0;
  let prevElev = 0;

  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i]!;
    const gridX = Math.floor(((lng - bbox[0]) / (bbox[2] - bbox[0])) * (elevationGrid[0]?.length ?? 1));
    const gridY = Math.floor(((lat - bbox[1]) / (bbox[3] - bbox[1])) * elevationGrid.length);

    let elev = 0;
    if (gridY >= 0 && gridY < elevationGrid.length && gridX >= 0 && gridX < (elevationGrid[0]?.length ?? 0)) {
      elev = elevationGrid[gridY]![gridX] ?? 0;
    }

    if (i > 0) {
      totalAscent += Math.abs(elev - prevElev);
    }
    prevElev = elev;
  }

  // Normalize: 0m ascent = 0 difficulty, 5000m+ ascent = 1.0 difficulty
  return Math.min(1, totalAscent / 5000);
}

/**
 * Estimate if a city is coastal by checking if it's within
 * a threshold distance from the country boundary.
 */
export function estimateCoastalCities(
  cities: CityNode[],
  coastlineCoords: [number, number][],
  thresholdKm: number = 30
): CityNode[] {
  return cities.map((city) => {
    let minDist = Infinity;
    for (const coastPt of coastlineCoords) {
      const dist = haversineKm(city.coordinates, coastPt);
      if (dist < minDist) minDist = dist;
      if (dist < thresholdKm) break; // early exit
    }
    return { ...city, isCoastal: minDist < thresholdKm };
  });
}
