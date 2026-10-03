/**
 * SVG Parser - Converts Inkscape SVG files to GeoJSON FeatureCollections.
 *
 * Server-side only. Handles:
 * - Parsing SVG XML structure with @xmldom/xmldom
 * - Extracting layer groups and path features
 * - Flattening cubic bezier curves to line segments
 * - Converting SVG coordinates to WGS84 via configurable affine transform
 * - Calculating centroids, bounding boxes, and areas
 * - Fuzzy-matching political features to Country records
 */

import { DOMParser } from "@xmldom/xmldom";

import { type SvgPathCommand, pathCommandsToRings } from "./svg/command-evaluator";
import {
  ringArea,
  calculateCentroid,
  calculateBoundingBox,
  calculateApproxArea,
  extractFillColor,
  extractStrokeColor,
} from "./svg/topology-flattener";
import type { SvgCoordinateConfig } from "./svg-coordinate-config";
import { IXEARTH_SVG_CONFIG } from "./svg-coordinate-config";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { SVG_NS, INKSCAPE_NS } from "./svg/xml";
import { readViewBox, resolveCoordinateConfig } from "./svg/coordinate-calibration";
import { selectTargetLayer } from "./svg/layer-selection";
import { buildReferenceGeometryMap } from "./svg/reference-geometry";
import { extractFeatures, featureIdToDisplayName } from "./svg/feature-extraction";

export type { SvgPathCommand };
export {
  pathCommandsToRings,
  ringArea,
  calculateCentroid,
  calculateBoundingBox,
  calculateApproxArea,
  extractFillColor,
  extractStrokeColor,
  featureIdToDisplayName,
};
export { computeLayerDiff } from "./svg/layer-diff";

export interface SvgParseConfig {
  /** Coordinate conversion config (defaults to IxEarth) */
  coordinateConfig?: SvgCoordinateConfig;
  /** Specific layer ID to extract (e.g., "political"). If null, extracts all layers. */
  targetLayerId?: string;
  /** Number of line segments to use when flattening each cubic bezier curve */
  bezierSegments?: number;
  /** Minimum number of coordinates for a valid polygon ring */
  minRingSize?: number;
  /**
   * Reference GeoJSON for auto-calibrating the coordinate mapping.
   * When provided, the parser matches SVG feature IDs to reference features
   * and derives the correct affine transform from matched pairs.
   * This is the most accurate method when existing map data exists.
   */
  referenceGeoJson?: FeatureCollection;
}

export interface ParsedFeature {
  featureId: string;
  displayName: string;
  geometry: Polygon | MultiPolygon;
  properties: Record<string, unknown>;
  centroid: [number, number]; // [lng, lat]
  boundingBox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  areaSqKm: number;
}

interface SvgParseResult {
  features: ParsedFeature[];
  featureCollection: FeatureCollection;
  layersFound: string[];
  viewBox: { width: number; height: number };
  log: string[];
}

// SVG Parsing

/**
 * Main entry point: parse SVG content string into GeoJSON.
 */
export function parseSvgToGeoJson(
  svgContent: string,
  layerType: string,
  config: SvgParseConfig = {}
): SvgParseResult {
  const log: string[] = [];
  const baseCoordConfig = config.coordinateConfig ?? IXEARTH_SVG_CONFIG;
  const bezierSegments = config.bezierSegments ?? 8;
  const minRingSize = config.minRingSize ?? 4;
  const targetLayerId = config.targetLayerId ?? layerType;

  log.push(`Parsing SVG for layer type: ${layerType}`);

  // Parse SVG XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgRoot = doc.documentElement;

  if (!svgRoot) {
    throw new Error("Failed to parse SVG: no root element found");
  }

  const viewBox = readViewBox(svgRoot, baseCoordConfig, log);
  const coordConfig = resolveCoordinateConfig(
    svgRoot,
    viewBox,
    baseCoordConfig,
    config.referenceGeoJson,
    log
  );

  const { targetGroup, layersFound } = selectTargetLayer(svgRoot, targetLayerId, log);
  log.push(`Extracting features from layer: ${targetGroup.getAttribute("id")}`);

  // Prefer exact coordinates from the reference GeoJSON over converted SVG coordinates.
  const refGeometryMap = buildReferenceGeometryMap(config.referenceGeoJson, log);
  const { features, pathCount, refUsedCount } = extractFeatures(
    targetGroup,
    { coordConfig, bezierSegments, minRingSize, refGeometryMap },
    log
  );

  log.push(`Extracted ${features.length} features from ${pathCount} paths`);
  if (refUsedCount > 0) {
    log.push(
      `Used reference geometry for ${refUsedCount} features (${features.length - refUsedCount} from SVG conversion)`
    );
  }

  // Build FeatureCollection
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: features.map((f): Feature => ({
      type: "Feature",
      id: f.featureId,
      geometry: f.geometry,
      properties: f.properties,
    })),
  };

  return {
    features,
    featureCollection,
    layersFound,
    viewBox,
    log,
  };
}

