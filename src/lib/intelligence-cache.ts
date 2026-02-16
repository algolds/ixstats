// Intelligence Cache System - Now a thin facade over globalCache
// Eliminates a separate Map + setInterval while preserving the same API for consumers.
// All storage is handled by the consolidated globalCache (advanced-cache-system.ts).

import { globalCache } from "./advanced-cache-system";

export type CacheType = "critical" | "standard" | "historical" | "static";

// TTL mapping by CacheType (in seconds, for globalCache)
const TTL_BY_TYPE: Record<CacheType, number> = {
  critical: 10,    // 10 seconds
  standard: 30,    // 30 seconds
  historical: 300,  // 5 minutes
  static: 3600,    // 1 hour
};

/**
 * Intelligence Cache - facade over globalCache
 * Maintains the same API but delegates to the consolidated cache system.
 */
class IntelligenceCacheFacade {
  private stats = { hits: 0, misses: 0, startTime: Date.now() };

  set(key: string, data: any, type: CacheType = "standard"): void {
    const prefixedKey = `intel:${key}`;
    const ttl = TTL_BY_TYPE[type] || TTL_BY_TYPE.standard;
    // Fire-and-forget (globalCache.set is async but callers expect sync)
    void globalCache.set(prefixedKey, data, { ttl, skipRedis: true });
  }

  get(key: string): any | null {
    // globalCache.get is async but this API is sync — we need to maintain compatibility.
    // Use the underlying memoryCache directly for sync access.
    const prefixedKey = `intel:${key}`;
    // Access the in-memory layer synchronously via a synchronous wrapper
    const cached = (globalCache as any).memoryCache?.get?.(prefixedKey) ?? null;
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidateCountryIntelligence(countryId: string): number {
    // Delegate to globalCache pattern-based deletion
    // We can't easily do pattern matching on globalCache, so clear by known patterns
    const patterns = [`intel:country:${countryId}`, `intel:intelligence:${countryId}`, `intel:vitality:${countryId}`];
    let count = 0;
    for (const key of patterns) {
      void globalCache.delete(key);
      count++;
    }
    return count;
  }

  invalidateByPattern(_pattern: RegExp): number {
    // Pattern-based invalidation not supported on globalCache facade
    // Callers should use specific key invalidation instead
    return 0;
  }

  invalidateByType(_type: CacheType): number {
    // Type-based invalidation not practical in consolidated cache
    return 0;
  }

  update(key: string, data: any): boolean {
    const prefixedKey = `intel:${key}`;
    const existing = (globalCache as any).memoryCache?.get?.(prefixedKey);
    if (existing === null || existing === undefined) return false;
    void globalCache.set(prefixedKey, data, { ttl: TTL_BY_TYPE.standard, skipRedis: true });
    return true;
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalEntries: 0, // Cannot determine from globalCache
      memoryUsage: 0,
      averageAccessTime: 0,
      mostAccessedKeys: [] as string[],
    };
  }

  clear(): void {
    // Cannot selectively clear intel: keys from globalCache without iteration.
    // This is called by MemoryOptimizer.clearAllCaches() which also clears globalCache,
    // so this is effectively a no-op.
    this.stats = { hits: 0, misses: 0, startTime: Date.now() };
  }

  destroy(): void {
    this.clear();
  }

  async preload(_countryIds: string[]): Promise<void> {
    // No-op: preloading placeholder was never implemented
  }
}

// Global cache instance — no Map, no setInterval
export const intelligenceCache = new IntelligenceCacheFacade();

/**
 * Cache utilities for common intelligence patterns
 */
export const CacheUtils = {
  generateKey: (type: string, id: string, suffix?: string): string => {
    return suffix ? `${type}:${id}:${suffix}` : `${type}:${id}`;
  },

  setWithInvalidation: (key: string, data: any, type: CacheType, _countryId?: string): void => {
    intelligenceCache.set(key, data, type);
  },

  setBatch: (entries: Array<{ key: string; data: any; type: CacheType }>): void => {
    entries.forEach(({ key, data, type }) => {
      intelligenceCache.set(key, data, type);
    });
  },

  getWithFallback: async <T>(
    key: string,
    fallbackFn: () => Promise<T>,
    type: CacheType = "standard"
  ): Promise<T> => {
    const cached = intelligenceCache.get(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await fallbackFn();
    intelligenceCache.set(key, fresh, type);
    return fresh;
  },
};
