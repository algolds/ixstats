/**
 * World Generation Types — Azgaar-Style PackedGraph Data Model
 *
 * All world attributes are stored as parallel typed arrays indexed by cell ID
 * on a single Voronoi mesh. This guarantees layers never intersect.
 */

// Core Data Model

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

interface CellData {
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

// Entity Types

interface Feature {
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

interface State {
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

interface Culture {
  id: number;
  name: string;
  /** Language family ID from language-families.ts */
  familyId: string;
  /** Origin cell ID */
  center: number;
  /** Number of cells claimed */
  cellCount: number;
}

interface Burg {
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

// Generation Parameters (owned by UPG v2)

import type { WorldGenParams } from "./v2/types";
export type { WorldGenParams };

// Generation Output

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

interface WorldStats {
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

export type { ProgressCallback } from "./v2/types";
