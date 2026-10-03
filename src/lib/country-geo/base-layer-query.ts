/**
 * Base Layer Query Utility
 *
 * Server-side functions for querying the altitude (topographic) base layer
 * and climate data. Used by the economic simulation, pin info tool,
 * subdivision validation, and any system needing terrain data.
 */

import type { PrismaClient } from "@prisma/client";
import type { Geometry } from "geojson";

interface TerrainPointResult {
  elevationZone: {
    zoneId: string;
    zoneName: string;
    elevationMin: number;
    elevationMax: number;
    color: string;
  } | null;
  climateZone: {
    climateId: string;
    climateName: string;
    color: string;
  } | null;
}

interface TerrainAreaResult {
  elevationZones: Array<{
    zoneId: string;
    zoneName: string;
    elevationMin: number;
    elevationMax: number;
    color: string;
    percentArea: number;
  }>;
  dominantElevation: string | null;
  dominantClimate: string | null;
}

/**
 * Get terrain info at a specific point (elevation zone + climate zone).
 *
 * Pass `realmId` to restrict the lookup to that realm's layers; without it the
 * point is matched against every realm's layers. When several altitude bands
 * overlap the point, the highest (most specific) band wins, so the result is
 * deterministic rather than whichever row the database returns first.
 */
export async function getTerrainAtPoint(
  db: PrismaClient,
  lng: number,
  lat: number,
  realmId?: string | null
): Promise<TerrainPointResult> {
  try {
    const realmFilter = realmId ? `AND "worldId" = $3` : "";
    const params: unknown[] = realmId ? [lng, lat, realmId] : [lng, lat];
    const results = await db.$queryRawUnsafe<
      Array<{
        layerType: string;
        featureId?: string;
        properties: Record<string, unknown>;
      }>
    >(
      `SELECT "layerType", "featureId", properties
       FROM map_layers
       WHERE "isActive" = true
         AND geom_postgis IS NOT NULL
         AND "layerType" IN ('altitudes', 'climate')
         ${realmFilter}
         AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))
       ORDER BY "featureId"`,
      ...params
    );

    const num = (v: unknown): number =>
      typeof v === "number" && Number.isFinite(v) ? v : -Infinity;
    const altResult = results
      .filter((r) => r.layerType === "altitudes")
      .reduce<(typeof results)[number] | undefined>((best, r) => {
        if (!best) return r;
        const dMin = num(r.properties?.elevationMin) - num(best.properties?.elevationMin);
        if (dMin !== 0) return dMin > 0 ? r : best;
        return num(r.properties?.elevationMax) > num(best.properties?.elevationMax) ? r : best;
      }, undefined);
    const climResult = results.find((r) => r.layerType === "climate");

    return {
      elevationZone: altResult
        ? {
            zoneId: (altResult.properties.zoneId as string) ?? "",
            zoneName: (altResult.properties.zoneName as string) ?? "",
            elevationMin: (altResult.properties.elevationMin as number) ?? 0,
            elevationMax: (altResult.properties.elevationMax as number) ?? 0,
            color: (altResult.properties.fill as string) ?? "",
          }
        : null,
      climateZone: climResult
        ? {
            climateId: (climResult.properties.climateId as string) ?? "",
            climateName: (climResult.properties.climateName as string) ?? "",
            color: (climResult.properties.fill as string) ?? "",
          }
        : null,
    };
  } catch {
    return { elevationZone: null, climateZone: null };
  }
}

/**
 * Get terrain breakdown for an area (which elevation zones it spans).
 * Returns zones ordered by percentage of area covered.
 */
export async function getTerrainForArea(
  db: PrismaClient,
  geometry: Geometry
): Promise<TerrainAreaResult> {
  try {
    const geojsonStr = JSON.stringify(geometry);

    // Get altitude zones that intersect this area with approximate % coverage
    const results = await db.$queryRawUnsafe<
      Array<{
        zoneId: string;
        zoneName: string;
        elevationMin: number;
        elevationMax: number;
        color: string;
        intersectArea: number;
      }>
    >(
      `SELECT
         properties->>'zoneId' as "zoneId",
         properties->>'zoneName' as "zoneName",
         COALESCE((properties->>'elevationMin')::int, 0) as "elevationMin",
         COALESCE((properties->>'elevationMax')::int, 0) as "elevationMax",
         properties->>'fill' as color,
         SUM(ST_Area(
           ST_Intersection(geom_postgis, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
         )) as "intersectArea"
       FROM map_layers
       WHERE "isActive" = true
         AND "layerType" = 'altitudes'
         AND geom_postgis IS NOT NULL
         AND ST_Intersects(geom_postgis, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
       GROUP BY properties->>'zoneId', properties->>'zoneName',
                properties->>'elevationMin', properties->>'elevationMax',
                properties->>'fill'
       ORDER BY "intersectArea" DESC`,
      geojsonStr
    );

    if (results.length === 0) {
      return { elevationZones: [], dominantElevation: null, dominantClimate: null };
    }

    const totalArea = results.reduce((sum, r) => sum + Number(r.intersectArea), 0);

    const elevationZones = results.map((r) => ({
      zoneId: r.zoneId,
      zoneName: r.zoneName,
      elevationMin: Number(r.elevationMin),
      elevationMax: Number(r.elevationMax),
      color: r.color,
      percentArea: totalArea > 0 ? (Number(r.intersectArea) / totalArea) * 100 : 0,
    }));

    // Get dominant climate
    let dominantClimate: string | null = null;
    try {
      const climateResults = await db.$queryRawUnsafe<
        Array<{ climateName: string; totalArea: number }>
      >(
        `SELECT
           properties->>'climateName' as "climateName",
           SUM(ST_Area(
             ST_Intersection(geom_postgis, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
           )) as "totalArea"
         FROM map_layers
         WHERE "isActive" = true
           AND "layerType" = 'climate'
           AND geom_postgis IS NOT NULL
           AND ST_Intersects(geom_postgis, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
         GROUP BY properties->>'climateName'
         ORDER BY "totalArea" DESC
         LIMIT 1`,
        geojsonStr
      );
      dominantClimate = climateResults[0]?.climateName ?? null;
    } catch {
      // Climate data not available
    }

    return {
      elevationZones,
      dominantElevation: elevationZones[0]?.zoneName ?? null,
      dominantClimate,
    };
  } catch {
    return { elevationZones: [], dominantElevation: null, dominantClimate: null };
  }
}
