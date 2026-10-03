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

export { hslToHex } from "~/lib/color";
