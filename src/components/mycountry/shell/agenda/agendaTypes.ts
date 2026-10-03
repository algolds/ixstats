import type { ComponentType } from "react";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import type { StatusTone } from "../status-tone";

/** Where an agenda item comes from. */
type AgendaItemKind = "issue" | "directive" | "election";

/**
 * How pressing an item is, relative to its deadline. Never a calendar date: an item is either
 * past its deadline, close to it, or simply scheduled.
 */
export type AgendaUrgency = "overdue" | "due-soon" | "upcoming";

/** One agenda item, derived from live game state (never stored or invented). */
export interface AgendaItem {
  /** Stable across refetches: `<kind>:<source id>`. */
  id: string;
  kind: AgendaItemKind;
  title: string;
  /** One-line snippet under the title. */
  preview: string;
  /** Sentence-case source label, e.g. "Priority issue", "Moderate directive", "Election". */
  statusLabel: string;
  icon: ComponentType<{ className?: string }>;
  /** Status tone for the glyph and source label (colour only when it means something). */
  tone: StatusTone;
  /** When the item arrived (real time, ms), shown as "2h ago". */
  receivedAt: number | null;
  /** Deadline pressure, when the item has a deadline or a scheduled time. */
  urgency: AgendaUrgency | null;
  /** Urgent: shown with a flag. */
  flagged: boolean;
  drillKind?: Exclude<DrillSheetKind, { kind: "intent" } | null>;
  intentId?: string;
}

export function getSeverityRank(s: string): number {
  const sev = String(s ?? "").toLowerCase();
  if (sev === "critical") return 4;
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  return 1;
}

export interface ExecutiveAgendaProps {
  countryId: string;
  onOpenDrill?: (drill: Exclude<DrillSheetKind, { kind: "intent" } | null>) => void;
  onOpenIntent?: (intentId: string) => void;
}
