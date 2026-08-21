/**
 * geojson-layer-helpers.ts — Type-safe GeoJSON source & layer utilities for MapLibre.
 *
 * Eliminates repetitive `getSource()`, `addSource()`, and `setData()` boilerplate
 * across all map overlays.
 */

import type { Map as MapLibreMap, LayerSpecification } from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";

/**
 * Sets or updates a GeoJSON source on the given MapLibre instance.
 */
export function setOrUpdateGeoJSONSource(
  map: MapLibreMap | null,
  sourceId: string,
  data: FeatureCollection<Geometry, any> | object
): boolean {
  if (!map || !map.isStyleLoaded()) return false;

  const source = map.getSource(sourceId);
  if (source && "setData" in source) {
    (source as any).setData(data);
    return true;
  } else if (!source) {
    try {
      map.addSource(sourceId, {
        type: "geojson",
        data: data as any,
      });
      return true;
    } catch (_err) {
      return false;
    }
  }
  return false;
}

/**
 * Ensures a MapLibre layer exists on the map, adding it if missing.
 */
export function ensureMapLayer(
  map: MapLibreMap | null,
  layerConfig: LayerSpecification,
  beforeLayerId?: string
): boolean {
  if (!map || !map.isStyleLoaded()) return false;

  if (!map.getLayer(layerConfig.id)) {
    try {
      map.addLayer(layerConfig, beforeLayerId);
      return true;
    } catch (_err) {
      return false;
    }
  }
  return true;
}

/**
 * Removes a layer and its corresponding source if they exist.
 */
export function removeLayerAndSource(
  map: MapLibreMap | null,
  layerId: string,
  sourceId?: string
): void {
  if (!map || !map.isStyleLoaded()) return;

  if (map.getLayer(layerId)) {
    try {
      map.removeLayer(layerId);
    } catch (_err) {
      // Ignored
    }
  }

  if (sourceId && map.getSource(sourceId)) {
    try {
      map.removeSource(sourceId);
    } catch (_err) {
      // Ignored
    }
  }
}
