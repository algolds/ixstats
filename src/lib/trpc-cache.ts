/**
 * tRPC Server-Side Cache Middleware
 *
 * Provides Redis-backed (with in-memory fallback) caching for tRPC query results.
 * This dramatically reduces database load for frequently accessed, read-heavy endpoints.
 *
 * Features:
 * - Redis primary with in-memory fallback
 * - Configurable TTL per procedure
 * - Automatic cache key generation from path + input
 * - User-aware caching (optional)
 * - Mutation detection to skip caching
 *
 * Usage in trpc.ts:
 *   export const cachedPublicProcedure = publicProcedure
 *     .use(createTrpcCacheMiddleware({ ttlSeconds: 60 }));
 */

import { Redis } from "ioredis";
// eslint-disable-next-line unused-imports/no-unused-imports
import { initTRPC } from "@trpc/server";
import { createHash } from "crypto";
import type { createTRPCContext } from "~/server/api/trpc";
import { memoryConfig } from "~/lib/dev-memory-config";

// Type for the tRPC middleware context
type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// Redis client (lazy initialized)
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  const redisEnabled = process.env.REDIS_ENABLED === "true";

  if (redisUrl && redisEnabled) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      redis.on("error", (err) => {
        console.warn("[TRPC_CACHE] Redis connection error:", err.message);
        // Don't crash on Redis errors, fall back to memory cache
      });

      redis.on("connect", () => {
        console.log("[TRPC_CACHE] Connected to Redis");
      });

      return redis;
    } catch (err) {
      console.warn("[TRPC_CACHE] Failed to connect to Redis, using memory cache fallback");
      return null;
    }
  }

  return null;
}

// In-memory cache with TTL support
interface MemoryCacheEntry {
  data: unknown;
  expiry: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

if (process.env.NODE_ENV === "development") {
  memoryCache.clear(); // HMR cache bust trigger
}

const MAX_MEMORY_CACHE_SIZE = memoryConfig.trpc.maxCacheSize;

// Clean up expired entries periodically
let cleanupInterval: NodeJS.Timeout | null = null;

function startMemoryCacheCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let deleted = 0;

    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiry < now) {
        memoryCache.delete(key);
        deleted++;
      }
    }

    if (deleted > 0 && process.env.NODE_ENV === "development") {
      console.log(`[TRPC_CACHE] Cleaned up ${deleted} expired memory cache entries`);
    }
  }, 60 * 1000); // Clean up every minute
}

startMemoryCacheCleanup();

/**
 * Cache options for the middleware
 */
export interface TrpcCacheOptions {
  /** Time to live in seconds */
  ttlSeconds: number;
  /** Cache namespace (optional, defaults to 'default') */
  namespace?: string;
  /** Whether to include user ID in cache key (for user-specific caches) */
  userAware?: boolean;
  /** Patterns to skip caching (mutations are always skipped) */
  skipPatterns?: RegExp[];
}

/**
 * Safe JSON stringify that handles circular references and filters out database/client pointers
 */
function safeJsonStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
      // Filter out internal database client pointers to avoid circular serializations
      if (key === "_originalClient" || key === "prisma" || key === "db") {
        return undefined;
      }
    }
    return value;
  });
}

/**
 * Generate a cache key from procedure path and input
 * Uses MD5 hash for input to reduce key length and improve Redis performance
 */
function generateCacheKey(
  path: string,
  input: unknown,
  userId?: string,
  namespace: string = "default"
): string {
  // Use hash-based key generation for better performance with complex inputs
  // MD5 is fast and collision-resistant enough for cache keys
  const inputHash = input
    ? createHash("md5").update(safeJsonStringify(input)).digest("hex").substring(0, 16)
    : "no-input";
  const userPart = userId ? `:u:${userId.substring(0, 12)}` : "";
  return `trpc:${namespace}:${path}${userPart}:${inputHash}`;
}

/**
 * Check if procedure path should skip caching
 */
function shouldSkipCache(path: string, skipPatterns?: RegExp[]): boolean {
  // Always skip mutations
  const mutationPatterns = [
    /create/i,
    /update/i,
    /delete/i,
    /upsert/i,
    /add/i,
    /remove/i,
    /set/i,
    /mutation/i,
    /execute/i,
    /action/i,
    /respond/i,
    /cancel/i,
    /submit/i,
    /send/i,
    /save/i,
    /upload/i,
    /batch/i,
    /sync/i,
    /copy/i,
    /clone/i,
    /import/i,
    /export/i,
    /publish/i,
    /generate/i,
    /seed/i,
    /migrate/i,
    /reset/i,
  ];

  for (const pattern of mutationPatterns) {
    if (pattern.test(path)) return true;
  }

  // Check custom skip patterns
  if (skipPatterns) {
    for (const pattern of skipPatterns) {
      if (pattern.test(path)) return true;
    }
  }

  return false;
}

