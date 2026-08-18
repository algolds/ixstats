/**
 * WikiOS Fast Client-Side LRU Cache & Draft Store
 *
 * Backed by IndexedDB with in-memory fallback for instant (<5ms) article reads
 * and offline/speculative navigation support.
 */

import type { CachedArticleData } from "~/lib/wiki-os/config";

const DB_NAME = "wikios_cache_v1";
const STORE_ARTICLES = "articles";
const STORE_DRAFTS = "drafts";
const MAX_CACHED_ARTICLES = 100;
const ARTICLE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DraftRecord {
  title: string;
  wikitext: string;
  updatedAt: number;
}

// In-memory fallback
const memoryArticles = new Map<string, CachedArticleData>();
const memoryDrafts = new Map<string, DraftRecord>();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_ARTICLES)) {
          const store = db.createObjectStore(STORE_ARTICLES, { keyPath: "title" });
          store.createIndex("fetchedAt", "fetchedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          db.createObjectStore(STORE_DRAFTS, { keyPath: "title" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/ /g, "_");
}

export async function getCachedArticle(title: string): Promise<CachedArticleData | null> {
  const norm = normalizeTitle(title);

  // Check in-memory first for 0ms hit
  const mem = memoryArticles.get(norm);
  if (mem) {
    if (Date.now() - mem.fetchedAt < ARTICLE_TTL_MS) {
      return mem;
    }
    memoryArticles.delete(norm);
  }

  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ARTICLES, "readonly");
      const store = tx.objectStore(STORE_ARTICLES);
      const req = store.get(norm);

      req.onsuccess = () => {
        const result = req.result as CachedArticleData | undefined;
        if (result && Date.now() - result.fetchedAt < ARTICLE_TTL_MS) {
          memoryArticles.set(norm, result);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedArticle(
  title: string,
  data: Omit<CachedArticleData, "fetchedAt">
): Promise<void> {
  const norm = normalizeTitle(title);
  const record: CachedArticleData = {
    ...data,
    fetchedAt: Date.now(),
  };

  memoryArticles.set(norm, record);

  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ARTICLES, "readwrite");
      const store = tx.objectStore(STORE_ARTICLES);
      store.put(record);

      tx.oncomplete = () => {
        // Run light async pruning if cache is growing
        if (memoryArticles.size > MAX_CACHED_ARTICLES) {
          void pruneOldArticles(db);
        }
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function pruneOldArticles(db: IDBDatabase): Promise<void> {
  try {
    const tx = db.transaction(STORE_ARTICLES, "readwrite");
    const store = tx.objectStore(STORE_ARTICLES);
    const index = store.index("fetchedAt");
    const countReq = store.count();

    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count > MAX_CACHED_ARTICLES) {
        const deleteCount = count - MAX_CACHED_ARTICLES;
        let deleted = 0;
        const cursorReq = index.openCursor();

        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
    };
  } catch {
    // Best-effort pruning
  }
}

export async function getCachedDraft(title: string): Promise<string | null> {
  const norm = normalizeTitle(title);

  const mem = memoryDrafts.get(norm);
  if (mem) return mem.wikitext;

  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, "readonly");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.get(norm);

      req.onsuccess = () => {
        const result = req.result as DraftRecord | undefined;
        if (result) {
          memoryDrafts.set(norm, result);
          resolve(result.wikitext);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedDraft(title: string, wikitext: string): Promise<void> {
  const norm = normalizeTitle(title);
  const record: DraftRecord = {
    title: norm,
    wikitext,
    updatedAt: Date.now(),
  };

  memoryDrafts.set(norm, record);

  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, "readwrite");
      const store = tx.objectStore(STORE_DRAFTS);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearCachedDraft(title: string): Promise<void> {
  const norm = normalizeTitle(title);
  memoryDrafts.delete(norm);

  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, "readwrite");
      const store = tx.objectStore(STORE_DRAFTS);
      store.delete(norm);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
