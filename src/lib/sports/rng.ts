/**
 * Deterministic seeded PRNG using the mulberry32 algorithm.
 * Returns a function that produces pseudo-random floats in [0, 1).
 */
export function createRNG(seed: number): () => number {
  let state = seed | 0;
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic non-negative seed from a string (e.g. a match id), for createRNG. */
export function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
