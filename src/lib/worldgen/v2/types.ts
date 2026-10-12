/**
 * UPG v2 — World Generation Types
 *
 * Complete data model for the Unified Physical Geography Engine.
 * All per-cell data stored as parallel typed arrays indexed by cell ID.
 * Replaces the v1 PackedGraph with richer physical geography support.
 */

// Core Data Model

export interface WorldGraph {
  /** Voronoi cell geometry and per-cell attributes */
  cells: WorldCells;
  /** Tectonic plates */
  plates: TectonicPlate[];
  /** Geographic features: oceans, continents, lakes, islands */
  features: GeographicFeature[];
  /** River networks with tributary relationships */
  rivers: RiverNetwork[];
  /** Drainage watersheds */
  watersheds: Watershed[];
  /** Political states/countries */
  states: PoliticalState[];
  /** Cultural regions */
  cultures: CulturalRegion[];
  /** Cities and towns */
  settlements: Settlement[];
}

export interface WorldCells {
  /** Number of cells in the mesh */
  n: number;
  /** Cell center coordinates: flat [lng0,lat0, lng1,lat1, ...] in WGS84 */
  p: Float64Array;
  /** Neighbor cell IDs for each cell (adjacency graph) */
  neighbors: number[][];
  /** Voronoi polygon vertices per cell (closed rings for GeoJSON) */
  vertices: [number, number][][];

  // Tectonic

  /** Plate ID for each cell */
  plate: Uint16Array;
  /** BFS distance to nearest plate boundary cell */
  plateDist: Float32Array;

  // Terrain

  /** Elevation in meters (float, not quantized) */
  h: Float32Array;
  /** Elevation zone index 0-8 (maps to ELEVATION_ZONES) */
  elevZone: Uint8Array;
  /** BFS hops from coast (0 = coastal land cell) */
  coastDist: Uint16Array;
  /** 1 = land, 0 = water */
  isLand: Uint8Array;
  /** 1 = on tectonic convergent boundary (mountain ridge) */
  isMountainRidge: Uint8Array;

  // Hydrology

  /** Cell ID of steepest-descent neighbor (-1 = drains to ocean/boundary) */
  downstream: Int32Array;
  /** Accumulated water flux */
  flux: Float32Array;
  /** River ID (0 = no river) */
  river: Uint16Array;
  /** Watershed ID (0 = unassigned) */
  watershed: Uint16Array;
  /** Lake feature ID (0 = not a lake cell) */
  lake: Uint16Array;

  // Climate

  /** Temperature in °C (float precision, allows fractional degrees) */
  temp: Float32Array;
  /** Precipitation in mm/year (float precision) */
  prec: Float32Array;
  /** Prevailing wind direction in radians (0 = East, π/2 = North) */
  windDir: Float32Array;
  /** Relative wind strength (0-1, reduced behind mountains) */
  windSpeed: Float32Array;
  /** Ocean current temperature influence in °C (positive = warming) */
  oceanCurrentInfluence: Float32Array;
  /** Trewartha biome ID (0-11) */
  biome: Uint8Array;
  /** Aridity index 0-1 (0 = wet, 1 = hyper-arid) */
  aridity: Float32Array;

  // Feature Membership

  /** Geographic feature ID (ocean/continent/lake/island) */
  feature: Uint16Array;
  /** 1 = cell touches grid boundary */
  boundary: Uint8Array;

  // Political (set by politics stage, read-only on physical)

  /** Culture ID (0 = unassigned) */
  culture: Uint16Array;
  /** State/country ID (0 = unclaimed) */
  state: Uint16Array;
}

/** The mesh geometry: written once by `createMesh`, never mutated by a later stage, so graphs can share it. */
export type MeshGeometry = Pick<WorldCells, "p" | "neighbors" | "vertices" | "boundary">;

// Entity Types

export interface TectonicPlate {
  id: number;
  /** "continental" or "oceanic" */
  type: "continental" | "oceanic";
  /** Center cell ID (seed point) */
  center: number;
  /** Velocity vector [vx, vy] in degrees/unit-time */
  velocity: [number, number];
  /** Speed magnitude */
  speed: number;
  /** Number of cells in this plate */
  cellCount: number;
}

