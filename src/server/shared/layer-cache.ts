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

/** In-flight layer builds keyed like layerCache, so concurrent requests share one build. */
export const layerInflight = new Map<string, Promise<FeatureCollection | null>>();

/** True when `key` belongs to `layerType` (any zoom bucket); political also covers country_labels. */
function matchesLayer(key: string, layerType: string): boolean {
  const matches = (type: string) => key === type || key.startsWith(`${type}:`);
  return matches(layerType) || (layerType === "political" && matches("country_labels"));
}

/**
 * Clear entries from the shared layerCache and drop matching in-flight builds.
 * If layerType is provided, deletes all zoom-level keys for that layer
 * (e.g. "political", "political:z0", "political:z1", "political:z2").
 * If no layerType is provided, clears the entire cache.
 */
export function clearLayerCache(layerType?: string): void {
  if (!layerType) {
    layerCache.clear();
    layerInflight.clear();
    return;
  }
  for (const map of [layerCache, layerInflight]) {
    for (const key of map.keys()) {
      if (matchesLayer(key, layerType)) map.delete(key);
    }
  }
}

// ──────────────────────────────────────────────
// Generic in-memory cache for static catalogs & reference definitions.
// ──────────────────────────────────────────────

const catalogCache = new Map<string, { data: unknown; expires: number }>();

/**
 * Fetch from in-memory cache or compute and store for ttlMs (default 10 mins).
 */
export async function getOrSetCatalogCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 600_000
): Promise<T> {
  const cached = catalogCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }
  const fresh = await fetcher();
  catalogCache.set(key, { data: fresh, expires: Date.now() + ttlMs });
  return fresh;
}

/**
 * Invalidate catalog cache by exact key or prefix wildcard (e.g. "gov-components*").
 */
export function invalidateCatalogCache(keyOrPattern?: string): void {
  if (!keyOrPattern) {
    catalogCache.clear();
    return;
  }
  if (keyOrPattern.endsWith("*")) {
    const prefix = keyOrPattern.slice(0, -1);
    for (const key of catalogCache.keys()) {
      if (key.startsWith(prefix)) {
        catalogCache.delete(key);
      }
    }
  } else {
    catalogCache.delete(keyOrPattern);
  }
}
