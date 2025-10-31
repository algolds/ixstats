/**
 * Spatial Validation Utilities
 *
 * Comprehensive geometry validation using @turf/turf for IxEarth map editing.
 * All area and distance calculations apply the IxEarth scale factor (1.4777x)
 * to reconcile Earth-scale WGS84 measurements with IxEarth canonical metrics.
 *
 * @module spatial-validation
 * @see /src/lib/ixearth-constants.ts for scale system documentation
 */

import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import { IXEARTH_SCALE_SYSTEM, sqMiToSqKm, sqKmToSqMi } from "../ixearth-constants";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface OverlapValidationResult extends ValidationResult {
  overlaps: string[];
}

export interface TopologyValidationResult extends ValidationResult {
  issues: string[];
}

export interface AreaCalculationResult {
  /** Earth-scale area in square kilometers */
  areaSqKm: number;
  /** Earth-scale area in square miles */
  areaSqMi: number;
  /** IxEarth canonical area in square kilometers */
  ixEarthAreaSqKm: number;
  /** IxEarth canonical area in square miles */
  ixEarthAreaSqMi: number;
}

export interface AreaValidationResult extends ValidationResult {
  warning?: string;
}

export interface VertexValidationResult extends ValidationResult {
  count: number;
  warning?: string;
}

export type GeometryType = "subdivision" | "city" | "poi";
export type DistanceUnits = "kilometers" | "miles";

// =============================================================================
// VALIDATION THRESHOLDS
// =============================================================================

/**
 * Area thresholds for different geometry types (in IxEarth square kilometers)
 */
const AREA_THRESHOLDS = {
  subdivision: {
    min: 10, // ~4 sq mi - prevents tiny subdivisions
    max: 5_000_000, // ~1.9M sq mi - prevents unrealistic subdivisions
  },
  city: {
    min: 0.01, // ~0.004 sq mi - allows small urban areas
    max: 10_000, // ~3,860 sq mi - prevents unrealistic city boundaries
  },
  poi: {
    min: 0.0001, // ~0.00004 sq mi - allows point-like features
    max: 100, // ~39 sq mi - prevents POIs from being too large
  },
} as const;

/**
 * Vertex count thresholds
 */
const VERTEX_THRESHOLDS = {
  min: 3, // Triangle (minimum valid polygon)
  max: 10_000, // Prevents performance issues
  warningThreshold: 1_000, // Warn about high vertex counts
} as const;

/**
 * Coordinate range limits (WGS84)
 */
const COORDINATE_LIMITS = {
  longitude: { min: -180, max: 180 },
  latitude: { min: -90, max: 90 },
} as const;

