/**
 * Growth-rate normalization helpers (pure, no React).
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly.
 */

/**
 * Smart normalization for growth-rate values that may arrive in inconsistent
 * units (e.g. decimal fraction, whole-number percent, or basis-point scaled).
 *
 * - Falsy / non-finite values return the provided fallback.
 * - Values are repeatedly divided by 100 until their magnitude is <= 50.
 * - The result is clamped to the [-20, 20] range.
 *
 * @param value    Raw growth rate (any scale) or null/undefined.
 * @param fallback Value to return when `value` is missing/invalid (default 3.0).
 */
export function smartNormalizeGrowthRate(value: number | null | undefined, fallback = 3.0): number {
  if (!value || !isFinite(value)) return fallback;

  let normalizedValue = value;
  while (Math.abs(normalizedValue) > 50) {
    normalizedValue = normalizedValue / 100;
  }

  if (Math.abs(normalizedValue) > 20) {
    return normalizedValue > 0 ? 20 : -20;
  }

  return normalizedValue;
}
