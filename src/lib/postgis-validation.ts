/**
 * PostGIS Topology Validation Service
 * Provides comprehensive geometry validation and auto-fix capabilities
 */

import { db } from "~/server/db";
import type { Prisma } from "@prisma/client";

/**
 * Validation result for a geometry
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canAutoFix: boolean;
  fixedGeometry?: any; // GeoJSON geometry if auto-fixed
}

/**
 * Boundary intersection result
 */
export interface BoundaryIntersection {
  intersects: boolean;
  intersectingCountries?: Array<{ id: string; name: string; overlapAreaKm2: number }>;
  isFullyContained: boolean;
  percentageInCountry?: number;
}

/**
 * Data quality report for a country
 */
export interface DataQualityReport {
  country: {
    id: string;
    name: string;
  };
  subdivisions: {
    total: number;
    approved: number;
    pending: number;
    invalid: number;
    invalidDetails: Array<{ id: string; name: string; errors: string[] }>;
  };
  cities: {
    total: number;
    approved: number;
    pending: number;
    outOfBounds: number;
    outOfBoundsDetails: Array<{ id: string; name: string }>;
  };
  pois: {
    total: number;
    approved: number;
    pending: number;
    outOfBounds: number;
    outOfBoundsDetails: Array<{ id: string; name: string }>;
  };
  overallScore: number; // 0-100
}

/**
 * Validate a polygon geometry using PostGIS
 */
export async function validatePolygonGeometry(
  geometry: any
): Promise<ValidationResult> {
  try {
    // Convert GeoJSON to PostGIS geometry
    const geomJson = JSON.stringify(geometry);

    // Validate using PostGIS ST_IsValid and ST_IsValidReason
    const result = await db.$queryRaw<
      Array<{
        is_valid: boolean;
        reason: string | null;
        is_simple: boolean;
        num_rings: number;
        num_points: number;
        area_km2: number;
      }>
    >`
      WITH geom AS (
        SELECT ST_GeomFromGeoJSON(${geomJson})::geometry as g
      )
      SELECT
        ST_IsValid(g) as is_valid,
        ST_IsValidReason(g) as reason,
        ST_IsSimple(g) as is_simple,
        ST_NumInteriorRings(g) + 1 as num_rings,
        ST_NPoints(g) as num_points,
        ST_Area(ST_Transform(g, 4326)::geography) / 1000000 as area_km2
      FROM geom
    `;

    const data = result[0];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if valid
    if (!data?.is_valid) {
      errors.push(data?.reason || "Invalid geometry");
    }

    // Check if simple (no self-intersections)
    if (!data?.is_simple) {
      warnings.push("Geometry has self-intersections");
    }

    // Check minimum points (at least 4 for a polygon: 3 vertices + closing point)
    if (data && data.num_points < 4) {
      errors.push(`Polygon must have at least 4 points, found ${data.num_points}`);
    }

    // Check reasonable size (not too small, not too large)
    if (data && data.area_km2 < 0.1) {
      warnings.push(`Very small area: ${data.area_km2.toFixed(4)} km²`);
    }
    if (data && data.area_km2 > 10000000) {
      warnings.push(`Very large area: ${data.area_km2.toFixed(0)} km² - check coordinates`);
    }

    // Try to auto-fix if invalid
    let fixedGeometry: any = undefined;
    if (errors.length > 0) {
      try {
        const fixResult = await db.$queryRaw<Array<{ fixed_geom: any }>>`
          SELECT ST_AsGeoJSON(
            ST_MakeValid(ST_GeomFromGeoJSON(${geomJson})::geometry)
          )::json as fixed_geom
        `;

        if (fixResult[0]?.fixed_geom) {
          fixedGeometry = fixResult[0].fixed_geom;
        }
      } catch (fixError) {
        console.error("[PostGISValidation] Auto-fix failed:", fixError);
      }
    }

    return {
      isValid: data?.is_valid ?? false,
      errors,
      warnings,
      canAutoFix: !!fixedGeometry,
      fixedGeometry,
    };
  } catch (error) {
    console.error("[PostGISValidation] Validation error:", error);
    return {
      isValid: false,
      errors: ["Failed to validate geometry: " + String(error)],
      warnings: [],
      canAutoFix: false,
    };
  }
}

/**
 * Validate a point geometry
 */
