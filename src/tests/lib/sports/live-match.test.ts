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
  test("kickoff: nothing has happened", () => {
    const s = computeLiveMatchState({ ...base, nowIxTime: 1000 });
    expect(s.minute).toBe(0);
    expect(s.homeScore).toBe(0);
    expect(s.awayScore).toBe(0);
    expect(s.isFinal).toBe(false);
  });

  test("mid-broadcast reveals only events up to the current minute", () => {
    // 50% through 100ms window -> minute 40 of 80 -> first goal (t=10) only
    const s = computeLiveMatchState({ ...base, nowIxTime: 1050 });
    expect(s.minute).toBe(40);
    expect(s.homeScore).toBe(1);
    expect(s.awayScore).toBe(0);
    expect(s.lastEvent?.type).toBe("card"); // t=35 is the latest <= 40
  });

  test("full time uses the stored final score and clamps progress", () => {
    const s = computeLiveMatchState({ ...base, nowIxTime: 9999 });
    expect(s.isFinal).toBe(true);
    expect(s.progress).toBe(1);
    expect(s.minute).toBe(80);
    expect(s.homeScore).toBe(2);
    expect(s.awayScore).toBe(1);
  });

  test("before kickoff (clock skew) clamps to 0", () => {
    const s = computeLiveMatchState({ ...base, nowIxTime: 500 });
    expect(s.progress).toBe(0);
    expect(s.minute).toBe(0);
  });
});
