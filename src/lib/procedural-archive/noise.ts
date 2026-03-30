/**
 * Seeded Simplex Noise - Deterministic noise generation.
 * Based on OpenSimplex noise algorithm with seeded permutation table.
 *
 * All functions are pure and deterministic for a given seed.
 */

// Seeded PRNG (xorshift32)
function seedRNG(seed: number): () => number {
  let state = seed | 0;
  if (state === 0) state = 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff);
  };
}

// Generate a shuffled permutation table from seed
function buildPermTable(seed: number): Uint8Array {
  const rng = seedRNG(seed);
  const perm = new Uint8Array(512);
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i++) source[i] = i;

  // Fisher-Yates shuffle
  for (let i = 255; i >= 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = source[i]!;
    source[i] = source[j]!;
    source[j] = tmp;
  }

  for (let i = 0; i < 512; i++) {
    perm[i] = source[i & 255]!;
  }
  return perm;
}

// 2D gradient vectors
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function dot2(g: number[], x: number, y: number): number {
  return g[0]! * x + g[1]! * y;
}

// Skew constants for 2D simplex
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

// Skew constants for 3D simplex
const F3 = 1 / 3;
const G3 = 1 / 6;

// 3D gradient vectors
const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function dot3(g: number[], x: number, y: number, z: number): number {
  return g[0]! * x + g[1]! * y + g[2]! * z;
}

export interface NoiseGenerator {
  noise2D: (x: number, y: number) => number;
  noise3D: (x: number, y: number, z: number) => number;
  seed: number;
}

/**
 * Create a seeded 2D simplex noise generator.
 * Returns values in [-1, 1].
 */
export function createNoise(seed: number): NoiseGenerator {
  const perm = buildPermTable(seed);

  function noise2D(xin: number, yin: number): number {
    // Skew input space
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    // Determine which simplex we're in
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    const gi0 = perm[ii + perm[jj]!]! % 8;
    const gi1 = perm[ii + i1 + perm[jj + j1]!]! % 8;
    const gi2 = perm[ii + 1 + perm[jj + 1]!]! % 8;

    // Contribution from three corners
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * dot2(GRAD2[gi0]!, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * dot2(GRAD2[gi1]!, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * dot2(GRAD2[gi2]!, x2, y2);
    }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2);
  }

  function noise3D(xin: number, yin: number, zin: number): number {
    // Skew input space to determine which simplex cell we're in
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);

    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const z0 = zin - Z0;

    // Determine which simplex we are in
    let i1: number, j1: number, k1: number;
    let i2: number, j2: number, k2: number;

    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    const gi0 = perm[ii + perm[jj + perm[kk]!]!]! % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]!]!]! % 12;
    const gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]!]!]! % 12;
    const gi3 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]!]!]! % 12;

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot3(GRAD3[gi0]!, x0, y0, z0); }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot3(GRAD3[gi1]!, x1, y1, z1); }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot3(GRAD3[gi2]!, x2, y2, z2); }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 >= 0) { t3 *= t3; n3 = t3 * t3 * dot3(GRAD3[gi3]!, x3, y3, z3); }

    // Scale to [-1, 1]
    return 32 * (n0 + n1 + n2 + n3);
  }

  return { noise2D, noise3D, seed };
}

/**
 * Multi-octave fractal noise (fBm).
 * Combines multiple octaves of noise at different frequencies/amplitudes.
 */
export function fractalNoise(
  gen: NoiseGenerator,
  x: number,
  y: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  persistence: number = 0.5
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += gen.noise2D(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * Ridge noise - creates mountain ridge-like features.
 */
export function ridgeNoise(
  gen: NoiseGenerator,
  x: number,
  y: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  persistence: number = 0.5
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;
  let weight = 1;

  for (let i = 0; i < octaves; i++) {
    let signal = gen.noise2D(x * frequency, y * frequency);
    signal = 1 - Math.abs(signal);
    signal *= signal;
    signal *= weight;
    weight = Math.min(1, Math.max(0, signal * 2));

    value += signal * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * 3D fractal noise (fBm) for use with noise3D.
 */
export function fractalNoise3D(
  gen: NoiseGenerator,
  x: number,
  y: number,
  z: number,
  octaves: number = 6,
  lacunarity: number = 2.0,
  persistence: number = 0.5
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += gen.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * Domain warping - displaces coordinates using fBm noise before sampling.
 * Creates organic, flowing distortion of features.
 *
 * @param gen Noise generator
 * @param x X coordinate
 * @param y Y coordinate
 * @param octaves fBm octaves for the warp displacement
 * @param amplitude Maximum displacement amount
 * @param frequency Base frequency of the warp noise
 * @returns [warpedX, warpedY] displacement offsets to add to coordinates
 */
export function domainWarp2D(
  gen: NoiseGenerator,
  x: number,
  y: number,
  octaves: number = 4,
  amplitude: number = 0.5,
  frequency: number = 2.0
): [number, number] {
  // Use different offsets for X and Y displacement to avoid correlation
  const dx = fractalNoise(gen, x * frequency, y * frequency, octaves, 2.0, 0.5) * amplitude;
  const dy = fractalNoise(gen, x * frequency + 100, y * frequency + 100, octaves, 2.0, 0.5) * amplitude;
  return [dx, dy];
}
