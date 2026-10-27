/**
 * Advanced Caching System for Production
 * Multi-layer caching with Redis, in-memory, and intelligent invalidation
 */

// Note: Using globalThis.performance (available in Node.js 16+ and browsers)
import superjson from "superjson";
import type { SuperJSONResult } from "superjson";

import { memoryConfig } from "~/lib/system/dev-memory-config";
import { getSharedRedis, isRedisReady, deleteKeysByPattern } from "./redis-client";

// In-memory cache for fallback
class InMemoryCache {
  private cache = new Map<string, { value: any; expires: number; hits: number }>();
  private readonly maxSize = memoryConfig.cache.maxEntries;
  private readonly defaultTTL = memoryConfig.cache.defaultTTL;

  set(key: string, value: any, ttl: number = this.defaultTTL): void {
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

  deleteByPattern(pattern: string): void {
    const isWildcard = pattern.includes("*");
    if (isWildcard) {
      const regexStr = pattern.replace(/[-/\\^$*+?.()|[\]{}]/g, (ch) =>
        ch === "*" ? ".*" : "\\" + ch
      );
      const regex = new RegExp(`^${regexStr}$`);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.delete(pattern);
    }
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

// Redis cache interface (shared client; every key namespaced so clear() never touches other data)
const KEY_PREFIX = "acs:";

class RedisCache {
  isEnabled(): boolean {
    return getSharedRedis() !== null;
  }

  isConnected(): boolean {
    return isRedisReady(getSharedRedis());
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    const redis = getSharedRedis();
    if (!isRedisReady(redis)) return;

    try {
      await redis.setex(KEY_PREFIX + key, ttlSeconds, JSON.stringify(superjson.serialize(value)));
    } catch (error) {
      console.error("[RedisCache] Set failed:", error);
    }
  }

  async get(key: string): Promise<any | null> {
    const redis = getSharedRedis();
    if (!isRedisReady(redis)) return null;

    try {
      const raw = await redis.get(KEY_PREFIX + key);
      if (raw === null) return null;
      const payload: SuperJSONResult = JSON.parse(raw);
      return superjson.deserialize(payload) ?? null;
    } catch (error) {
      console.error("[RedisCache] Get failed:", error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const redis = getSharedRedis();
    if (!isRedisReady(redis)) return;

    try {
      await redis.del(KEY_PREFIX + key);
    } catch (error) {
      console.error("[RedisCache] Delete failed:", error);
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const redis = getSharedRedis();
    if (!isRedisReady(redis)) return;

    try {
      await deleteKeysByPattern(redis, KEY_PREFIX + pattern);
    } catch (error) {
      console.error("[RedisCache] Delete by pattern failed:", error);
    }
  }

  async clear(): Promise<void> {
    const redis = getSharedRedis();
    if (!isRedisReady(redis)) return;

    try {
      await deleteKeysByPattern(redis, KEY_PREFIX + "*");
    } catch (error) {
      console.error("[RedisCache] Clear failed:", error);
    }
  }
}

interface AdvancedCacheOptions {
  ttl?: number; // Time to live in seconds
  tier?: "critical" | "standard" | "background"; // Cache tier
  tags?: string[]; // For invalidation
  skipRedis?: boolean; // Skip Redis for this item
}

interface AdvancedCacheStats {
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

/** Memory-tier TTL cap while Redis is connected: bounds cross-process staleness after invalidation. */
const L1_MAX_TTL_MS = 30_000;

/**
 * Advanced multi-tier caching system
 */
class AdvancedCacheSystem {
  // Exposed for synchronous access by intelligence-cache facade
  readonly memoryCache = new InMemoryCache();
  private redisCache = new RedisCache();
  // Use running averages instead of storing arrays of individual timings
  private performanceMetrics = {
    getTimeSum: 0,
    getTimeCount: 0,
    setTimeSum: 0,
    setTimeCount: 0,
    totalOperations: 0,
  };

  /**
   * Set value in cache with intelligent tiering
   */
  async set(key: string, value: any, options: AdvancedCacheOptions = {}): Promise<void> {
    const startTime = performance.now();

    try {
      const { ttl = 300, tier = "standard", skipRedis = false } = options;

      // Redis holds critical and standard tiers (unless skipped) when connected
      const toRedis =
        !skipRedis && (tier === "critical" || tier === "standard") && this.redisCache.isConnected();

      // Always set in memory cache; short-lived when Redis is the shared source of truth
      this.memoryCache.set(key, value, toRedis ? Math.min(ttl * 1000, L1_MAX_TTL_MS) : ttl * 1000);

      if (toRedis) {
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
        this.memoryCache.set(key, value, L1_MAX_TTL_MS);
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

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      this.memoryCache.deleteByPattern(pattern);
      await this.redisCache.deleteByPattern(pattern);
    } catch (error) {
      console.error("[AdvancedCacheSystem] Delete by pattern error:", error);
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
  getStats(): AdvancedCacheStats {
    const memoryStats = this.memoryCache.getStats();
    const avgGetTime =
      this.performanceMetrics.getTimeCount > 0
        ? this.performanceMetrics.getTimeSum / this.performanceMetrics.getTimeCount
        : 0;
    const avgSetTime =
      this.performanceMetrics.setTimeCount > 0
        ? this.performanceMetrics.setTimeSum / this.performanceMetrics.setTimeCount
        : 0;

    return {
      memory: memoryStats,
      redis: {
        enabled: this.redisCache.isEnabled(),
        connected: this.redisCache.isConnected(),
      },
      performance: {
        averageGetTime: avgGetTime,
        averageSetTime: avgSetTime,
        totalOperations: this.performanceMetrics.totalOperations,
      },
    };
  }

  private recordGetTime(duration: number): void {
    this.performanceMetrics.getTimeSum += duration;
    this.performanceMetrics.getTimeCount++;
    this.performanceMetrics.totalOperations++;
  }

  private recordSetTime(duration: number): void {
    this.performanceMetrics.setTimeSum += duration;
    this.performanceMetrics.setTimeCount++;
  }
}

// Global cache instance
export const globalCache = new AdvancedCacheSystem();
