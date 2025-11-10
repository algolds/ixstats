/**
 * GeoJSON Labels API Route
 *
 * Serves point-based GeoJSON with calculated centroids for clean label placement.
 * This ensures exactly one label per feature at the geographic center.
 *
 * Usage:
 *   /api/geojson/labels/{layer}
 *
 * Layers: political, lakes, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

// Valid layer names for labels
const VALID_LAYERS = ["political"] as const;
type LayerName = (typeof VALID_LAYERS)[number];

// Cache for label GeoJSON (in-memory, process-level)
const labelsCache = new Map<string, GeoJSON.FeatureCollection>();

/**
 * GET /api/geojson/labels/[layer]
 *
 * Returns point GeoJSON with centroids for label placement
 */
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ layer: string }>;
  }
) {
  const startTime = Date.now();

  try {
    const params = await context.params;
    const { layer } = params;

    // Validate layer name
    if (!VALID_LAYERS.includes(layer as LayerName)) {
      return NextResponse.json(
        { error: `Invalid layer: ${layer}. Valid: ${VALID_LAYERS.join(", ")}` },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = labelsCache.get(layer);
    if (cached) {
      const duration = Date.now() - startTime;
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          "Content-Type": "application/geo+json",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "X-Cache-Status": "HIT",
          "X-Response-Time": `${duration}ms`,
        },
      });
    }

    // Fetch centroids and area from PostGIS
    // Use Country table for political layer since map_layer_political doesn't exist
    const tableName = layer === "political" ? "Country" : `map_layer_${layer}`;
    const geometryColumn = layer === "political" ? "geom_postgis" : "geometry";
    const nameColumn = layer === "political" ? "name" : "id";

    const results = await db.$queryRawUnsafe<
      Array<{
        ogc_fid: number;
        name: string | null;
        fill: string | null;
        country_id: string | null;
        area_km2: number;
        centroid: any;
      }>
    >(`
      SELECT
        ${layer === "political" ? "ROW_NUMBER() OVER ()::integer as ogc_fid" : "ogc_fid"},
        ${nameColumn} as name,
        ${layer === "political" ? "NULL" : "fill"} as fill,
        ${layer === "political" ? "id" : "country_id"} as country_id,
        -- Calculate area in square kilometers using spherical geometry
        ST_Area(geography(ST_Transform(${geometryColumn}, 4326))) / 1000000 as area_km2,
        ST_AsGeoJSON(ST_Centroid(ST_Transform(${geometryColumn}, 4326)))::json as centroid
      FROM "${tableName}"
      WHERE ${geometryColumn} IS NOT NULL
    `);

    // Transform to GeoJSON FeatureCollection with Point geometries
    const features: GeoJSON.Feature[] = results.map((row) => ({
      type: "Feature",
      id: row.ogc_fid,
      properties: {
        ogc_fid: row.ogc_fid,
        name: row.name,
        fill: row.fill,
        country_id: row.country_id,
        area_km2: row.area_km2,
      },
      geometry: row.centroid,
    }));

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    // Cache the result
    labelsCache.set(layer, geojson);

    const duration = Date.now() - startTime;

    return NextResponse.json(geojson, {
      status: 200,
      headers: {
        "Content-Type": "application/geo+json",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Cache-Status": "MISS",
        "X-Response-Time": `${duration}ms`,
        "X-Feature-Count": String(geojson.features.length),
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const params = await context.params;
    console.error(
      `[LabelsAPI] Error ${params.layer}:`,
      errorMsg
    );

    return NextResponse.json(
      {
        error: "Failed to fetch labels GeoJSON",
        details: errorMsg,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  }
}
