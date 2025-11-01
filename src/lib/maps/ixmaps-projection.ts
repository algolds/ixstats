/**
 * IxMaps Custom Coordinate System for IxStats
 *
 * This module provides a custom geographic projection adapted from the IxMaps system
 * for use with d3-geo-based mapping libraries. It implements a modified equirectangular
 * (Plate Carrée) projection with a custom prime meridian offset.
 *
 * Key characteristics:
 * - Linear projection: Equal spacing for latitude/longitude lines
 * - Custom prime meridian: Offset by 30 degrees longitude (IxEarth convention)
 * - Direct coordinate transformation: No complex trigonometric calculations
 * - Compatible with d3-geo projection interface
 *
 * Source: Ported from /ixwiki/public/maps/ixmaps-new/src/lib/coordinates-system.ts
 *
 * @module ixmaps-projection
 */

/**
 * IxMaps projection configuration parameters
 *
 * These parameters define the custom coordinate reference system used by IxEarth,
 * adapted from the SVG-based IxMaps system to work with standard geographic projections.
 */
export interface IxMapsProjectionConfig {
  /**
   * Reference longitude for the prime meridian in IxEarth coordinate system.
   * Standard value is 30 degrees, representing the IxEarth prime meridian offset
   * from the real-world Greenwich meridian.
   *
   * @default 30
   */
  primeMeridianReferenceLng: number;

  /**
   * Scale factor for pixel-to-degree conversion in longitude.
   * Determines horizontal spacing between longitude lines.
   *
   * In IxMaps, this is calculated from the SVG dimensions:
   * ORIGINAL_PIXELS_PER_LNG = 45.5666 * EFFECTIVE_SCALE_X = ~4.5181
   *
   * @default 4.5181
   */
  pixelsPerLongitude: number;

  /**
   * Scale factor for pixel-to-degree conversion in latitude.
   * Determines vertical spacing between latitude lines.
   *
   * In IxMaps, this is calculated from the SVG dimensions:
   * ORIGINAL_PIXELS_PER_LAT = 27.2222 * EFFECTIVE_SCALE_Y = ~3.4091
   *
   * @default 3.4091
   */
  pixelsPerLatitude: number;

  /**
   * SVG Y-coordinate of the equator (0° latitude).
   * Used as the reference point for latitude calculations.
   *
   * @default 306.81
   */
  equatorY: number;

  /**
   * SVG X-coordinate of the prime meridian.
   * Used as the reference point for longitude calculations.
   *
   * @default 474.56
   */
  primeMeridianX: number;
}

/**
 * Default IxMaps projection configuration
 *
 * These values are derived from the IxMaps master map SVG with effective scaling applied:
 * - EFFECTIVE_SCALE_X = 0.099156
 * - EFFECTIVE_SCALE_Y = 0.125229
 * - ORIGINAL_SVG_WIDTH = 8200
 * - ORIGINAL_SVG_HEIGHT = 4900
 */
export const DEFAULT_IXMAPS_CONFIG: IxMapsProjectionConfig = {
  primeMeridianReferenceLng: 30,
  pixelsPerLongitude: 4.5181,
  pixelsPerLatitude: 3.4091,
  equatorY: 306.81,
  primeMeridianX: 474.56,
};

/**
 * Coordinate pair type for geographic coordinates
 */
export type GeoCoordinates = [longitude: number, latitude: number];

/**
 * Coordinate pair type for projected pixel coordinates
 */
export type ProjectedCoordinates = [x: number, y: number];

/**
 * Creates an IxMaps projection function compatible with d3-geo
 *
 * The IxMaps projection is a custom linear projection (similar to equirectangular/Plate Carrée)
 * with the following key differences from standard projections:
 *
 * 1. **Custom Prime Meridian**: Instead of Greenwich (0°), IxEarth uses 30° as the reference
 *    meridian. All longitude calculations are relative to this offset.
 *
 * 2. **Linear Transformation**: Unlike conformal projections (Mercator) or equal-area projections
 *    (Lambert), this uses direct linear scaling without trigonometric adjustments. This makes
 *    it computationally efficient but introduces area/shape distortions.
 *
 * 3. **SVG-Space Mapping**: The projection maps geographic coordinates directly to SVG pixel
 *    space using fixed scale factors (pixelsPerLongitude, pixelsPerLatitude).
 *
 * 4. **Inverted Y-Axis**: Following SVG conventions, higher latitudes result in lower Y values
 *    (moving "up" from the equator).
 *
 * @param config - Projection configuration parameters (uses defaults if not provided)
 * @returns A projection function that transforms [lng, lat] to [x, y]
 *
 * @example
 * ```typescript
 * const projection = createIxMapsProjection();
 * const [x, y] = projection([30, 0]); // Prime meridian at equator
 * console.log(x, y); // [474.56, 306.81]
 * ```
 *
 * @see {@link latLngToPixel} for the underlying transformation logic
 */
