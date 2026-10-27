/**
 * Issue consequences on projected stats → StorytellerEffects.
 *
 * GDP, GDP per capita, population and GDP growth are not stored truths: the economy engine
 * (`IxStatsCalculator`) projects them from the country's baseline plus its StorytellerEffects,
 * and the stat-progression job persists that projection into `current*`. A direct field write
 * from an issue was therefore overwritten on the next read (and `actualGdpGrowth` is read by no
 * progression code at all). These consequences become level effects the projection applies:
 *
 * - `actualGdpGrowth` ±X (percentage points) → GDP per capita level effect of
 *   (1 + X/100)^years − 1, phased in over the effect's years (default 1 IxTime year).
 * - `currentTotalGdp` / `currentGdpPerCapita` ×m → GDP per capita level effect of m − 1, at once.
 * - `currentPopulation` ×m → population level effect of m − 1, at once.
 *
 * Anything else aimed at these fields (e.g. `set`, or an absolute add to GDP) has no faithful
 * mapping and is dropped, so it is neither applied nor shown.
 */

import { StorytellerEffectType } from "~/lib/economy/calculations";
import type { ConsequenceDefinition } from "./types";

/** IxTime years over which a GDP-growth consequence phases in (StorytellerEffect.duration is an Int). */
export const ISSUE_GROWTH_EFFECT_YEARS = 1;
/** Largest GDP-per-capita level shift one consequence may cause (±3%). */
export const MAX_ISSUE_GDP_LEVEL_SHIFT = 0.03;
/** Largest population level shift one consequence may cause (±1%). */
export const MAX_ISSUE_POPULATION_LEVEL_SHIFT = 0.01;

/** Country fields the projection owns; issue consequences on them become effects. */
const PROJECTION_FIELDS = new Set([
  "actualGdpGrowth",
  "currentTotalGdp",
  "currentGdpPerCapita",
  "currentPopulation",
]);

interface IssueEffectSpec {
  inputType: StorytellerEffectType;
  /** Level shift as a decimal (0.01 = +1%). */
  value: number;
  /** IxTime years to phase in; null = at once. */
  duration: number | null;
  /** Player-facing summary, e.g. "GDP per capita +0.30% over 1 IxTime year". */
  description: string;
}

export function isProjectionConsequence(
  c: Pick<ConsequenceDefinition, "targetModel" | "targetField">
) {
  return c.targetModel === "Country" && PROJECTION_FIELDS.has(c.targetField);
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function describe(label: string, value: number, duration: number | null): string {
  const pct = `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(2)}%`;
  if (duration == null) return `${label} ${pct}`;
  return `${label} ${pct} over ${duration} IxTime year${duration === 1 ? "" : "s"}`;
}

function growthYears(c: ConsequenceDefinition): number {
  if (c.durationDays && c.durationDays > 0) return Math.max(1, Math.round(c.durationDays / 365));
  return ISSUE_GROWTH_EFFECT_YEARS;
}

/**
 * The StorytellerEffect a projection-field consequence becomes, or null when it has no faithful
 * mapping (or rounds to nothing).
 */
export function issueConsequenceToEffect(c: ConsequenceDefinition): IssueEffectSpec | null {
  if (!isProjectionConsequence(c) || !Number.isFinite(c.value)) return null;

  let spec: IssueEffectSpec | null = null;
  switch (c.targetField) {
    case "actualGdpGrowth": {
      if (c.operation !== "add" && c.operation !== "subtract") return null;
      const pp = c.operation === "add" ? c.value : -c.value;
      const years = growthYears(c);
      const value = round4(clamp(Math.pow(1 + pp / 100, years) - 1, MAX_ISSUE_GDP_LEVEL_SHIFT));
      spec = {
        inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
        value,
        duration: years,
        description: describe("GDP per capita", value, years),
      };
      break;
    }
    case "currentTotalGdp":
    case "currentGdpPerCapita": {
      if (c.operation !== "multiply" || c.value <= 0) return null;
      const value = round4(clamp(c.value - 1, MAX_ISSUE_GDP_LEVEL_SHIFT));
      spec = {
        inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
        value,
        duration: null,
        description: describe("GDP", value, null),
      };
      break;
    }
    case "currentPopulation": {
      if (c.operation !== "multiply" || c.value <= 0) return null;
      const value = round4(clamp(c.value - 1, MAX_ISSUE_POPULATION_LEVEL_SHIFT));
      spec = {
        inputType: StorytellerEffectType.POPULATION_LEVEL_ADJUSTMENT,
        value,
        duration: null,
        description: describe("Population", value, null),
      };
      break;
    }
  }

  return spec && spec.value !== 0 ? spec : null;
}

/**
 * Whether resolving would actually apply this consequence. Used to keep previews (recon) from
 * listing effects that are dropped.
 */
export function isAppliedIssueConsequence(c: ConsequenceDefinition): boolean {
  return !isProjectionConsequence(c) || issueConsequenceToEffect(c) !== null;
}
