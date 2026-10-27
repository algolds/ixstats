/**
 * localStorage persistent cache for wiki data (intros, infoboxes, section previews).
 *
 * Stores per-country wiki responses in localStorage so they survive
 * page refreshes. 24hr TTL, max 200 entries with oldest-eviction.
 */

const KEY_PREFIX = "wiki-v1:";
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 200;

interface CachedEntry<T> {
  data: T;
  ts: number; // timestamp
}

/**
 * Get a cached wiki value from localStorage.
 * Returns null if not found, expired, or in SSR.
 */
export function getWikiCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry<T>;
    if (Date.now() - entry.ts > DEFAULT_TTL) {
      localStorage.removeItem(KEY_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Store a wiki value in localStorage with TTL.
 * Evicts oldest entries if over MAX_ENTRIES.
 */
export function setWikiCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CachedEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry));
    evictIfNeeded();
  } catch {
    // Silently fail — cache is best-effort (quota exceeded, etc.)
  }
}

/** Remove oldest entries when over MAX_ENTRIES. */
function evictIfNeeded(): void {
  try {
    const wikiKeys: Array<{ key: string; ts: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(KEY_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const entry = JSON.parse(raw) as CachedEntry<unknown>;
        wikiKeys.push({ key: k, ts: entry.ts });
      } catch {
        // Corrupted entry — remove it
        localStorage.removeItem(k);
      }
    }
    if (wikiKeys.length <= MAX_ENTRIES) return;
    // Sort oldest first, remove excess
    wikiKeys.sort((a, b) => a.ts - b.ts);
    const toRemove = wikiKeys.length - MAX_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(wikiKeys[i]!.key);
    }
  } catch {
    // Best-effort eviction
  }
}