export function createIxMapsProjection(
  config: Partial<IxMapsProjectionConfig> = {}
): (coordinates: GeoCoordinates) => ProjectedCoordinates {
  const fullConfig: IxMapsProjectionConfig = {
    ...DEFAULT_IXMAPS_CONFIG,
    ...config,
  };

  return (coordinates: GeoCoordinates): ProjectedCoordinates => {
    const [lng, lat] = coordinates;
    return latLngToPixel(lat, lng, fullConfig);
  };
}

/**
 * Converts geographic coordinates (latitude, longitude) to pixel coordinates (x, y)
 *
 * This is the core transformation function implementing the IxMaps custom projection.
 * It performs a linear mapping from spherical geographic coordinates to 2D pixel space.
 *
 * **Mathematical Transformation:**
 * ```
 * y = equatorY - (lat * pixelsPerLatitude)
 * x = primeMeridianX + ((lng - primeMeridianReferenceLng) * pixelsPerLongitude)
 * ```
 *
 * **Y-Axis Calculation:**
 * - Positive latitudes (north) decrease Y (move up from equator)
 * - Negative latitudes (south) increase Y (move down from equator)
 * - Example: lat=10° → y = 306.81 - (10 * 3.4091) = 272.72
 *
 * **X-Axis Calculation:**
 * - Longitude is offset from the custom prime meridian (30°)
 * - East of 30° increases X (move right)
 * - West of 30° decreases X (move left)
 * - Example: lng=60° → x = 474.56 + ((60-30) * 4.5181) = 610.10
 *
 * @param lat - Latitude in decimal degrees (-90 to +90)
 * @param lng - Longitude in decimal degrees (-180 to +180)
 * @param config - Projection configuration
 * @returns Pixel coordinates [x, y]
 * @throws {Error} If config parameters are invalid (zero scale factors)
 *
 * @example
 * ```typescript
 * // Prime meridian at equator
 * const [x, y] = latLngToPixel(0, 30, DEFAULT_IXMAPS_CONFIG);
 * // x ≈ 474.56, y ≈ 306.81
 *
 * // North pole at prime meridian
 * const [x2, y2] = latLngToPixel(90, 30, DEFAULT_IXMAPS_CONFIG);
 * // x ≈ 474.56, y ≈ 0 (top of map)
 * ```
 */
export function latLngToPixel(
  lat: number,
  lng: number,
  config: IxMapsProjectionConfig
): ProjectedCoordinates {
  const {
    equatorY,
    pixelsPerLatitude,
    primeMeridianX,
    pixelsPerLongitude,
    primeMeridianReferenceLng,
  } = config;

  // Validate scale factors to prevent division by zero
  if (pixelsPerLatitude === 0 || pixelsPerLongitude === 0) {
    throw new Error(
      'IxMaps projection error: pixelsPerLatitude and pixelsPerLongitude cannot be zero'
    );
  }

  // Calculate Y: Higher latitude means lower Y value (SVG coordinate system)
  const y = equatorY - lat * pixelsPerLatitude;

  // Calculate X: Offset from prime meridian based on longitude difference
  const x = primeMeridianX + (lng - primeMeridianReferenceLng) * pixelsPerLongitude;

  return [x, y];
}

/**
 * Converts pixel coordinates (x, y) to geographic coordinates (latitude, longitude)
 *
 * This is the inverse transformation of latLngToPixel, used for reverse geocoding
 * and coordinate system conversions (e.g., mouse click to geographic position).
 *
 * **Inverse Mathematical Transformation:**
 * ```
 * lat = (equatorY - y) / pixelsPerLatitude
 * lng = ((x - primeMeridianX) / pixelsPerLongitude) + primeMeridianReferenceLng
 * ```
 *
 * @param x - Pixel X coordinate
 * @param y - Pixel Y coordinate
 * @param config - Projection configuration
 * @returns Geographic coordinates [longitude, latitude]
 * @throws {Error} If config parameters are invalid (zero scale factors)
 *
 * @example
 * ```typescript
 * // Click at center of map
 * const [lng, lat] = pixelToLatLng(474.56, 306.81, DEFAULT_IXMAPS_CONFIG);
 * // lng ≈ 30, lat ≈ 0 (prime meridian at equator)
 *
 * // Click at top-left corner
 * const [lng2, lat2] = pixelToLatLng(0, 0, DEFAULT_IXMAPS_CONFIG);
 * // lng ≈ -75, lat ≈ 90
 * ```
 */
export function pixelToLatLng(
  x: number,
  y: number,
  config: IxMapsProjectionConfig
): GeoCoordinates {
  const {
    equatorY,
    pixelsPerLatitude,
    primeMeridianX,
    pixelsPerLongitude,
    primeMeridianReferenceLng,
  } = config;

  // Validate scale factors
  if (pixelsPerLatitude === 0 || pixelsPerLongitude === 0) {
    throw new Error(
      'IxMaps projection error: pixelsPerLatitude and pixelsPerLongitude cannot be zero'
    );
  }

  // Calculate latitude: Higher Y means lower latitude
  const lat = (equatorY - y) / pixelsPerLatitude;

  // Calculate longitude: Pixel offset from prime meridian, adjusted by reference longitude
  const lng = (x - primeMeridianX) / pixelsPerLongitude + primeMeridianReferenceLng;

  return [lng, lat];
}

