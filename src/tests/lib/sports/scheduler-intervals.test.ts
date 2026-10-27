/** @jest-environment node */
import { matchIntervalMs, raceIntervalMs } from "~/lib/sports/scheduler";

const HOUR = 3_600_000;

describe("sports intervals on real time", () => {
  it("defaults to the old IxTime-day pace: 12 hours between matchdays, 36 hours between races", () => {
    expect(matchIntervalMs(null)).toBe(12 * HOUR);
    expect(raceIntervalMs({})).toBe(36 * HOUR);
  });

  it("reads a league's own interval in real days", () => {
    expect(matchIntervalMs({ matchIntervalDays: 3.5 })).toBe(84 * HOUR);
    expect(raceIntervalMs({ raceIntervalDays: 2 })).toBe(48 * HOUR);
  });
});
