/**
 * Mathematical Primitives & Numeric Utility Functions
 */

/**
 * Restricts a number to be within a specified range [min, max].
 */
export function clamp(val: number, min: number, max: number): number {
  if (min > max) [min, max] = [max, min];
  return Math.max(min, Math.min(max, val));
}

/**
 * Linearly interpolates between two values by a normalized factor t in [0, 1].
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Rounds a number to a specified precision (number of decimal places).
 */
export function roundTo(val: number, decimals: number = 0): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

/**
 * Normalizes a number from [min, max] into [0, 1].
 */
export function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((val - min) / (max - min), 0, 1);
}

/**
 * Calculates the percentage of a value relative to a total.
 */
export function calculatePercentage(part: number, total: number, decimals: number = 1): number {
  if (total === 0) return 0;
  return roundTo((part / total) * 100, decimals);
}
