/**
 * Relief detail texture: a 256 x 256 fractal value-noise tile that repeats seamlessly, built once on first use. Six
 * octaves with a gain of 0.6 keep the fine octaves strong, so the tile shades as grain and crags rather than swells.
 * Pure and deterministic (a fixed hash, no randomness), so the worker preview and the server tiles add the same
 * detail.
 */

export const DETAIL_SIZE = 256;

/** Lattice cells across the tile per octave; each divides DETAIL_SIZE so every octave wraps exactly. */
const OCTAVE_PERIODS = [4, 8, 16, 32, 64, 128] as const;
const GAIN = 0.6;

let texture: Float32Array | null = null;

/** Integer hash of a lattice point to [-1, 1]. */
function lattice(ix: number, iy: number, octave: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(octave + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** One octave of periodic value noise at a texel. */
function octaveAt(x: number, y: number, period: number, octave: number): number {
  const cell = DETAIL_SIZE / period;
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = fade(gx - x0);
  const fy = fade(gy - y0);
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const top = lattice(x0, y0, octave) * (1 - fx) + lattice(x1, y0, octave) * fx;
  const bottom = lattice(x0, y1, octave) * (1 - fx) + lattice(x1, y1, octave) * fx;
  return top * (1 - fy) + bottom * fy;
}

function buildTexture(): Float32Array {
  const out = new Float32Array(DETAIL_SIZE * DETAIL_SIZE);
  let peak = 0;
  for (let y = 0; y < DETAIL_SIZE; y++) {
    for (let x = 0; x < DETAIL_SIZE; x++) {
      let value = 0;
      let amplitude = 1;
      for (let o = 0; o < OCTAVE_PERIODS.length; o++) {
        value += amplitude * octaveAt(x, y, OCTAVE_PERIODS[o]!, o);
        amplitude *= GAIN;
      }
      out[y * DETAIL_SIZE + x] = value;
      peak = Math.max(peak, Math.abs(value));
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / peak;
  return out;
}

/** The shared detail tile, values in [-1, 1], row-major, periodic in both axes. */
export function detailTexture(): Float32Array {
  texture ??= buildTexture();
  return texture;
}
