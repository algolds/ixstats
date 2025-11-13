/**
 * GeoJSON Fetcher
 * 
 * Fetches and transforms GeoJSON data for custom projections
 */

import { createProjection } from './projections';
import { transformFeatureCollection } from './projection-transformer';
import type { ProjectionType } from '~/types/maps';

/**
 * Valid layer names for GeoJSON
 */
export const VALID_LAYERS = [
  'political',
  'altitudes',
  'lakes',
  'rivers',
  'icecaps',
  'climate',
] as const;

export type LayerName = (typeof VALID_LAYERS)[number];

/**
 * Cache for transformed GeoJSON
 */
const transformCache = new Map<string, GeoJSON.FeatureCollection>();

/**
 * Fetch and transform GeoJSON for a specific layer and projection
 * 
 * @param layer - Layer name to fetch
 * @param projectionType - Projection type to apply
 * @returns Transformed GeoJSON FeatureCollection
 */
export async function fetchTransformedGeoJSON(
  layer: LayerName,
  projectionType: ProjectionType
): Promise<GeoJSON.FeatureCollection> {
  const cacheKey = `${projectionType}-${layer}`;
  
  // Check cache first
  const cached = transformCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch raw GeoJSON from static files
  // Adjust path based on your actual GeoJSON file locations
  const geojsonPath = `/geojson/${layer}.json`;
  
  const response = await fetch(geojsonPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch GeoJSON for layer ${layer}: ${response.statusText}`);
  }

  const geojson = await response.json() as GeoJSON.FeatureCollection;

  // Get projection function
  const projection = createProjection(projectionType);

  // Transform coordinates
  const transformed = transformFeatureCollection(geojson, projection);

  // Cache result
  transformCache.set(cacheKey, transformed);

  return transformed;
}

/**
 * Clear transformation cache
 */
export function clearTransformCache(): void {
  transformCache.clear();
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  return transformCache.size;
}

