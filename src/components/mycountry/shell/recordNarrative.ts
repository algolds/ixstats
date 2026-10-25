import { consequenceFieldLabel } from "~/lib/intent/consequence-labels";
import { STATUS_TEXT } from "./status-tone";

export interface CanonFeedItem {
  id: string;
  title: string;
  category?: string;
  timestamp: number | string | Date;
  kind?: string;
  description?: string | null;
  deltaValue?: number | null;
  targetField?: string | null;
}

/** Badge text colour: only a direction of change (or a directive's accent) carries colour. */
export const POSITIVE = "text-green";
export const NEGATIVE = STATUS_TEXT.critical;
const NEUTRAL = STATUS_TEXT.neutral;

export function formatDeltaValue(val: number | null | undefined): string {
  if (val === null || val === undefined || !isFinite(val)) return "Updated";
  const formatted = Math.abs(val).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${val > 0 ? "+" : val < 0 ? "-" : ""}${formatted}`;
}

interface Narrative {
  narrative: string;
  badge?: { text: string; direction?: "up" | "down" | "neutral"; cls: string };
}

function describedBadge(item: CanonFeedItem): Narrative["badge"] {
  if (item.deltaValue == null) return undefined;
  const deltaStr = formatDeltaValue(item.deltaValue);
  if (item.deltaValue > 0) return { text: `${deltaStr} increase`, direction: "up", cls: POSITIVE };
  if (item.deltaValue < 0)
    return { text: `${deltaStr} decrease`, direction: "down", cls: NEGATIVE };
  return { text: "No net change", direction: "neutral", cls: NEUTRAL };
}

function ledgerNarrative(item: CanonFeedItem, field: string): Narrative {
  const deltaStr = formatDeltaValue(item.deltaValue);
  const isPositive = (item.deltaValue ?? 0) > 0;
  const label = consequenceFieldLabel(field);
  return {
    narrative: `${label} changed by ${deltaStr}.`,
    badge: {
      text: `${label}: ${deltaStr}`,
      direction: isPositive ? "up" : "down",
      cls: isPositive ? POSITIVE : NEGATIVE,
    },
  };
}

/** The expanded-row text and badge for a feed item, from its description or by kind. */
export function describeRecord(item: CanonFeedItem, metaLabel: string): Narrative {
  if (item.description && item.description.trim().length > 10) {
    return { narrative: item.description.trim(), badge: describedBadge(item) };
  }

  switch (item.kind) {
    case "effect":
      return {
        narrative: `Effect recorded: ${item.title}.`,
        badge: { text: "Effect", cls: STATUS_TEXT.accent },
      };
    case "diplomacy":
      return {
        narrative: `Diplomatic event: ${item.title}.`,
        badge: { text: "Diplomatic event", cls: NEUTRAL },
      };
    case "decision":
      return {
        narrative: `Issue decided: ${item.title}.`,
        badge: { text: "Decision", cls: NEUTRAL },
      };
    case "ledger":
      if (item.targetField) return ledgerNarrative(item, item.targetField);
  }

  return {
    narrative: `${metaLabel} record: ${item.title}.`,
    badge: { text: "Record", cls: NEUTRAL },
  };
}
