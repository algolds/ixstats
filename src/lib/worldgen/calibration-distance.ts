/**
 * The one number the Calibration tab shows per realm: how far a generated world is from the realm's map.
 *
 * Five parts, each from 0 (the same) to 1 (nothing in common), weighted equally and shown on a scale of 0 to 100:
 * land share, hypsometry (half the summed differences of the nine zone shares, so lifting all land by a zone scores
 * 1), the climate mix (the same over the seven groups; 1 when only one side has classified land), the nations (mean
 * of the relative gaps of count, median and p90 area) and the coastline. A relative gap is |a - b| / max(|a|, |b|).
 * A world fitted to a realm keeps that realm's borders and has no nations, which no parameter can change: for it the
 * caller passes `{ nations: false }`, the nations part is `null` and the distance is the mean of the other four.
 * Pure and symmetric.
 */

import { TREWARTHA_GROUPS, type WorldMeasures } from "./measure-world";

export interface DistanceParts {
  land: number;
  hypsometry: number;
  climate: number;
  /** Null when the nations are left out */
  nations: number | null;
  coastline: number;
}

export interface DistanceOptions {
  /** Score the nations (default true); false for a world that has none of its own */
  nations?: boolean;
}

export interface CalibrationDistance {
  /** 0 (the same) to 100 */
  distance: number;
  parts: DistanceParts;
}

/** |a - b| relative to the larger of the two: 0 when equal (including both 0), 1 when one is 0. */
export function relativeGap(a: number, b: number): number {
  if (a === b) return 0;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
}

/** Half the summed differences of two shares that each add to 1 (the total variation distance). */
function shareGap(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return Math.min(sum / 2, 1);
}

function climateGap(a: WorldMeasures["climate"], b: WorldMeasures["climate"]): number {
  const left = TREWARTHA_GROUPS.map((group) => a[group]);
  const right = TREWARTHA_GROUPS.map((group) => b[group]);
  const leftHas = left.some((share) => share > 0);
  const rightHas = right.some((share) => share > 0);
  if (!leftHas && !rightHas) return 0;
  if (leftHas !== rightHas) return 1;
  return shareGap(left, right);
}

function nationsGap(a: WorldMeasures["nations"], b: WorldMeasures["nations"]): number {
  return (
    (relativeGap(a.count, b.count) +
      relativeGap(a.medianKm2, b.medianKm2) +
      relativeGap(a.p90Km2, b.p90Km2)) /
    3
  );
}

export function calibrationDistance(
  a: WorldMeasures,
  b: WorldMeasures,
  { nations = true }: DistanceOptions = {}
): CalibrationDistance {
  const parts: DistanceParts = {
    land: relativeGap(a.landShare, b.landShare),
    hypsometry: shareGap(a.hypsometry, b.hypsometry),
    climate: climateGap(a.climate, b.climate),
    nations: nations ? nationsGap(a.nations, b.nations) : null,
    coastline: relativeGap(a.coastlineKm, b.coastlineKm),
  };
  const scored = Object.values(parts).filter((part): part is number => part !== null);
  return { distance: (scored.reduce((sum, part) => sum + part, 0) / scored.length) * 100, parts };
}