export async function validatePointGeometry(geometry: any): Promise<ValidationResult> {
  try {
    const geomJson = JSON.stringify(geometry);

    // Validate point coordinates
    const result = await db.$queryRaw<
      Array<{
        is_valid: boolean;
        lng: number;
        lat: number;
      }>
    >`
      WITH geom AS (
        SELECT ST_GeomFromGeoJSON(${geomJson})::geometry as g
      )
      SELECT
        ST_IsValid(g) as is_valid,
        ST_X(g) as lng,
        ST_Y(g) as lat
      FROM geom
    `;

    const data = result[0];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data?.is_valid) {
      errors.push("Invalid point geometry");
    }

    // Check coordinate bounds
    if (data) {
      if (data.lng < -180 || data.lng > 180) {
        errors.push(`Longitude ${data.lng} out of bounds [-180, 180]`);
      }
      if (data.lat < -90 || data.lat > 90) {
        errors.push(`Latitude ${data.lat} out of bounds [-90, 90]`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canAutoFix: false, // Points can't be auto-fixed
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ["Failed to validate point geometry: " + String(error)],
      warnings: [],
      canAutoFix: false,
    };
  }
}

/**
 * Check if a subdivision intersects with country boundaries
 * and ensure it's fully contained within the country
 */
export async function checkBoundaryIntersection(
  subdivisionGeometry: any,
  countryId: string
): Promise<BoundaryIntersection> {
  try {
    const geomJson = JSON.stringify(subdivisionGeometry);

    // Check intersection with vector tile country boundaries
    const result = await db.$queryRaw<
      Array<{
        intersects: boolean;
        is_contained: boolean;
        overlap_area_km2: number;
        percent_in_country: number;
      }>
    >`
      WITH subdivision_geom AS (
        SELECT ST_GeomFromGeoJSON(${geomJson})::geometry as geom
      ),
      country_boundary AS (
        SELECT geometry
        FROM map_layer_political
        WHERE country_id = ${countryId}
        LIMIT 1
      )
      SELECT
        ST_Intersects(
          country_boundary.geometry,
          subdivision_geom.geom
        ) as intersects,
        ST_Contains(
          country_boundary.geometry,
          subdivision_geom.geom
        ) as is_contained,
        ST_Area(
          ST_Intersection(
            ST_Transform(country_boundary.geometry, 4326)::geography,
            ST_Transform(subdivision_geom.geom, 4326)::geography
          )
        ) / 1000000 as overlap_area_km2,
        (ST_Area(
          ST_Intersection(
            ST_Transform(country_boundary.geometry, 4326)::geography,
            ST_Transform(subdivision_geom.geom, 4326)::geography
          )
        ) / ST_Area(
          ST_Transform(subdivision_geom.geom, 4326)::geography
        )) * 100 as percent_in_country
      FROM subdivision_geom, country_boundary
    `;

    const data = result[0];

    return {
      intersects: data?.intersects ?? false,
      isFullyContained: data?.is_contained ?? false,
      percentageInCountry: data?.percent_in_country,
    };
  } catch (error) {
    console.error("[PostGISValidation] Boundary intersection check failed:", error);
    return {
      intersects: false,
      isFullyContained: false,
    };
  }
}

/**
 * Check if a point is within country boundaries
 */
export async function checkPointInCountry(
  pointGeometry: any,
  countryId: string
): Promise<{ isInCountry: boolean; distanceKm?: number }> {
  try {
    const geomJson = JSON.stringify(pointGeometry);

    const result = await db.$queryRaw<
      Array<{
        is_in_country: boolean;
        distance_km: number | null;
      }>
    >`
      WITH point_geom AS (
        SELECT ST_GeomFromGeoJSON(${geomJson})::geometry as geom
      ),
      country_boundary AS (
        SELECT geometry
        FROM map_layer_political
        WHERE country_id = ${countryId}
        LIMIT 1
      )
      SELECT
        ST_Contains(
          country_boundary.geometry,
          point_geom.geom
        ) as is_in_country,
        ST_Distance(
          ST_Transform(country_boundary.geometry, 4326)::geography,
          ST_Transform(point_geom.geom, 4326)::geography
        ) / 1000 as distance_km
      FROM point_geom, country_boundary
    `;

    const data = result[0];

    return {
      isInCountry: data?.is_in_country ?? false,
      distanceKm: data?.distance_km ?? undefined,
    };
  } catch (error) {
    console.error("[PostGISValidation] Point-in-country check failed:", error);
    return {
      isInCountry: false,
    };
  }
}

/**
 * Generate a data quality report for a country
 */
export async function generateDataQualityReport(
  countryId: string
): Promise<DataQualityReport> {
  try {
    // Get country info
    const country = await db.country.findUnique({
      where: { id: countryId },
      select: { id: true, name: true },
    });

    if (!country) {
      throw new Error("Country not found");
    }

    // Get subdivision statistics
    const subdivisions = await db.subdivision.groupBy({
      by: ["status"],
      where: { countryId },
      _count: true,
    });

    // Find invalid subdivisions
    const allSubdivisions = await db.subdivision.findMany({
      where: { countryId },
      select: { id: true, name: true, geometry: true },
    });

    const invalidSubdivisions: Array<{ id: string; name: string; errors: string[] }> = [];
    for (const sub of allSubdivisions) {
      if (sub.geometry) {
        // Check validity using PostGIS
        const validationCheck = await db.$queryRaw<Array<{ is_valid: boolean; reason: string | null }>>`
          SELECT
            ST_IsValid(geom_postgis) as is_valid,
            ST_IsValidReason(geom_postgis) as reason
          FROM subdivisions
          WHERE id = ${sub.id}
        `;

        if (validationCheck[0] && !validationCheck[0].is_valid) {
          invalidSubdivisions.push({
            id: sub.id,
            name: sub.name,
            errors: [validationCheck[0].reason || "Unknown error"],
          });
        }
      }
    }

    // Get city statistics
    const cities = await db.city.groupBy({
      by: ["status"],
      where: { countryId },
      _count: true,
    });

    // Check cities out of bounds
    const allCities = await db.city.findMany({
      where: { countryId },
      select: { id: true, name: true, coordinates: true },
    });

    const outOfBoundsCities: Array<{ id: string; name: string }> = [];
    for (const city of allCities) {
      const pointCheck = await checkPointInCountry(city.coordinates, countryId);
      if (!pointCheck.isInCountry) {
        outOfBoundsCities.push({ id: city.id, name: city.name });
      }
    }

    // Get POI statistics
    const pois = await db.pointOfInterest.groupBy({
      by: ["status"],
      where: { countryId },
      _count: true,
    });

    // Check POIs out of bounds
    const allPOIs = await db.pointOfInterest.findMany({
      where: { countryId },
      select: { id: true, name: true, coordinates: true },
    });

    const outOfBoundsPOIs: Array<{ id: string; name: string }> = [];
    for (const poi of allPOIs) {
      const pointCheck = await checkPointInCountry(poi.coordinates, countryId);
      if (!pointCheck.isInCountry) {
        outOfBoundsPOIs.push({ id: poi.id, name: poi.name });
      }
    }

    // Calculate overall quality score (0-100)
    const totalSubdivisions = allSubdivisions.length;
    const totalCities = allCities.length;
    const totalPOIs = allPOIs.length;
    const totalEntities = totalSubdivisions + totalCities + totalPOIs;

    const invalidCount = invalidSubdivisions.length + outOfBoundsCities.length + outOfBoundsPOIs.length;
    const validCount = totalEntities - invalidCount;

    const overallScore = totalEntities > 0 ? Math.round((validCount / totalEntities) * 100) : 100;

    return {
      country: {
        id: country.id,
        name: country.name,
      },
      subdivisions: {
        total: totalSubdivisions,
        approved: subdivisions.find((s) => s.status === "approved")?._count || 0,
        pending: subdivisions.find((s) => s.status === "pending")?._count || 0,
        invalid: invalidSubdivisions.length,
        invalidDetails: invalidSubdivisions,
      },
      cities: {
        total: totalCities,
        approved: cities.find((c) => c.status === "approved")?._count || 0,
        pending: cities.find((c) => c.status === "pending")?._count || 0,
        outOfBounds: outOfBoundsCities.length,
        outOfBoundsDetails: outOfBoundsCities,
      },
      pois: {
        total: totalPOIs,
        approved: pois.find((p) => p.status === "approved")?._count || 0,
        pending: pois.find((p) => p.status === "pending")?._count || 0,
        outOfBounds: outOfBoundsPOIs.length,
        outOfBoundsDetails: outOfBoundsPOIs,
      },
      overallScore,
    };
  } catch (error) {
    console.error("[PostGISValidation] Quality report generation failed:", error);
    throw error;
  }
}
