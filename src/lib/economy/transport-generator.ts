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
  // Rail family
  | "rail"
  | "high_speed_rail"
  | "freight_rail"
  | "commuter_rail"
  // Road family
  | "motorway"
  | "highway"
  | "trunk"
  | "road"
  | "secondary"
  // Maritime
  | "shipping_lane"
  | "canal"
  | "ferry"
  // Air
  | "air_corridor"
  // Utility
  | "pipeline"
  | "power_grid"
  | "fiber"
  // Military
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

interface GeneratedRoute {
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
  high_speed_rail: {
    maxElevation: 1800,
    maxGrade: 2.5,
    waterCost: Infinity,
    elevationCostFactor: 6,
    baseSpeed: 300,
  },
  freight_rail: {
    maxElevation: 2200,
    maxGrade: 2.0,
    waterCost: Infinity,
    elevationCostFactor: 5,
    baseSpeed: 80,
  },
  commuter_rail: {
    maxElevation: 2500,
    maxGrade: 3.5,
    waterCost: Infinity,
    elevationCostFactor: 4,
    baseSpeed: 90,
  },
  motorway: {
    maxElevation: 2800,
    maxGrade: 6,
    waterCost: Infinity,
    elevationCostFactor: 3.5,
    baseSpeed: 130,
  },
  highway: {
    maxElevation: 3000,
    maxGrade: 8,
    waterCost: Infinity,
    elevationCostFactor: 3,
    baseSpeed: 100,
  },
  trunk: {
    maxElevation: 3500,
    maxGrade: 10,
    waterCost: Infinity,
    elevationCostFactor: 2.5,
    baseSpeed: 80,
  },
  road: {
    maxElevation: 4500,
    maxGrade: 15,
    waterCost: Infinity,
    elevationCostFactor: 1.5,
    baseSpeed: 60,
  },
  secondary: {
    maxElevation: 4500,
    maxGrade: 18,
    waterCost: Infinity,
    elevationCostFactor: 1.2,
    baseSpeed: 50,
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
// ── Haversine distance ─────────────────────────────────────────────

import { distanceKm as haversineKm } from "~/lib/maps/geo-math";

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

type Bbox = [number, number, number, number];

/** Elevation of the grid cell containing (lng, lat); undefined outside the grid. */
function elevationAt(grid: number[][], bbox: Bbox, lng: number, lat: number): number | undefined {
  const width = grid[0]?.length ?? 0;
  const x = Math.floor(((lng - bbox[0]) / (bbox[2] - bbox[0])) * (width || 1));
  const y = Math.floor(((lat - bbox[1]) / (bbox[3] - bbox[1])) * grid.length);
  if (y < 0 || y >= grid.length || x < 0 || x >= width) return undefined;
  return grid[y]![x] ?? 0;
}

const NEIGHBOR_OFFSETS = [
  [0.1, 0],
  [-0.1, 0],
  [0, 0.1],
  [0, -0.1],
] as const;

/**
 * Apply terrain-aware deflection to a route.
 * Nudges waypoints toward lower elevation when possible.
 */
function deflectForTerrain(
  coords: [number, number][],
  elevationGrid: number[][] | undefined,
  bbox: Bbox,
  routeType: RouteType
): [number, number][] {
  if (!elevationGrid || elevationGrid.length === 0) return coords;
  if (ROUTE_CONFIGS[routeType].elevationCostFactor === 0) return coords; // shipping doesn't deflect

  // Nudge each interior waypoint 30% toward the lowest of its four neighbouring cells
  const deflected: [number, number][] = [coords[0]!];
  for (const [lng, lat] of coords.slice(1, -1)) {
    let bestElev = elevationAt(elevationGrid, bbox, lng, lat);
    let point: [number, number] = [lng, lat];
    if (bestElev !== undefined) {
      for (const [dlng, dlat] of NEIGHBOR_OFFSETS) {
        const elev = elevationAt(elevationGrid, bbox, lng + dlng, lat + dlat);
        if (elev !== undefined && elev < bestElev) {
          bestElev = elev;
          point = [lng + dlng * 0.3, lat + dlat * 0.3];
        }
      }
    }
    deflected.push(point);
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

const ROUTE_LABELS: Partial<Record<RouteType, string>> = {
  rail: "Railway",
  high_speed_rail: "Express Shinkansen",
  freight_rail: "Freight Corridor",
  commuter_rail: "Commuter Line",
  motorway: "Autoroute",
  highway: "Highway",
  trunk: "Trunk Expressway",
  road: "Road",
  secondary: "Secondary Arterial",
  pipeline: "Pipeline",
  power_grid: "Power Grid",
  fiber: "Fiber Link",
  military_supply: "Military Supply Route",
};

const NON_LAND_TYPES: RouteType[] = ["shipping_lane", "ferry", "air_corridor", "military_naval"];
const UTILITY_TYPES: RouteType[] = ["pipeline", "power_grid", "fiber", "military_supply"];

/** Rail sub-type for a city pair, among the types requested. */
function classifyRail(requested: RouteType[], a: CityNode, b: CityNode, dist: number): RouteType {
  const pop = a.population + b.population;
  if (requested.includes("high_speed_rail") && (a.isCapital || b.isCapital || pop > 6_000_000)) {
    return "high_speed_rail";
  }
  if (requested.includes("commuter_rail") && dist < 60 && pop > 1_500_000) return "commuter_rail";
  if (requested.includes("freight_rail") && dist > 150) return "freight_rail";
  return "rail";
}

/** Road sub-type for a city pair, among the types requested. */
function classifyRoad(requested: RouteType[], a: CityNode, b: CityNode, dist: number): RouteType {
  const pop = a.population + b.population;
  if (requested.includes("motorway") && (a.isCapital || b.isCapital || pop > 4_000_000)) {
    return "motorway";
  }
  if (requested.includes("highway") && (pop > 1_000_000 || dist > 150)) return "highway";
  if (requested.includes("trunk") && pop > 300_000) return "trunk";
  if (requested.includes("secondary") && pop < 150_000) return "secondary";
  return "road";
}

/** Land route types to build between two cities: one rail, one road, and every requested utility. */
function landTypesFor(requested: RouteType[], a: CityNode, b: CityNode): Set<RouteType> {
  const dist = haversineKm(a.coordinates, b.coordinates);
  const rail = classifyRail(requested, a, b, dist);
  const road = classifyRoad(requested, a, b, dist);

  const types = new Set<RouteType>();
  if (requested.includes(rail)) types.add(rail);
  else if (requested.includes("rail")) types.add("rail");

  if (requested.includes(road)) types.add(road);
  else if (requested.includes("highway")) types.add("highway");
  else if (requested.includes("road")) types.add("road");

  for (const t of UTILITY_TYPES) if (requested.includes(t)) types.add(t);
  return types;
}

function makeRoute(
  routeType: RouteType,
  name: string,
  from: CityNode,
  to: CityNode,
  coordinates: [number, number][],
  terrainDifficulty: number,
  lengthKm: number,
  properties: Record<string, unknown>
): GeneratedRoute {
  return {
    routeType,
    name,
    geometry: { type: "LineString", coordinates },
    stops: [
      { cityId: from.id, name: from.name, coordinates: from.coordinates, order: 0 },
      { cityId: to.id, name: to.name, coordinates: to.coordinates, order: 1 },
    ],
    terrainDifficulty,
    lengthKm,
    isInternational: false,
    properties,
  };
}

/** Sea routes chaining coastal cities in order. */
const COASTAL_CHAIN_ROUTES = [
  { type: "shipping_lane", label: "Shipping Lane", terrain: 0.1, speed: 30 },
  { type: "military_naval", label: "Naval Route", terrain: 0.1, speed: 40 },
] as const;

/** Pairs each city with its successor in the list. */
const consecutivePairs = <T>(items: T[]): Array<[T, T]> =>
  items.slice(1).map((item, i) => [items[i]!, item]);

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
  const { cities, countryBbox, elevationGrid } = input;
  if (cities.length < 2) return [];

  // Capital first, then by population descending
  const sorted = [...cities].sort((a, b) => {
    if (a.isCapital !== b.isCapital) return a.isCapital ? -1 : 1;
    return b.population - a.population;
  });
  const coastal = sorted.filter((c) => c.isCoastal);
  const routes: GeneratedRoute[] = [];

  if (routeTypes.some((t) => !NON_LAND_TYPES.includes(t))) {
    for (const edge of buildMST(sorted)) {
      const from = sorted[edge.from]!;
      const to = sorted[edge.to]!;
      const dist = haversineKm(from.coordinates, to.coordinates);

      for (const t of landTypesFor(routeTypes, from, to)) {
        const pointCount = Math.max(10, Math.round(dist / 20));
        const coords = deflectForTerrain(
          generateDirectRoute(from, to, pointCount),
          elevationGrid,
          countryBbox,
          t
        );
        routes.push(
          makeRoute(
            t,
            `${from.name}–${to.name} ${ROUTE_LABELS[t] ?? t}`,
            from,
            to,
            coords,
            computeTerrainDifficulty(coords, elevationGrid, countryBbox),
            Math.round(dist * 1.15), // 15% longer than straight-line due to terrain
            {
              speed_kmh: ROUTE_CONFIGS[t].baseSpeed,
              combinedPopulation: from.population + to.population,
            }
          )
        );
      }
    }
  }

  // Shipping lanes and naval routes chain the coastal cities in order
  for (const { type, label, terrain, speed } of COASTAL_CHAIN_ROUTES) {
    if (!routeTypes.includes(type)) continue;
    for (const [from, to] of consecutivePairs(coastal)) {
      routes.push(
        makeRoute(
          type,
          `${from.name}–${to.name} ${label}`,
          from,
          to,
          generateDirectRoute(from, to, 15),
          terrain,
          Math.round(haversineKm(from.coordinates, to.coordinates)),
          { speed_kmh: speed }
        )
      );
    }
  }

  // Ferries link nearby coastal cities (< 200 km), distinct from shipping lanes
  if (routeTypes.includes("ferry")) {
    for (let i = 0; i < coastal.length; i++) {
      for (let j = i + 1; j < coastal.length; j++) {
        const from = coastal[i]!;
        const to = coastal[j]!;
        const dist = haversineKm(from.coordinates, to.coordinates);
        if (dist > 200) continue;
        routes.push(
          makeRoute(
            "ferry",
            `${from.name}–${to.name} Ferry`,
            from,
            to,
            generateDirectRoute(from, to, 12),
            0.05,
            Math.round(dist),
            {
              speed_kmh: 40,
              vessel_type: "passenger",
            }
          )
        );
      }
    }
  }

  // Air corridors: capital routes plus pairs of large cities, as great-circle arcs
  if (routeTypes.includes("air_corridor")) {
    const airports = sorted.filter((c) => c.hasAirport);
    // If no airports flagged, fall back to the top cities by population
    const candidates =
      airports.length >= 2 ? airports : sorted.filter((c) => c.population > 500_000).slice(0, 10);

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const from = candidates[i]!;
        const to = candidates[j]!;
        const isCapitalRoute = from.isCapital || to.isCapital;
        const bothLarge = from.population > 1_000_000 && to.population > 1_000_000;
        if (!isCapitalRoute && !bothLarge) continue;

        routes.push(
          makeRoute(
            "air_corridor",
            `${from.name}–${to.name} Air Route`,
            from,
            to,
            generateGreatCircleArc(from.coordinates, to.coordinates, 40),
            0,
            Math.round(haversineKm(from.coordinates, to.coordinates)),
            { speed_kmh: 850, flight_level: 350 }
          )
        );
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
 * Compute terrain difficulty (0-1) from elevation changes along a route:
 * 0m total ascent = 0, 5000m+ = 1.
 */
function computeTerrainDifficulty(
  coords: [number, number][],
  elevationGrid: number[][] | undefined,
  bbox: Bbox
): number {
  if (!elevationGrid || elevationGrid.length === 0 || coords.length < 2) return 0.3;

  let totalAscent = 0;
  let prevElev = 0;
  coords.forEach(([lng, lat], i) => {
    const elev = elevationAt(elevationGrid, bbox, lng, lat) ?? 0;
    if (i > 0) totalAscent += Math.abs(elev - prevElev);
    prevElev = elev;
  });
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

interface GeneratedNode {
  id: string;
  name: string;
  coordinates: [number, number];
  nodeType: string;
  cityId?: string;
}

interface GeneratedSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  routeType: RouteType;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  lengthKm: number;
  terrainDifficulty: number;
  speedKmh: number;
  status: string;
  isInternational: boolean;
}

interface GeneratedNetwork {
  nodes: GeneratedNode[];
  segments: GeneratedSegment[];
  routes: GeneratedRoute[];
}

export function generateTransportNetworkWithSegments(
  input: GenerationInput,
  routeTypes: RouteType[] = ["rail", "highway", "road"]
): GeneratedNetwork {
  const routes = generateTransportNetwork(input, routeTypes);

  const nodeMap = new Map<string, GeneratedNode>();
  const segments: GeneratedSegment[] = [];

  function getOrCreateNode(coord: [number, number], name: string, cityId?: string): GeneratedNode {
    const key = `${coord[0].toFixed(3)},${coord[1].toFixed(3)}`;
    const existing = nodeMap.get(key);
    if (existing) return existing;

    const node: GeneratedNode = {
      id: `node_${nodeMap.size + 1}`,
      name,
      coordinates: coord,
      nodeType: cityId ? "city" : "waypoint",
      cityId,
    };
    nodeMap.set(key, node);
    return node;
  }

  for (let i = 0; i < routes.length; i++) {
    const r = routes[i]!;
    const coords = r.geometry.coordinates;
    const fromCoord = coords[0]!;
    const toCoord = coords[coords.length - 1]!;

    const stop0 = r.stops[0];
    const stop1 = r.stops[1];

    const fromNode = getOrCreateNode(fromCoord, stop0?.name ?? "Node A", stop0?.cityId);
    const toNode = getOrCreateNode(toCoord, stop1?.name ?? "Node B", stop1?.cityId);

    segments.push({
      id: `seg_${i + 1}`,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      routeType: r.routeType,
      geometry: r.geometry,
      lengthKm: r.lengthKm,
      terrainDifficulty: r.terrainDifficulty,
      speedKmh: (r.properties.speed_kmh as number) ?? 80,
      status: "operational",
      isInternational: r.isInternational,
    });
  }

  return {
    nodes: Array.from(nodeMap.values()),
    segments,
    routes,
  };
}
