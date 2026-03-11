/**
 * Client-side point-in-polygon query using Turf.js.
 *
 * Provides instant feedback against already-loaded GeoJSON layer data
 * before the server-side PostGIS query returns.
 */

import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from "geojson";

export interface ClientPointQueryResult {
  political: Feature | null;
  altitude: Feature | null;
  climate: Feature | null;
}

/**
 * Query loaded GeoJSON layers for a point, returning the first
 * containing feature from each layer type.
 */
export function queryPointClientSide(
  lng: number,
  lat: number,
  layers: Record<string, FeatureCollection | undefined>
): ClientPointQueryResult {
  const pt: Feature = {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [lng, lat] },
  };

  return {
    political: findContainingFeature(pt, layers.political),
    altitude: findContainingFeature(pt, layers.altitudes),
    climate: findContainingFeature(pt, layers.climate),
  };
}

function findContainingFeature(
  pt: Feature,
  collection: FeatureCollection | undefined
): Feature | null {
  if (!collection?.features) return null;

  for (const feature of collection.features) {
    if (!feature.geometry) continue;
    const geomType = feature.geometry.type;
    if (geomType !== "Polygon" && geomType !== "MultiPolygon") continue;

    try {
      if (booleanPointInPolygon(pt, feature.geometry as Polygon | MultiPolygon)) {
        return feature;
      }
    } catch {
      // Invalid geometry — skip
    }
  }

  return null;
}

/**
 * Extract display info from a client-side query result feature.
 */
export function extractFeatureInfo(feature: Feature | null): Record<string, unknown> | null {
  if (!feature?.properties) return null;
  return feature.properties;
}
