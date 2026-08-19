/**
 * IndexedDB persistent cache for map GeoJSON data.
 *
 * Stores the 22MB+ map layer response in IndexedDB so it survives
 * page refreshes without re-fetching from the server.
 */

const DB_NAME = "ixworld-map-cache";
const STORE_NAME = "layers";
const DB_VERSION = 2;
const CACHE_KEY = "worldMapLayers";
// 24 hours - matches server-side static layer TTL
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface CachedEntry {
  key: string;
  data: unknown;
  timestamp: number;
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

/**
 * Get cached map layers from IndexedDB.
 * Returns null if not found or expired.
 */
export async function getCachedMapLayers(): Promise<Record<string, unknown> | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        const entry = req.result as CachedEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        if (Date.now() - entry.timestamp > CACHE_TTL) {
          // Expired — delete in background
          const delTx = db.transaction(STORE_NAME, "readwrite");
          delTx.objectStore(STORE_NAME).delete(CACHE_KEY);
          resolve(null);
          return;
        }
        resolve(entry.data as Record<string, unknown>);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Store map layers in IndexedDB for persistent caching.
 */
export async function setCachedMapLayers(data: Record<string, unknown>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key: CACHE_KEY, data, timestamp: Date.now() } satisfies CachedEntry);
  } catch {
    // Silently fail — cache is best-effort
  }
}
