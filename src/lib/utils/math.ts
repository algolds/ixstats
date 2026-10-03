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
