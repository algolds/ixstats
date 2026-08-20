/**
 * 2D Value Noise implementation for procedural climate simulation
 */
import { makeRng } from "./rng";

export function createNoise(seed: number): (x: number, y: number) => number {
  const rng = makeRng(seed);
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = temp;
  }
  for (let i = 0; i < 512; i++) {
    p[i] = perm[i & 255]!;
  }

  const grad = (hash: number, x: number, y: number) => {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

  return (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const a = p[X]! + Y;
    const aa = p[a]!;
    const ab = p[a + 1]!;
    const b = p[X + 1]! + Y;
    const ba = p[b]!;
    const bb = p[b + 1]!;

    const x1 = (1 - u) * grad(p[aa]!, xf, yf) + u * grad(p[ba]!, xf - 1, yf);
    const x2 = (1 - u) * grad(p[ab]!, xf, yf - 1) + u * grad(p[bb]!, xf - 1, yf - 1);
    return (1 - v) * x1 + v * x2;
  };
}

export function fractalNoise(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number = 3,
  lacunarity: number = 2.0,
  persistence: number = 0.5
): number {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return maxValue > 0 ? total / maxValue : 0;
}
