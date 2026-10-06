// src/lib/cache/byte-bounded-cache.ts
// In-memory LRU cache bounded by the total size of what it holds, not by the number of entries.
// `Cache` (./cache.ts) counts entries: fine for small values, wrong for article views, whose size
// ranges from 2 KB to a few MB.

interface Entry<V> {
  value: V;
  bytes: number;
  expires: number;
}

export interface ByteBoundedCacheOptions {
  /** Total size the cache may hold; the least recently used entries are dropped to stay under it. */
  maxBytes: number;
  /** Lifetime of an entry when `set` names none. */
  defaultTtlMs: number;
  /** Clock, for tests. */
  now?: () => number;
}

export class ByteBoundedCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private held = 0;
  private readonly now: () => number;

  constructor(private readonly options: ByteBoundedCacheOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  /** The bytes held (as the callers of `set` counted them). */
  get totalBytes(): number {
    return this.held;
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.remove(key, entry);
      return undefined;
    }
    // Most recently used goes last.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Store `value`, which takes `bytes`. A value bigger than the whole cache is not stored. */
  set(key: string, value: V, bytes: number, ttlMs = this.options.defaultTtlMs): void {
    const previous = this.entries.get(key);
    if (previous) this.remove(key, previous);
    if (bytes > this.options.maxBytes) return;

    for (const [oldest, entry] of this.entries) {
      if (this.held + bytes <= this.options.maxBytes) break;
      this.remove(oldest, entry);
    }
    this.entries.set(key, { value, bytes, expires: this.now() + ttlMs });
    this.held += bytes;
  }

  /** Drop every entry whose key `matches`; returns how many went. */
  deleteWhere(matches: (key: string) => boolean): number {
    let dropped = 0;
    for (const [key, entry] of this.entries) {
      if (!matches(key)) continue;
      this.remove(key, entry);
      dropped++;
    }
    return dropped;
  }

  private remove(key: string, entry: Entry<V>): void {
    this.entries.delete(key);
    this.held -= entry.bytes;
  }
}
