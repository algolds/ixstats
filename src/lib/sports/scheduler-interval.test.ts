import { matchIntervalMs, raceIntervalMs } from "./scheduler";

const IXDAY = 86_400_000;

describe("matchIntervalMs", () => {
  test("defaults to 1 IxDay when unset/invalid", () => {
    expect(matchIntervalMs(null)).toBe(IXDAY);
    expect(matchIntervalMs({})).toBe(IXDAY);
    expect(matchIntervalMs({ matchIntervalDays: 0 })).toBe(IXDAY);
    expect(matchIntervalMs({ matchIntervalDays: -5 })).toBe(IXDAY);
    expect(matchIntervalMs({ matchIntervalDays: "7" })).toBe(IXDAY); // non-number ignored
  });

  test("honors a valid override (weekly = 7 IxDays)", () => {
    expect(matchIntervalMs({ matchIntervalDays: 7 })).toBe(7 * IXDAY);
    expect(matchIntervalMs({ matchIntervalDays: 3 })).toBe(3 * IXDAY);
  });
});

describe("raceIntervalMs", () => {
  test("defaults to 3 IxDays", () => {
    expect(raceIntervalMs(null)).toBe(3 * IXDAY);
  });

  test("honors a valid override", () => {
    expect(raceIntervalMs({ raceIntervalDays: 5 })).toBe(5 * IXDAY);
  });
});
