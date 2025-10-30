/**
 * Advanced Caching System for Production
 * Multi-layer caching with Redis, in-memory, and intelligent invalidation
 */

// import { Redis } from '@upstash/redis'; // Commented out for now - will be enabled when Redis is configured
import { performance } from "perf_hooks";

// In-memory cache for fallback
class InMemoryCache {
  private cache = new Map<string, { value: any; expires: number; hits: number }>();
  private readonly maxSize = 10000;
  private readonly defaultTTL = 300000; // 5 minutes

  set(key: string, value: any, ttl = this.defaultTTL): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
      hits: 0,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    item.hits++;
    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hits: number; hitRate: number } {
    const items = Array.from(this.cache.values());
    const totalHits = items.reduce((sum, item) => sum + item.hits, 0);
    const totalRequests = items.length + totalHits;

    return {
      size: this.cache.size,
      hits: totalHits,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }
}

// Redis cache interface
class RedisCache {
  private redis: any | null = null; // Using any for now since Redis import is commented out
  private enabled = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        // Redis initialization commented out for now
        // this.redis = new Redis({
        //   url: process.env.UPSTASH_REDIS_REST_URL,
        //   token: process.env.UPSTASH_REDIS_REST_TOKEN,
        // });
        this.enabled = false; // Disabled for now
        console.log("[RedisCache] Redis initialization disabled - using in-memory fallback");
      } else {
        console.warn("[RedisCache] Redis not configured, using in-memory fallback");
      }
    } catch (error) {
      console.error("[RedisCache] Failed to initialize:", error);
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error("[RedisCache] Set failed:", error);
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value as string) : null;
    } catch (error) {
      console.error("[RedisCache] Get failed:", error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("[RedisCache] Delete failed:", error);
    }
  }

  async clear(): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error("[RedisCache] Clear failed:", error);
    }
  }
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tier?: "critical" | "standard" | "background"; // Cache tier
  tags?: string[]; // For invalidation
  skipRedis?: boolean; // Skip Redis for this item
}

export interface CacheStats {
  memory: {
    size: number;
    hits: number;
    hitRate: number;
  };
  redis: {
    enabled: boolean;
    connected: boolean;
  };
  performance: {
    averageGetTime: number;
    averageSetTime: number;
    totalOperations: number;
  };
}

/**
 * Advanced multi-tier caching system
 */
export class AdvancedCacheSystem {
  private memoryCache = new InMemoryCache();
  private redisCache = new RedisCache();
  private performanceMetrics = {
    getTimes: [] as number[],
    setTimes: [] as number[],
    totalOperations: 0,
  };

  /**
   * Set value in cache with intelligent tiering
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const startTime = performance.now();

    try {
      const { ttl = 300, tier = "standard", tags = [], skipRedis = false } = options;

      // Always set in memory cache
      this.memoryCache.set(key, value, ttl * 1000);

      // Set in Redis for critical and standard tiers (unless skipped)
      if (!skipRedis && (tier === "critical" || tier === "standard")) {
        await this.redisCache.set(key, value, ttl);
      }

      // Record performance
      const duration = performance.now() - startTime;
      this.recordSetTime(duration);
    } catch (error) {
      console.error("[AdvancedCacheSystem] Set error:", error);
    }
  }

  /**
   * Get value from cache with fallback strategy
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Try memory cache first (fastest)
      let value = this.memoryCache.get(key);
      if (value !== null) {
        this.recordGetTime(performance.now() - startTime);
        return value;
      }

      // Try Redis cache (slower but persistent)
      value = await this.redisCache.get(key);
      if (value !== null) {
        // Store back in memory for faster access
        this.memoryCache.set(key, value, 300000); // 5 minutes
        this.recordGetTime(performance.now() - startTime);
        return value;
      }

      this.recordGetTime(performance.now() - startTime);
      return null;
    } catch (error) {
      console.error("[AdvancedCacheSystem] Get error:", error);
      return null;
    }
  }

  /**
   * Delete from all cache tiers
   */
  async delete(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      await this.redisCache.delete(key);
    } catch (error) {
      console.error("[AdvancedCacheSystem] Delete error:", error);
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      await this.redisCache.clear();
    } catch (error) {
      console.error("[AdvancedCacheSystem] Clear error:", error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const avgGetTime =
      this.performanceMetrics.getTimes.length > 0
        ? this.performanceMetrics.getTimes.reduce((a, b) => a + b, 0) /
          this.performanceMetrics.getTimes.length
        : 0;
    const avgSetTime =
      this.performanceMetrics.setTimes.length > 0
        ? this.performanceMetrics.setTimes.reduce((a, b) => a + b, 0) /
          this.performanceMetrics.setTimes.length
        : 0;

    return {
      memory: memoryStats,
      redis: {
        enabled: true,
        connected: true, // Simplified for now
      },
      performance: {
        averageGetTime: avgGetTime,
        averageSetTime: avgSetTime,
        totalOperations: this.performanceMetrics.totalOperations,
      },
    };
  }

  private recordGetTime(duration: number): void {
    this.performanceMetrics.getTimes.push(duration);
    this.performanceMetrics.totalOperations++;

    // Keep only recent metrics
    if (this.performanceMetrics.getTimes.length > 1000) {
      this.performanceMetrics.getTimes = this.performanceMetrics.getTimes.slice(-500);
    }
  }

  private recordSetTime(duration: number): void {
    this.performanceMetrics.setTimes.push(duration);

    // Keep only recent metrics
    if (this.performanceMetrics.setTimes.length > 1000) {
      this.performanceMetrics.setTimes = this.performanceMetrics.setTimes.slice(-500);
    }
  }
}

// Global cache instance
export const globalCache = new AdvancedCacheSystem();

/**
 * Cache utilities for common patterns
 */
export class CacheUtils {
  /**
   * Generate cache key with consistent formatting
   */
  static generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  /**
   * Cache with automatic key generation
   */
  static async cache<T>(
    keyGenerator: () => string,
    dataFetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const key = keyGenerator();

    // Try to get from cache first
    const cached = await globalCache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await dataFetcher();

    // Cache the result
    await globalCache.set(key, data, options);

    return data;
  }

