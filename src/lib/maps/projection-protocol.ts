/**
 * Custom MapLibre Protocol Handler for Projection Transformation
 *
 * Registers custom protocols (projection-equalearth://, projection-naturalearth://, etc.)
 * that intercept tile requests and fetch pre-transformed MVT tiles from the server.
 *
 * Usage:
 *   registerProjectionProtocol('equalEarth')
 *   // Tiles can now be requested via: projection-equalearth://{layer}/{z}/{x}/{y}
 */

import maplibregl from 'maplibre-gl';
import type { ProjectionType } from '~/types/maps';

/**
 * LRU Cache for transformed tiles
 * Keeps recently accessed tiles in memory to avoid re-transformation
 */
class TileCache {
  private cache = new Map<string, ArrayBuffer>();
  private accessOrder: string[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get(key: string): ArrayBuffer | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }
    return value;
  }

  set(key: string, value: ArrayBuffer): void {
    // If key exists, remove it first (will be re-added at end)
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}

// Global cache instance
const tileCache = new TileCache(500);

/**
 * Register custom protocol for a projection type
 *
 * @param projection - Projection type (equalEarth, naturalEarth, ixmaps)
 * @returns Protocol name (e.g., "projection-equalearth")
 */
export function registerProjectionProtocol(projection: ProjectionType): string {
  const protocolName = `projection-${projection}`;

  // Check if protocol is already registered
  const protocols = (maplibregl as any).protocols;
  if (protocols && protocols[protocolName]) {
    console.log(`[ProjectionProtocol] Protocol ${protocolName} already registered`);
    return protocolName;
  }

  console.log(`[ProjectionProtocol] Registering protocol: ${protocolName}`);

  // Clear cache when switching projections to avoid stale buffer issues
  tileCache.clear();
  console.log(`[ProjectionProtocol] Cleared tile cache for fresh start`);

  maplibregl.addProtocol(protocolName, async (params, abortController) => {
    try {
      // Parse tile coordinates and layer from URL
      // Format: projection-equalearth://{layer}/{z}/{x}/{y}
      const urlPath = params.url.split('://')[1];
      if (!urlPath) {
        throw new Error('Invalid protocol URL format');
      }

      const match = urlPath.match(/(\w+)\/(\d+)\/(\d+)\/(\d+)$/);
      if (!match) {
        throw new Error(`Invalid tile URL format: ${params.url}`);
      }

      const layer = match[1]!;
      const z = parseInt(match[2]!);
      const x = parseInt(match[3]!);
      const y = parseInt(match[4]!);

      // Normalize projection name for cache key consistency
      const projectionLower = projection.toLowerCase();
      const cacheKey = `${projectionLower}:${layer}:${z}:${x}:${y}`;

      // Check cache first
      const cachedTile = tileCache.get(cacheKey);
      if (cachedTile) {
        // Clone cached buffer to avoid detachment issues (double slice for safety)
        return { data: cachedTile.slice(0).slice(0) };
      }

      // Fetch pre-transformed tile from server (using normalized projection name)
      const tileUrl = `/api/tiles/projections/${projectionLower}/${layer}/${z}/${x}/${y}`;
      const response = await fetch(tileUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        // Return empty tile on error (MapLibre handles gracefully)
        console.warn(`[ProjectionProtocol] Tile fetch failed: ${tileUrl} - ${response.statusText}`);
        return { data: new ArrayBuffer(0) };
      }

      const transformedTile = await response.arrayBuffer();

      // Clone the ArrayBuffer to avoid detachment issues with workers
      // MapLibre transfers the buffer to a worker, which detaches it
      const clonedTile = transformedTile.slice(0);

      // Cache the cloned tile (store a separate copy)
      tileCache.set(cacheKey, clonedTile.slice(0));

      // Return another clone to prevent detachment of the cached version
      return { data: clonedTile.slice(0) };
    } catch (error) {
      // Handle aborted requests gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors
      }

      console.error('[ProjectionProtocol] Error fetching tile:', error);
      return { data: new ArrayBuffer(0) };
    }
  });

  return protocolName;
}

/**
 * Unregister custom protocol for a projection type
 *
 * @param projection - Projection type to unregister
 */
export function unregisterProjectionProtocol(projection: ProjectionType): void {
  const protocolName = `projection-${projection}`;

  try {
    maplibregl.removeProtocol(protocolName);
    console.log(`[ProjectionProtocol] Unregistered protocol: ${protocolName}`);
  } catch (error) {
    console.warn(`[ProjectionProtocol] Failed to unregister ${protocolName}:`, error);
  }
}

/**
 * Clear the tile cache
 * Useful when switching projections or when memory needs to be freed
 */
export function clearTileCache(): void {
  tileCache.clear();
  console.log('[ProjectionProtocol] Tile cache cleared');
}

/**
 * Get cache statistics
 * Useful for debugging and monitoring
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: tileCache.size,
    maxSize: 500,
  };
}
