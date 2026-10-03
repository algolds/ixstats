/**
 * tRPC Server-Side Cache Middleware
 *
 * Provides Redis-backed (with in-memory fallback) caching for tRPC query results.
 * This dramatically reduces database load for frequently accessed, read-heavy endpoints.
 *
 * Features:
 * - Redis primary (shared client) with in-memory fallback only while Redis is not ready
 * - Configurable TTL per procedure
 * - Automatic cache key generation from path + input
 * - User-aware caching (optional)
 * - Only queries are cached (mutations/subscriptions skipped by procedure type)
 *
 * Usage in trpc.ts:
 *   export const cachedPublicProcedure = publicProcedure
 *     .use(createTrpcCacheMiddleware({ ttlSeconds: 60 }));
 */

import { createHash } from "crypto";
import superjson from "superjson";
import type { SuperJSONResult } from "superjson";
import type { createTRPCContext } from "~/server/api/trpc";
import { memoryConfig } from "~/lib/system/dev-memory-config";
import { getSharedRedis, isRedisReady, deleteKeysByPattern } from "./redis-client";

// Type for the tRPC middleware context
type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

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
  if (process.env.NODE_ENV === "test" || typeof process.env.JEST_WORKER_ID !== "undefined") return;

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

  if (cleanupInterval?.unref) {
    cleanupInterval.unref();
  }
}

startMemoryCacheCleanup();

/**
 * Cache options for the middleware
 */
interface TrpcCacheOptions {
  /** Time to live in seconds */
  ttlSeconds: number;
  /** Cache namespace (optional, defaults to 'default') */
  namespace?: string;
  /** Whether to include user ID in cache key (for user-specific caches) */
  userAware?: boolean;
  /** Path patterns to skip caching (non-query procedures are always skipped) */
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
  namespace: string = "default",
  realmId?: string
): string {
  // Use hash-based key generation for better performance with complex inputs
  // MD5 is fast and collision-resistant enough for cache keys
  const inputHash = input
    ? createHash("md5").update(safeJsonStringify(input)).digest("hex").substring(0, 16)
    : "no-input";
  const userPart = userId ? `:u:${userId.substring(0, 12)}` : "";
  const realmPart = realmId ? `:r:${realmId}` : "";
  return `trpc:${namespace}:${path}${userPart}${realmPart}:${inputHash}`;
}

type TrpcProcedureType = "query" | "mutation" | "subscription";

/**
 * Only queries are cached; custom skip patterns can exclude specific query paths.
 */
export function shouldSkipCache(
  type: TrpcProcedureType,
  path: string,
  skipPatterns?: RegExp[]
): boolean {
  if (type !== "query") return true;
  return skipPatterns?.some((p) => p.test(path)) ?? false;
}

/** Parse a Redis value written as JSON.stringify(superjson.serialize(v)); null for legacy/invalid values. */
function parseRedisPayload(raw: string): SuperJSONResult | null {
  const parsed: SuperJSONResult | null = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || !("json" in parsed)) return null;
  return parsed;
}

/**
 * Get cached value. While Redis is ready it is the only tier (a Redis miss is a miss);
 * memory is used only when Redis is unavailable or errors.
 */
async function getCachedValue<T>(key: string): Promise<T | null> {
  const redisClient = getSharedRedis();

  if (isRedisReady(redisClient)) {
    try {
      const raw = await redisClient.get(key);
      if (raw === null) return null;
      const payload = parseRedisPayload(raw);
      if (!payload) return null;
      const value = superjson.deserialize<T | undefined>(payload);
      return value === undefined ? null : value;
    } catch (err) {
      console.warn("[TRPC_CACHE] Redis get error, falling back to memory:", err);
    }
  }

  // Try memory cache
  const memEntry = memoryCache.get(key);
  if (memEntry && memEntry.expiry > Date.now()) {
    return memEntry.data as T;
  }

  // Clean up expired entry
  if (memEntry) {
    memoryCache.delete(key);
  }

  return null;
}

/**
 * Set cached value in Redis when ready, otherwise in the size-capped memory cache.
 */
async function setCachedValue<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redisClient = getSharedRedis();

  if (isRedisReady(redisClient)) {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(superjson.serialize(value)));
    } catch (err) {
      // Includes unserializable (e.g. circular) values: skip caching rather than failing the request
      console.warn("[TRPC_CACHE] Redis set error, value not cached:", err);
    }
    return;
  }

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

// tRPC's `middlewareMarker` (not exported from a stable entrypoint).
const MIDDLEWARE_MARKER = "middlewareMarker";

type CachedData = NonNullable<unknown>;

/** tRPC's next() resolves to { ok: false, error } when the procedure throws. */
function isFailedResult<T>(result: T): boolean {
  return typeof result === "object" && result !== null && "ok" in result && result.ok === false;
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
    type: TrpcProcedureType;
    input: unknown;
    next: () => Promise<T>;
    /** The viewer's realm when it isn't IxWorld (computed by the tRPC middleware, ruling E-q). */
    realmKey?: string;
  }): Promise<T> {
    const { ctx, path, type, input, next, realmKey } = opts;

    // Only queries are cached
    if (shouldSkipCache(type, path, skipPatterns)) {
      return next();
    }

    // Generate cache key. Realm-scoped listings fall back to the viewer's active nation's realm
    // when the input names none, so that realm is part of the key (ruling E-h).
    const userId = userAware ? (ctx.auth?.userId ?? undefined) : undefined;
    const cacheKey = generateCacheKey(path, input, userId, namespace, realmKey);

    // Check cache
    const cached = await getCachedValue<CachedData>(cacheKey);
    if (cached !== null) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[TRPC_CACHE] HIT: ${path}`);
      }
      // Rebuilt around the current request's ctx: the stored payload is only the procedure's data.
      return { marker: MIDDLEWARE_MARKER, ok: true, data: cached, ctx } as T;
    }

    // Execute procedure
    const result = await next();

    // Cache result (never a failed one, or the error would be replayed for the whole TTL)
    // Only `data` is stored: the result envelope carries ctx (Prisma client, headers, auth),
    // which superjson rejects ("Detected property constructor") and must never be replayed.
    if (!isFailedResult(result)) {
      await setCachedValue(cacheKey, (result as { data?: CachedData }).data, ttlSeconds);
    }

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
  const redisClient = getSharedRedis();

  // Clear from Redis (SCAN + UNLINK; never blocks Redis like KEYS)
  if (isRedisReady(redisClient)) {
    try {
      for (const pattern of patterns) {
        const deleted = await deleteKeysByPattern(redisClient, `trpc:*${pattern}*`);
        if (deleted > 0) {
          console.log(`[TRPC_CACHE] Invalidated ${deleted} Redis keys matching: ${pattern}`);
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

// Shared invalidation key sets for geo feature writes (Plan 119 §2.3)
export const GEO_FEATURE_INVALIDATE_KEYS: string[] = [
  "geoCore.getCountryFeatures",
  "geoCore.getMapBundle",
  "geoCore.getWorldMap",
  "geoCore.getAllMapFeatures",
  "countryGeo.getCountryGeoBundle",
];

export const GEO_FEATURE_INVALIDATE_KEYS_WITH_STORY_PINS: string[] = [
  ...GEO_FEATURE_INVALIDATE_KEYS,
  "geoFeatures.getAllStoryPins",
];

export const GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS: string[] = [
  ...GEO_FEATURE_INVALIDATE_KEYS,
  "geoFeatures.getAllMapLabels",
];

export function clearTrpcMemoryCache(): void {
  memoryCache.clear();
  console.log("[TRPC_CACHE] Module-level memory cache cleared manually");
}
