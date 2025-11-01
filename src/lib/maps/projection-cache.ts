/**
 * Projection Cache for Map Tiles
 *
 * LRU (Least Recently Used) cache implementation for transformed tile features.
 * Caches projected GeoJSON features to avoid redundant coordinate transformations.
 *
 * Cache Key Structure: `${projectionType}-${zoom}-${tileX}-${tileY}`
 * Max Size: 100 entries
 * Eviction Strategy: LRU (removes oldest accessed entry when full)
 *
 * @module projection-cache
 */

import type { Feature, FeatureCollection, Geometry } from 'geojson';

/**
 * Cache entry containing transformed features and metadata
 */
export interface CacheEntry {
  /** Transformed GeoJSON features */
  features: Feature<Geometry>[];
  /** Timestamp when entry was created */
  timestamp: number;
  /** Timestamp when entry was last accessed */
  lastAccessed: number;
  /** Size estimate in bytes (approximate) */
  sizeEstimate: number;
}

/**
 * Cache statistics for debugging and monitoring
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Current number of cached entries */
  size: number;
  /** Maximum cache size */
  maxSize: number;
  /** Total number of evictions */
  evictions: number;
  /** Hit rate percentage (0-100) */
  hitRate: number;
}

/**
 * Cache key parameters
 */
export interface CacheKeyParams {
  projectionType: string;
  zoom: number;
  tileX: number;
  tileY: number;
}

/**
 * LRU Cache for projected tile features
 *
 * Implements a Least Recently Used cache to store transformed map tile features,
 * reducing computational overhead from repeated coordinate transformations.
 */
class ProjectionCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private stats: Omit<CacheStats, 'hitRate'>;

  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize,
      evictions: 0,
    };
  }

  /**
   * Generate cache key from parameters
   */
  private generateKey(params: CacheKeyParams): string {
    const { projectionType, zoom, tileX, tileY } = params;
    return `${projectionType}-${zoom}-${tileX}-${tileY}`;
  }

  /**
   * Estimate memory size of features (approximate)
   * Used for cache size monitoring
   */
  private estimateSize(features: Feature<Geometry>[]): number {
    // Rough estimate: ~500 bytes per feature on average
    // This accounts for geometry coordinates, properties, and overhead
    return features.length * 500;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    // Find entry with oldest lastAccessed timestamp
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size--;
    }
  }

  /**
   * Retrieve cached tile features
   *
   * @param key - Cache key string or key parameters
   * @returns Cached features or null if not found
   */
  getCachedTile(key: string | CacheKeyParams): Feature<Geometry>[] | null {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (entry) {
      // Update last accessed time (LRU tracking)
      entry.lastAccessed = Date.now();
      this.stats.hits++;

      // Move to end of Map (most recently used)
      // Note: Map preserves insertion order, so delete + re-insert moves to end
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, entry);

      return entry.features;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store transformed tile features in cache
   *
   * @param key - Cache key string or key parameters
   * @param features - Transformed GeoJSON features to cache
   */
  setCachedTile(
    key: string | CacheKeyParams,
    features: Feature<Geometry>[] | FeatureCollection
  ): void {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);

    // Extract features array from FeatureCollection if needed
    const featureArray = Array.isArray(features) ? features : features.features;

    // Evict LRU entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry = {
      features: featureArray,
      timestamp: now,
      lastAccessed: now,
      sizeEstimate: this.estimateSize(featureArray),
    };

    this.cache.set(cacheKey, entry);

    // Update size only if this is a new entry
    if (this.cache.size > this.stats.size) {
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Clear all cached entries
   */
  clearCache(): void {
    this.cache.clear();
    this.stats.size = 0;
    // Preserve hit/miss/eviction stats for debugging
  }

  /**
   * Clear cached entries for specific projection type
   *
   * @param projectionType - Projection type to clear (e.g., 'mercator', 'equirectangular')
   */
  clearProjectionCache(projectionType: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${projectionType}-`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    this.stats.size = this.cache.size;
  }

  /**
   * Get cache statistics
   *
   * @returns Current cache statistics including hit rate
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get total estimated cache size in bytes
   */
  getEstimatedSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.sizeEstimate;
    }
    return totalSize;
  }

  /**
   * Check if cache has entry for given key
   */
  has(key: string | CacheKeyParams): boolean {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);
    return this.cache.has(cacheKey);
  }

  /**
   * Get current cache size (number of entries)
   */
  get size(): number {
    return this.cache.size;
  }
}

// Singleton instance for global use
export const projectionCache = new ProjectionCache(100);

// Export class for custom instances if needed
export default ProjectionCache;
