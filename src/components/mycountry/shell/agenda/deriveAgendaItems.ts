import { KeyCommand as Command, WarningCircle as AlertCircle, Megaphone } from "iconoir-react";
import type { AgendaItem, AgendaUrgency } from "./agendaTypes";
import { getSeverityRank } from "./agendaTypes";
import { PHASE_META, directiveTimeline } from "~/components/mycountry/directives/directive-model";

/**
 * Deadlines and elections are scheduled on the nation's realm clock; how soon they come is real time at the realm's
 * speed, so a 6× realm's deadlines turn "Due soon" sooner in game time and a paused realm's never approach.
 */
const REAL_DAY_MS = 86_400_000;
/** An issue deadline a real day away is "Due soon" (two in-world days on Ixnay's ×2). */
const ISSUE_DUE_SOON_REAL_MS = REAL_DAY_MS;
/** An election three and a half real days away is "Due soon" and needs action (a week on Ixnay's ×2). */
const ELECTION_DUE_SOON_REAL_MS = 3.5 * REAL_DAY_MS;

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
  /** IxTime the directive was declared; places it in its execution week or in force. */
  createdIxTime?: number | null;
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

interface AgendaSources {
  /** Open national issues (`nationalIssues.getMyIssues`, status active). */
  issues?: readonly AgendaSourceIssue[];
  /** All intents (`intent.getTree`); only active directives are listed. */
  intents?: readonly AgendaSourceIntent[];
  /** Elections (`elections.getElections`); only future, not completed or cancelled. */
  elections?: readonly AgendaSourceElection[];
  /** The nation's realm-clock "now". */
  nowIxTime: number;
  /** The realm's speed (0: paused). */
  multiplier: number;
}

type AgendaClock = Pick<AgendaSources, "nowIxTime" | "multiplier">;

/** `target` (realm-clock ms, still ahead) is within `realMs` of real time at the realm's speed. */
function dueWithin(
  target: number,
  { nowIxTime, multiplier }: AgendaClock,
  realMs: number
): boolean {
  return multiplier > 0 && (target - nowIxTime) / multiplier <= realMs;
}

/** A Date, ISO string or ms timestamp as ms, or null when missing or invalid. */
function toMs(value: Timestamp): number | null {
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
function compareAgendaItems(a: AgendaItem, b: AgendaItem): number {
  const rank = (i: AgendaItem) => (i.urgency ? URGENCY_RANK[i.urgency] : 0) || (i.flagged ? 1 : 0);
  return rank(b) - rank(a) || (b.receivedAt ?? 0) - (a.receivedAt ?? 0);
}

const finiteOrNull = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function issueDeadlineUrgency(deadline: number | null, clock: AgendaClock): AgendaUrgency | null {
  if (deadline === null) return null;
  if (deadline <= clock.nowIxTime) return "overdue";
  return dueWithin(deadline, clock, ISSUE_DUE_SOON_REAL_MS) ? "due-soon" : null;
}

function issueItem(iss: AgendaSourceIssue, clock: AgendaClock): AgendaItem {
  const urgent =
    getSeverityRank(String(iss.severity ?? "").toLowerCase()) >= 3 || (iss.urgency ?? 0) > 70;
  const urgency = issueDeadlineUrgency(finiteOrNull(iss.deadlineIxTime), clock);
  return {
    id: `issue:${iss.id}`,
    kind: "issue",
    title: iss.title,
    preview: firstLine(iss.description) || "Waiting for your decision.",
    statusLabel: urgent ? "Priority issue" : "Open issue",
    icon: AlertCircle,
    tone:
      urgent || urgency === "overdue" ? "critical" : urgency === "due-soon" ? "warning" : "neutral",
    receivedAt: toMs(iss.createdAt),
    urgency,
    flagged: urgent || urgency !== null,
    drillKind: { kind: "issue", issueId: iss.id },
  };
}

/**
 * An active directive's phase ("Executing" during its execution week, then "In force"). Its stored
 * progress only moves when linked resistance resolves, so it is not shown.
 */
function directivePhaseLabel(it: AgendaSourceIntent, nowIxTime: number): string {
  const createdIxTime = finiteOrNull(it.createdIxTime);
  if (createdIxTime === null) return "In progress";
  const { phase } = directiveTimeline(
    { status: "active", createdIxTime, execBandwidthCost: 0 },
    nowIxTime
  );
  return PHASE_META[phase].label;
}

function directiveItem(it: AgendaSourceIntent, nowIxTime: number): AgendaItem {
  return {
    id: `directive:${it.id}`,
    kind: "directive",
    title: it.goal,
    preview: [directivePhaseLabel(it, nowIxTime), it.category ? capitalize(it.category) : null]
      .filter(Boolean)
      .join(" · "),
    statusLabel: it.tier ? `${capitalize(it.tier)} directive` : "Directive",
    icon: Command,
    tone: "accent",
    receivedAt: toMs(it.createdAt),
    urgency: null,
    flagged: false,
    intentId: it.id,
  };
}

const ELECTION_LABEL: Record<string, string> = {
  referendum: "Referendum",
  special: "Special election",
};
const ELECTION_PHASE: Record<string, string> = {
  voting: "Polls are open",
  campaigning: "Campaigning is under way",
};

function electionItem(el: AgendaSourceElection, clock: AgendaClock): AgendaItem {
  const soon = dueWithin(el.scheduledIxTime, clock, ELECTION_DUE_SOON_REAL_MS);
  return {
    id: `election:${el.id}`,
    kind: "election",
    title: el.name || "Election",
    preview: ELECTION_PHASE[String(el.status ?? "").toLowerCase()] ?? "Scheduled",
    statusLabel: ELECTION_LABEL[String(el.electionType ?? "").toLowerCase()] ?? "General election",
    icon: Megaphone,
    tone: soon ? "warning" : "neutral",
    receivedAt: toMs(el.createdAt),
    urgency: soon ? "due-soon" : "upcoming",
    flagged: soon,
    drillKind: { kind: "politics" },
  };
}

const isUpcoming = (el: AgendaSourceElection, nowIxTime: number) =>
  !["completed", "cancelled"].includes(String(el.status ?? "").toLowerCase()) &&
  el.scheduledIxTime > nowIxTime;

/**
 * The agenda's items, from real game state only: open national issues (with their deadline
 * pressure folded in), active directives and upcoming elections. Pure: the caller passes the
 * query data and the nation's realm-clock "now" and speed. Timing is relative (see
 * `formatAgendaTime`), never a date.
 */
export function deriveAgendaItems({
  issues = [],
  intents = [],
  elections = [],
  nowIxTime,
  multiplier,
}: AgendaSources): AgendaItem[] {
  const clock = { nowIxTime, multiplier };
  return [
    ...issues.map((iss) => issueItem(iss, clock)),
    ...intents
      .filter((it) => String(it.status ?? "").toLowerCase() === "active")
      .map((it) => directiveItem(it, nowIxTime)),
    ...elections.filter((el) => isUpcoming(el, nowIxTime)).map((el) => electionItem(el, clock)),
  ].sort(compareAgendaItems);
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
