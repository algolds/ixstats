/**
 * UPG v2 — Binary min-heap of (priority, value) pairs.
 *
 * Replaces the sorted-array queues (O(n) shift/splice per operation) used by the
 * flood fills, which went quadratic on 100K-cell meshes.
 */

export class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, val: number): void {
    const { keys, vals } = this;
    let i = keys.length;
    keys.push(key);
    vals.push(val);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent]! <= key) break;
      keys[i] = keys[parent]!;
      vals[i] = vals[parent]!;
      i = parent;
    }
    keys[i] = key;
    vals[i] = val;
  }

  /** Lowest key of the heap (undefined when empty). */
  peekKey(): number | undefined {
    return this.keys[0];
  }

  /** Remove the lowest-key entry and return its value. Call only when size > 0. */
  pop(): number {
    const { keys, vals } = this;
    const top = vals[0]!;
    const lastKey = keys.pop()!;
    const lastVal = vals.pop()!;
    const n = keys.length;
    if (n === 0) return top;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const r = l + 1;
      const c = r < n && keys[r]! < keys[l]! ? r : l;
      if (keys[c]! >= lastKey) break;
      keys[i] = keys[c]!;
      vals[i] = vals[c]!;
      i = c;
    }
    keys[i] = lastKey;
    vals[i] = lastVal;
    return top;
  }
}
