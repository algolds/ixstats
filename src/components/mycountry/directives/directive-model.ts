/**
 * Directives page model: pure helpers shared by the composer, the active list and the history.
 * No React, no server imports, so it is safe on the client and easy to unit test.
 *
 * Engine facts mirrored here (see docs/systems/mycountry.md, "Civil Service Capacity"):
 * - a directive holds its CivCap while it is `active` and inside one IxTime week of its commit
 *   (`DIRECTIVE_CIVCAP_WINDOW_MS` in src/lib/government/civcap.ts, which is server-only);
 * - moderate and extreme directives may spawn a resistance issue that must be resolved before
 *   the directive can be completed (src/lib/intent/resistance.ts, `intent.updateStatus`).
 */

import type { RouterOutputs } from "~/trpc/react";
import type { Acceptance, Category, ChangeLine, Tier } from "~/lib/intent/assemble";
import { consequenceFieldLabel, describeConsequenceBadge } from "~/lib/intent/consequence-labels";
import type { EffectItem } from "./EffectList";

export type IntentRow = RouterOutputs["intent"]["getTree"]["allIntents"][number];
export type IntentPackageView = RouterOutputs["intent"]["suggest"]["packages"][number];

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mirrors DIRECTIVE_CIVCAP_WINDOW_MS (src/lib/government/civcap.ts): one IxTime week. */
export const DIRECTIVE_EXECUTION_WINDOW_MS = 7 * DAY_MS;

/** Tiers the composer offers. `structural_unlocked` has no unlock check yet, so it is not shown. */
export type OfferedTier = Extract<Tier, "measured" | "moderate" | "extreme" | "broker_unlocked">;
export const OFFERED_TIERS: readonly OfferedTier[] = [
  "measured",
  "moderate",
  "extreme",
  "broker_unlocked",
];

export type Tone = "positive" | "caution" | "negative" | "info" | "neutral";

/** Status colour classes. The only place this page reaches past the neutral theme tokens. */
export const TONE_CLASSES: Record<Tone, { dot: string; text: string; chip: string; bar: string }> =
  {
    positive: {
      dot: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
      chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      bar: "bg-emerald-500",
    },
    caution: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      chip: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      bar: "bg-amber-500",
    },
    negative: {
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      chip: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300",
      bar: "bg-red-500",
    },
    info: {
      dot: "bg-sky-500",
      text: "text-sky-700 dark:text-sky-400",
      chip: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
      bar: "bg-sky-500",
    },
    neutral: {
      dot: "bg-muted-foreground/60",
      text: "text-muted-foreground",
      chip: "border-border bg-muted/50 text-muted-foreground",
      bar: "bg-muted-foreground/60",
    },
  };

export const TIER_META: Record<string, { label: string; summary: string; tone: Tone }> = {
  measured: {
    label: "Measured",
    summary: "A small, low-friction step. Easiest for stakeholders to accept.",
    tone: "positive",
  },
  moderate: {
    label: "Moderate",
    summary: "A real policy push. Balanced impact and acceptance.",
    tone: "caution",
  },
  extreme: {
    label: "Extreme",
    summary: "The biggest change, and the biggest fight.",
    tone: "negative",
  },
  broker_unlocked: {
    label: "Broker deal",
    summary: "Unlocked by an aligned power broker. Partners share the strain.",
    tone: "info",
  },
  structural_unlocked: {
    label: "Structural",
    summary: "Unlocked by your government components.",
    tone: "info",
  },
  proposed: { label: "Draft", summary: "Not yet declared.", tone: "neutral" },
};

export function tierMeta(tier: string | null | undefined) {
  return (
    TIER_META[tier ?? ""] ?? { label: tier ?? "Unknown", summary: "", tone: "neutral" as Tone }
  );
}

export const ACCEPTANCE_META: Record<Acceptance, { label: string; tone: Tone }> = {
  good: { label: "Likely accepted", tone: "positive" },
  mid: { label: "Contested", tone: "caution" },
  bad: { label: "Hard sell", tone: "negative" },
};

/** Engine category (lib/intent/assemble.ts) → the name players see. */
export const CATEGORY_LABELS: Record<Category, string> = {
  defense: "Defense",
  fiscal: "Fiscal",
  economy: "Economy",
  social: "Public services",
  infrastructure: "Infrastructure",
  security: "Public order",
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "General";
  return (
    CATEGORY_LABELS[category as Category] ??
    category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
  );
}

/** Tiers that can spawn a resistance issue on commit (intent.commit → spawnIntentResistance). */
export function tierMaySpawnResistance(tier: string): boolean {
  return tier === "moderate" || tier === "extreme";
}

export function parseChangeLines(changesJson: string | null | undefined): ChangeLine[] {
  if (!changesJson) return [];
  try {
    const parsed: unknown = JSON.parse(changesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is ChangeLine =>
        typeof c === "object" && c !== null && typeof (c as ChangeLine).label === "string"
    );
  } catch {
    return [];
  }
}

export type DirectivePhase = "draft" | "executing" | "in_force" | "completed" | "abandoned";