/** Classification of a plate boundary segment */
export type BoundaryType = "convergent" | "divergent" | "transform";

export interface GeographicFeature {
  id: number;
  type: "ocean" | "continent" | "lake" | "island";
  /** Number of cells in this feature */
  cellCount: number;
  /** Approximate area in km² */
  areaKm2: number;
  /** Generated name */
  name: string;
  /** Whether this feature touches the grid boundary */
  border: boolean;
}

export interface RiverNetwork {
  id: number;
  name: string;
  /** Ordered cell IDs from source to mouth */
  cells: number[];
  /** Cell ID at river mouth */
  mouth: number;
  /** Cell ID at river source (headwaters) */
  source: number;
  /** Total water discharge at mouth */
  flux: number;
  /** Approximate length in km */
  lengthKm: number;
  /** IDs of tributary rivers that join this one */
  tributaries: number[];
}

export interface Watershed {
  id: number;
  /** Cell IDs in this watershed */
  cells: number[];
  /** River ID that drains this watershed (0 = endorheic) */
  river: number;
  /** Total area in km² */
  areaKm2: number;
  /** Whether this is an endorheic basin (no outlet to ocean) */
  isEndorheic: boolean;
}

export interface PoliticalState {
  id: number;
  name: string;
  /** Hex color for map display */
  color: string;
  /** Settlement ID of capital city */
  capital: number;
  /** Number of cells in this state */
  cellCount: number;
  /** Approximate area in km² */
  areaKm2: number;
  /** Adjacent state IDs */
  neighbors: number[];
  /** Dominant culture ID */
  culture: number;
  /** Continent feature name */
  continent: string;
}

interface CulturalRegion {
  id: number;
  name: string;
  /** Language family ID */
  familyId: string;
  /** Origin cell ID */
  center: number;
  /** Number of cells claimed */
  cellCount: number;
}

export interface Settlement {
  id: number;
  name: string;
  /** Cell ID where this settlement is located */
  cell: number;
  /** State ID this settlement belongs to */
  state: number;
  /** Estimated population */
  population: number;
  /** Whether this is a state capital */
  isCapital: boolean;
  /** Whether this is a port city (coastal) */
  isPort: boolean;
  /** Longitude */
  lng: number;
  /** Latitude */
  lat: number;
  /** Habitability score used for placement (0-1) */
  score: number;
}

// Generation Parameters

/** Development level a generated world's nation slots start at (sets the GDP-per-capita base). */
export type DevelopmentLevel = "developing" | "industrial" | "modern";

export interface WorldGenParams {
  /** Deterministic seed */
  seed: number;
  /** Approximate number of Voronoi cells (the latitude-compensated grid yields ~2/3 of this) */
  cellCount: number;
  /** Number of tectonic plates (6-20, default 10) */
  plateCount: number;
  /** Number of continents grown (1-12) */
  continentCount: number;
  /** Latitude band continent centres are drawn from: [south, north] in degrees */
  continentLatitudeRange: [number, number];
  /** Spread of continent sizes: 0 = equal, 1+ = a few dominant continents */
  continentSizeVariance: number;
  /** Share of the land budget placed as islands and archipelagos (0-0.3) */
  islandShare: number;
  /** Antarctica-style polar land caps beyond ~72° */
  polarLand: { north: boolean; south: boolean };
  /** Target country count range */
  countryCountRange: [number, number];
  /** Target ocean fraction (0.4-0.85, default 0.7) */
  oceanPercentage: number;
  /** Terrain roughness 0-1 (hill noise amplitude) */
  terrainRoughness: number;
  /** Coastline complexity 0-1 (0 = smooth blobs, 1 = highly fractalized) */
  coastlineComplexity: number;
  /** Target share of land in each of the 9 elevation zones (normalized, zone_0..zone_8) */
  hypsometry: number[];
  /** Global temperature shift in °C (warm or cold world) */
  temperatureOffset: number;
  /** Global precipitation multiplier */
  precipitationScale: number;
  /** River density multiplier (1 = default) */
  riverDensity: number;
  /** Target lake surface as a share of land (0-0.05) */
  lakeCoverage: number;
  /** Generate ice caps at poles */
  hasIcecaps: boolean;
  /** Generate rivers */
  hasRivers: boolean;
  /** Generate lakes */
  hasLakes: boolean;
  /** Enable Markov chain naming */
  useMarkovNaming: boolean;
  /** Lloyd relaxation iterations for mesh (1-5, default 5) */
  lloydIterations: number;
  /** Development level of the nation slots (default "industrial") */
  developmentLevel: DevelopmentLevel;
}

