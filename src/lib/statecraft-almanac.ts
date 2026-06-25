/**
 * Statecraft Almanac — the upcoming-events feed.
 *
 * One pure function, fed by data the caller already has (elections, issue
 * deadlines, the legislative term). The MyCountry hero calendar and the Halo
 * (Dynamic Island) clock both render the SAME feed — glance + dwell, one source.
 * See plans/statecraft-stage1.md.
 *
 * Pure on purpose: no React, no tRPC, no IxTime import — caller passes `nowIxTime`.
 * That keeps it testable and reusable from both a client component and a server query.
 */

export type AlmanacKind = "election" | "issue" | "term";

export interface AlmanacEvent {
  id: string;
  label: string;
  ixTime: number; // IxTime ms timestamp the event falls on
  section: string; // MyCountrySection value, e.g. "politics" | "executive"
  kind: AlmanacKind;
}

export interface AlmanacInputs {
  nowIxTime: number;
  elections?: { id: string; name: string; scheduledIxTime: number; status?: string }[];
  issueDeadlines?: { id: string; title: string; deadlineIxTime: number | null | undefined }[];
  /** End of the current legislative term, if known. */
  termEndIxTime?: number | null;
}

/** Future Statecraft events, soonest first. Past/undated entries are dropped. */
export function getUpcomingEvents(inp: AlmanacInputs): AlmanacEvent[] {
  const now = inp.nowIxTime;
  const events: AlmanacEvent[] = [];

  for (const e of inp.elections ?? []) {
    // "completed"/"cancelled" elections are history, not upcoming.
    const done = e.status === "completed" || e.status === "cancelled";
    if (!done && e.scheduledIxTime > now) {
      events.push({
        id: `election-${e.id}`,
        label: e.name || "Election",
        ixTime: e.scheduledIxTime,
        section: "politics",
        kind: "election",
      });
    }
  }

  for (const i of inp.issueDeadlines ?? []) {
    if (i.deadlineIxTime != null && i.deadlineIxTime > now) {
      events.push({
        id: `issue-${i.id}`,
        label: i.title || "Issue deadline",
        ixTime: i.deadlineIxTime,
        section: "executive",
        kind: "issue",
      });
    }
  }

  if (inp.termEndIxTime != null && inp.termEndIxTime > now) {
    events.push({
      id: "term-end",
      label: "Legislative term ends",
      ixTime: inp.termEndIxTime,
      section: "politics",
      kind: "term",
    });
  }

  return events.sort((a, b) => a.ixTime - b.ixTime);
}

/** Short relative label for an IxTime event, e.g. "in 3 days" / "tomorrow" / "today". */
export function formatRelativeIxDays(eventIxTime: number, nowIxTime: number): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((eventIxTime - nowIxTime) / dayMs);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

/** Fine-grained countdown for a live pill, e.g. "2d 4h" / "6h 12m" / "45m" / "now". */
export function formatIxCountdown(targetIxTime: number, nowIxTime: number): string {
  let s = Math.floor((targetIxTime - nowIxTime) / 1000);
  if (s <= 0) return "now";
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
