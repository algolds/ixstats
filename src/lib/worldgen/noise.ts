/**
 * Simplex/Fractal Noise Generator for Climate & Terrain.
 */

export interface NoiseGenerator {
  (x: number, y: number): number;
}

/**
 * Creates a seeded 2D value noise function.
 */
export function createNoise(seed = 42): NoiseGenerator {
  const mask = 255;
  const p = new Uint8Array(512);
  const permutation = new Uint8Array(256);

  // Initialize permutation table deterministically
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;

  function next(): number {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  for (let i = 0; i < 256; i++) {
    permutation[i] = i;
  }

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = permutation[i]!;
    permutation[i] = permutation[j]!;
    permutation[j] = tmp;
  }

  for (let i = 0; i < 512; i++) {
    p[i] = permutation[i & mask]!;
  }

  function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  function grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  return function noise2D(x: number, y: number): number {
    const X = Math.floor(x) & mask;
    const Y = Math.floor(y) & mask;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const A = p[X]! + Y;
    const B = p[X + 1]! + Y;

    return lerp(
      v,
      lerp(u, grad(p[A]!, xf, yf), grad(p[B]!, xf - 1, yf)),
      lerp(u, grad(p[A + 1]!, xf, yf - 1), grad(p[B + 1]!, xf - 1, yf - 1))
    );
  };
}

/**
 * Multi-octave fractal noise.
 */
export function fractalNoise(
  noise: NoiseGenerator,
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2.0,
  persistence = 0.5
): number {
  let total = 0;
  let frequency = 1.0;
  let amplitude = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return maxValue > 0 ? total / maxValue : 0;
}
