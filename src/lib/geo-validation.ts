/**
 * Unified Geo-Validation Library
 *
 * Server-side validation functions for all geographic feature operations.
 * Replaces scattered catch-all patterns in geo.ts with explicit,
 * differentiated error handling.
 */

import type { PrismaClient } from "@prisma/client";
import type { Geometry } from "geojson";
import { TRPCError } from "@trpc/server";

// ──────────────────────────────────────────────
// Coordinate Validation
// ──────────────────────────────────────────────

/**
 * Validate that coordinates are within valid WGS84 bounds.
 * Throws TRPCError BAD_REQUEST if invalid.
 */
export function validateCoordinateBounds(lng: number, lat: number): void {
  if (lng < -180 || lng > 180) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid longitude: ${lng}. Must be between -180 and 180.`,
    });
  }
  if (lat < -90 || lat > 90) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid latitude: ${lat}. Must be between -90 and 90.`,
    });
  }
}

/**
 * Validate all positions in a GeoJSON geometry are within WGS84 bounds.
 * Throws TRPCError BAD_REQUEST on first invalid coordinate found.
 */
export function validateGeometryBounds(geometry: Geometry): void {
  const positions = extractAllPositions(geometry);
  for (const [lng, lat] of positions) {
    validateCoordinateBounds(lng, lat);
  }
}

// ──────────────────────────────────────────────
// PostGIS Availability
// ──────────────────────────────────────────────

let _postgisAvailable: boolean | null = null;

/**
 * One-time probe to check if PostGIS is available.
 * Result is cached for the process lifetime.
 */
export async function isPostGISAvailable(db: PrismaClient): Promise<boolean> {
  if (_postgisAvailable !== null) return _postgisAvailable;
  try {
    await db.$queryRawUnsafe<unknown[]>(`SELECT PostGIS_Version()`);
    _postgisAvailable = true;
  } catch {
    _postgisAvailable = false;
  }
  return _postgisAvailable;
}

/**
 * Reset PostGIS availability cache (for testing or reconnection).
 */
export function resetPostGISCache(): void {
  _postgisAvailable = null;
}

// ──────────────────────────────────────────────
// Spatial Containment Validation
// ──────────────────────────────────────────────

/**
 * Validate a point is within a country's borders using PostGIS.
 * Throws TRPCError with differentiated errors:
 * - BAD_REQUEST: Point is outside the country
 * - INTERNAL_SERVER_ERROR: PostGIS query failed (not silently ignored)
 */
export async function validatePointContainment(
  db: PrismaClient,
  countryId: string,
  lng: number,
  lat: number,
  featureLabel = "Feature"
): Promise<void> {
  validateCoordinateBounds(lng, lat);

  if (!(await isPostGISAvailable(db))) {
    console.warn(
      `[geo-validation] PostGIS not available — skipping containment check for ${featureLabel}`
    );
    return;
  }

  try {
    const result = await db.$queryRawUnsafe<Array<{ is_inside: boolean }>>(
      `SELECT ST_Contains(
         (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
         ST_SetSRID(ST_MakePoint($2, $3), 4326)
       ) as is_inside`,
      countryId,
      lng,
      lat
    );

    if (!result[0]?.is_inside) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${featureLabel} location must be within your country's borders`,
      });
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    console.error(`[geo-validation] PostGIS containment query failed:`, err);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Spatial validation failed. Please try again.",
    });
  }
}

/**
 * Validate a polygon geometry is within a country's borders using PostGIS.
 * Throws TRPCError with differentiated errors.
 */
