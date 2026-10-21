import { computeLiveMatchState, type LiveTraceEvent } from "~/lib/sports/live-match";

const trace: LiveTraceEvent[] = [
  { t: 10, type: "goal", team: "home", description: "1-0" },
  { t: 35, type: "card", team: "away", description: "yellow" },
  { t: 55, type: "goal", team: "away", description: "1-1" },
  { t: 80, type: "goal", team: "home", description: "2-1" },
];

const base = {
  trace,
  resolvedIxTime: 1000,
  windowMs: 100, // broadcast spans 100 IxMs; maxMinute = 80
  finalHomeScore: 2,
  finalAwayScore: 1,
};

describe("computeLiveMatchState", () => {
  test("mid-broadcast reveals only events up to the current minute", () => {
    // 50% through 100ms window -> minute 40 of 80 -> first goal (t=10) only
    const s = computeLiveMatchState({ ...base, nowIxTime: 1050 });
    expect(s.minute).toBe(40);
    expect(s.homeScore).toBe(1);
    expect(s.awayScore).toBe(0);
    expect(s.lastEvent?.type).toBe("card"); // t=35 is the latest <= 40
  });
});
