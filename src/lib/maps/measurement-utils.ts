/**
 * Measurement Utilities
 *
 * Utility functions for distance and area measurements in MapLibre GL.
 * Provides coordinate transformations, distance calculations, and formatting.
 *
 * @module measurement-utils
 */

import * as turf from "@turf/turf";
import { IXEARTH_SCALE_SYSTEM } from "../ixearth-constants";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Conversion factor from kilometers to miles */
export const KM_TO_MILES = 0.621371;

/** Conversion factor from square kilometers to square miles */
export const SQ_KM_TO_SQ_MILES = 0.386102;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface LngLat {
  lng: number;
  lat: number;
}

// =============================================================================
// DISTANCE CALCULATIONS
// =============================================================================

/**
 * Calculates the distance between two lng/lat points using IxEarth scale.
 *
 * @param point1 - First point with lng and lat properties
 * @param point2 - Second point with lng and lat properties
 * @returns Distance in kilometers (IxEarth-scaled)
 *
 * @example
 * ```typescript
 * const distance = calculateDistanceFromLngLat(
 *   { lng: 125.5, lat: 45.2 },
 *   { lng: 126.0, lat: 45.8 }
 * );
 * console.log(`Distance: ${distance.toFixed(2)} km`);
 * ```
 */
export function calculateDistanceFromLngLat(point1: LngLat, point2: LngLat): number {
  try {
    const from = turf.point([point1.lng, point1.lat]);
    const to = turf.point([point2.lng, point2.lat]);

    // Calculate Earth-scale distance in kilometers
    const earthScaleDistance = turf.distance(from, to, { units: "kilometers" });

    // Apply IxEarth scale factor (1.4777x)
    const ixEarthDistance = earthScaleDistance * IXEARTH_SCALE_SYSTEM.ixearthScaleFactor;

    return ixEarthDistance;
  } catch (error) {
    console.error("Distance calculation error:", error);
    return 0;
  }
}

/**
 * Calculates the total distance of a polyline (sequence of points).
 *
 * Sums the distances between consecutive points using IxEarth scale.
 *
 * @param points - Array of lng/lat points defining the polyline
 * @returns Total distance in kilometers (IxEarth-scaled)
 *
 * @example
 * ```typescript
 * const route = [
 *   { lng: 125.5, lat: 45.2 },
 *   { lng: 126.0, lat: 45.8 },
 *   { lng: 126.5, lat: 46.1 }
 * ];
 * const totalDistance = calculatePolylineDistance(route);
 * console.log(`Route length: ${totalDistance.toFixed(2)} km`);
 * ```
 */
export function calculatePolylineDistance(points: LngLat[]): number {
  if (points.length < 2) return 0;

  try {
    let totalDistance = 0;

    for (let i = 1; i < points.length; i++) {
      totalDistance += calculateDistanceFromLngLat(points[i - 1]!, points[i]!);
    }

    return totalDistance;
  } catch (error) {
    console.error("Polyline distance calculation error:", error);
    return 0;
  }
}

// =============================================================================
// AREA CALCULATIONS
// =============================================================================

/**
 * Calculates the area of a polygon defined by a sequence of points.
 *
 * Automatically closes the polygon if the first and last points don't match.
 * Uses IxEarth scale factor for area calculations.
 *
 * @param points - Array of lng/lat points defining the polygon boundary
 * @returns Area in square kilometers (IxEarth-scaled)
 *
 * @example
 * ```typescript
 * const boundary = [
 *   { lng: 125.0, lat: 45.0 },
 *   { lng: 126.0, lat: 45.0 },
 *   { lng: 126.0, lat: 46.0 },
 *   { lng: 125.0, lat: 46.0 }
 * ];
 * const area = calculatePolygonArea(boundary);
 * console.log(`Area: ${area.toFixed(2)} km²`);
 * ```
 */
export function calculatePolygonArea(points: LngLat[]): number {
  if (points.length < 3) return 0;

  try {
    // Convert points to coordinate array
    const coordinates: [number, number][] = points.map((p) => [p.lng, p.lat]);

    // Close the polygon if not already closed
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first![0] !== last![0] || first![1] !== last![1]) {
      coordinates.push([first![0], first![1]]);
    }

    // Create polygon feature
    const polygon = turf.polygon([coordinates]);

    // Calculate Earth-scale area in square kilometers
    const earthScaleAreaSqKm = turf.area(polygon) / 1_000_000; // Convert m² to km²

    // Apply IxEarth scale factor squared (area scales with scale²)
    const scaleFactor = IXEARTH_SCALE_SYSTEM.ixearthScaleFactor;
    const ixEarthAreaSqKm = earthScaleAreaSqKm * (scaleFactor * scaleFactor);

    return ixEarthAreaSqKm;
  } catch (error) {
    console.error("Polygon area calculation error:", error);
    return 0;
  }
}

