import type { FeatureCollection } from "geojson";
import type { CompressOptions } from "~/lib/maps/geojson-compress";
import { layerCache, clearLayerCache } from "~/server/shared/layer-cache";

// The shared cache primitive lives in src/server/shared/layer-cache.ts so the
// countries router can invalidate it without importing this geo router. Re-export
// for geo siblings that import { layerCache, clearLayerCache } from "./core".
export { layerCache, clearLayerCache };

/** Per-layer cache TTL — static layers imported from SVGs rarely change */
const CACHE_TTLS: Record<string, number> = {
  political: 15 * 60 * 1000, // 15 min (editable)
  background: 24 * 60 * 60 * 1000, // 24 hours (static)
  altitudes: 24 * 60 * 60 * 1000, // 24 hours (static)
  climate: 24 * 60 * 60 * 1000, // 24 hours (static)
  rivers: 24 * 60 * 60 * 1000, // 24 hours (static)
  lakes: 24 * 60 * 60 * 1000, // 24 hours (static)
  icecaps: 24 * 60 * 60 * 1000, // 24 hours (static)
};
const DEFAULT_CACHE_TTL = 15 * 60 * 1000;

/** Per-layer geometry compression — simplify + truncate + dedup.
 * Decorative layers use precision 3 (~111m) and higher tolerance to cut payload.
 * Political borders keep precision 4 (~11m) for crisp rendering. */
const LAYER_COMPRESSION: Record<string, CompressOptions> = {
  altitudes: { simplifyTolerance: 0.05, coordinatePrecision: 3 }, // decorative — aggressive
  rivers: { simplifyTolerance: 0.035, coordinatePrecision: 3 }, // decorative — aggressive
  climate: { simplifyTolerance: 0.05, coordinatePrecision: 3 }, // decorative — aggressive
  political: { simplifyTolerance: 0.008, coordinatePrecision: 4 }, // borders — keep crisp
  lakes: { simplifyTolerance: 0.02, coordinatePrecision: 3 }, // decorative
  icecaps: { simplifyTolerance: 0, coordinatePrecision: 3 }, // no simplification — preserves polar vertices
  background: { simplifyTolerance: 0, coordinatePrecision: 3 },
};

/**
 * Zoom-level LOD compression overrides.
 * At low zoom (globe view), aggressively simplify to reduce payload.
 * At high zoom, use full detail for crisp borders.
 * Zoom buckets: 0 = globe (0-3), 1 = mid (4-6), 2 = detail (7+)
 */
export type ZoomBucket = 0 | 1 | 2;

export function getZoomBucket(zoom?: number): ZoomBucket {
  if (zoom === undefined || zoom === null) return 1; // default = mid
  if (zoom < 4) return 0; // globe view
  if (zoom < 7) return 1; // mid zoom
  return 2; // detail zoom
}

const LOD_OVERRIDES: Record<ZoomBucket, Record<string, Partial<CompressOptions>>> = {
  0: {
    // Globe view — very aggressive (user can't see detail anyway)
    altitudes: { simplifyTolerance: 0.12, coordinatePrecision: 2 },
    rivers: { simplifyTolerance: 0.1, coordinatePrecision: 2 },
    climate: { simplifyTolerance: 0.12, coordinatePrecision: 2 },
    political: { simplifyTolerance: 0.025 },
    lakes: { simplifyTolerance: 0.06, coordinatePrecision: 2 },
  },
  1: {}, // Mid zoom — use defaults
  2: {
    // Detail view — minimal simplification for crisp borders
    political: { simplifyTolerance: 0.002, coordinatePrecision: 4 },
    altitudes: { simplifyTolerance: 0.01, coordinatePrecision: 4 },
    rivers: { simplifyTolerance: 0.008, coordinatePrecision: 4 },
    climate: { simplifyTolerance: 0.01, coordinatePrecision: 4 },
    lakes: { simplifyTolerance: 0.005, coordinatePrecision: 4 },
  },
};

export function getCompressionForLayer(layerType: string, zoomBucket: ZoomBucket): CompressOptions {
  const base = LAYER_COMPRESSION[layerType] ?? { simplifyTolerance: 0, coordinatePrecision: 4 };
  const override = LOD_OVERRIDES[zoomBucket]?.[layerType];
  return override ? { ...base, ...override } : base;
}

export function getCached(key: string): FeatureCollection | null {
  const entry = layerCache.get(key);
  if (!entry) return null;
  const baseLayerType = key.split(":")[0] || key;
  const ttl = CACHE_TTLS[baseLayerType] ?? DEFAULT_CACHE_TTL;
  if (Date.now() - entry.timestamp > ttl) {
    layerCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key: string, data: FeatureCollection): void {
  layerCache.set(key, { data, timestamp: Date.now() });
  // Ponytail: Simple LRU size cap (max 32 entries). If full, evict oldest entry.
  if (layerCache.size > 32) {
    const firstKey = layerCache.keys().next().value;
    if (firstKey) layerCache.delete(firstKey);
  }
}