export const PHASE_META: Record<DirectivePhase, { label: string; tone: Tone; hint: string }> = {
  draft: { label: "Draft", tone: "neutral", hint: "Saved but not declared." },
  executing: {
    label: "Executing",
    tone: "caution",
    hint: "The civil service is carrying it out and it is holding CivCap.",
  },
  in_force: {
    label: "In force",
    tone: "info",
    hint: "Execution week is over and its CivCap is released. Complete it to close it out.",
  },
  completed: { label: "Completed", tone: "positive", hint: "Closed out." },
  abandoned: { label: "Abandoned", tone: "negative", hint: "Withdrawn before completion." },
};

export interface DirectiveTimeline {
  phase: DirectivePhase;
  /** 0-1 through the execution week (1 once it is over or closed). */
  executionProgress: number;
  /** IxTime at which the held CivCap is released, when still executing. */
  releasesAt: number | null;
  /** CivCap currently held by this directive (0 unless executing). */
  heldCivCap: number;
}

export function directiveTimeline(
  intent: Pick<IntentRow, "status" | "createdIxTime" | "civCapCost">,
  nowIxTime: number
): DirectiveTimeline {
  const endsAt = intent.createdIxTime + DIRECTIVE_EXECUTION_WINDOW_MS;
  const elapsed = Math.max(0, nowIxTime - intent.createdIxTime);
  const progress = Math.min(1, elapsed / DIRECTIVE_EXECUTION_WINDOW_MS);

  switch (intent.status) {
    case "proposed":
      return { phase: "draft", executionProgress: 0, releasesAt: null, heldCivCap: 0 };
    case "completed":
      return { phase: "completed", executionProgress: 1, releasesAt: null, heldCivCap: 0 };
    case "abandoned":
      return { phase: "abandoned", executionProgress: progress, releasesAt: null, heldCivCap: 0 };
    default: {
      const executing = nowIxTime < endsAt;
      return {
        phase: executing ? "executing" : "in_force",
        executionProgress: progress,
        releasesAt: executing ? endsAt : null,
        heldCivCap: executing ? (intent.civCapCost ?? 0) : 0,
      };
    }
  }
}

/** An IxTime timestamp as a short in-game date, e.g. "Mar 4, 2041". */
export function formatIxDate(ixTime: number): string {
  if (!Number.isFinite(ixTime)) return "—";
  return new Date(ixTime).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A GDP level shift (0.000583) as a percentage string ("+0.058%"). */
export function formatGdpShift(shift: number): string {
  const pct = shift * 100;
  const digits = Math.abs(pct) >= 0.1 ? 2 : 3;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(digits)}%`;
}

export interface DirectiveCountrySignals {
  crimeRate?: number | null;
  publicApproval?: number | null;
  militaryReadiness?: number | null;
}

/**
 * The preset domain that best answers the nation's weakest signal (crime, readiness, approval),
 * or null when nothing stands out. Drives the composer's "Suggest one" button.
 */
export function suggestedDomain(signals: DirectiveCountrySignals): string | null {
  if ((signals.crimeRate ?? 0) > 50) return "Security";
  if (signals.militaryReadiness != null && signals.militaryReadiness < 60) return "Defense";
  if (signals.publicApproval != null && signals.publicApproval < 50) return "Social";
  return null;
}

function formatSigned(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded)}`;
}

/** A projected package consequence as an effect row. */
export function consequenceToEffect(
  c: { targetField: string; operation: "add" | "subtract"; value: number },
  key: string
): EffectItem {
  const signed = c.operation === "subtract" ? -c.value : c.value;
  return {
    key,
    label: consequenceFieldLabel(c.targetField),
    value: formatSigned(signed),
    direction: signed > 0 ? "up" : signed < 0 ? "down" : "flat",
    favorable: signed === 0 ? null : describeConsequenceBadge(c).favorable,
  };
}

/** A recorded ledger change (intent.getOutcome) as an effect row, with before → after. */
export function ledgerToEffect(row: {
  id: string;
  targetField: string | null;
  deltaValue: number | null;
  previousValue: number | null;
  newValue: number | null;
}): EffectItem {
  const field = row.targetField ?? "change";
  const delta =
    row.deltaValue ??
    (row.previousValue != null && row.newValue != null ? row.newValue - row.previousValue : 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    key: row.id,
    label: consequenceFieldLabel(field),
    value: formatSigned(delta),
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    favorable:
      delta === 0
        ? null
        : describeConsequenceBadge({ targetField: field, operation: "add", value: delta })
            .favorable,
    caption:
      row.previousValue != null && row.newValue != null
        ? `${round(row.previousValue)} → ${round(row.newValue)}`
        : undefined,
  };
}

/** The phased GDP level effect as an effect row. */
export function gdpShiftToEffect(shift: number, years: number, key = "gdp"): EffectItem {
  return {
    key,
    label: "GDP",
    value: formatGdpShift(shift),
    direction: shift > 0 ? "up" : shift < 0 ? "down" : "flat",
    favorable: shift === 0 ? null : shift > 0,
    caption: `Phased in over ${years} IxTime year${years === 1 ? "" : "s"}, then kept`,
  };
}