export async function validatePolygonContainment(
  db: PrismaClient,
  countryId: string,
  geometry: Geometry | Record<string, unknown>,
  featureLabel = "Feature"
): Promise<void> {
  // Validate coordinate bounds first
  if ("coordinates" in geometry) {
    validateGeometryBounds(geometry as Geometry);
  }

  if (!(await isPostGISAvailable(db))) {
    console.warn(
      `[geo-validation] PostGIS not available — skipping containment check for ${featureLabel}`
    );
    return;
  }

  try {
    const geoJson = JSON.stringify(geometry);
    const result = await db.$queryRawUnsafe<Array<{ is_inside: boolean }>>(
      `SELECT ST_Contains(
         (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
         ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
       ) as is_inside`,
      countryId,
      geoJson
    );

    if (!result[0]?.is_inside) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${featureLabel} must be entirely within your country's borders`,
      });
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    console.error(`[geo-validation] PostGIS polygon containment query failed:`, err);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Spatial validation failed. Please try again.",
    });
  }
}

// ──────────────────────────────────────────────
// Geometry Validity
// ──────────────────────────────────────────────

/**
 * Check if a geometry is valid using PostGIS ST_IsValid.
 * Throws TRPCError BAD_REQUEST with the ST_IsValidReason if invalid.
 */
export async function validateGeometryValid(
  db: PrismaClient,
  geometry: Geometry | Record<string, unknown>
): Promise<void> {
  if (!(await isPostGISAvailable(db))) return;

  try {
    const geoJson = JSON.stringify(geometry);
    const result = await db.$queryRawUnsafe<
      Array<{ is_valid: boolean; reason: string }>
    >(
      `SELECT
         ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as is_valid,
         ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as reason`,
      geoJson
    );

    if (result[0] && !result[0].is_valid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid geometry: ${result[0].reason}`,
      });
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    console.error(`[geo-validation] ST_IsValid query failed:`, err);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Geometry validation failed. Please try again.",
    });
  }
}

// ──────────────────────────────────────────────
// Collision Detection
// ──────────────────────────────────────────────

/**
 * Check if a point feature is too close to an existing feature of the same type.
 * Uses ST_DWithin with ~111m tolerance (0.001 degrees).
 * Throws TRPCError BAD_REQUEST if a collision is found.
 */
export async function checkPointCollision(
  db: PrismaClient,
  table: "city" | "pointOfInterest",
  countryId: string,
  lng: number,
  lat: number,
  excludeId?: string
): Promise<void> {
  if (!(await isPostGISAvailable(db))) return;

  const tableName = table === "city" ? "cities" : "points_of_interest";
  const idColumn = "id";
  const toleranceDegrees = 0.001; // ~111 meters

  try {
    const query = excludeId
      ? `SELECT ${idColumn}, name FROM ${tableName}
         WHERE "countryId" = $1
           AND ${idColumn} != $4
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(
               (coordinates->0)::float,
               (coordinates->1)::float
             ), 4326),
             ST_SetSRID(ST_MakePoint($2, $3), 4326),
             $5
           )
         LIMIT 1`
      : `SELECT ${idColumn}, name FROM ${tableName}
         WHERE "countryId" = $1
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(
               (coordinates->0)::float,
               (coordinates->1)::float
             ), 4326),
             ST_SetSRID(ST_MakePoint($2, $3), 4326),
             $4
           )
         LIMIT 1`;

    const params = excludeId
      ? [countryId, lng, lat, excludeId, toleranceDegrees]
      : [countryId, lng, lat, toleranceDegrees];

    const result = await db.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      query,
      ...params
    );

    if (result.length > 0) {
      const label = table === "city" ? "city" : "point of interest";
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Too close to existing ${label} "${result[0]!.name}". Features must be at least ~100m apart.`,
      });
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    // Collision check is non-critical — log and continue
    console.warn(`[geo-validation] Collision check failed (non-blocking):`, err);
  }
}

// ──────────────────────────────────────────────
// Name Uniqueness
// ──────────────────────────────────────────────

/**
 * Check for duplicate feature names within a country.
 * Throws TRPCError BAD_REQUEST if a duplicate is found.
 */
