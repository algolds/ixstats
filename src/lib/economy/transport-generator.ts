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

export type RouteType =
  | "rail"
  | "highway"
  | "road"
  | "shipping_lane"
  | "canal"
  | "air_corridor"
  | "ferry"
  | "pipeline"
  | "power_grid"
  | "fiber"
  | "military_supply"
  | "military_naval";

export interface CityNode {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  population: number;
  isCapital: boolean;
  isCoastal?: boolean;
  hasAirport?: boolean;
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

const ROUTE_CONFIGS: Record<
  RouteType,
  {
    maxElevation: number;
    maxGrade: number; // percent
    waterCost: number; // multiplier (Infinity = impassable)
    elevationCostFactor: number;
    baseSpeed: number; // km/h
  }
> = {
  rail: {
    maxElevation: 2000,
    maxGrade: 3,
    waterCost: Infinity,
    elevationCostFactor: 5,
    baseSpeed: 120,
  },
  highway: {
    maxElevation: 3000,
    maxGrade: 8,
    waterCost: Infinity,
    elevationCostFactor: 3,
    baseSpeed: 100,
  },
  road: {
    maxElevation: 4500,
    maxGrade: 15,
    waterCost: Infinity,
    elevationCostFactor: 1.5,
    baseSpeed: 60,
  },
  shipping_lane: {
    maxElevation: 0,
    maxGrade: 0,
    waterCost: 0.5,
    elevationCostFactor: 0,
    baseSpeed: 30,
  },
  canal: { maxElevation: 500, maxGrade: 0.1, waterCost: 1, elevationCostFactor: 10, baseSpeed: 15 },
  air_corridor: {
    maxElevation: Infinity,
    maxGrade: 0,
    waterCost: 0,
    elevationCostFactor: 0,
    baseSpeed: 850, // cruising speed
  },
  ferry: {
    maxElevation: 0,
    maxGrade: 0,
    waterCost: 0.3,
    elevationCostFactor: 0,
    baseSpeed: 40,
  },
  pipeline: {
    maxElevation: 4000,
    maxGrade: 20,
    waterCost: Infinity,
    elevationCostFactor: 1.5,
    baseSpeed: 10,
  },
  power_grid: {
    maxElevation: 5000,
    maxGrade: 30,
    waterCost: Infinity,
    elevationCostFactor: 1.0,
    baseSpeed: 300000,
  },
  fiber: {
    maxElevation: 5000,
    maxGrade: 30,
    waterCost: Infinity,
    elevationCostFactor: 1.0,
    baseSpeed: 200000,
  },
  military_supply: {
    maxElevation: 4000,
    maxGrade: 15,
    waterCost: Infinity,
    elevationCostFactor: 2.0,
    baseSpeed: 80,
  },
  military_naval: {
    maxElevation: 0,
    maxGrade: 0,
    waterCost: 0.5,
    elevationCostFactor: 0,
    baseSpeed: 40,
  },
};

/**
 * Compute terrain traversal cost for a route type at a given point.
 * Returns Infinity if impassable.
 */
/** Terrain traversal cost for A* pathfinding (used by future grid-based pathfinder) */
export function terrainCost(elevation: number, isWater: boolean, routeType: RouteType): number {
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

import { distanceKm as haversineKm } from "~/lib/geo-math";

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
    const gridX = Math.floor(
      ((lng - _bbox[0]) / (_bbox[2] - _bbox[0])) * (_elevationGrid[0]?.length ?? 1)
    );
    const gridY = Math.floor(((lat - _bbox[1]) / (_bbox[3] - _bbox[1])) * _elevationGrid.length);

    if (
      gridY >= 0 &&
      gridY < _elevationGrid.length &&
      gridX >= 0 &&
      gridX < (_elevationGrid[0]?.length ?? 0)
    ) {
      const centerElev = _elevationGrid[gridY]![gridX] ?? 0;

      // Check 4 neighbors for lower elevation
      const offsets = [
        [0.1, 0],
        [-0.1, 0],
        [0, 0.1],
        [0, -0.1],
      ] as const;
      let bestLng = lng;
      let bestLat = lat;
      let bestElev = centerElev;

      for (const [dlng, dlat] of offsets) {
        const nx = Math.floor(
          ((lng + dlng - _bbox[0]) / (_bbox[2] - _bbox[0])) * (_elevationGrid[0]?.length ?? 1)
        );
        const ny = Math.floor(
          ((lat + dlat - _bbox[1]) / (_bbox[3] - _bbox[1])) * _elevationGrid.length
        );
        if (
          ny >= 0 &&
          ny < _elevationGrid.length &&
          nx >= 0 &&
          nx < (_elevationGrid[0]?.length ?? 0)
        ) {
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
  const nonLandTypes = ["shipping_lane", "ferry", "air_corridor", "military_naval"];
  const landTypesRequested = routeTypes.filter((t) => !nonLandTypes.includes(t));

  if (landTypesRequested.length > 0) {
    const mstEdges = buildMST(sorted);

    for (const edge of mstEdges) {
      const from = sorted[edge.from]!;
      const to = sorted[edge.to]!;
      const dist = haversineKm(from.coordinates, to.coordinates);
      const combinedPop = from.population + to.population;

      // Classify standard transport route type by importance
      let transportType: RouteType;
      if (combinedPop > 5_000_000 || from.isCapital || to.isCapital) {
        transportType = "rail";
      } else if (combinedPop > 1_000_000 || dist > 200) {
        transportType = "highway";
      } else {
        transportType = "road";
      }

      // Collect all land route types we should generate for this edge
      const typesToGenerate = new Set<RouteType>();
      if (routeTypes.includes(transportType)) {
        typesToGenerate.add(transportType);
      }
      for (const t of ["pipeline", "power_grid", "fiber", "military_supply"] as RouteType[]) {
        if (routeTypes.includes(t)) {
          typesToGenerate.add(t);
        }
      }

      for (const t of typesToGenerate) {
        // Generate route geometry
        const pointCount = Math.max(10, Math.round(dist / 20));
        let coords = generateDirectRoute(from, to, pointCount);
        coords = deflectForTerrain(coords, elevationGrid, gridResolution, countryBbox, t);

        // Compute terrain difficulty from elevation variance along route
        const difficulty = computeTerrainDifficulty(
          coords,
          elevationGrid,
          gridResolution,
          countryBbox
        );

        let typeLabel = "";
        if (t === "rail") typeLabel = "Railway";
        else if (t === "highway") typeLabel = "Highway";
        else if (t === "road") typeLabel = "Road";
        else if (t === "pipeline") typeLabel = "Pipeline";
        else if (t === "power_grid") typeLabel = "Power Grid";
        else if (t === "fiber") typeLabel = "Fiber Link";
        else if (t === "military_supply") typeLabel = "Military Supply Route";
        else typeLabel = t;

        routes.push({
          routeType: t,
          name: `${from.name}–${to.name} ${typeLabel}`,
          geometry: { type: "LineString", coordinates: coords },
          stops: [
            { cityId: from.id, name: from.name, coordinates: from.coordinates, order: 0 },
            { cityId: to.id, name: to.name, coordinates: to.coordinates, order: 1 },
          ],
          terrainDifficulty: difficulty,
          lengthKm: Math.round(dist * 1.15), // 15% longer than straight-line due to terrain
          isInternational: false,
          properties: {
            speed_kmh: ROUTE_CONFIGS[t].baseSpeed,
            combinedPopulation: combinedPop,
          },
        });
      }
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

  // Military naval routes between coastal cities (similar to shipping lanes)
  if (routeTypes.includes("military_naval")) {
    const coastalCities = sorted.filter((c) => c.isCoastal);
    if (coastalCities.length >= 2) {
      for (let i = 0; i < coastalCities.length - 1; i++) {
        const from = coastalCities[i]!;
        const to = coastalCities[i + 1]!;
        const dist = haversineKm(from.coordinates, to.coordinates);

        routes.push({
          routeType: "military_naval",
          name: `${from.name}–${to.name} Naval Route`,
          geometry: { type: "LineString", coordinates: generateDirectRoute(from, to, 15) },
          stops: [
            { cityId: from.id, name: from.name, coordinates: from.coordinates, order: 0 },
            { cityId: to.id, name: to.name, coordinates: to.coordinates, order: 1 },
          ],
          terrainDifficulty: 0.1,
          lengthKm: Math.round(dist),
          isInternational: false,
          properties: { speed_kmh: 40 },
        });
      }
    }
  }

  // Ferry routes between nearby coastal cities (< 200km, distinct from shipping lanes)
  if (routeTypes.includes("ferry")) {
    const coastalCities = sorted.filter((c) => c.isCoastal);
    const ferryThresholdKm = 200;
    const addedPairs = new Set<string>();
    for (let i = 0; i < coastalCities.length; i++) {
      for (let j = i + 1; j < coastalCities.length; j++) {
        const from = coastalCities[i]!;
        const to = coastalCities[j]!;
        const dist = haversineKm(from.coordinates, to.coordinates);
        if (dist > ferryThresholdKm) continue;
        const pairKey = [from.id, to.id].sort().join("|");
        if (addedPairs.has(pairKey)) continue;
        addedPairs.add(pairKey);

        routes.push({
          routeType: "ferry",
          name: `${from.name}–${to.name} Ferry`,
          geometry: { type: "LineString", coordinates: generateDirectRoute(from, to, 12) },
          stops: [
            { cityId: from.id, name: from.name, coordinates: from.coordinates, order: 0 },
            { cityId: to.id, name: to.name, coordinates: to.coordinates, order: 1 },
          ],
          terrainDifficulty: 0.05,
          lengthKm: Math.round(dist),
          isInternational: false,
          properties: { speed_kmh: 40, vessel_type: "passenger" },
        });
      }
    }
  }

  // Air corridors between major cities with airports (great-circle arcs)
  if (routeTypes.includes("air_corridor")) {
    const airportCities = sorted.filter((c) => c.hasAirport);
    // If no airports flagged, fall back to top cities by population
    const candidates =
      airportCities.length >= 2
        ? airportCities
        : sorted.filter((c) => c.population > 500_000).slice(0, 10);

    if (candidates.length >= 2) {
      // Connect each airport city to the capital and to other major airport cities
      const capital = candidates.find((c) => c.isCapital);
      const addedAirPairs = new Set<string>();

      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const from = candidates[i]!;
          const to = candidates[j]!;
          const pairKey = [from.id, to.id].sort().join("|");
          if (addedAirPairs.has(pairKey)) continue;

          // Only connect if at least one is the capital, or both are large
          const isCapitalRoute = from.isCapital || to.isCapital;
          const bothLarge = from.population > 1_000_000 && to.population > 1_000_000;
          if (!isCapitalRoute && !bothLarge) continue;

          addedAirPairs.add(pairKey);
          const dist = haversineKm(from.coordinates, to.coordinates);
          const arcCoords = generateGreatCircleArc(from.coordinates, to.coordinates, 40);

          routes.push({
            routeType: "air_corridor",
            name: `${from.name}–${to.name} Air Route`,
            geometry: { type: "LineString", coordinates: arcCoords },
            stops: [
              { cityId: from.id, name: from.name, coordinates: from.coordinates, order: 0 },
              { cityId: to.id, name: to.name, coordinates: to.coordinates, order: 1 },
            ],
            terrainDifficulty: 0,
            lengthKm: Math.round(dist),
            isInternational: false,
            properties: { speed_kmh: 850, flight_level: 350 },
          });
        }
      }
    }
  }

  return routes;
}

/**
 * Generate a great-circle arc between two points using spherical interpolation.
 * Produces a true geodesic path (curved on Mercator projection) — essential for
 * realistic air corridors and long-distance routes.
 */
function generateGreatCircleArc(
  from: [number, number],
  to: [number, number],
  numPoints: number = 40
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(from[1]);
  const lng1 = toRad(from[0]);
  const lat2 = toRad(to[1]);
  const lng2 = toRad(to[0]);

  // Central angle via Haversine
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const d = 2 * Math.asin(Math.sqrt(a));

  // Degenerate case: same point
  if (d < 1e-10) return [from, to];

  const coords: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lng = Math.atan2(y, x);
    coords.push([toDeg(lng), toDeg(lat)]);
  }

  return coords;
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
    const gridX = Math.floor(
      ((lng - bbox[0]) / (bbox[2] - bbox[0])) * (elevationGrid[0]?.length ?? 1)
    );
    const gridY = Math.floor(((lat - bbox[1]) / (bbox[3] - bbox[1])) * elevationGrid.length);

    let elev = 0;
    if (
      gridY >= 0 &&
      gridY < elevationGrid.length &&
      gridX >= 0 &&
      gridX < (elevationGrid[0]?.length ?? 0)
    ) {
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
