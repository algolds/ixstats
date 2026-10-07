/**
 * IndexedDB persistent cache for map GeoJSON data.
 *
 * Stores the 22MB+ map layer response in IndexedDB so it survives
 * page refreshes without re-fetching from the server.
 *
 * Entries are per realm. Each records the realm the server resolved the layers for, so one
 * realm's cached map never stands in for another's — e.g. after the viewer's active nation
 * moves to another realm (ruling E-h).
 */

const DB_NAME = "ixworld-map-cache";
const STORE_NAME = "layers";
// v3: entries carry the realm they belong to (older, realm-less entries are dropped on upgrade)
// 4: rivers, lakes and altitudes moved to vector tiles; drop entries that still carry them
const DB_VERSION = 4;
const CACHE_KEY = "worldMapLayers";
// 24 hours - matches server-side static layer TTL
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Which realm's map a cache read or write is for. */
export interface MapCacheScope {
  /** The map's `?realm=` slug, when it names one */
  realm?: string;
  /** Without a slug: the realm the server resolves for this viewer (active nation's, else IxWorld); undefined while unknown */
  viewerRealmId?: string;
}

interface CachedEntry {
  key: string;
  data: unknown;
  /** The realm the server resolved these layers for, when known */
  realmId?: string;
  timestamp: number;
}

/** One entry per `?realm=` slug, else per the viewer's realm id; null (no caching) while that realm is unknown. */
export function mapLayersCacheKey(scope: MapCacheScope): string | null {
  if (scope.realm) return `${CACHE_KEY}:slug:${scope.realm}`;
  return scope.viewerRealmId ? `${CACHE_KEY}:realm:${scope.viewerRealmId}` : null;
}

/**
 * Whether layers resolved for `realmId` belong under this scope. A slug always resolves to the same
 * realm, so its entry is its own; without a slug the layers must be the viewer's realm's.
 */
export function isCacheEntryForScope(realmId: string | undefined, scope: MapCacheScope): boolean {
  if (scope.realm) return true;
  return realmId !== undefined && realmId === scope.viewerRealmId;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Drop old store on version upgrade to invalidate stale data
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** The entry's layers when it is fresh and belongs to the scope's realm, else null (expired ones are deleted). */
function usableLayers(
  db: IDBDatabase,
  entry: CachedEntry | undefined,
  scope: MapCacheScope
): Record<string, unknown> | null {
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(entry.key);
    return null;
  }
  return isCacheEntryForScope(entry.realmId, scope)
    ? (entry.data as Record<string, unknown>)
    : null;
}

/**
 * Get this scope's cached map layers from IndexedDB.
 * Returns null if the realm is unknown, or the entry is missing, expired, or another realm's.
 */
export async function getCachedMapLayers(
  scope: MapCacheScope
): Promise<Record<string, unknown> | null> {
  const key = mapLayersCacheKey(scope);
  if (!key) return null;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(usableLayers(db, req.result as CachedEntry | undefined, scope));
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Store layers the server resolved for `realmId` under this scope — skipped while the realm is
 * unknown, or when the layers are another realm's (e.g. the viewer's profile is stale).
 */
export async function setCachedMapLayers(
  scope: MapCacheScope,
  data: Record<string, unknown>,
  realmId: string | undefined
): Promise<void> {
  const key = mapLayersCacheKey(scope);
  if (!key || !isCacheEntryForScope(realmId, scope)) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, data, realmId, timestamp: Date.now() } satisfies CachedEntry);
  } catch {
    // Silently fail — cache is best-effort
  }
}