export async function checkNameUniqueness(
  db: PrismaClient,
  countryId: string,
  name: string,
  featureType: "city" | "subdivision" | "poi" | "storyPin" | "mapLabel",
  excludeId?: string
): Promise<void> {
  const normalizedName = name.trim().toLowerCase();

  let existing: { id: string; name: string } | null = null;

  if (featureType === "city") {
    existing = await db.city.findFirst({
      where: {
        countryId,
        name: { equals: normalizedName, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true },
    });
  } else if (featureType === "subdivision") {
    existing = await db.subdivision.findFirst({
      where: {
        countryId,
        name: { equals: normalizedName, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true },
    });
  } else if (featureType === "poi") {
    existing = await db.pointOfInterest.findFirst({
      where: {
        countryId,
        name: { equals: normalizedName, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true },
    });
  } else if (featureType === "storyPin") {
    existing = await db.storyPin.findFirst({
      where: {
        countryId,
        title: { equals: normalizedName, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, title: true },
    }) as { id: string; name: string } | null;
    if (existing) existing.name = (existing as any).title;
  } else if (featureType === "mapLabel") {
    existing = await db.mapLabel.findFirst({
      where: {
        countryId,
        text: { equals: normalizedName, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, text: true },
    }) as { id: string; name: string } | null;
    if (existing) existing.name = (existing as any).text;
  }

  if (existing) {
    const label =
      featureType === "city"
        ? "city"
        : featureType === "subdivision"
          ? "subdivision"
          : featureType === "storyPin"
            ? "story pin"
            : featureType === "mapLabel"
              ? "map label"
              : "point of interest";
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A ${label} named "${existing.name}" already exists in this country.`,
    });
  }
}

// ──────────────────────────────────────────────
// Shared Geometry Helpers
// ──────────────────────────────────────────────

/**
 * Recursively extract all [lng, lat] positions from a GeoJSON geometry.
 */
function extractAllPositions(geometry: Geometry): [number, number][] {
  const positions: [number, number][] = [];
  function scan(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      positions.push([coords[0] as number, coords[1] as number]);
      return;
    }
    for (const c of coords) scan(c);
  }
  if ("coordinates" in geometry) {
    scan((geometry as { coordinates: unknown }).coordinates);
  }
  return positions;
}

// ──────────────────────────────────────────────
// Geometry Structure Validation (Pure — no DB)
// ──────────────────────────────────────────────

export interface GeometryValidationError {
  type: string;
  message: string;
}

/**
 * Validate basic GeoJSON geometry structure (rings closed, min vertices, etc.).
 * Returns an array of errors (empty if valid).
 */
export function validateGeometryStructure(
  geometry: Geometry
): GeometryValidationError[] {
  const errors: GeometryValidationError[] = [];

  if (!geometry.type) {
    errors.push({ type: "missing_type", message: "Geometry has no type" });
    return errors;
  }

  if (!("coordinates" in geometry)) {
    errors.push({
      type: "missing_coordinates",
      message: "Geometry has no coordinates",
    });
    return errors;
  }

  if (geometry.type === "Polygon") {
    validatePolygonRings(geometry.coordinates, errors);
  } else if (geometry.type === "MultiPolygon") {
    for (let i = 0; i < geometry.coordinates.length; i++) {
      validatePolygonRings(geometry.coordinates[i]!, errors, `polygon[${i}]`);
    }
  }

  return errors;
}

function validatePolygonRings(
  rings: number[][][],
  errors: GeometryValidationError[],
  prefix = ""
): void {
  if (!rings || rings.length === 0) {
    errors.push({
      type: "empty_polygon",
      message: `${prefix ? prefix + ": " : ""}Polygon has no rings`,
    });
    return;
  }

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i]!;
    const label = prefix ? `${prefix}.ring[${i}]` : `ring[${i}]`;

    if (ring.length < 4) {
      errors.push({
        type: "too_few_vertices",
        message: `${label}: Ring must have at least 4 positions (has ${ring.length})`,
      });
      continue;
    }

    // Check ring closure
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      errors.push({
        type: "ring_not_closed",
        message: `${label}: Ring is not closed (first and last positions differ)`,
      });
    }
  }
}
