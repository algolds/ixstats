import type { FeatureCollection } from "geojson";

// ──────────────────────────────────────────────
// Shared in-memory cache for assembled map FeatureCollections.
//
// This is a cross-domain primitive: the geo router populates/reads it, and the
// countries router invalidates it when borders/identity change. It lives in
// src/server/shared so neither router imports the other (arch.md: no
// cross-router imports). Geo-specific TTL/compression config stays in
// routers/geo/core/cache.ts, which re-exports these for its siblings.
// ──────────────────────────────────────────────

export const layerCache = new Map<string, { data: FeatureCollection; timestamp: number }>();

/**
 * Clear entries from the shared layerCache.
 * If layerType is provided, deletes all zoom-level keys for that layer
 * (e.g. "political", "political:z0", "political:z1", "political:z2").
 * If no layerType is provided, clears the entire cache.
 */
export function clearLayerCache(layerType?: string): void {
  if (layerType) {
    layerCache.forEach((_, key) => {
      if (key === layerType || key.startsWith(`${layerType}:`)) {
        layerCache.delete(key);
      }
    });
    if (layerType === "political") {
      layerCache.forEach((_, key) => {
        if (key === "country_labels" || key.startsWith("country_labels:")) {
          layerCache.delete(key);
        }
      });
    }
  } else {
    layerCache.clear();
  }
}
