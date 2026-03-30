/**
 * Seeded PRNG - Park-Miller Linear Congruential Generator.
 *
 * Compatible with World Orogen's RNG for seed reproducibility.
 * Also provides the existing xorshift32 for backward compatibility.
 */

// ─── Park-Miller LCG (World Orogen compatible) ──────────────

const PM_A = 16807;
const PM_M = 2147483647; // 2^31 - 1

/**
 * Create a Park-Miller LCG random number generator.
 * Compatible with World Orogen's seeding: seed → hash → LCG state.
 * Returns values in [0, 1).
 */
export function makeRng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed * 9301 + 49297)) % (PM_M - 1)) + 1;
  return () => {
    s = (s * PM_A) % PM_M;
    return (s - 1) / (PM_M - 1);
  };
}

/**
 * Create a seeded random integer generator.
 * Returns values in [0, max) exclusive of max.
 */
export function makeRandInt(seed: number): (max: number) => number {
  const rng = makeRng(seed);
  return (max: number) => Math.floor(rng() * max);
}

/**
 * Shuffle an array in-place using Fisher-Yates with a seeded RNG.
 */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ─── xorshift32 (existing IxWorld compatibility) ─────────────

/**
 * Create an xorshift32 PRNG (used by existing IxWorld noise/landmass code).
 * Returns values in [0, 1).
 */
export function xorshift32(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}