// =============================================================================
// SCALE CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculates the map scale ratio at a given latitude and zoom level.
 *
 * Returns the scale as a fraction (e.g., 0.000001 for 1:1,000,000).
 * Uses Web Mercator projection calculations.
 *
 * @param latitude - Latitude in degrees (-90 to 90)
 * @param zoom - Map zoom level (0-22)
 * @returns Scale ratio (map units / real-world units)
 *
 * @example
 * ```typescript
 * const scale = calculateScaleAtZoom(45.5, 10);
 * const ratio = Math.round(1 / scale);
 * console.log(`Scale: 1:${ratio.toLocaleString()}`);
 * ```
 */
export function calculateScaleAtZoom(latitude: number, zoom: number): number {
  // Web Mercator scale calculation
  // At zoom 0, the world is 256 pixels wide
  // Each zoom level doubles the resolution
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);

  // Apply IxEarth scale factor
  const ixEarthMetersPerPixel = metersPerPixel * IXEARTH_SCALE_SYSTEM.ixearthScaleFactor;

  // Convert to scale ratio (pixels per meter)
  return 1 / ixEarthMetersPerPixel;
}

/**
 * Calculates kilometers per pixel for a given projection, zoom, and latitude.
 *
 * Supports different map projections with appropriate scale calculations.
 *
 * @param projection - Map projection type
 * @param zoom - Map zoom level
 * @param latitude - Latitude in degrees
 * @returns Object with kmPerPixel and scale ratio
 *
 * @example
 * ```typescript
 * const { kmPerPixel, scale } = getScaleForProjection('mercator', 10, 45.5);
 * console.log(`At zoom ${zoom}: ${kmPerPixel} km per pixel`);
 * ```
 */
export function getScaleForProjection(
  projection: "mercator" | "globe" | "equalEarth",
  zoom: number,
  latitude: number
): { kmPerPixel: number; scale: number } {
  // Base calculation for Mercator projection
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);

  // Apply projection-specific adjustments
  let adjustedMetersPerPixel = metersPerPixel;

  switch (projection) {
    case "globe":
      // Globe projection has consistent scale at all latitudes when zoomed out
      if (zoom < 5) {
        adjustedMetersPerPixel = 156543.03392 / Math.pow(2, zoom);
      }
      break;
    case "equalEarth":
      // Equal Earth preserves area but distorts scale
      // Approximate adjustment for mid-latitudes
      const latAdjustment = 1 + Math.abs(latitude) / 180;
      adjustedMetersPerPixel = metersPerPixel * latAdjustment;
      break;
    case "mercator":
    default:
      // Standard Mercator - no adjustment needed
      break;
  }

  // Apply IxEarth scale factor
  const ixEarthMetersPerPixel = adjustedMetersPerPixel * IXEARTH_SCALE_SYSTEM.ixearthScaleFactor;
  const kmPerPixel = ixEarthMetersPerPixel / 1000;
  const scale = 1 / ixEarthMetersPerPixel;

  return { kmPerPixel, scale };
}

/**
 * Rounds a distance to a nice round number for scale bar display.
 *
 * Selects appropriate intervals (1, 2, 5, 10, 20, 50, 100, etc.) to ensure
 * the scale bar shows clean, readable values.
 *
 * @param targetKm - Target distance in kilometers
 * @returns Nice rounded distance
 *
 * @example
 * ```typescript
 * getNiceScaleDistance(7.3);   // 5
 * getNiceScaleDistance(0.73);  // 0.5
 * getNiceScaleDistance(130);   // 100
 * ```
 */
export function getNiceScaleDistance(targetKm: number): number {
  // Nice round numbers for scale bars
  const niceNumbers = [
    0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
    2000, 5000, 10000,
  ];

  // Find the closest nice number that's less than or equal to target
  for (let i = niceNumbers.length - 1; i >= 0; i--) {
    if (niceNumbers[i]! <= targetKm) {
      return niceNumbers[i]!;
    }
  }

  // If target is smaller than smallest nice number, return it
  return niceNumbers[0]!;
}

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

/**
 * Formats a distance value for display.
 *
 * Automatically selects appropriate units (m/km or ft/mi) based on magnitude.
 * Shows both metric and imperial units by default.
 *
 * @param distanceKm - Distance in kilometers
 * @param showBothUnits - Whether to show both metric and imperial (default: true)
 * @returns Formatted distance string
 *
 * @example
 * ```typescript
 * formatDistance(0.523, true);  // "523 m (1,716 ft)"
 * formatDistance(15.7, true);   // "15.70 km (9.75 mi)"
 * formatDistance(15.7, false);  // "15.70 km"
 * ```
 */
