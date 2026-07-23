/**
 * World Generation Types — Azgaar-Style PackedGraph Data Model
 *
 * All world attributes are stored as parallel typed arrays indexed by cell ID
 * on a single Voronoi mesh. This guarantees layers never intersect.
 */

// ──────────────────────────────────────────────
// Core Data Model
// ──────────────────────────────────────────────

export interface PackedGraph {
  /** Voronoi cell geometry and per-cell attributes */
  cells: CellData;
  /** Land masses, ocean basins, and lakes */
  features: Feature[];
  /** River networks */
  rivers: River[];
  /** Political entities (countries) */
  states: State[];
  /** Cultural regions */
  cultures: Culture[];
  /** Settlements (cities, towns) */
  burgs: Burg[];
}

export interface CellData {
  /** Number of cells */
  n: number;
  /** Cell center coordinates: flat [x0,y0, x1,y1, ...] in WGS84 [-180,180]×[-90,90] */
  p: Float64Array;
  /** Neighbor cell IDs for each cell */
  neighbors: number[][];
  /** Voronoi polygon vertices per cell (for GeoJSON export) */
  vertices: [number, number][][];

  // Per-cell attributes (all parallel arrays of length n)

  /** Elevation 0-255. Water < WATER_THRESHOLD (51), Land >= WATER_THRESHOLD */
  h: Uint8Array;
  /** Feature ID (index into features[]) — identifies ocean/landmass/lake */
  f: Uint16Array;
  /** Biome ID (index into Trewartha climate types) */
  b: Uint8Array;
  /** Culture ID (index into cultures[]) */
  culture: Uint16Array;
  /** State/country ID (index into states[], 0 = unclaimed) */
  state: Uint16Array;
  /** River ID (index into rivers[], 0 = no river) */
  river: Uint16Array;
  /** Water flux accumulation (for river detection) */
  flux: Float32Array;
  /** Temperature in degrees Celsius (signed) */
  temp: Int8Array;
  /** Precipitation 0-255 */
  prec: Uint8Array;
  /** Elevation zone index (0-8, maps to ELEVATION_ZONES from elevation-config.ts) */
  elevZone: Uint8Array;
  /** Distance from coast in cell hops (0 = coastal) */
  coastDist: Uint16Array;
  /** Whether this cell is on the grid boundary */
  boundary: Uint8Array;
}

/** Water/land threshold. Cells with h < this are water, >= are land. */
export const WATER_THRESHOLD = 51;

/** Map 0-255 elevation to meters (max ~6000m) */
export function elevToMeters(h: number): number {
  if (h < WATER_THRESHOLD) return 0;
  const landH = (h - WATER_THRESHOLD) / (255 - WATER_THRESHOLD); // 0-1
  return Math.round(landH * landH * 6000); // quadratic curve favoring low elevations
}

// ──────────────────────────────────────────────
// Entity Types
// ──────────────────────────────────────────────

export interface Feature {
  id: number;
  type: "ocean" | "land" | "lake";
  /** Number of cells in this feature */
  cellCount: number;
  /** Approximate area in km² */
  area: number;
  /** Generated name (for lakes and named seas) */
  name: string;
  /** Whether this feature touches the grid boundary */
  border: boolean;
}

export interface River {
  id: number;
  name: string;
  /** Ordered cell IDs from source to mouth */
  cells: number[];
  /** Cell ID at river mouth (where it meets ocean/lake) */
  mouth: number;
  /** Cell ID at river source (headwaters) */
  source: number;
  /** Total water discharge at mouth */
  flux: number;
  /** Approximate length in km */
  length: number;
}

export interface State {
  id: number;
  name: string;
  /** Hex color for map display */
  color: string;
  /** Burg ID of capital city */
  capital: number;
  /** Number of cells in this state */
  cellCount: number;
  /** Approximate area in km² */
  area: number;
  /** Adjacent state IDs */
  neighbors: number[];
  /** Dominant culture ID */
  culture: number;
  /** Continent name (derived from landmass feature) */
  continent: string;
}

export interface Culture {
  id: number;
  name: string;
  /** Language family ID from language-families.ts */
  familyId: string;
  /** Origin cell ID */
  center: number;
  /** Number of cells claimed */
  cellCount: number;
}

export interface Burg {
  id: number;
  name: string;
  /** Cell ID where this burg is located */
  cell: number;
  /** State ID this burg belongs to */
  state: number;
  /** Estimated population */
  population: number;
  /** Whether this burg is a state capital */
  isCapital: boolean;
  /** Whether this is a port city */
  isPort: boolean;
  /** Longitude */
  lng: number;
  /** Latitude */
  lat: number;
}

// ──────────────────────────────────────────────
// Generation Parameters
// ──────────────────────────────────────────────

export interface WorldGenParams {
  seed: number;
  /** Number of Voronoi cells (10000-50000, default 20000) */
  cellCount: number;
  /** Number of continents (1-8, default 6) */
  continentCount: number;
  /** Target country count range */
  countryCountRange: [number, number];
  /** Target ocean fraction (0.4-0.85, default 0.65) */
  oceanPercentage: number;
  /** Terrain roughness 0-1 (controls blob count and noise) */
  terrainRoughness: number;
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
  /** Use UPG v2 unified physical geography engine (default true) */
  useV2Engine?: boolean;
}

export const DEFAULT_PARAMS: WorldGenParams = {
  seed: 42,
  cellCount: 50000,
  continentCount: 6,
  countryCountRange: [60, 200],
  oceanPercentage: 0.65,
  terrainRoughness: 0.5,
  hasIcecaps: true,
  hasRivers: true,
  hasLakes: true,
  useIxWorldTemplate: true,
  templateStrength: 0.6,
  useMarkovNaming: true,
  languageFamilies: [],
  useV2Engine: true,
};

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
  /** The internal Voronoi graph (for Studio editor, not for rendering) */
  graph?: PackedGraph;
}

export interface WorldStats {
  landPercentage: number;
  countryCount: number;
  riverCount: number;
  lakeCount: number;
  altitudeZoneCount: number;
  climateZoneCount: number;
  icecapCount: number;
  biomeCount: number;
  cultureCount: number;
  cityCount: number;
  generationTimeMs: number;
  cellCount: number;
}

export type GenerationStage =
  | "mesh"
  | "template"
  | "heightmap"
  | "features"
  | "rivers"
  | "climate"
  | "cultures"
  | "settlements"
  | "states"
  | "validate"
  | "export";

export type ProgressCallback = (stage: GenerationStage, progress: number, message: string) => void;
