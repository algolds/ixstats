/**
 * Dynamic, distribution-relative thresholds for scale-based achievements.
 *
 * Population / GDP / GDP-per-capita achievements are NOT hardcoded to absolute
 * numbers (those go stale as nations grow). Instead each tier is a percentile of
 * the live country distribution, chosen by the achievement's rarity. "Top 10% of
 * nations by GDP" stays meaningful forever; "reach $10T" does not.
 *
 * Single source of truth:
 *   - RARITY_PERCENTILE  → which percentile each rarity targets
 *   - SCALE_METRIC_BY_ID → which metric each scale achievement measures
 * Both the sync layer (conditionJson) and the fallback condition fns derive from
 * these, so there are no duplicated magic numbers anywhere.
 */
import type { PrismaClient } from "@prisma/client";
import type { AchievementRarity, ExtendedAchievementData } from "./achievement-definitions";

export type ScaleMetric = "currentPopulation" | "currentTotalGdp" | "currentGdpPerCapita";

export const SCALE_METRICS: ScaleMetric[] = [
  "currentPopulation",
  "currentTotalGdp",
  "currentGdpPerCapita",
];

/** Higher value = better, so a higher percentile = rarer tier. */
export const RARITY_PERCENTILE: Record<AchievementRarity, number> = {
  Common: 25,
  Uncommon: 50,
  Rare: 75,
  Epic: 90,
  Legendary: 98,
};

/** The scale achievements and the metric each one ranks on. */
export const SCALE_METRIC_BY_ID: Record<string, ScaleMetric> = {
  // Total GDP ladder (Common → Legendary)
  "econ-first-million": "currentTotalGdp",
  "econ-millionaire-nation": "currentTotalGdp",
  "econ-economic-powerhouse": "currentTotalGdp",
  "econ-trillion-club": "currentTotalGdp",
  "econ-global-titan": "currentTotalGdp",
  // GDP per capita ladder (Common → Epic)
  "econ-wealthy-citizens": "currentGdpPerCapita",
  "econ-prosperity-nation": "currentGdpPerCapita",
  "econ-first-world-status": "currentGdpPerCapita",
  "econ-ultra-prosperity": "currentGdpPerCapita",
  // Population ladder (Common → Legendary)
  "pop-rising-nation": "currentPopulation",
  "gen-population-growth": "currentPopulation",
  "pop-major-power": "currentPopulation",
  "pop-superpower": "currentPopulation",
  "pop-demographic-titan": "currentPopulation",
};

export type ScaleThresholds = Partial<Record<ScaleMetric, Record<number, number>>>;

const PERCENTILES = [...new Set(Object.values(RARITY_PERCENTILE))].sort((a, b) => a - b);

/** Value at the p-th percentile of an ascending-sorted array. */
export function percentileOf(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return Infinity; // empty distribution → unattainable (safe)
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor((p / 100) * sortedAsc.length)));
  return sortedAsc[idx]!;
}

const TTL_MS = 10 * 60 * 1000;
let cache: ScaleThresholds | null = null;
let cachedAt = 0;
let inflight: Promise<ScaleThresholds> | null = null;

/** Cached per-metric percentile thresholds computed from all countries. */
export async function getScaleThresholds(db: PrismaClient): Promise<ScaleThresholds> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const rows = await db.country.findMany({
      select: { currentPopulation: true, currentTotalGdp: true, currentGdpPerCapita: true },
    });
    const out: ScaleThresholds = {};
    for (const metric of SCALE_METRICS) {
      const vals = rows
        .map((r) => r[metric])
        .filter((v): v is number => typeof v === "number" && isFinite(v))
        .sort((a, b) => a - b);
      const byPct: Record<number, number> = {};
      for (const p of PERCENTILES) byPct[p] = percentileOf(vals, p);
      out[metric] = byPct;
    }
    cache = out;
    cachedAt = Date.now();
    inflight = null;
    return out;
  })();

  return inflight;
}

/**
 * Fallback condition check for a scale achievement (used when conditionJson is
 * absent). Resolves the percentile threshold attached to `data.scaleThresholds`.
 */
export function meetsScale(
  data: ExtendedAchievementData,
  metric: ScaleMetric,
  percentile: number
): boolean {
  const threshold = data.scaleThresholds?.[metric]?.[percentile];
  if (threshold == null) return false;
  const value = data.country[metric];
  return typeof value === "number" && value >= threshold;
}
