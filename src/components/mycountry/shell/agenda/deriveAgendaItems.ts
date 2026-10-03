import { KeyCommand as Command, WarningCircle as AlertCircle, Megaphone } from "iconoir-react";
import type { AgendaItem, AgendaUrgency } from "./agendaTypes";
import { getSeverityRank } from "./agendaTypes";

/** One IxTime day in ms. Deadlines and elections are scheduled in IxTime. */
const IX_DAY_MS = 86_400_000;
/** An issue deadline this close (IxTime) is "Due soon". */
export const ISSUE_DUE_SOON_IX_MS = 2 * IX_DAY_MS;
/** An election this close (IxTime) is "Due soon" and needs action. */
export const ELECTION_DUE_SOON_IX_MS = 7 * IX_DAY_MS;

type Timestamp = Date | string | number | null | undefined;

export interface AgendaSourceIssue {
  id: string;
  title: string;
  description?: string | null;
  severity?: string | null;
  urgency?: number | null;
  deadlineIxTime?: number | null;
  status?: string | null;
  createdAt?: Timestamp;
}

export interface AgendaSourceIntent {
  id: string;
  goal: string;
  status?: string | null;
  category?: string | null;
  tier?: string | null;
  progress?: number | null;
  createdAt?: Timestamp;
}

export interface AgendaSourceElection {
  id: string;
  name: string;
  electionType?: string | null;
  scheduledIxTime: number;
  status?: string | null;
  createdAt?: Timestamp;
}

export interface AgendaSources {
  /** Open national issues (`nationalIssues.getMyIssues`, status active). */
  issues?: readonly AgendaSourceIssue[];
  /** All intents (`intent.getTree`); only active directives are listed. */
  intents?: readonly AgendaSourceIntent[];
  /** Elections (`elections.getElections`); only future, not completed or cancelled. */
  elections?: readonly AgendaSourceElection[];
  nowIxTime: number;
}

/** A Date, ISO string or ms timestamp as ms, or null when missing or invalid. */
export function toMs(value: Timestamp): number | null {
  if (value == null) return null;
  const ms =
    value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function firstLine(text: string | null | undefined): string {
  return (text ?? "").trim().split(/\n+/)[0]?.trim() ?? "";
}

function capitalize(text: string): string {
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

const URGENCY_RANK: Record<AgendaUrgency, number> = { overdue: 3, "due-soon": 2, upcoming: 0 };

/** Agenda order: overdue, then due soon, then flagged, then newest first. */
export function compareAgendaItems(a: AgendaItem, b: AgendaItem): number {
  const rank = (i: AgendaItem) => (i.urgency ? URGENCY_RANK[i.urgency] : 0) || (i.flagged ? 1 : 0);
  return rank(b) - rank(a) || (b.receivedAt ?? 0) - (a.receivedAt ?? 0);
}

/**
 * The agenda's items, from real game state only: open national issues (with their deadline
 * pressure folded in), active directives and upcoming elections. Pure: the caller passes the
 * query data and IxTime "now". Timing is relative (see `formatAgendaTime`), never a date.
 */
export function deriveAgendaItems({
  issues = [],
  intents = [],
  elections = [],
  nowIxTime,
}: AgendaSources): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const iss of issues) {
    const sev = String(iss.severity ?? "").toLowerCase();
    const urgent = getSeverityRank(sev) >= 3 || (iss.urgency ?? 0) > 70;
    const deadline =
      typeof iss.deadlineIxTime === "number" && Number.isFinite(iss.deadlineIxTime)
        ? iss.deadlineIxTime
        : null;
    const urgency: AgendaUrgency | null =
      deadline === null
        ? null
        : deadline <= nowIxTime
          ? "overdue"
          : deadline - nowIxTime <= ISSUE_DUE_SOON_IX_MS
            ? "due-soon"
            : null;
    items.push({
      id: `issue:${iss.id}`,
      kind: "issue",
      title: iss.title,
      preview: firstLine(iss.description) || "Waiting for your decision.",
      statusLabel: urgent ? "Priority issue" : "Open issue",
      icon: AlertCircle,
      tone:
        urgent || urgency === "overdue"
          ? "critical"
          : urgency === "due-soon"
            ? "warning"
            : "neutral",
      receivedAt: toMs(iss.createdAt),
      urgency,
      flagged: urgent || urgency !== null,
      drillKind: { kind: "issue", issueId: iss.id },
    });
  }

  for (const it of intents) {
    if (String(it.status ?? "").toLowerCase() !== "active") continue;
    const tier = it.tier ? `${capitalize(it.tier)} directive` : "Directive";
    const progress =
      typeof it.progress === "number" && Number.isFinite(it.progress)
        ? `${Math.round(it.progress)}% done`
        : null;
    items.push({
      id: `directive:${it.id}`,
      kind: "directive",
      title: it.goal,
      preview: ["In progress", progress, it.category ? capitalize(it.category) : null]
        .filter(Boolean)
        .join(" · "),
      statusLabel: tier,
      icon: Command,
      tone: "accent",
      receivedAt: toMs(it.createdAt),
      urgency: null,
      flagged: false,
      intentId: it.id,
    });
  }

  for (const el of elections) {
    const status = String(el.status ?? "").toLowerCase();
    if (status === "completed" || status === "cancelled") continue;
    if (!(el.scheduledIxTime > nowIxTime)) continue;
    const soon = el.scheduledIxTime - nowIxTime <= ELECTION_DUE_SOON_IX_MS;
    const type = String(el.electionType ?? "general").toLowerCase();
    const label =
      type === "referendum"
        ? "Referendum"
        : type === "special"
          ? "Special election"
          : "General election";
    const phase =
      status === "voting"
        ? "Polls are open"
        : status === "campaigning"
          ? "Campaigning is under way"
          : "Scheduled";
    items.push({
      id: `election:${el.id}`,
      kind: "election",
      title: el.name || "Election",
      preview: phase,
      statusLabel: label,
      icon: Megaphone,
      tone: soon ? "warning" : "neutral",
      receivedAt: toMs(el.createdAt),
      urgency: soon ? "due-soon" : "upcoming",
      flagged: soon,
      drillKind: { kind: "politics" },
    });
  }

  return items.sort(compareAgendaItems);
}

/**
 * The trailing time label for an agenda row: deadline pressure ("Overdue", "Due soon",
 * "Upcoming") when there is one, otherwise how long ago the item arrived ("Just now", "5m ago",
 * "2h ago", "3d ago", "2w ago", "4mo ago", "1y ago"). Never a calendar date or weekday.
 */
export function formatAgendaTime(
  item: Pick<AgendaItem, "urgency" | "receivedAt">,
  nowMs: number
): string {
  if (item.urgency === "overdue") return "Overdue";
  if (item.urgency === "due-soon") return "Due soon";
  if (item.urgency === "upcoming") return "Upcoming";
  if (item.receivedAt == null) return "";
  return formatAgo(item.receivedAt, nowMs);
}

export function formatAgo(thenMs: number, nowMs: number): string {
  const minutes = Math.floor(Math.max(0, nowMs - thenMs) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