/**
 * Formats a latitude value to a human-readable string
 *
 * @param lat - Latitude in decimal degrees
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "45.67° N" or "23.12° S")
 *
 * @example
 * ```typescript
 * formatLatitude(45.6789, 2); // "45.68° N"
 * formatLatitude(-23.1234, 3); // "23.123° S"
 * formatLatitude(NaN); // "---"
 * ```
 */
export function formatLatitude(lat: number, precision: number = 2): string {
  if (typeof lat !== 'number' || isNaN(lat)) return '---';
  const direction = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(precision)}° ${direction}`;
}

/**
 * Formats a longitude value to a human-readable string
 *
 * @param lng - Longitude in decimal degrees
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "120.12° E" or "45.67° W")
 *
 * @example
 * ```typescript
 * formatLongitude(120.123, 2); // "120.12° E"
 * formatLongitude(-45.678, 3); // "45.678° W"
 * formatLongitude(NaN); // "---"
 * ```
 */
export function formatLongitude(lng: number, precision: number = 2): string {
  if (typeof lng !== 'number' || isNaN(lng)) return '---';
  const direction = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lng).toFixed(precision)}° ${direction}`;
}

/**
 * Calculates the great-circle distance between two points using the Haversine formula
 *
 * The Haversine formula calculates the shortest distance over Earth's surface,
 * giving an "as-the-crow-flies" distance between points (ignoring any terrain).
 *
 * **Note:** This uses real-world Earth radius constants, not IxEarth scaling.
 * For accurate IxEarth distances, you may need to apply custom scaling factors.
 *
 * @param lat1 - Latitude of first point (degrees)
 * @param lng1 - Longitude of first point (degrees)
 * @param lat2 - Latitude of second point (degrees)
 * @param lng2 - Longitude of second point (degrees)
 * @param unit - Output unit: 'km' (kilometers) or 'miles' (default: 'km')
 * @returns Distance in specified units, or NaN if inputs are invalid
 *
 * @example
 * ```typescript
 * // Distance from New York to London (real-world)
 * const distKm = calculateDistance(40.7128, -74.0060, 51.5074, -0.1278, 'km');
 * console.log(distKm); // ~5570 km
 *
 * // Distance from Kirav to Burgundie (IxEarth)
 * const distMiles = calculateDistance(45.5, 30.0, 50.0, 35.0, 'miles');
 * console.log(distMiles); // ~350 miles
 * ```
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: 'km' | 'miles' = 'km'
): number {
  // Validate inputs
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return NaN;
  }

  // Earth radius constants
  const EARTH_RADIUS = {
    km: 6371, // Earth radius in kilometers
    miles: 3959, // Earth radius in miles
  };

  const radius = EARTH_RADIUS[unit];

  // Convert degrees to radians
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}

/**
 * Creates an inversion function for the IxMaps projection
 *
 * Returns a function that converts pixel coordinates back to geographic coordinates.
 * This is useful for implementing d3-geo projection.invert() functionality.
 *
 * @param config - Projection configuration parameters (uses defaults if not provided)
 * @returns An inversion function that transforms [x, y] to [lng, lat]
 *
 * @example
 * ```typescript
 * const projection = createIxMapsProjection();
 * const invert = createIxMapsInversion();
 *
 * // Project forward
 * const [x, y] = projection([30, 45]);
 *
 * // Project backward
 * const [lng, lat] = invert([x, y]);
 * console.log(lng, lat); // [30, 45]
 * ```
 */
export function createIxMapsInversion(
  config: Partial<IxMapsProjectionConfig> = {}
): (coordinates: ProjectedCoordinates) => GeoCoordinates {
  const fullConfig: IxMapsProjectionConfig = {
    ...DEFAULT_IXMAPS_CONFIG,
    ...config,
  };

  return (coordinates: ProjectedCoordinates): GeoCoordinates => {
    const [x, y] = coordinates;
    return pixelToLatLng(x, y, fullConfig);
  };
}

/**
 * Type guard to check if coordinates are valid geographic coordinates
 *
 * @param coords - Coordinates to validate
 * @returns True if coordinates are valid [lng, lat] within valid ranges
 */
export function isValidGeoCoordinates(coords: unknown): coords is GeoCoordinates {
  if (!Array.isArray(coords) || coords.length !== 2) return false;

  const [lng, lat] = coords;

  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    !isNaN(lng) &&
    !isNaN(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Type guard to check if coordinates are valid projected pixel coordinates
 *
 * @param coords - Coordinates to validate
 * @returns True if coordinates are valid [x, y] numbers
 */
export function isValidProjectedCoordinates(coords: unknown): coords is ProjectedCoordinates {
  if (!Array.isArray(coords) || coords.length !== 2) return false;

  const [x, y] = coords;

  return typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y);
}
