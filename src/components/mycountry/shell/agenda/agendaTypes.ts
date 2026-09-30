import type { ComponentType } from "react";
import type { DrillSheetKind, V2Drill } from "~/components/mycountry/shell/DrillSheets";
import type { StatusTone } from "../status-tone";

/** Where an inbox item comes from — also the item's mailbox. */
export type AgendaItemKind = "issue" | "directive" | "election";

/**
 * How pressing an item is, relative to its deadline. Never a calendar date: an item is either
 * past its deadline, close to it, or simply scheduled.
 */
export type AgendaUrgency = "overdue" | "due-soon" | "upcoming";

/** One inbox item, derived from live game state (never stored or invented). */
export interface AgendaItem {
  /** Stable across refetches: `<kind>:<source id>`. */
  id: string;
  kind: AgendaItemKind;
  title: string;
  /** One-line snippet under the title. */
  preview: string;
  /** Full text for the item's detail dialog. */
  description: string;
  /** Sentence-case source label, e.g. "Priority issue", "Moderate directive", "Election". */
  statusLabel: string;
  icon: ComponentType<{ className?: string }>;
  /** Status tone for the glyph and source label (colour only when it means something). */
  tone: StatusTone;
  /** When the item arrived (real time, ms) — shown as "2h ago". */
  receivedAt: number | null;
  /** Deadline pressure, when the item has a deadline or a scheduled time. */
  urgency: AgendaUrgency | null;
  /** Urgent: shown with a flag and listed under "Needs action". */
  flagged: boolean;
  /**
   * Fingerprint of the underlying state that should bring a read, done or snoozed item back
   * (an escalated severity, a moved deadline). Inbox state stored for another version is ignored.
   */
  version: string;
  /** Already seen elsewhere (an issue the player has viewed): starts read. */
  seen: boolean;
  directiveGoal: string;
  drillKind?: Exclude<V2Drill, { kind: "intent" } | null>;
  intentId?: string;
}

/** The inbox's mailboxes, in display order. */
export type AgendaMailbox = "all" | "action" | "issues" | "directives" | "elections";

export const AGENDA_MAILBOX_LABEL: Record<AgendaMailbox, string> = {
  all: "All",
  action: "Needs action",
  issues: "Issues",
  directives: "Directives",
  elections: "Elections",
};

export function inMailbox(item: AgendaItem, mailbox: AgendaMailbox): boolean {
  switch (mailbox) {
    case "all":
      return true;
    case "action":
      return item.flagged;
    case "issues":
      return item.kind === "issue";
    case "directives":
      return item.kind === "directive";
    case "elections":
      return item.kind === "election";
  }
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
  onIssueDirective?: (goal?: string) => void;
  onOpenIntent?: (intentId: string) => void;
}
