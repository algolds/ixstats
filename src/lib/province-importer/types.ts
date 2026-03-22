/**
 * Province Importer - Shared types and interfaces.
 *
 * Used across the province import pipeline: parsing, alignment, topology, and UI.
 */

import type { Position, Polygon, MultiPolygon, FeatureCollection } from "geojson";

// ──────────────────────────────────────────────
// Province Feature Types
// ──────────────────────────────────────────────

/** A parsed province from an SVG or PNG input. */
export interface ProvinceFeature {
  /** Unique identifier from SVG (element ID or generated) */
  sourceId: string;
  /** Human-readable province name */
  name: string;
  /** Province boundary polygon */
  geometry: Polygon | MultiPolygon;
  /** Fill color from SVG (hex) */
  color?: string;
  /** How confident the name detection is (0-1) */
  confidence: number;
  /** Centroid [lng, lat] */
  centroid: [number, number];
  /** Bounding box [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** Area in square kilometers */
  areaSqKm: number;
  /** Whether this province is included in the import */
  included: boolean;
}

// ──────────────────────────────────────────────
// Parse Configuration & Results
// ──────────────────────────────────────────────

export interface ProvinceParseConfig {
  /** Number of segments for bezier flattening (default: 8) */
  bezierSegments?: number;
  /** Minimum ring size in coordinates (default: 4) */
  minRingSize?: number;
  /** Whether to merge paths sharing the same parent <g> into one province */
  mergeGroupedPaths?: boolean;
  /** Max paths per group before treating each child as a separate province (default: 4) */
  maxMergeSize?: number;
  /** Specific layer name to target (e.g., "Provinces"). If unset, auto-detect. */
  targetLayer?: string;
  /** Match <text> labels to provinces by spatial proximity (default: true) */
  useTextLabels?: boolean;
  /** Apply SVG transform attributes to coordinates (default: true) */
  includeTransforms?: boolean;
}

export interface ProvinceParseResult {
  /** Parsed province features */
  provinces: ProvinceFeature[];
  /** SVG viewBox dimensions */
  viewBox: { width: number; height: number };
  /** Processing log messages */
  log: string[];
  /** Names of layers/groups found in the SVG */
  layersFound: string[];
}

// ──────────────────────────────────────────────
// Affine Transform & Alignment
// ──────────────────────────────────────────────

/**
 * 2D affine transformation matrix (6 parameters).
 * Transforms point [x, y] to:
 *   x' = a * x + b * y + tx
 *   y' = c * x + d * y + ty
 */
export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/** A pair of corresponding points in source and target space. */
export interface ReferencePoint {
  /** Point in the imported province coordinate space [lng, lat] */
  source: Position;
  /** Corresponding point on the country border [lng, lat] */
  target: Position;
}

export type AlignmentMode = "reference-points" | "auto-align" | "manual";

export interface AlignmentResult {
  /** The computed affine transform */
  matrix: AffineMatrix;
  /** Root mean square error (degrees) — lower is better */
  rmse: number;
  /** Number of matched point pairs used */
  matchCount: number;
  /** Number of ICP iterations (for auto-align) */
  iterations?: number;
}

export interface ManualTransform {
  /** Translation offset [dLng, dLat] */
  translate: [number, number];
  /** Rotation in degrees (clockwise) */
  rotate: number;
  /** Uniform scale factor (1.0 = no change) */
  scale: number;
}

// ──────────────────────────────────────────────
// Topology Validation
// ──────────────────────────────────────────────

export interface GapReport {
  /** GeoJSON polygon of the gap area */
  geometry: Polygon;
  /** Area of the gap in sq km */
  areaSqKm: number;
  /** Names of adjacent provinces */
  adjacentProvinces: string[];
  /** Whether this gap can be auto-filled */
  autoFixable: boolean;
}

export interface OverlapReport {
  /** GeoJSON polygon of the overlap area */
  geometry: Polygon;
  /** Area of the overlap in sq km */
  areaSqKm: number;
  /** Names of overlapping provinces */
  provinces: [string, string];
}

export interface TopologyReport {
  /** Whether the topology is valid (no issues) */
  valid: boolean;
  /** Detected gaps between provinces */
  gaps: GapReport[];
  /** Detected overlaps between provinces */
  overlaps: OverlapReport[];
  /** Percentage of country area covered by provinces */
  coveragePercent: number;
  /** Total area of all provinces combined (sq km) */
  totalProvincesArea: number;
  /** Country border area (sq km) */
  countryArea: number;
  /** Individual province validation issues */
  featureIssues: Array<{
    provinceIndex: number;
    provinceName: string;
    issues: string[];
  }>;
}

// ──────────────────────────────────────────────
// Import Session State
// ──────────────────────────────────────────────

export type ImportStep = "upload" | "names" | "align" | "snap" | "validate" | "commit";

export interface ProvinceImportSession {
  /** Current wizard step */
  step: ImportStep;
  /** Country ID being imported to */
  countryId: string;
  /** Upload record ID (if uploaded via API) */
  uploadId?: string;
  /** Raw parsed provinces (pre-alignment) */
  rawProvinces: ProvinceFeature[];
  /** Provinces after alignment and snapping */
  alignedProvinces: ProvinceFeature[];
  /** Current alignment mode */
  alignmentMode: AlignmentMode;
  /** Reference points placed by the user */
  referencePoints: ReferencePoint[];
  /** Computed affine transform */
  transform: AffineMatrix | null;
  /** Manual transform parameters */
  manualTransform: ManualTransform;
  /** Snap tolerance in degrees */
  snapTolerance: number;
  /** Topology validation report */
  validationReport: TopologyReport | null;
  /** Whether processing is in progress */
  isProcessing: boolean;
  /** Error message, if any */
  error: string | null;
}

// ──────────────────────────────────────────────
// Commit Data
// ──────────────────────────────────────────────

export interface ProvinceCommitData {
  name: string;
  type: string;
  geometry: Polygon | MultiPolygon;
  level?: number;
  capital?: string;
  population?: number;
  color?: string;
}

export interface ProvinceCommitInput {
  countryId: string;
  provinces: ProvinceCommitData[];
  replaceExisting: boolean;
}

// ──────────────────────────────────────────────
// PNG Tracer Types
// ──────────────────────────────────────────────

export interface PngTracerConfig {
  /** Minimum region area in pixels (skip tiny regions) */
  minRegionPixels?: number;
  /** Color distance threshold for grouping similar colors (0-255) */
  colorThreshold?: number;
  /** Douglas-Peucker simplification tolerance (pixels) */
  simplifyTolerance?: number;
  /** Colors to ignore (e.g., background, borders) */
  ignoreColors?: string[];
}

export interface TracedRegion {
  /** Hex color of the region */
  color: string;
  /** Boundary polygon in pixel coordinates */
  boundary: Position[];
  /** Area in pixels */
  areaPixels: number;
}

// ──────────────────────────────────────────────
// GeoJSON Helpers
// ──────────────────────────────────────────────

/** A province collection ready for MapLibre preview rendering. */
export interface ProvincePreviewData {
  /** GeoJSON for all provinces */
  collection: FeatureCollection;
  /** Country border polygon for comparison */
  countryBorder: Polygon | MultiPolygon;
  /** Alignment error metric (degrees RMSE) */
  alignmentError?: number;
}
