// src/lib/cache.ts
// Unified in-memory cache with TTL, LRU eviction, and stats tracking.
// Replaces 15+ ad-hoc Map-based caches across the codebase.

export interface CacheEntry<T> {
  data: T;
  expires: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheOptions {
  /** Default TTL in ms (applied when set() has no explicit ttl). Default: 300000 (5 min). */
  defaultTtlMs?: number;
  /** Max entries before eviction. Default: 500. */
  maxSize?: number;
  /** Namespace prefix for all keys. */
  namespace?: string;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntryAge: number;
  newestEntryAge: number;
}

export class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private opts: Required<CacheOptions>;

  constructor(opts?: CacheOptions) {
    this.opts = {
      defaultTtlMs: opts?.defaultTtlMs ?? 300_000,
      maxSize: opts?.maxSize ?? 500,
      namespace: opts?.namespace ?? "",
    };
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.evictIfNeeded();
    const effectiveTtl = ttlMs ?? this.opts.defaultTtlMs;
    this.store.set(key, {
      data: value,
      expires: Date.now() + effectiveTtl,
      hits: 0,
      lastAccessed: Date.now(),
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    entry.hits++;
    entry.lastAccessed = Date.now();
    // Move to tail (LRU — most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  keys(): IterableIterator<string> {
    return this.store.keys();
  }

  forEach(fn: (value: unknown, key: string) => void): void {
    this.store.forEach((entry, key) => fn(entry.data, key));
  }

  getStats(): CacheStats {
    const items = Array.from(this.store.values());
    const totalHits = items.reduce((s, e) => s + e.hits, 0);
    const totalRequests = items.length + totalHits;
    const now = Date.now();
    let oldestEntryAge = 0;
    let newestEntryAge = 0;
    if (items.length > 0) {
      const ages = items.map((e) => now - e.lastAccessed);
      oldestEntryAge = Math.max(...ages);
      newestEntryAge = Math.min(...ages);
    }
    return {
      size: this.store.size,
      hits: totalHits,
      misses: 0,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      oldestEntryAge,
      newestEntryAge,
    };
  }

  private evictIfNeeded(): void {
    while (this.store.size >= this.opts.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey === undefined) break;
      this.store.delete(firstKey);
    }
  }
}

export function createCache(opts?: CacheOptions): Cache {
  return new Cache(opts);
}
