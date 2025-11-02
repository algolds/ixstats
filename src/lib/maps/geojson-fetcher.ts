/**
 * GeoJSON Fetcher for Map Layers
 *
 * Fetches GeoJSON data from PostGIS map_layer_* tables and applies
 * D3 projection transformations for custom projections.
 *
 * Layers supported:
 * - political: Political boundaries
 * - altitudes: Elevation/terrain data
 * - lakes: Lake features
 * - rivers: River features
 * - icecaps: Ice cap features
 * - climate: Climate zones
 */

import { db } from "~/server/db";
import type { ProjectionType } from "~/types/maps";
import { createProjection, createIxMapsProjectionWrapper } from "./projections";
import { transformGeoJSON } from "./projection-transformer";
import type { D3Projection } from "./projections";

/**
 * Valid map layer names
 */
export const VALID_LAYERS = [
  "political",
  "altitudes",
  "lakes",
  "rivers",
  "icecaps",
  "climate",
] as const;

export type LayerName = (typeof VALID_LAYERS)[number];

/**
 * Cache for transformed GeoJSON (in-memory, process-level)
 * Key format: {projection}:{layer}
 */
const geoJSONCache = new Map<string, GeoJSON.FeatureCollection>();

/**
 * Fetch raw GeoJSON from PostGIS for a given layer
 *
 * @param layer - Map layer name
 * @returns GeoJSON FeatureCollection in WGS84 (EPSG:4326)
 */
export async function fetchLayerGeoJSON(
  layer: LayerName
): Promise<GeoJSON.FeatureCollection> {
  const tableName = `map_layer_${layer}`;

  try {
    // Query PostGIS using raw SQL via Prisma
    const results = await db.$queryRawUnsafe<
      Array<{
        ogc_fid: number;
        name: string | null;
        fill: string | null;
        country_id: string | null;
        area_km2: number;
        geojson: any;
      }>
    >(`
      SELECT
        ogc_fid,
        id as name,
        fill,
        country_id,
        -- Calculate area in square kilometers using spherical geometry
        ST_Area(geography(ST_Transform(geometry, 4326))) / 1000000 as area_km2,
        ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geojson
      FROM ${tableName}
      WHERE geometry IS NOT NULL
    `);

    // Transform to GeoJSON FeatureCollection
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
      geometry: row.geojson,
    }));

    return {
      type: "FeatureCollection",
      features,
    };
  } catch (error) {
    console.error(`[GeoJSONFetcher] Error fetching ${layer}:`, error);
    // Return empty FeatureCollection on error
    return {
      type: "FeatureCollection",
      features: [],
    };
  }
}

/**
 * Transform GeoJSON using D3 projection
 *
 * @param geojson - Source GeoJSON in WGS84
 * @param projection - Target projection type
 * @returns Transformed GeoJSON in projection space
 */
export async function transformLayerGeoJSON(
  geojson: GeoJSON.FeatureCollection,
  projection: ProjectionType
): Promise<GeoJSON.FeatureCollection> {
  // Skip transformation for Mercator/Globe (MapLibre handles natively)
  if (projection === "mercator" || projection === "globe") {
    return geojson;
  }

  try {
    let d3Projection: D3Projection | { project: (coords: [number, number]) => [number, number]; invert: (coords: [number, number]) => [number, number] };

    // Handle IxMaps projection separately (uses custom interface)
    if (projection === "ixmaps") {
      const ixmapsProj = createIxMapsProjectionWrapper();
      // Create a D3-compatible projection wrapper
      d3Projection = ((coord: [number, number]) => ixmapsProj.project(coord)) as any;
      (d3Projection as any).invert = ixmapsProj.invert;
    } else {
      // Use standard D3 projections (equalEarth, naturalEarth)
      d3Projection = createProjection(projection, {
        width: 1000,
        height: 500,
        scale: 150,
      });
    }

    // Transform the GeoJSON using D3 projection
    const transformed = transformGeoJSON(geojson, d3Projection as D3Projection);

    return transformed as GeoJSON.FeatureCollection;
  } catch (error) {
    console.error(
      `[GeoJSONFetcher] Error transforming ${projection}:`,
      error
    );
    // Return original GeoJSON on transformation error
    return geojson;
  }
}

/**
 * Fetch and transform GeoJSON for a given layer and projection
 * Uses in-memory caching for performance
 *
 * @param layer - Map layer name
 * @param projection - Target projection type
 * @returns Transformed GeoJSON FeatureCollection
 */
export async function fetchTransformedGeoJSON(
  layer: LayerName,
  projection: ProjectionType
): Promise<GeoJSON.FeatureCollection> {
  // Check cache first
  const cacheKey = `${projection}:${layer}`;
  const cached = geoJSONCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch raw GeoJSON from PostGIS
  const rawGeoJSON = await fetchLayerGeoJSON(layer);

  // Transform using D3 projection
  const transformedGeoJSON = await transformLayerGeoJSON(
    rawGeoJSON,
    projection
  );

  // Cache the result
  geoJSONCache.set(cacheKey, transformedGeoJSON);

  return transformedGeoJSON;
}

/**
 * Clear the GeoJSON cache
 * Useful for testing or when data updates
 */
export function clearGeoJSONCache(): void {
  geoJSONCache.clear();
  console.log("[GeoJSONFetcher] Cache cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: geoJSONCache.size,
    keys: Array.from(geoJSONCache.keys()),
  };
}
