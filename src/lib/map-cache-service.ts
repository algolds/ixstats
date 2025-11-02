/**
 * Map Data Cache Service
 * Provides in-memory caching for frequently accessed map data
 * to reduce database load and improve response times
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class MapCacheService {
  private cache: Map<string, CacheEntry<any>>;
  private readonly defaultTTL: number = 5 * 60 * 1000; // 5 minutes
  private readonly maxSize: number = 1000; // Maximum cache entries

  constructor() {
    this.cache = new Map();

    // Periodic cleanup of expired entries (every 2 minutes)
    setInterval(() => this.cleanup(), 2 * 60 * 1000);
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Enforce max size (LRU-style eviction)
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const timestamp = Date.now();
    const expiresAt = timestamp + (ttl ?? this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp,
      expiresAt,
    });
  }

  /**
   * Invalidate cached data
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;

    if (typeof pattern === "string") {
      // Exact match
      if (this.cache.has(pattern)) {
        this.cache.delete(pattern);
        count = 1;
      }
    } else {
      // Regex pattern matching
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for this
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[MapCacheService] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Generate cache key for country subdivisions
   */
  static subdivisionKey(countryId: string, includeGeometry: boolean): string {
    return `subdivisions:${countryId}:geom=${includeGeometry}`;
  }

  /**
   * Generate cache key for country cities
   */
  static cityKey(
    countryId: string,
    subdivisionId?: string,
    includeCoords: boolean = true
  ): string {
    return `cities:${countryId}:${subdivisionId || "all"}:coords=${includeCoords}`;
  }

  /**
   * Generate cache key for country POIs
   */
  static poiKey(
    countryId: string,
    category?: string,
    subdivisionId?: string
  ): string {
    return `pois:${countryId}:${category || "all"}:${subdivisionId || "all"}`;
  }

  /**
   * Generate cache key for national capitals
   */
  static nationalCapitalsKey(): string {
    return `nationalCapitals:all`;
  }
}

// Export singleton instance
export const mapCacheService = new MapCacheService();

// Export cache key generators
export const MapCacheKeys = {
  subdivision: MapCacheService.subdivisionKey,
  city: MapCacheService.cityKey,
  poi: MapCacheService.poiKey,
  nationalCapitals: MapCacheService.nationalCapitalsKey,
};
