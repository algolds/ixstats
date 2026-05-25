/**
 * Stale-While-Revalidate Cache for Wiki API calls.
 *
 * Serves cached data instantly while refreshing in the background.
 * Positive results (found pages): cached for 24 hours
 * Negative results (not found): cached for 30 minutes before re-checking
 */

interface SWREntry<T> {
  data: T;
  cachedAt: number;
  positiveTTL: number;
  negativeTTL: number;
}

const cache = new Map<string, SWREntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;

function isExpired<T>(entry: SWREntry<T>): boolean {
  const ttl =
    entry.data !== null && entry.data !== undefined ? entry.positiveTTL : entry.negativeTTL;
  return Date.now() - entry.cachedAt > ttl;
}

function evictIfNeeded(): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export async function swrWikiFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: {
    positiveTTL?: number;
    negativeTTL?: number;
  } = {}
): Promise<T> {
  const positiveTTL = options.positiveTTL ?? 24 * 60 * 60 * 1000;
  const negativeTTL = options.negativeTTL ?? 30 * 60 * 1000;

  const cached = cache.get(cacheKey) as SWREntry<T> | undefined;

  // Cache hit and still fresh → return immediately
  if (cached && !isExpired(cached)) {
    return cached.data;
  }

  // Cache hit but stale → serve stale, refresh in background
  if (cached && isExpired(cached)) {
    if (!inflight.has(cacheKey)) {
      inflight.set(
        cacheKey,
        fetcher()
          .then((data) => {
            evictIfNeeded();
            cache.set(cacheKey, {
              data,
              cachedAt: Date.now(),
              positiveTTL,
              negativeTTL,
            });
            return data;
          })
          .finally(() => inflight.delete(cacheKey))
      );
    }
    return cached.data;
  }

  // No cache at all — deduplicate in-flight requests
  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey) as Promise<T>;
  }

  const promise = fetcher()
    .then((data) => {
      evictIfNeeded();
      cache.set(cacheKey, {
        data,
        cachedAt: Date.now(),
        positiveTTL,
        negativeTTL,
      });
      return data;
    })
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, promise);
  return promise;
}

export function invalidateWikiCache(pattern?: RegExp): void {
  if (pattern) {
    for (const key of Array.from(cache.keys())) {
      if (pattern.test(key)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}

export function getWikiCacheSize(): number {
  return cache.size;
}
