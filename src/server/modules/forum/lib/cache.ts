// src/lib/forum/cache.ts
// In-memory TTL cache for XenForo API responses — delegates to unified Cache.

import { Cache } from "~/lib/cache";

export const FORUM_CACHE_TTL = {
  forums: 30 * 60 * 1000,
  threadList: 2 * 60 * 1000,
  thread: 60 * 1000,
  post: 60 * 1000,
  member: 10 * 60 * 1000,
  search: 5 * 60 * 1000,
  alerts: 30 * 1000,
  conversations: 60 * 1000,
} as const;

export type ForumCacheType = keyof typeof FORUM_CACHE_TTL;

const forumCache = new Cache({
  defaultTtlMs: 60_000,
  maxSize: 500,
  namespace: "forum",
});

export function cacheKey(type: ForumCacheType, ...parts: (string | number)[]): string {
  return `forum:${type}:${parts.join(":")}`;
}

export function cacheGet<T>(key: string): T | null {
  return forumCache.get<T>(key) ?? null;
}

export function cacheSet<T>(key: string, data: T, type: ForumCacheType): void {
  forumCache.set(key, data, FORUM_CACHE_TTL[type]);
}

export function cacheInvalidate(prefix: string): void {
  const keysToDelete: string[] = [];
  forumCache.forEach((_v, key) => {
    if (key.startsWith(prefix)) keysToDelete.push(key);
  });
  keysToDelete.forEach((k) => forumCache.delete(k));
}

export function invalidateThread(threadId: number): void {
  cacheInvalidate(`forum:thread:${threadId}`);
  cacheInvalidate(`forum:post:`);
}

export function cacheClear(): void {
  const keysToDelete: string[] = [];
  forumCache.forEach((_v, key) => {
    if (key.startsWith("forum:")) keysToDelete.push(key);
  });
  keysToDelete.forEach((k) => forumCache.delete(k));
}

export async function cachedFetch<T>(
  key: string,
  type: ForumCacheType,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  if (data != null) {
    cacheSet(key, data, type);
  }
  return data;
}
