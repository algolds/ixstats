/**
 * The studio's calibration readout: a draft world's land share, elevation profile and climate mix beside the
 * Ixnay and Eurth targets, so the presets can be tuned against the two hand-drawn maps. Pure, so it can be tested
 * and used wherever a result is at hand.
 *
 * Land share and the elevation profile come from `WORLD_PRESETS`. The climate mix has no field there: its
 * reference is what was measured on the two maps (see the note on `WORLD_PRESETS`) and is kept here.
 */

import { ELEVATION_ZONES, WORLD_PRESETS, getElevationZone } from "./v2/config";
import type { WorldPreviewStats } from "./world-stats";

export const CLIMATE_GROUPS = ["A", "B", "C", "D", "E", "F", "H"] as const;
type ClimateGroup = (typeof CLIMATE_GROUPS)[number];

export const CLIMATE_GROUP_NAMES: Record<ClimateGroup, string> = {
  A: "Tropical",
  B: "Dry",
  C: "Subtropical",
  D: "Temperate",
  E: "Boreal",
  F: "Polar",
  H: "Highland",
};

type Targets = { ixnay: number | null; eurth: number | null };

/**
 * Share of land per climate group (percent) on the two reference maps, measured 2026-10-11. Eurth is classified
 * in Koppen, which has no highland class, so it has no target there.
 */
export const CLIMATE_REFERENCE: Record<ClimateGroup, Targets> = {
  A: { ixnay: 37, eurth: 21 },
  B: { ixnay: 16, eurth: 23 },
  C: { ixnay: 25, eurth: 11 },
  D: { ixnay: 18, eurth: 24 },
  E: { ixnay: 2, eurth: 9 },
  F: { ixnay: 1, eurth: 13 },
  H: { ixnay: 1, eurth: null },
};

export interface CalibrationRow extends Targets {
  label: string;
  /** The draft world's value, in percent */
  draft: number;
}

export interface CalibrationReadout {
  landShare: CalibrationRow;
  /** One row per elevation zone: share of land, in percent */
  hypsometry: CalibrationRow[];
  /** One row per climate group: share of land, in percent */
  climate: CalibrationRow[];
  /** Mean gap to each target, in percentage points, over the hypsometry and climate rows that have one */
  distance: { ixnay: number; eurth: number };
}

const ZONES = ELEVATION_ZONES.length;

/** Share of the land cells (height at or above sea level) in each elevation zone, in percent; `cells` are packed lng, lat, height. */
export function measureHypsometry(cells: Float32Array): number[] {
  const counts = new Array<number>(ZONES).fill(0);
  let land = 0;
  for (let i = 2; i < cells.length; i += 3) {
    const height = cells[i]!;
    if (height < 0) continue;
    land++;
    const zone = getElevationZone(height);
    counts[zone] = (counts[zone] ?? 0) + 1;
  }
  return counts.map((count) => (land > 0 ? (count / land) * 100 : 0));
}

/** A preset's elevation curve as percentages of land that add up to 100. */
function normalised(curve: readonly number[]): number[] {
  const total = curve.reduce((sum, share) => sum + share, 0);
  return curve.map((share) => (total > 0 ? (share / total) * 100 : 0));
}

function meanGap(rows: readonly CalibrationRow[], target: keyof Targets): number {
  const gaps = rows.flatMap((row) => {
    const goal = row[target];
    return goal === null ? [] : [Math.abs(row.draft - goal)];
  });
  return gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
}

export function calibrationReadout(input: {
  stats: Pick<WorldPreviewStats, "landShare" | "climateMix">;
  cells: Float32Array;
}): CalibrationReadout {
  const ixnayCurve = normalised(WORLD_PRESETS.ixnay.hypsometry);
  const eurthCurve = normalised(WORLD_PRESETS.eurth.hypsometry);
  const hypsometry = measureHypsometry(input.cells).map((draft, zone) => ({
    label: ELEVATION_ZONES[zone]!.name,
    draft,
    ixnay: ixnayCurve[zone]!,
    eurth: eurthCurve[zone]!,
  }));
  const climate = CLIMATE_GROUPS.map((group) => ({
    label: CLIMATE_GROUP_NAMES[group],
    draft: (input.stats.climateMix[group] ?? 0) * 100,
    ...CLIMATE_REFERENCE[group],
  }));
  const rows = [...hypsometry, ...climate];
  return {
    landShare: {
      label: "Land share",
      draft: input.stats.landShare * 100,
      ixnay: (1 - WORLD_PRESETS.ixnay.oceanPercentage) * 100,
      eurth: (1 - WORLD_PRESETS.eurth.oceanPercentage) * 100,
    },
    hypsometry,
    climate,
    distance: { ixnay: meanGap(rows, "ixnay"), eurth: meanGap(rows, "eurth") },
  };
}