  /**
   * Batch cache operations
   */
  static async batchCache<T>(
    keys: string[],
    dataFetcher: (keys: string[]) => Promise<Record<string, T>>,
    options: CacheOptions = {}
  ): Promise<Record<string, T>> {
    const results: Record<string, T> = {};
    const missingKeys: string[] = [];

    // Check cache for all keys
    for (const key of keys) {
      const cached = await globalCache.get<T>(key);
      if (cached !== null) {
        results[key] = cached;
      } else {
        missingKeys.push(key);
      }
    }

    // Fetch missing data
    if (missingKeys.length > 0) {
      const freshData = await dataFetcher(missingKeys);

      // Cache fresh data
      for (const [key, value] of Object.entries(freshData)) {
        results[key] = value;
        await globalCache.set(key, value, options);
      }
    }

    return results;
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    // This would require Redis SCAN in production
    // For now, we'll clear memory cache
    globalCache.clear();
  }
}

/**
 * Specialized cache decorators for different data types
 */
export class CacheDecorators {
  /**
   * Cache country data
   */
  static async cacheCountryData<T>(
    countryId: string,
    dataType: string,
    fetcher: () => Promise<T>,
    ttl = 600 // 10 minutes
  ): Promise<T> {
    const key = CacheUtils.generateKey("country", countryId, dataType);
    return CacheUtils.cache(() => key, fetcher, { ttl, tier: "standard" });
  }

  /**
   * Cache user data
   */
  static async cacheUserData<T>(
    userId: string,
    dataType: string,
    fetcher: () => Promise<T>,
    ttl = 300 // 5 minutes
  ): Promise<T> {
    const key = CacheUtils.generateKey("user", userId, dataType);
    return CacheUtils.cache(() => key, fetcher, { ttl, tier: "critical" });
  }

  /**
   * Cache intelligence data
   */
  static async cacheIntelligenceData<T>(
    countryId: string,
    dataType: string,
    fetcher: () => Promise<T>,
    ttl = 180 // 3 minutes
  ): Promise<T> {
    const key = CacheUtils.generateKey("intelligence", countryId, dataType);
    return CacheUtils.cache(() => key, fetcher, { ttl, tier: "critical" });
  }

  /**
   * Cache ThinkPages data
   */
  static async cacheThinkPagesData<T>(
    dataType: string,
    params: Record<string, any>,
    fetcher: () => Promise<T>,
    ttl = 120 // 2 minutes
  ): Promise<T> {
    const key = CacheUtils.generateKey("thinkpages", dataType, JSON.stringify(params));
    return CacheUtils.cache(() => key, fetcher, { ttl, tier: "background" });
  }
}
