/**
 * GeoJSON API Route for Custom Projections
 *
 * Serves pre-transformed GeoJSON for custom projections (Equal Earth, Natural Earth, IxMaps)
 * using D3 projection transformations on the server side.
 *
 * This approach:
 * - Transforms coordinates once on the server (D3 projection)
 * - Caches transformed GeoJSON in memory
 * - Serves GeoJSON to MapLibre GL JS as a geojson source
 * - Works around MapLibre's lack of native custom projection support
 *
 * Usage:
 *   /api/geojson/{projection}/{layer}
 *
 * Projections: equalEarth, naturalEarth, ixmaps
 * Layers: political, altitudes, lakes, rivers, icecaps, climate
 */

import { NextRequest, NextResponse } from "next/server";
import type { ProjectionType } from "~/types/maps";
import {
  fetchTransformedGeoJSON,
  VALID_LAYERS,
  type LayerName,
} from "~/lib/maps/geojson-fetcher";

// Valid projection names for custom projections
const VALID_PROJECTIONS = ["equalearth", "naturalearth", "ixmaps"] as const;
type ProjectionName = (typeof VALID_PROJECTIONS)[number];

/**
 * GET /api/geojson/[projection]/[layer]
 *
 * Returns transformed GeoJSON for the specified projection and layer
 */
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ projection: string; layer: string }>;
  }
) {
  const startTime = Date.now();

  try {
    const params = await context.params;
    const { projection, layer } = params;

    // Normalize projection name (case-insensitive)
    const projectionLower = projection.toLowerCase();

    // Validate projection name
    if (!VALID_PROJECTIONS.includes(projectionLower as ProjectionName)) {
      return NextResponse.json(
        { error: `Invalid projection: ${projection}. Valid: ${VALID_PROJECTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate layer name
    if (!VALID_LAYERS.includes(layer as LayerName)) {
      return NextResponse.json(
        { error: `Invalid layer: ${layer}. Valid: ${VALID_LAYERS.join(", ")}` },
        { status: 400 }
      );
    }

    // Convert projection name to ProjectionType
    const projectionType: ProjectionType = projectionLower as ProjectionType;

    // Fetch and transform GeoJSON
    const geojson = await fetchTransformedGeoJSON(
      layer as LayerName,
      projectionType
    );

    const duration = Date.now() - startTime;

    // Return GeoJSON with caching headers
    return NextResponse.json(geojson, {
      status: 200,
      headers: {
        "Content-Type": "application/geo+json",
        // Long cache time since map data rarely changes
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", // 1 day, 7 day stale
        "X-Projection": projectionType,
        "X-Layer": layer,
        "X-Response-Time": `${duration}ms`,
        "X-Feature-Count": String(geojson.features.length),
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const params = await context.params;
    console.error(
      `[GeoJSONAPI] Error ${params.projection}/${params.layer}:`,
      errorMsg
    );

    return NextResponse.json(
      {
        error: "Failed to fetch GeoJSON",
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
