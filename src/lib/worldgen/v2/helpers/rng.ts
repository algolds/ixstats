/**
 * UPG v2 — Seeded PRNG
 *
 * Park-Miller LCG + utilities. Carried over from v1 for deterministic generation.
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

/** Seeded random float in [min, max). */
export function rngRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Seeded random integer in [min, max] (inclusive). */
export function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

/** Convert HSL color values to hex string "#rrggbb" */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
