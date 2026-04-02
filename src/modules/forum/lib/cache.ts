// src/lib/forum/cache.ts
// In-memory TTL cache for XenForo API responses.
// Same pattern as xenforo-service.ts but with configurable TTLs per entity type.

// ---------------------------------------------------------------------------
// Cache configuration
// ---------------------------------------------------------------------------

/** Cache TTL in milliseconds per entity type */
export const FORUM_CACHE_TTL = {
  /** Forum/category list — rarely changes */
  forums: 30 * 60 * 1000, // 30 min
  /** Thread list for a forum */
  threadList: 2 * 60 * 1000, // 2 min
  /** Thread content with posts */
  thread: 60 * 1000, // 1 min
  /** Individual post */
  post: 60 * 1000, // 1 min
  /** Member profile */
  member: 10 * 60 * 1000, // 10 min
  /** Search results */
  search: 5 * 60 * 1000, // 5 min
  /** User alerts */
  alerts: 30 * 1000, // 30 sec
  /** Conversations */
  conversations: 60 * 1000, // 1 min
} as const;

export type ForumCacheType = keyof typeof FORUM_CACHE_TTL;

// ---------------------------------------------------------------------------
// Cache implementation
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/** Maximum cache entries to prevent unbounded memory growth */
const MAX_CACHE_SIZE = 500;

/**
 * Build a cache key from type and params.
 */
export function cacheKey(type: ForumCacheType, ...parts: (string | number)[]): string {
  return `forum:${type}:${parts.join(":")}`;
}

/**
 * Get a cached value if it exists and hasn't expired.
 */
export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt > entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set a cached value with TTL.
 */
export function cacheSet<T>(key: string, data: T, type: ForumCacheType): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    cache.forEach((v, k) => {
      if (v.fetchedAt < oldestTime) {
        oldestTime = v.fetchedAt;
        oldest = k;
      }
    });
    if (oldest) cache.delete(oldest);
  }

  cache.set(key, { data, fetchedAt: Date.now(), ttl: FORUM_CACHE_TTL[type] });
}

/**
 * Invalidate specific cache entries by key prefix.
 */
export function cacheInvalidate(prefix: string): void {
  const keysToDelete: string[] = [];
  cache.forEach((_v, key) => {
    if (key.startsWith(prefix)) keysToDelete.push(key);
  });
  keysToDelete.forEach((k) => cache.delete(k));
}

/**
 * Invalidate all thread-related caches for a specific thread.
 * Called after creating/editing/deleting a post.
 */
export function invalidateThread(threadId: number): void {
  cacheInvalidate(`forum:thread:${threadId}`);
  cacheInvalidate(`forum:post:`);
}

/**
 * Clear entire forum cache (admin use).
 */
export function cacheClear(): void {
  const keysToDelete: string[] = [];
  cache.forEach((_v, key) => {
    if (key.startsWith("forum:")) keysToDelete.push(key);
  });
  keysToDelete.forEach((k) => cache.delete(k));
}

/**
 * Get-or-fetch pattern: returns cached data or calls fetcher, then caches result.
 */
export async function cachedFetch<T>(
  key: string,
  type: ForumCacheType,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  // Don't cache null/undefined results (failed API calls)
  if (data != null) {
    cacheSet(key, data, type);
  }
  return data;
}
