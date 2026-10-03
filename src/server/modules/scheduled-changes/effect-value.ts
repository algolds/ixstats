/**
 * Scheduled changes — pure value/lookup helpers.
 *
 * The economy engine (`src/lib/economy/calculations.ts`) treats a StorytellerEffect
 * `value` as a growth-rate-like decimal clamped to ±0.5, so a scheduled change must be
 * stored as a *relative* change `(new - old) / |old|`, never as the absolute target.
 */

import { StorytellerEffectType } from "~/types/ixstats";

export const ALLOWED_FIELD_PATHS = [
  "currentGdpPerCapita",
  "currentTotalGdp",
  "currentPopulation",
  "adjustedGdpGrowth",
  "populationGrowthRate",
  "unemploymentRate",
  "inflationRate",
  "taxRevenueGDPPercent",
] as const;

export type AllowedFieldPath = (typeof ALLOWED_FIELD_PATHS)[number];

export function isAllowedFieldPath(p: string): p is AllowedFieldPath {
  return (ALLOWED_FIELD_PATHS as readonly string[]).includes(p);
}

export const FIELD_TO_EFFECT_TYPE: Record<AllowedFieldPath, StorytellerEffectType> = {
  currentGdpPerCapita: StorytellerEffectType.GDP_ADJUSTMENT,
  currentTotalGdp: StorytellerEffectType.GDP_ADJUSTMENT,
  currentPopulation: StorytellerEffectType.POPULATION_ADJUSTMENT,
  adjustedGdpGrowth: StorytellerEffectType.GROWTH_RATE_MODIFIER,
  populationGrowthRate: StorytellerEffectType.GROWTH_RATE_MODIFIER,
  unemploymentRate: StorytellerEffectType.ECONOMIC_POLICY,
  inflationRate: StorytellerEffectType.ECONOMIC_POLICY,
  taxRevenueGDPPercent: StorytellerEffectType.ECONOMIC_POLICY,
};

export const IMPACT_TO_DURATION: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 4,
};

export const IMPACT_TO_PRIORITY: Record<string, "low" | "medium" | "high"> = {
  none: "low",
  low: "medium",
  medium: "high",
  high: "high",
};

type EffectValueResult = { ok: true; value: number } | { ok: false; reason: string };

function parseFiniteNumber(json: string): number | null {
  try {
    const parsed: number = JSON.parse(json);
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Converts an absolute target (oldValue → newValue, both JSON-encoded numbers) into the
 * relative-change decimal the economy engine expects: (new - old) / |old|.
 * Not clamped here — the engine clamps to ±0.5.
 */
export function toEffectValue(oldValueJson: string, newValueJson: string): EffectValueResult {
  const oldValue = parseFiniteNumber(oldValueJson);
  const newValue = parseFiniteNumber(newValueJson);
  if (oldValue === null || newValue === null) {
    return { ok: false, reason: "oldValue and newValue must be JSON-encoded finite numbers" };
  }
  if (oldValue === 0) {
    return { ok: false, reason: "oldValue is 0; relative change undefined" };
  }
  return { ok: true, value: (newValue - oldValue) / Math.abs(oldValue) };
}
