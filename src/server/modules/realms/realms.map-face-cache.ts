/**
 * The per-process caches behind a realm's map face and hero map (realms.map-face.ts), and their invalidation when a
 * nation's claim status changes. Apart from the map SQL so the ownership writer can clear them cheaply.
 */

const CACHE_TTL_MS = 3_600_000;
/** How long a failed build is remembered as "no face", so a broken realm is not re-queried on every
 * card render. Short, so a fixed realm comes back soon. */
const FAILURE_TTL_MS = 300_000;
/** An invalidation from inside a transaction runs before the write commits, so a build in that gap reads the old
 * rows. For this long after an invalidation, builds are kept only until the window closes. */
const SETTLE_MS = 10_000;

interface CacheEntry<T> {
  expires: number;
  /** The `Realm.mapVersion` it was built at; another version is a miss. */
  version: number;
  value: Promise<T | null>;
}

// ponytail: per-process caches; move to Redis if IxStats runs more than one instance
const stores = new Set<Map<string, unknown>>();
/** When each realm's entries were last dropped, for the settle window. */
const invalidatedAt = new Map<string, number>();

/** A new cache keyed by realm id, cleared by `invalidateRealmMapFace`. */
export function realmMapCache<T>(): Map<string, CacheEntry<T>> {
  const store = new Map<string, CacheEntry<T>>();
  stores.add(store);
  return store;
}

/**
 * A nation's claim status changed (claimed, released, made claimable or reserved): drop the realm's map face and
 * hero map. Map edits need no call: they move `Realm.mapVersion`, which the caches key on. Per process.
 */
export function invalidateRealmMapFace(realmId: string, now = Date.now()): void {
  for (const store of stores) store.delete(realmId);
  invalidatedAt.set(realmId, now);
}

/** How long a build made now may be kept: until the settle window of a recent invalidation closes, else an hour. */
function cacheTtl(realmId: string, now: number): number {
  const last = invalidatedAt.get(realmId) ?? -Infinity;
  return now - last < SETTLE_MS ? last + SETTLE_MS - now : CACHE_TTL_MS;
}

/** `build` through `store`: a live entry at `version` is returned as is (in flight or settled); a failed build is
 * logged and remembered as null for `FAILURE_TTL_MS`. */
export function cachedBuild<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  version: number,
  build: () => Promise<T | null>,
  label: string,
  now: number
): Promise<T | null> {
  const hit = store.get(key);
  if (hit && hit.version === version && hit.expires > now) return hit.value;
  const value = build().catch((error: Error) => {
    console.error(`[realms] ${label} failed for realm ${key}:`, error);
    store.set(key, { expires: now + FAILURE_TTL_MS, version, value: Promise.resolve(null) });
    return null;
  });
  store.set(key, { expires: now + cacheTtl(key, now), version, value });
  return value;
}