/**
 * Get cached value from Redis or memory
 */
async function getCachedValue(key: string): Promise<unknown | null> {
  const redisClient = getRedisClient();

  if (redisClient && redisClient.status === "ready") {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn("[TRPC_CACHE] Redis get error, falling back to memory:", err);
    }
  }

  // Try memory cache
  const memEntry = memoryCache.get(key);
  if (memEntry && memEntry.expiry > Date.now()) {
    return memEntry.data;
  }

  // Clean up expired entry
  if (memEntry) {
    memoryCache.delete(key);
  }

  return null;
}

/**
 * Set cached value in Redis and memory
 */
async function setCachedValue(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redisClient = getRedisClient();

  // Try to set in Redis
  if (redisClient && redisClient.status === "ready") {
    try {
      await redisClient.setex(key, ttlSeconds, safeJsonStringify(value));
    } catch (err) {
      console.warn("[TRPC_CACHE] Redis set error:", err);
    }
  }

  // Also set in memory cache as backup/fallback
  // Enforce max size with LRU-style eviction
  if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
    // Delete oldest entries (first 10%)
    const entriesToDelete = Math.floor(MAX_MEMORY_CACHE_SIZE * 0.1);
    const keys = Array.from(memoryCache.keys()).slice(0, entriesToDelete);
    for (const k of keys) {
      memoryCache.delete(k);
    }
  }

  memoryCache.set(key, {
    data: value,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Create a tRPC cache middleware factory
 *
 * Note: This returns a function that creates the actual middleware,
 * which needs to be integrated with the tRPC instance in trpc.ts
 */
export function createCacheMiddlewareFactory(options: TrpcCacheOptions) {
  const { ttlSeconds, namespace = "default", userAware = false, skipPatterns } = options;

  return async function cacheMiddleware<T>(opts: {
    ctx: TRPCContext;
    path: string;
    input: unknown;
    next: () => Promise<T>;
  }): Promise<T> {
    const { ctx, path, input, next } = opts;

    // Skip caching for mutations
    if (shouldSkipCache(path, skipPatterns)) {
      return next();
    }

    // Generate cache key
    const userId = userAware ? (ctx.auth?.userId ?? undefined) : undefined;
    const cacheKey = generateCacheKey(path, input, userId, namespace);

    // Check cache
    const cached = await getCachedValue(cacheKey);
    if (cached !== null) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[TRPC_CACHE] HIT: ${path}`);
      }
      return cached as T;
    }

    // Execute procedure
    const result = await next();

    // Cache result
    await setCachedValue(cacheKey, result, ttlSeconds);

    if (process.env.NODE_ENV === "development") {
      console.log(`[TRPC_CACHE] MISS: ${path} (cached for ${ttlSeconds}s)`);
    }

    return result;
  };
}

/**
 * Cache invalidation helper
 * Call this when data changes to clear related caches
 */
export async function invalidateCache(patterns: string[]): Promise<void> {
  const redisClient = getRedisClient();

  // Clear from Redis
  if (redisClient) {
    try {
      for (const pattern of patterns) {
        const keys = await redisClient.keys(`trpc:*${pattern}*`);
        if (keys.length > 0) {
          await redisClient.del(...keys);
          console.log(`[TRPC_CACHE] Invalidated ${keys.length} Redis keys matching: ${pattern}`);
        }
      }
    } catch (err) {
      console.warn("[TRPC_CACHE] Redis invalidation error:", err);
    }
  }

  // Clear from memory cache
  let deleted = 0;
  for (const [key] of memoryCache.entries()) {
    for (const pattern of patterns) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
        deleted++;
        break;
      }
    }
  }

  if (deleted > 0) {
    console.log(`[TRPC_CACHE] Invalidated ${deleted} memory cache entries`);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  memoryCacheSize: number;
  redisConnected: boolean;
} {
  return {
    memoryCacheSize: memoryCache.size,
    redisConnected: redis?.status === "ready",
  };
}

// Pre-configured cache middleware factories for common use cases
export const cacheConfigs = {
  /** Static data that rarely changes (1 hour) */
  static: { ttlSeconds: 3600, namespace: "static" },
  /** Slow-changing data (5 minutes) */
  slow: { ttlSeconds: 300, namespace: "slow" },
  /** Standard data (1 minute) */
  standard: { ttlSeconds: 60, namespace: "standard" },
  /** Fast-changing data (15 seconds) */
  fast: { ttlSeconds: 15, namespace: "fast" },
  /** User-specific data (30 seconds) */
  userSpecific: { ttlSeconds: 30, namespace: "user", userAware: true },
} as const;