// Country Name Matching

/**
 * Normalize a name for fuzzy matching.
 * Removes common prefixes/suffixes, lowercases, strips non-alpha.
 */
function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(
      /^(the|republic|kingdom|empire|federation|state|commonwealth|duchy|principality)(of)?/g,
      ""
    )
    .trim();
}

/**
 * Match parsed features to Country records by name.
 */
export function matchFeaturesToCountries(
  features: ParsedFeature[],
  countries: Array<{ id: string; name: string; slug: string | null }>
): Map<string, { countryId: string; countryName: string; matchType: "exact" | "fuzzy" }> {
  const matches = new Map<
    string,
    { countryId: string; countryName: string; matchType: "exact" | "fuzzy" }
  >();

  // Build lookup maps
  const countryByExactName = new Map<string, { id: string; name: string }>();
  const countryByNormalized = new Map<string, { id: string; name: string }>();
  const countryBySlug = new Map<string, { id: string; name: string }>();

  for (const c of countries) {
    countryByExactName.set(c.name.toLowerCase(), { id: c.id, name: c.name });
    countryByNormalized.set(normalizeForMatching(c.name), { id: c.id, name: c.name });
    if (c.slug) {
      countryBySlug.set(c.slug.toLowerCase(), { id: c.id, name: c.name });
    }
  }

  for (const feature of features) {
    const featureName = feature.displayName.toLowerCase();
    const featureNorm = normalizeForMatching(feature.displayName);
    const featureSlug = feature.featureId.toLowerCase().replace(/_/g, "-");

    // Try exact name match
    const exact = countryByExactName.get(featureName);
    if (exact) {
      matches.set(feature.featureId, {
        countryId: exact.id,
        countryName: exact.name,
        matchType: "exact",
      });
      continue;
    }

    // Try slug match
    const slugMatch = countryBySlug.get(featureSlug);
    if (slugMatch) {
      matches.set(feature.featureId, {
        countryId: slugMatch.id,
        countryName: slugMatch.name,
        matchType: "exact",
      });
      continue;
    }

    // Try normalized fuzzy match
    const fuzzy = countryByNormalized.get(featureNorm);
    if (fuzzy) {
      matches.set(feature.featureId, {
        countryId: fuzzy.id,
        countryName: fuzzy.name,
        matchType: "fuzzy",
      });
    }
  }

  return matches;
}

// Layer type auto-detection

/**
 * Extract SVG metadata (viewBox, dimensions, layer list).
 */
export function extractSvgMetadata(svgContent: string): {
  viewBox: { x: number; y: number; width: number; height: number } | null;
  width: string | null;
  height: string | null;
  layers: Array<{ id: string; label: string; childCount: number }>;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const root = doc.documentElement;

  if (!root) return { viewBox: null, width: null, height: null, layers: [] };

  // Parse viewBox
  let viewBox = null;
  const vbAttr = root.getAttribute("viewBox");
  if (vbAttr) {
    const parts = vbAttr.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      viewBox = { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
    }
  }

  // Find layers
  const layers: Array<{ id: string; label: string; childCount: number }> = [];
  const groups = root.getElementsByTagNameNS(SVG_NS, "g");
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    if (g.parentNode !== root) continue;

    const gId = g.getAttribute("id") || "";
    const gLabel =
      g.getAttributeNS(INKSCAPE_NS, "label") || g.getAttribute("inkscape:label") || gId;

    // Count all descendant paths (not just direct children — Illustrator nests groups)
    const paths = g.getElementsByTagNameNS(SVG_NS, "path");

    layers.push({ id: gId, label: gLabel, childCount: paths.length });
  }

  return {
    viewBox,
    width: root.getAttribute("width"),
    height: root.getAttribute("height"),
    layers,
  };
}
