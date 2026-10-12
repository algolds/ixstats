/**
 * A least-recently-used cache bounded by the bytes its values hold, not by their count: a packed map layer is a
 * pre-stringified JSON string or Buffer of anything from a few KB to tens of MB. A string counts two bytes per
 * character (UTF-16), a Buffer its byte length. Map insertion order is the recency order (oldest first).
 */
export class ByteLru<V extends string | Buffer> {
  private readonly entries = new Map<string, { value: V; size: number }>();
  private total = 0;

  constructor(private readonly maxBytes: number) {}

  /** Bytes currently held. */
  get bytes(): number {
    return this.total;
  }

  /** The value, now the most recently used; undefined when absent. */
  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Store a value, evicting the least recently used until the total fits. A value over the limit is not kept. */
  set(key: string, value: V): void {
    this.delete(key);
    const size = typeof value === "string" ? value.length * 2 : Buffer.byteLength(value);
    if (size > this.maxBytes) return;
    this.entries.set(key, { value, size });
    this.total += size;
    for (const [oldest, { size: oldestSize }] of this.entries) {
      if (this.total <= this.maxBytes) break;
      this.entries.delete(oldest);
      this.total -= oldestSize;
    }
  }

  delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.total -= entry.size;
  }

  deleteWhere(pred: (key: string) => boolean): void {
    for (const key of this.entries.keys()) {
      if (pred(key)) this.delete(key);
    }
  }
}
