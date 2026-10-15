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
function octave(x: number, y: number, z: number, config: NoiseConfig, i: number): number {
  const r = config.rotations[i]!;
  const f = config.frequencies[i]!;
  const [ox, oy, oz] = config.offsets[i]!;
  const rx = r[0]! * x + r[1]! * y + r[2]! * z;
  const ry = r[3]! * x + r[4]! * y + r[5]! * z;
  const rz = r[6]! * x + r[7]! * y + r[8]! * z;
  return Math.sin(rx * f + ox) * Math.sin(ry * f + oy) * Math.sin(rz * f + oz);
}

/**
 * Multi-octave fractal noise at cell `i` of `sphere`, the packed unit-sphere coordinates
 * [x0,y0,z0, x1,y1,z1, ...]. Roughly in [-1, 1]
 * (standard deviation ≈ 0.35 × 2 = 0.7 after the ×2 rescale below).
 */
export function fractalNoise(sphere: Float64Array, i: number, config: NoiseConfig): number {
  const x = sphere[i * 3]!;
  const y = sphere[i * 3 + 1]!;
  const z = sphere[i * 3 + 2]!;
  let sum = 0;
  let maxAmp = 0;
  for (let o = 0; o < config.frequencies.length; o++) {
    sum += octave(x, y, z, config, o) * config.amplitudes[o]!;
    maxAmp += config.amplitudes[o]!;
  }
  return maxAmp > 0 ? Math.max(-1, Math.min(1, (2 * sum) / maxAmp)) : 0;
}

/** Ridged noise in [0, 1] at cell `i` of `sphere`: inverted absolute octaves, squared, for sharp mountain crests. */
export function ridgedNoise(sphere: Float64Array, i: number, config: NoiseConfig): number {
  const x = sphere[i * 3]!;
  const y = sphere[i * 3 + 1]!;
  const z = sphere[i * 3 + 2]!;
  let sum = 0;
  let maxAmp = 0;
  for (let o = 0; o < config.frequencies.length; o++) {
    const v = 1 - Math.abs(octave(x, y, z, config, o));
    sum += v * v * config.amplitudes[o]!;
    maxAmp += config.amplitudes[o]!;
  }
  return maxAmp > 0 ? sum / maxAmp : 0;
}

/** Noise values of a mesh by configuration; NaN marks a cell not asked for yet. */
const fields = new WeakMap<Float64Array, Map<string, Float64Array>>();
/** Configurations kept per mesh: the generator uses about ten for one seed. */
const MAX_FIELDS_PER_MESH = 24;

/**
 * Fractal (or ridged) noise of one configuration at the cells of a mesh, remembered cell by cell. Noise depends
 * on the mesh and the configuration's seed alone, so a run on a cached mesh with the same seed (a slider change)
 * reads the values the previous run computed. The values are those of `fractalNoise` / `ridgedNoise`.
 */
export class NoiseField {
  private readonly values: Float64Array;
  private readonly config: NoiseConfig;

  constructor(
    private readonly sphere: Float64Array,
    seed: number,
    octaves: number,
    baseFrequency: number,
    lacunarity: number,
    persistence: number,
    private readonly ridged = false
  ) {
    this.config = buildNoiseConfig(seed, octaves, baseFrequency, lacunarity, persistence);
    const key = `${ridged ? "r" : "f"}:${seed}:${octaves}:${baseFrequency}:${lacunarity}:${persistence}`;
    let byKey = fields.get(sphere);
    if (!byKey) {
      byKey = new Map();
      fields.set(sphere, byKey);
    }
    let values = byKey.get(key);
    if (!values) {
      if (byKey.size >= MAX_FIELDS_PER_MESH) byKey.clear();
      values = new Float64Array(sphere.length / 3).fill(NaN);
      byKey.set(key, values);
    }
    this.values = values;
  }

  /** Noise at cell i. */
  at(i: number): number {
    let value = this.values[i]!;
    if (value !== value) {
      value = this.ridged
        ? ridgedNoise(this.sphere, i, this.config)
        : fractalNoise(this.sphere, i, this.config);
      this.values[i] = value;
    }
    return value;
  }
}
