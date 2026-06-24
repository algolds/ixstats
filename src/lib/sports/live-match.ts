/**
 * Live match playback — deterministic shared-clock projection.
 *
 * Matches resolve instantly in the cron, but the resolver emits a minute-by-minute
 * event `trace`. A "Live Activity" replays that trace over a fixed broadcast window
 * anchored to the match's `resolvedIxTime`. Because IxTime is a shared clock and the
 * trace is deterministic, every client computes the same state with no server ticks
 * and no WebSocket — just `computeLiveMatchState(now)`.
 */

export interface LiveTraceEvent {
  t: number; // match minute
  type: string; // "goal" | "card" | "injury" | "tactic_shift" | ...
  team?: "home" | "away";
  description?: string;
  actorName?: string;
}

export interface LiveMatchState {
  progress: number; // 0..1 through the broadcast window
  minute: number; // current match minute being shown
  maxMinute: number;
  homeScore: number;
  awayScore: number;
  isFinal: boolean;
  lastEvent: LiveTraceEvent | null;
}

export function computeLiveMatchState(args: {
  trace: LiveTraceEvent[];
  resolvedIxTime: number;
  nowIxTime: number;
  windowMs: number;
  finalHomeScore?: number;
  finalAwayScore?: number;
}): LiveMatchState {
  const { trace, resolvedIxTime, nowIxTime, windowMs } = args;

  const maxMinute = trace.reduce((m, e) => Math.max(m, e?.t ?? 0), 0) || 90;
  const rawProgress = windowMs > 0 ? (nowIxTime - resolvedIxTime) / windowMs : 1;
  const progress = Math.min(1, Math.max(0, rawProgress));
  const isFinal = progress >= 1;
  const minute = Math.min(maxMinute, Math.round(progress * maxMinute));

  let homeScore = 0;
  let awayScore = 0;
  let lastEvent: LiveTraceEvent | null = null;
  // trace is pushed in ascending minute order, so the last event with t <= minute
  // is the most recent one to show.
  for (const e of trace) {
    if (!e || e.t > minute) continue;
    lastEvent = e;
    if (e.type === "goal") {
      if (e.team === "away") awayScore++;
      else homeScore++;
    }
  }

  // At full time, trust the stored final score over the trace tally.
  if (isFinal) {
    homeScore = args.finalHomeScore ?? homeScore;
    awayScore = args.finalAwayScore ?? awayScore;
  }

  return { progress, minute, maxMinute, homeScore, awayScore, isFinal, lastEvent };
}
