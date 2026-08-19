/**
 * UPG v2 — World Generation Types
 *
 * Complete data model for the Unified Physical Geography Engine.
 * All per-cell data stored as parallel typed arrays indexed by cell ID.
 * Replaces the v1 PackedGraph with richer physical geography support.
 */

// ──────────────────────────────────────────────
// Core Data Model
// ──────────────────────────────────────────────

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

  // ── Tectonic ──────────────────────────────────

  /** Plate ID for each cell */
  plate: Uint16Array;
  /** BFS distance to nearest plate boundary cell */
  plateDist: Float32Array;

  // ── Terrain ───────────────────────────────────

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

  // ── Hydrology ─────────────────────────────────

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

  // ── Climate ───────────────────────────────────

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

  // ── Feature Membership ────────────────────────

  /** Geographic feature ID (ocean/continent/lake/island) */
  feature: Uint16Array;
  /** 1 = cell touches grid boundary */
  boundary: Uint8Array;

  // ── Political (set by politics stage, read-only on physical) ──

  /** Culture ID (0 = unassigned) */
  culture: Uint16Array;
  /** State/country ID (0 = unclaimed) */
  state: Uint16Array;
}

// ──────────────────────────────────────────────
// Entity Types
// ──────────────────────────────────────────────

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

export interface CulturalRegion {
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

// ──────────────────────────────────────────────
// Generation Parameters
// ──────────────────────────────────────────────

export interface WorldGenParams {
  /** Deterministic seed */
  seed: number;
  /** Number of Voronoi cells (20000-100000, default 50000) */
  cellCount: number;
  /** Number of tectonic plates (6-20, default 10) */
  plateCount: number;
  /** Target number of continents (2-8, default 6) */
  continentCount: number;
  /** Target country count range */
  countryCountRange: [number, number];
  /** Target ocean fraction (0.4-0.85, default 0.65) */
  oceanPercentage: number;
  /** Terrain roughness 0-1 (controls noise amplitude) */
  terrainRoughness: number;
  /** Coastline complexity 0-1 (0 = smooth blobs, 1 = highly fractalized) */
  coastlineComplexity: number;
  /** Climate simulation fidelity 0-1 (0 = simple lat model, 1 = full Coriolis+currents) */
  climateFidelity: number;
  /** Generate ice caps at poles */
  hasIcecaps: boolean;
  /** Generate rivers */
  hasRivers: boolean;
  /** Generate lakes */
  hasLakes: boolean;
  /** Use IxWorld continent outlines as soft template */
  useIxWorldTemplate: boolean;
  /** How closely to follow the template (0=ignore, 1=strict) */
  templateStrength: number;
  /** Enable Markov chain naming */
  useMarkovNaming: boolean;
  /** Specific language family IDs (empty = use all) */
  languageFamilies: string[];
  /** Lloyd relaxation iterations for mesh (1-5, default 3) */
  lloydIterations: number;
}

// ──────────────────────────────────────────────
// Generation Output
// ──────────────────────────────────────────────

export interface GeneratedWorld {
  seed: number;
  params: WorldGenParams;
  /** 7-layer GeoJSON output for IxWorldMap renderer */
  layers: Record<string, import("geojson").FeatureCollection>;
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

export type GenerationStage =
  | "mesh"
  | "tectonics"
  | "terrain"
  | "coastlines"
  | "hydro-climate"
  | "quality"
  | "politics"
  | "export";

export type ProgressCallback = (stage: GenerationStage, progress: number, message: string) => void;

// ──────────────────────────────────────────────
// Quality Gate
// ──────────────────────────────────────────────

export interface QualityCheckResult {
  name: string;
  passed: boolean;
  score: number; // 0-100
  details: string;
  repaired: boolean;
  repairAction?: string;
}

export interface QualityReport {
  passed: boolean;
  compositeScore: number; // 0-100
  checks: QualityCheckResult[];
  totalRepairs: number;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Create an empty WorldGraph skeleton with all typed arrays allocated and zeroed.
 */
export function createEmptyWorldGraph(n: number): WorldGraph {
  const cells: WorldCells = {
    n,
    p: new Float64Array(n * 2),
    neighbors: Array.from({ length: n }, () => []),
    vertices: Array.from({ length: n }, () => [[0, 0] as [number, number]]),

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
    boundary: new Uint8Array(n),

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
