/**
 * UPG v2 — Multi-Octave Fractal Noise on the Sphere
 *
 * Noise is evaluated on unit-sphere coordinates, so it is seamless across the
 * antimeridian and does not pinch at the poles (2D lng/lat noise did both).
 * Each octave is randomly rotated and offset so no two seeds share an axis.
 */

import { makeRng } from "./rng";

type Vec3 = [number, number, number];

interface NoiseConfig {
  /** Row-major 3×3 rotation per octave */
  rotations: number[][];
  /** Frequency per octave, in radians⁻¹ on the unit sphere (≈ features per radian) */
  frequencies: number[];
  amplitudes: number[];
  offsets: Vec3[];
}

/** Unit-sphere coordinates of a lng/lat point in degrees. */
export function toXYZ(lng: number, lat: number): Vec3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lng * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

function rotation(rng: () => number): number[] {
  const [a, b, c] = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  const [ca, sa, cb, sb, cc, sc] = [
    Math.cos(a),
    Math.sin(a),
    Math.cos(b),
    Math.sin(b),
    Math.cos(c),
    Math.sin(c),
  ];
  // Rz(a) · Ry(b) · Rx(c)
  return [
    ca * cb,
    ca * sb * sc - sa * cc,
    ca * sb * cc + sa * sc,
    sa * cb,
    sa * sb * sc + ca * cc,
    sa * sb * cc - ca * sc,
    -sb,
    cb * sc,
    cb * cc,
  ];
}

/**
 * Build a noise configuration from a seed.
 * @param baseFrequency radians⁻¹: ~2 gives continent-scale blobs, ~10 regional hills, ~30 local detail
 */
export function buildNoiseConfig(
  seed: number,
  octaves: number,
  baseFrequency: number = 3,
  lacunarity: number = 2.1,
  persistence: number = 0.5
): NoiseConfig {
  const rng = makeRng(seed);
  const config: NoiseConfig = { rotations: [], frequencies: [], amplitudes: [], offsets: [] };
  let freq = baseFrequency;
  let amp = 1.0;
  for (let i = 0; i < octaves; i++) {
    config.rotations.push(rotation(rng));
    config.frequencies.push(freq);
    config.amplitudes.push(amp);
    config.offsets.push([rng() * 100, rng() * 100, rng() * 100]);
    freq *= lacunarity;
    amp *= persistence;
  }
  return config;
}

/** One octave: a product of sines along three rotated axes, in [-1, 1]. */
function octave(p: Vec3, config: NoiseConfig, i: number): number {
  const r = config.rotations[i]!;
  const f = config.frequencies[i]!;
  const [ox, oy, oz] = config.offsets[i]!;
  const x = r[0]! * p[0] + r[1]! * p[1] + r[2]! * p[2];
  const y = r[3]! * p[0] + r[4]! * p[1] + r[5]! * p[2];
  const z = r[6]! * p[0] + r[7]! * p[1] + r[8]! * p[2];
  return Math.sin(x * f + ox) * Math.sin(y * f + oy) * Math.sin(z * f + oz);
}

/**
 * Multi-octave fractal noise at a unit-sphere point. Roughly in [-1, 1]
 * (standard deviation ≈ 0.35 × 2 = 0.7 after the ×2 rescale below).
 */
export function fractalNoise(p: Vec3, config: NoiseConfig): number {
  let sum = 0;
  let maxAmp = 0;
  for (let i = 0; i < config.frequencies.length; i++) {
    sum += octave(p, config, i) * config.amplitudes[i]!;
    maxAmp += config.amplitudes[i]!;
  }
  return maxAmp > 0 ? Math.max(-1, Math.min(1, (2 * sum) / maxAmp)) : 0;
}

/** Ridged noise in [0, 1]: inverted absolute octaves, squared, for sharp mountain crests. */
export function ridgedNoise(p: Vec3, config: NoiseConfig): number {
  let sum = 0;
  let maxAmp = 0;
  for (let i = 0; i < config.frequencies.length; i++) {
    const v = 1 - Math.abs(octave(p, config, i));
    sum += v * v * config.amplitudes[i]!;
    maxAmp += config.amplitudes[i]!;
  }
  return maxAmp > 0 ? sum / maxAmp : 0;
}
