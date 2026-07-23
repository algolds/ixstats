/**
 * UPG v2 — Multi-Octave Fractal Noise
 *
 * Provides continuous value noise functions for terrain generation.
 * Uses rotation-aware evaluation to prevent axis-aligned artifacts.
 */

import { makeRng } from "./rng";

// ──────────────────────────────────────────────
// Noise Seed State
// ──────────────────────────────────────────────

interface NoiseConfig {
  /** Rotation angles per octave (radians) */
  angles: number[];
  /** Frequency per octave */
  frequencies: number[];
  /** Amplitude per octave */
  amplitudes: number[];
  /** Offset per octave [ox, oy] */
  offsets: [number, number][];
}

/**
 * Build a noise configuration from a seed. Each octave gets a unique
 * rotation angle and offset so no two seeds produce axis-aligned patterns.
 */
export function buildNoiseConfig(
  seed: number,
  octaves: number,
  baseFrequency: number = 0.02,
  lacunarity: number = 2.1,
  persistence: number = 0.5
): NoiseConfig {
  const rng = makeRng(seed);
  const angles: number[] = [];
  const frequencies: number[] = [];
  const amplitudes: number[] = [];
  const offsets: [number, number][] = [];

  let freq = baseFrequency;
  let amp = 1.0;

  for (let i = 0; i < octaves; i++) {
    angles.push(rng() * Math.PI * 2);
    frequencies.push(freq);
    amplitudes.push(amp);
    offsets.push([rng() * 1000 - 500, rng() * 1000 - 500]);
    freq *= lacunarity;
    amp *= persistence;
  }

  return { angles, frequencies, amplitudes, offsets };
}

/**
 * Evaluate multi-octave fractal value noise at (x, y).
 * Returns a value roughly in [-1, 1] (sum of sin*cos octaves).
 */
export function fractalNoise(x: number, y: number, config: NoiseConfig): number {
  let sum = 0;
  let maxAmp = 0;

  for (let i = 0; i < config.angles.length; i++) {
    const angle = config.angles[i]!;
    const freq = config.frequencies[i]!;
    const amp = config.amplitudes[i]!;
    const [ox, oy] = config.offsets[i]!;

    // Rotate coordinates to break axis alignment
    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);

    sum += Math.sin((rx + ox) * freq) * Math.cos((ry + oy) * freq) * amp;
    maxAmp += amp;
  }

  return maxAmp > 0 ? sum / maxAmp : 0;
}

/**
 * Ridged noise — absolute value of fractal noise, inverted.
 * Produces sharp mountain ridge patterns.
 */
export function ridgedNoise(x: number, y: number, config: NoiseConfig): number {
  let sum = 0;
  let maxAmp = 0;

  for (let i = 0; i < config.angles.length; i++) {
    const angle = config.angles[i]!;
    const freq = config.frequencies[i]!;
    const amp = config.amplitudes[i]!;
    const [ox, oy] = config.offsets[i]!;

    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);

    // Ridged: invert the absolute value so peaks become sharp ridges
    const val = 1 - Math.abs(Math.sin((rx + ox) * freq) * Math.cos((ry + oy) * freq));
    sum += val * val * amp; // Square for sharper ridges
    maxAmp += amp;
  }

  return maxAmp > 0 ? sum / maxAmp : 0;
}

/**
 * Simple 2D value noise at a single frequency (no octaves).
 * Returns a value in [-1, 1].
 */
export function simpleNoise(
  x: number,
  y: number,
  freq: number,
  angle: number,
  ox: number,
  oy: number
): number {
  const rx = x * Math.cos(angle) - y * Math.sin(angle);
  const ry = x * Math.sin(angle) + y * Math.cos(angle);
  return Math.sin((rx + ox) * freq) * Math.cos((ry + oy) * freq);
}