// Generation Output

/** The slot key of a generated state: the slot's `key` and its political feature's `slotKey`. */
export const slotKey = (stateId: number): string => `slot_${stateId}`;

/** A claimable nation slot: a generated country with its derived baseline. */
export interface WorldSlot {
  /** Stable within one world; the political feature's `slotKey` */
  key: string;
  /** Suggested name the claimant may keep */
  name: string;
  colour: string;
  /** Land cells */
  cells: number;
  areaKm2: number;
  population: number;
  gdpPerCapita: number;
}

export interface GeneratedWorld {
  seed: number;
  params: WorldGenParams;
  /** 7-layer GeoJSON output for IxWorldMap renderer (no `political` when the realm's borders are kept) */
  layers: Record<string, import("geojson").FeatureCollection>;
  /** Nation slots, from the generated countries (empty when the realm's borders are kept) */
  slots: WorldSlot[];
  /** Packed per cell: lng, lat, height in metres */
  cells: Float32Array;
  /** Generation statistics */
  stats: WorldStats;
  /** The internal world graph (for Studio editor, not for rendering) */
  graph?: WorldGraph;
}

export interface WorldStats {
  landPercentage: number;
  continentCount: number;
  countryCount: number;
  riverCount: number;
  lakeCount: number;
  watershedCount: number;
  altitudeZoneCount: number;
  climateZoneCount: number;
  icecapCount: number;
  biomeCount: number;
  cultureCount: number;
  cityCount: number;
  plateCount: number;
  generationTimeMs: number;
  cellCount: number;
}

type GenerationStage =
  | "mesh"
  | "tectonics"
  | "terrain"
  | "coastlines"
  | "hydro-climate"
  | "quality"
  | "politics"
  | "export";

export type ProgressCallback = (stage: GenerationStage, progress: number, message: string) => void;

// Quality Gate

export interface QualityCheckResult {
  name: string;
  passed: boolean;
  score: number; // 0-100
  details: string;
}

export interface QualityReport {
  passed: boolean;
  compositeScore: number; // 0-100
  checks: QualityCheckResult[];
}

/**
 * Create an empty WorldGraph skeleton with all typed arrays allocated and zeroed. With `geometry`
 * the graph shares those mesh arrays instead of allocating its own.
 */
export function createEmptyWorldGraph(n: number, geometry?: MeshGeometry): WorldGraph {
  const cells: WorldCells = {
    n,
    p: geometry?.p ?? new Float64Array(n * 2),
    neighbors: geometry?.neighbors ?? Array.from({ length: n }, () => []),
    vertices: geometry?.vertices ?? Array.from({ length: n }, () => [[0, 0] as [number, number]]),

    // Tectonic
    plate: new Uint16Array(n),
    plateDist: new Float32Array(n),

    // Terrain
    h: new Float32Array(n),
    elevZone: new Uint8Array(n),
    coastDist: new Uint16Array(n).fill(65535),
    isLand: new Uint8Array(n),
    isMountainRidge: new Uint8Array(n),

    // Hydrology
    downstream: new Int32Array(n).fill(-1),
    flux: new Float32Array(n),
    river: new Uint16Array(n),
    watershed: new Uint16Array(n),
    lake: new Uint16Array(n),

    // Climate
    temp: new Float32Array(n),
    prec: new Float32Array(n),
    windDir: new Float32Array(n),
    windSpeed: new Float32Array(n).fill(1),
    oceanCurrentInfluence: new Float32Array(n),
    biome: new Uint8Array(n),
    aridity: new Float32Array(n),

    // Feature membership
    feature: new Uint16Array(n),
    boundary: geometry?.boundary ?? new Uint8Array(n),

    // Political
    culture: new Uint16Array(n),
    state: new Uint16Array(n),
  };

  return {
    cells,
    plates: [],
    features: [],
    rivers: [],
    watersheds: [],
    states: [],
    cultures: [],
    settlements: [],
  };
}
