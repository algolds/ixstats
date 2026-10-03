/**
 * geojson-layer-helpers.ts — Type-safe GeoJSON source & layer utilities for MapLibre.
 *
 * Eliminates repetitive `getSource()`, `addSource()`, and `setData()` boilerplate
 * across all map overlays.
 */

import type { Map as MapLibreMap, LayerSpecification } from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";

/**
 * Whether the map's style has finished its initial load, so sources and layers can be added.
 *
 * Deliberately not `map.isStyleLoaded()`: that also returns false while any source is
 * re-tiling (after every `setData`, and while tiles stream in during a pan). Overlays guarded by
 * it silently skipped their setup — or their cleanup, leaving layers behind — whenever they
 * were toggled mid-pan.
 */
export function isMapStyleLoaded(map: MapLibreMap | null | undefined): boolean {
  if (!map) return false;
  const style = (map as unknown as { style?: { _loaded?: boolean } }).style;
  return !!style && style._loaded !== false;
}

/** Type-guard form of {@link isMapStyleLoaded} for code that holds a nullable map. */
export function isMapStyleReady(map: MapLibreMap | null | undefined): map is MapLibreMap {
  return isMapStyleLoaded(map);
}

/**
 * Sets or updates a GeoJSON source on the given MapLibre instance.
 */
export function setOrUpdateGeoJSONSource(
  map: MapLibreMap | null,
  sourceId: string,
  data: FeatureCollection<Geometry, any> | object
): boolean {
  if (!isMapStyleReady(map)) return false;

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
    } catch {
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
  if (!isMapStyleReady(map)) return false;

  if (!map.getLayer(layerConfig.id)) {
    try {
      map.addLayer(layerConfig, beforeLayerId);
      return true;
    } catch {
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
  if (!isMapStyleReady(map)) return;

  if (map.getLayer(layerId)) {
    try {
      map.removeLayer(layerId);
    } catch {
      // Ignored
    }
  }

  if (sourceId && map.getSource(sourceId)) {
    try {
      map.removeSource(sourceId);
    } catch {
      // Ignored
    }
  }
}