// =============================================================================
// CORE VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates that a geometry is fully contained within country boundaries.
 *
 * Uses Turf.js boolean operations to check if the feature geometry lies
 * completely within the provided country boundary polygon.
 *
 * @param feature - The geometry to validate (subdivision, city, POI, etc.)
 * @param countryBoundary - The country's boundary geometry
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const subdivision = { type: "Feature", geometry: {...}, properties: {...} };
 * const country = { type: "Feature", geometry: {...}, properties: {...} };
 * const result = validateBoundaryContainment(subdivision, country);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateBoundaryContainment(
  feature: Feature<Polygon | MultiPolygon>,
  countryBoundary: Feature<Polygon | MultiPolygon>
): ValidationResult {
  try {
    // Validate inputs
    if (!feature || !feature.geometry) {
      return { valid: false, error: "Invalid feature: missing geometry" };
    }
    if (!countryBoundary || !countryBoundary.geometry) {
      return { valid: false, error: "Invalid country boundary: missing geometry" };
    }

    // Check if feature is completely within country boundary
    const isWithin = turf.booleanWithin(feature, countryBoundary);

    if (!isWithin) {
      return {
        valid: false,
        error: "Geometry extends outside country boundaries",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Boundary validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validates that a new geometry does not overlap with existing geometries.
 *
 * Checks for spatial overlaps between the new feature and a collection of
 * existing features. Returns all overlapping feature IDs for debugging.
 *
 * @param newFeature - The new geometry to validate
 * @param existingFeatures - Array of existing geometries to check against
 * @returns Validation result with list of overlapping feature IDs
 *
 * @example
 * ```typescript
 * const newSubdivision = { type: "Feature", geometry: {...}, properties: { id: "new" } };
 * const existing = [
 *   { type: "Feature", geometry: {...}, properties: { id: "sub-1" } },
 *   { type: "Feature", geometry: {...}, properties: { id: "sub-2" } }
 * ];
 * const result = validateOverlap(newSubdivision, existing);
 * if (!result.valid) {
 *   console.error(`Overlaps with: ${result.overlaps.join(", ")}`);
 * }
 * ```
 */
export function validateOverlap(
  newFeature: Feature<Polygon | MultiPolygon>,
  existingFeatures: Feature<Polygon | MultiPolygon>[]
): OverlapValidationResult {
  try {
    // Validate inputs
    if (!newFeature || !newFeature.geometry) {
      return { valid: false, overlaps: [], error: "Invalid feature: missing geometry" };
    }

    const overlaps: string[] = [];

    // Check each existing feature for overlap
    for (const existingFeature of existingFeatures) {
      if (!existingFeature || !existingFeature.geometry) {
        continue; // Skip invalid features
      }

      try {
        // Check for overlap using Turf.js boolean operations
        const hasOverlap = turf.booleanOverlap(newFeature, existingFeature);
        const isContained = turf.booleanContains(existingFeature, newFeature);
        const contains = turf.booleanContains(newFeature, existingFeature);

        if (hasOverlap || isContained || contains) {
          const featureId =
            existingFeature.properties?.id ||
            existingFeature.properties?.name ||
            "unknown";
          overlaps.push(String(featureId));
        }
      } catch (error) {
        // Individual comparison failed, continue checking others
        console.warn(
          `Overlap check failed for feature ${existingFeature.properties?.id}:`,
          error
        );
      }
    }

    if (overlaps.length > 0) {
      return {
        valid: false,
        overlaps,
        error: `Geometry overlaps with ${overlaps.length} existing feature(s): ${overlaps.join(", ")}`,
      };
    }

    return { valid: true, overlaps: [] };
  } catch (error) {
    return {
      valid: false,
      overlaps: [],
      error: `Overlap validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validates polygon topology for self-intersections, holes, and invalid geometries.
 *
 * Performs comprehensive topology validation including:
 * - Self-intersection detection
 * - Hole validation (interior rings)
 * - Coordinate validity
 * - Geometric simplicity
 *
 * @param feature - The geometry to validate
 * @returns Validation result with list of topology issues
 *
 * @example
 * ```typescript
 * const polygon = { type: "Feature", geometry: {...}, properties: {...} };
 * const result = validateTopology(polygon);
 * if (!result.valid) {
 *   console.error("Topology issues:", result.issues);
 * }
 * ```
 */
export function validateTopology(
  feature: Feature<Polygon | MultiPolygon>
): TopologyValidationResult {
  const issues: string[] = [];

  try {
    // Validate inputs
    if (!feature || !feature.geometry) {
      return { valid: false, issues: ["Invalid feature: missing geometry"] };
    }

    const { geometry } = feature;

    // Check for self-intersections using Turf's kinks detection
    const kinks = turf.kinks(feature);
    if (kinks.features.length > 0) {
      issues.push(`Self-intersections detected: ${kinks.features.length} kink(s)`);
    }

    // Validate coordinate structure
    if (geometry.type === "Polygon") {
      validatePolygonCoordinates(geometry.coordinates, issues);
    } else if (geometry.type === "MultiPolygon") {
      for (const polygonCoords of geometry.coordinates) {
        validatePolygonCoordinates(polygonCoords, issues);
      }
    }

    // Check if geometry is valid using Turf's boolean valid
    try {
      // Attempt to clean/buffer by 0 to check validity
      const buffered = turf.buffer(feature, 0, { units: "meters" });
      if (!buffered || !buffered.geometry) {
        issues.push("Geometry is invalid or degenerate");
      }
    } catch (error) {
      issues.push("Geometry is topologically invalid");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [
        `Topology validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Helper function to validate polygon coordinate structure
 */
function validatePolygonCoordinates(
  coordinates: Position[][],
  issues: string[]
): void {
  if (!coordinates || coordinates.length === 0) {
    issues.push("Empty coordinate array");
    return;
  }

  // Validate exterior ring (first element)
  const exteriorRing = coordinates[0];
  if (!exteriorRing || exteriorRing.length < 4) {
    issues.push("Exterior ring has fewer than 4 coordinates");
  }

  // Check if exterior ring is closed
  if (exteriorRing && exteriorRing.length >= 4) {
    const first = exteriorRing[0];
    const last = exteriorRing[exteriorRing.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      issues.push("Exterior ring is not closed (first and last coordinates must match)");
    }
  }

  // Validate interior rings (holes)
  for (let i = 1; i < coordinates.length; i++) {
    const hole = coordinates[i];
    if (!hole || hole.length < 4) {
      issues.push(`Interior ring ${i} has fewer than 4 coordinates`);
    }

    // Check if hole is closed
    if (hole && hole.length >= 4) {
      const first = hole[0];
      const last = hole[hole.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        issues.push(`Interior ring ${i} is not closed`);
      }
    }
  }
}

/**
 * Calculates area in both Earth-scale and IxEarth-scale measurements.
 *
 * Returns area in square kilometers and square miles for both:
 * - Earth-scale (raw WGS84 geographic calculation)
 * - IxEarth-scale (canonical area using 1.4777x scale factor)
 *
 * @param feature - The geometry to measure
 * @returns Area measurements in all four units
 *
 * @example
 * ```typescript
 * const subdivision = { type: "Feature", geometry: {...}, properties: {...} };
 * const result = calculateArea(subdivision);
 * console.log(`IxEarth Area: ${result.ixEarthAreaSqKm.toFixed(2)} sq km`);
 * console.log(`IxEarth Area: ${result.ixEarthAreaSqMi.toFixed(2)} sq mi`);
 * ```
 */
export function calculateArea(
  feature: Feature<Polygon | MultiPolygon>
): AreaCalculationResult {
  try {
    // Calculate Earth-scale area in square meters
    const areaSquareMeters = turf.area(feature);

    // Convert to square kilometers and square miles (Earth-scale)
    const areaSqKm = areaSquareMeters / 1_000_000;
    const areaSqMi = sqKmToSqMi(areaSqKm);

    // Apply IxEarth scale factor (1.4777x)
    const ixEarthAreaSqMi =
      IXEARTH_SCALE_SYSTEM.earthScaleToCanonical(areaSqMi);
    const ixEarthAreaSqKm = sqMiToSqKm(ixEarthAreaSqMi);

    return {
      areaSqKm,
      areaSqMi,
      ixEarthAreaSqKm,
      ixEarthAreaSqMi,
    };
  } catch (error) {
    // Return zero values on error
    return {
      areaSqKm: 0,
      areaSqMi: 0,
      ixEarthAreaSqKm: 0,
      ixEarthAreaSqMi: 0,
    };
  }
}

/**
 * Validates that a coordinate pair is within valid WGS84 ranges.
 *
 * Checks that longitude is in [-180, 180] and latitude is in [-90, 90].
 *
 * @param coordinates - [longitude, latitude] coordinate pair
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const coord: [number, number] = [125.5, 45.2];
 * const result = validateCoordinates(coord);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateCoordinates(
  coordinates: [number, number]
): ValidationResult {
  try {
    if (!coordinates || coordinates.length !== 2) {
      return { valid: false, error: "Coordinates must be [longitude, latitude] pair" };
    }

    const [lng, lat] = coordinates;

    if (typeof lng !== "number" || typeof lat !== "number") {
      return { valid: false, error: "Coordinates must be numeric values" };
    }

    if (isNaN(lng) || isNaN(lat)) {
      return { valid: false, error: "Coordinates cannot be NaN" };
    }

    if (!isFinite(lng) || !isFinite(lat)) {
      return { valid: false, error: "Coordinates must be finite numbers" };
    }

    if (lng < COORDINATE_LIMITS.longitude.min || lng > COORDINATE_LIMITS.longitude.max) {
      return {
        valid: false,
        error: `Longitude ${lng} is outside valid range [${COORDINATE_LIMITS.longitude.min}, ${COORDINATE_LIMITS.longitude.max}]`,
      };
    }

    if (lat < COORDINATE_LIMITS.latitude.min || lat > COORDINATE_LIMITS.latitude.max) {
      return {
        valid: false,
        error: `Latitude ${lat} is outside valid range [${COORDINATE_LIMITS.latitude.min}, ${COORDINATE_LIMITS.latitude.max}]`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Coordinate validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validates that a geometry's area is within acceptable thresholds.
 *
 * Checks minimum and maximum area constraints based on geometry type.
 * Uses IxEarth-scale areas for threshold comparison.
 *
 * @param feature - The geometry to validate
 * @param type - Type of geometry (subdivision, city, poi)
 * @param level - Optional subdivision level (for future hierarchical validation)
 * @returns Validation result with warning or error messages
 *
 * @example
 * ```typescript
 * const subdivision = { type: "Feature", geometry: {...}, properties: {...} };
 * const result = validateMinMaxArea(subdivision, "subdivision");
 * if (!result.valid) {
 *   console.error(result.error);
 * } else if (result.warning) {
 *   console.warn(result.warning);
 * }
 * ```
 */
export function validateMinMaxArea(
  feature: Feature<Polygon | MultiPolygon>,
  type: GeometryType,
  level?: number
): AreaValidationResult {
  try {
    // Calculate IxEarth-scale area
    const { ixEarthAreaSqKm } = calculateArea(feature);

    // Get thresholds for this geometry type
    const thresholds = AREA_THRESHOLDS[type];

    // Check minimum area
    if (ixEarthAreaSqKm < thresholds.min) {
      return {
        valid: false,
        error: `Area (${ixEarthAreaSqKm.toFixed(2)} sq km) is below minimum threshold (${thresholds.min} sq km) for ${type}`,
      };
    }

    // Check maximum area
    if (ixEarthAreaSqKm > thresholds.max) {
      return {
        valid: false,
        error: `Area (${ixEarthAreaSqKm.toFixed(2)} sq km) exceeds maximum threshold (${thresholds.max} sq km) for ${type}`,
      };
    }

    // Optional warning for areas near thresholds (within 10%)
    const nearMin = ixEarthAreaSqKm < thresholds.min * 1.1;
    const nearMax = ixEarthAreaSqKm > thresholds.max * 0.9;

    if (nearMin) {
      return {
        valid: true,
        warning: `Area (${ixEarthAreaSqKm.toFixed(2)} sq km) is close to minimum threshold (${thresholds.min} sq km)`,
      };
    }

    if (nearMax) {
      return {
        valid: true,
        warning: `Area (${ixEarthAreaSqKm.toFixed(2)} sq km) is close to maximum threshold (${thresholds.max} sq km)`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Area validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validates polygon vertex count to prevent performance issues.
 *
 * Checks that a polygon has at least 3 vertices (minimum for a triangle)
 * and no more than 10,000 vertices (performance threshold).
 *
 * @param feature - The geometry to validate
 * @returns Validation result with vertex count and warning/error messages
 *
 * @example
 * ```typescript
 * const polygon = { type: "Feature", geometry: {...}, properties: {...} };
 * const result = validateVertexCount(polygon);
 * if (!result.valid) {
 *   console.error(result.error);
 * } else if (result.warning) {
 *   console.warn(`${result.count} vertices - ${result.warning}`);
 * }
 * ```
 */
export function validateVertexCount(
  feature: Feature<Polygon | MultiPolygon>
): VertexValidationResult {
  try {
    // Validate inputs
    if (!feature || !feature.geometry) {
      return {
        valid: false,
        count: 0,
        error: "Invalid feature: missing geometry",
      };
    }

    // Count total vertices
    let totalVertices = 0;
    const { geometry } = feature;

    if (geometry.type === "Polygon") {
      totalVertices = countPolygonVertices(geometry.coordinates);
    } else if (geometry.type === "MultiPolygon") {
      for (const polygonCoords of geometry.coordinates) {
        totalVertices += countPolygonVertices(polygonCoords);
      }
    }

    // Check minimum vertex count
    if (totalVertices < VERTEX_THRESHOLDS.min) {
      return {
        valid: false,
        count: totalVertices,
        error: `Polygon has ${totalVertices} vertices (minimum: ${VERTEX_THRESHOLDS.min})`,
      };
    }

    // Check maximum vertex count
    if (totalVertices > VERTEX_THRESHOLDS.max) {
      return {
        valid: false,
        count: totalVertices,
        error: `Polygon has ${totalVertices} vertices (maximum: ${VERTEX_THRESHOLDS.max})`,
      };
    }

    // Warning for high vertex count
    if (totalVertices > VERTEX_THRESHOLDS.warningThreshold) {
      return {
        valid: true,
        count: totalVertices,
        warning: `High vertex count (${totalVertices}) may impact performance. Consider simplifying geometry.`,
      };
    }

    return { valid: true, count: totalVertices };
  } catch (error) {
    return {
      valid: false,
      count: 0,
      error: `Vertex validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Helper function to count vertices in a polygon's coordinate array
 */
function countPolygonVertices(coordinates: Position[][]): number {
  let count = 0;
  for (const ring of coordinates) {
    // Subtract 1 because last coordinate duplicates first (closed ring)
    count += Math.max(0, ring.length - 1);
  }
  return count;
}

/**
 * Calculates distance between two points with IxEarth scale factor.
 *
 * Returns distance in kilometers or miles, applying the 1.4777x scale factor
 * to convert Earth-scale WGS84 distance to IxEarth canonical distance.
 *
 * @param point1 - First coordinate [longitude, latitude]
 * @param point2 - Second coordinate [longitude, latitude]
 * @param units - Distance units ("kilometers" or "miles"), defaults to "kilometers"
 * @returns Distance between points in IxEarth-scale units
 *
 * @example
 * ```typescript
 * const city1: [number, number] = [125.5, 45.2];
 * const city2: [number, number] = [130.0, 42.5];
 * const distanceKm = calculateDistance(city1, city2, "kilometers");
 * const distanceMi = calculateDistance(city1, city2, "miles");
 * console.log(`Distance: ${distanceKm.toFixed(2)} km (${distanceMi.toFixed(2)} mi)`);
 * ```
 */
export function calculateDistance(
  point1: [number, number],
  point2: [number, number],
  units: DistanceUnits = "kilometers"
): number {
  try {
    // Validate coordinates
    const coord1Valid = validateCoordinates(point1);
    const coord2Valid = validateCoordinates(point2);

    if (!coord1Valid.valid || !coord2Valid.valid) {
      return 0;
    }

    // Create Turf points
    const from = turf.point(point1);
    const to = turf.point(point2);

    // Calculate Earth-scale distance
    const earthScaleDistance = turf.distance(from, to, { units });

    // Apply IxEarth scale factor (1.4777x)
    // Distance scales linearly with the scale factor
    const ixEarthDistance = earthScaleDistance * IXEARTH_SCALE_SYSTEM.ixearthScaleFactor;

    return ixEarthDistance;
  } catch (error) {
    console.error("Distance calculation error:", error);
    return 0;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Simplifies a polygon geometry to reduce vertex count.
 *
 * Uses Turf's simplify algorithm with a tolerance parameter.
 * Higher tolerance = more simplification = fewer vertices.
 *
 * @param feature - The geometry to simplify
 * @param tolerance - Simplification tolerance (0.001 = moderate, 0.01 = aggressive)
 * @param highQuality - Use high-quality simplification (slower but better)
 * @returns Simplified feature
 *
 * @example
 * ```typescript
 * const complex = { type: "Feature", geometry: {...}, properties: {...} };
 * const simplified = simplifyGeometry(complex, 0.001, true);
 * console.log(`Reduced from ${complex.geometry.coordinates[0].length} to ${simplified.geometry.coordinates[0].length} vertices`);
 * ```
 */
export function simplifyGeometry(
  feature: Feature<Polygon | MultiPolygon>,
  tolerance = 0.001,
  highQuality = true
): Feature<Polygon | MultiPolygon> {
  try {
    return turf.simplify(feature, {
      tolerance,
      highQuality,
      mutate: false,
    }) as Feature<Polygon | MultiPolygon>;
  } catch (error) {
    console.error("Geometry simplification error:", error);
    return feature; // Return original on error
  }
}

/**
 * Checks if a point is within a polygon geometry.
 *
 * @param point - Coordinate to check [longitude, latitude]
 * @param polygon - Polygon or MultiPolygon feature
 * @returns True if point is inside polygon
 *
 * @example
 * ```typescript
 * const cityLocation: [number, number] = [125.5, 45.2];
 * const country = { type: "Feature", geometry: {...}, properties: {...} };
 * const isInside = pointInPolygon(cityLocation, country);
 * console.log(`City is ${isInside ? "inside" : "outside"} country`);
 * ```
 */
export function pointInPolygon(
  point: [number, number],
  polygon: Feature<Polygon | MultiPolygon>
): boolean {
  try {
    const pt = turf.point(point);
    return turf.booleanPointInPolygon(pt, polygon);
  } catch (error) {
    console.error("Point-in-polygon check error:", error);
    return false;
  }
}

/**
 * Calculates the bounding box of a geometry.
 *
 * Returns [minLng, minLat, maxLng, maxLat] bbox array.
 *
 * @param feature - The geometry to bound
 * @returns Bounding box coordinates
 *
 * @example
 * ```typescript
 * const subdivision = { type: "Feature", geometry: {...}, properties: {...} };
 * const bbox = getBoundingBox(subdivision);
 * console.log(`Bounds: ${bbox[0]},${bbox[1]} to ${bbox[2]},${bbox[3]}`);
 * ```
 */
export function getBoundingBox(
  feature: Feature<Polygon | MultiPolygon>
): [number, number, number, number] {
  try {
    return turf.bbox(feature) as [number, number, number, number];
  } catch (error) {
    console.error("Bounding box calculation error:", error);
    return [0, 0, 0, 0];
  }
}

/**
 * Calculates the centroid (center point) of a geometry.
 *
 * @param feature - The geometry to find the center of
 * @returns Centroid coordinates [longitude, latitude]
 *
 * @example
 * ```typescript
 * const subdivision = { type: "Feature", geometry: {...}, properties: {...} };
 * const center = getCentroid(subdivision);
 * console.log(`Center: ${center[0]}, ${center[1]}`);
 * ```
 */
export function getCentroid(
  feature: Feature<Polygon | MultiPolygon>
): [number, number] {
  try {
    const centroid = turf.centroid(feature);
    return centroid.geometry.coordinates as [number, number];
  } catch (error) {
    console.error("Centroid calculation error:", error);
    return [0, 0];
  }
}

// =============================================================================
// COMPREHENSIVE VALIDATION
// =============================================================================

/**
 * Performs all validation checks on a geometry.
 *
 * Runs all validation functions and returns a comprehensive report.
 * Useful for pre-flight checks before saving geometry to database.
 *
 * @param feature - The geometry to validate
 * @param type - Type of geometry (subdivision, city, poi)
 * @param countryBoundary - Optional country boundary to check containment
 * @param existingFeatures - Optional existing features to check overlaps
 * @returns Comprehensive validation report
 *
 * @example
 * ```typescript
 * const subdivision = { type: "Feature", geometry: {...}, properties: {...} };
 * const country = { type: "Feature", geometry: {...}, properties: {...} };
 * const existing = [...]; // Other subdivisions
 *
 * const report = validateGeometryComprehensive(
 *   subdivision,
 *   "subdivision",
 *   country,
 *   existing
 * );
 *
 * if (!report.isValid) {
 *   console.error("Validation failed:", report.errors);
 * }
 * if (report.warnings.length > 0) {
 *   console.warn("Warnings:", report.warnings);
 * }
 * ```
 */
export function validateGeometryComprehensive(
  feature: Feature<Polygon | MultiPolygon>,
  type: GeometryType,
  countryBoundary?: Feature<Polygon | MultiPolygon>,
  existingFeatures?: Feature<Polygon | MultiPolygon>[]
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, unknown> = {};

  // 1. Topology validation
  const topologyResult = validateTopology(feature);
  if (!topologyResult.valid) {
    errors.push(...topologyResult.issues);
  }

  // 2. Vertex count validation
  const vertexResult = validateVertexCount(feature);
  metadata.vertexCount = vertexResult.count;
  if (!vertexResult.valid) {
    errors.push(vertexResult.error || "Invalid vertex count");
  } else if (vertexResult.warning) {
    warnings.push(vertexResult.warning);
  }

  // 3. Area validation
  const areaResult = validateMinMaxArea(feature, type);
  const areaCalc = calculateArea(feature);
  metadata.areaSqKm = areaCalc.ixEarthAreaSqKm;
  metadata.areaSqMi = areaCalc.ixEarthAreaSqMi;
  if (!areaResult.valid) {
    errors.push(areaResult.error || "Invalid area");
  } else if (areaResult.warning) {
    warnings.push(areaResult.warning);
  }

  // 4. Boundary containment (if provided)
  if (countryBoundary) {
    const containmentResult = validateBoundaryContainment(feature, countryBoundary);
    if (!containmentResult.valid) {
      errors.push(containmentResult.error || "Boundary containment failed");
    }
  }

  // 5. Overlap validation (if provided)
  if (existingFeatures && existingFeatures.length > 0) {
    const overlapResult = validateOverlap(feature, existingFeatures);
    if (!overlapResult.valid) {
      errors.push(overlapResult.error || "Overlap detected");
      metadata.overlaps = overlapResult.overlaps;
    }
  }

  // 6. Calculate bounding box and centroid
  metadata.bbox = getBoundingBox(feature);
  metadata.centroid = getCentroid(feature);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata,
  };
}
