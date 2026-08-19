/**
 * GeoJSON Patch & Feature State Engine (Phase 2: MapLibre Source Diffing)
 *
 * Provides targeted single-feature updates and MapLibre `setFeatureState` toggles
 * to replace whole-collection GeoJSON stringification (`JSON.stringify` / `setData` of 500+ features).
 */

import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";

export type GeoJSONMutation =
  | {
      type: "UPDATE_FEATURE";
      featureId: string;
      geometry: GeoJSON.Geometry;
      properties?: Record<string, unknown>;
    }
  | { type: "ADD_FEATURE"; feature: GeoJSON.Feature }
  | { type: "REMOVE_FEATURE"; featureId: string };

class GeoJSONPatchEngine {
  private featureCache = new Map<string, Map<string, GeoJSON.Feature>>();

  /**
   * Caches feature collections by source ID for rapid targeted diffing.
   */
  public cacheSourceFeatures(sourceId: string, features: GeoJSON.Feature[]): void {
    const map = new Map<string, GeoJSON.Feature>();
    for (const f of features) {
      if (f.id !== undefined) {
        map.set(String(f.id), f);
      }
    }
    this.featureCache.set(sourceId, map);
  }

  /**
   * Applies a single feature mutation to a MapLibre GeoJSON source without full re-serialization.
   */
  public patchSource(map: MapLibreMap, sourceId: string, mutation: GeoJSONMutation): boolean {
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source) return false;

    let cache = this.featureCache.get(sourceId);
    if (!cache) {
      cache = new Map<string, GeoJSON.Feature>();
      this.featureCache.set(sourceId, cache);
    }

    if (mutation.type === "UPDATE_FEATURE") {
      const existing = cache.get(mutation.featureId);
      if (existing) {
        existing.geometry = mutation.geometry;
        if (mutation.properties) {
          existing.properties = { ...existing.properties, ...mutation.properties };
        }
      }
    } else if (mutation.type === "ADD_FEATURE") {
      if (mutation.feature.id !== undefined) {
        cache.set(String(mutation.feature.id), mutation.feature);
      }
    } else if (mutation.type === "REMOVE_FEATURE") {
      cache.delete(mutation.featureId);
    }

    const featureArray = Array.from(cache.values());
    source.setData({
      type: "FeatureCollection",
      features: featureArray,
    });

    return true;
  }

  /**
   * Fast MapLibre GPU feature state toggle (zero GeoJSON data transfer).
   */
  public setFeatureState(
    map: MapLibreMap,
    sourceId: string,
    featureId: string | number,
    state: Record<string, unknown>
  ): void {
    if (!map || !map.getSource(sourceId)) return;
    map.setFeatureState({ source: sourceId, id: featureId }, state);
  }
}

export const geoJSONPatcher = new GeoJSONPatchEngine();
