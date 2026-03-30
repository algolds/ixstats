/**
 * Seeded PRNG — Park-Miller LCG + xorshift32
 * Copied from procedural-archive/rng.ts for independence.
 */

const PM_A = 16807;
const PM_M = 2147483647;

/** Park-Miller LCG. Returns values in [0, 1). */
export function makeRng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed * 9301 + 49297)) % (PM_M - 1)) + 1;
  return () => {
    s = (s * PM_A) % PM_M;
    return (s - 1) / (PM_M - 1);
  };
}

/** Seeded random integer in [0, max). */
export function makeRandInt(seed: number): (max: number) => number {
  const rng = makeRng(seed);
  return (max: number) => Math.floor(rng() * max);
}

/** Fisher-Yates shuffle with seeded RNG. */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