export function formatDistance(distanceKm: number, showBothUnits = true): string {
  if (distanceKm < 0.01) {
    // Less than 10 meters - show in meters
    const meters = distanceKm * 1000;
    const feet = meters * 3.28084;
    return showBothUnits
      ? `${meters.toFixed(0)} m (${feet.toFixed(0)} ft)`
      : `${meters.toFixed(0)} m`;
  } else if (distanceKm < 1) {
    // Less than 1 km - show in meters
    const meters = distanceKm * 1000;
    const feet = meters * 3.28084;
    return showBothUnits
      ? `${meters.toFixed(0)} m (${feet.toLocaleString("en-US", { maximumFractionDigits: 0 })} ft)`
      : `${meters.toFixed(0)} m`;
  } else {
    // 1 km or more - show in kilometers
    const miles = distanceKm * KM_TO_MILES;
    return showBothUnits
      ? `${distanceKm.toFixed(2)} km (${miles.toFixed(2)} mi)`
      : `${distanceKm.toFixed(2)} km`;
  }
}

/**
 * Formats an area value for display.
 *
 * Automatically selects appropriate units based on magnitude.
 * Shows both metric and imperial units by default.
 *
 * @param areaSqKm - Area in square kilometers
 * @param showBothUnits - Whether to show both metric and imperial (default: true)
 * @returns Formatted area string
 *
 * @example
 * ```typescript
 * formatArea(0.00052, true);  // "520 m² (5,598 ft²)"
 * formatArea(1.5, true);      // "1.50 km² (0.58 mi²)"
 * formatArea(1500, true);     // "1,500.00 km² (579.15 mi²)"
 * ```
 */
export function formatArea(areaSqKm: number, showBothUnits = true): string {
  if (areaSqKm < 0.01) {
    // Less than 0.01 km² - show in m²
    const sqMeters = areaSqKm * 1_000_000;
    const sqFeet = sqMeters * 10.7639;
    return showBothUnits
      ? `${sqMeters.toFixed(0)} m² (${sqFeet.toLocaleString("en-US", { maximumFractionDigits: 0 })} ft²)`
      : `${sqMeters.toFixed(0)} m²`;
  } else if (areaSqKm < 1) {
    // Less than 1 km² - show in m²
    const sqMeters = areaSqKm * 1_000_000;
    const sqFeet = sqMeters * 10.7639;
    return showBothUnits
      ? `${sqMeters.toLocaleString("en-US", { maximumFractionDigits: 0 })} m² (${sqFeet.toLocaleString("en-US", { maximumFractionDigits: 0 })} ft²)`
      : `${sqMeters.toLocaleString("en-US", { maximumFractionDigits: 0 })} m²`;
  } else {
    // 1 km² or more - show in km²
    const sqMiles = areaSqKm * SQ_KM_TO_SQ_MILES;
    return showBothUnits
      ? `${areaSqKm.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km² (${sqMiles.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi²)`
      : `${areaSqKm.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`;
  }
}

// =============================================================================
// GEOJSON CONVERSION FUNCTIONS
// =============================================================================

/**
 * Converts an array of coordinate tuples to a GeoJSON LineString feature.
 *
 * @param coordinates - Array of [lng, lat] coordinate pairs
 * @returns GeoJSON LineString feature
 *
 * @example
 * ```typescript
 * const coords: [number, number][] = [[125.5, 45.2], [126.0, 45.8]];
 * const lineFeature = coordsToLineString(coords);
 * map.addSource('route', { type: 'geojson', data: lineFeature });
 * ```
 */
export function coordsToLineString(coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: coordinates,
    },
  };
}

/**
 * Converts an array of coordinate tuples to a GeoJSON Polygon feature.
 *
 * Automatically closes the polygon if the first and last coordinates don't match.
 *
 * @param coordinates - Array of [lng, lat] coordinate pairs
 * @returns GeoJSON Polygon feature
 *
 * @example
 * ```typescript
 * const coords: [number, number][] = [
 *   [125.0, 45.0],
 *   [126.0, 45.0],
 *   [126.0, 46.0],
 *   [125.0, 46.0]
 * ];
 * const polygonFeature = coordsToPolygon(coords);
 * map.addSource('area', { type: 'geojson', data: polygonFeature });
 * ```
 */
export function coordsToPolygon(coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.Polygon> {
  // Close the polygon if not already closed
  const coords = [...coordinates];
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first![0] !== last![0] || first![1] !== last![1]) {
    coords.push([first![0], first![1]]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

/**
 * Converts an array of coordinate tuples to an array of GeoJSON Point features.
 *
 * Each coordinate pair becomes a separate Point feature with an index property.
 *
 * @param coordinates - Array of [lng, lat] coordinate pairs
 * @returns Array of GeoJSON Point features
 *
 * @example
 * ```typescript
 * const coords: [number, number][] = [[125.5, 45.2], [126.0, 45.8]];
 * const pointFeatures = coordsToPoints(coords);
 * map.addSource('markers', {
 *   type: 'geojson',
 *   data: { type: 'FeatureCollection', features: pointFeatures }
 * });
 * ```
 */
export function coordsToPoints(coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.Point>[] {
  return coordinates.map((coord, index) => ({
    type: "Feature",
    properties: { index },
    geometry: {
      type: "Point",
      coordinates: coord,
    },
  }));
}
