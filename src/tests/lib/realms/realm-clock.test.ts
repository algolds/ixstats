/** @jest-environment node */
/** Realm clocks (docs/superpowers/specs/2026-10-14-realm-clocks-design.md §1): continuous switch-on, speed, pause. */
import {
  createRealmClock,
  formatRealmDate,
  formatRealmSpeed,
  nextSpeedChangeAt,
  parseRealmClock,
  realmCalendarMs,
  realmClockNow,
  RealmStartDateSchema,
  SPEED_CHANGE_COOLDOWN_MS,
  withSpeed,
} from "~/lib/realms/realm-clock";

const HOUR = 60 * 60 * 1000;
const REAL = Date.UTC(2026, 9, 14, 18, 0, 0);
const GLOBAL = Date.UTC(2041, 5, 2, 9, 30, 0);
const start = (multiplier = 3, startDate = "1203-03-14", era = "AE") =>
  createRealmClock({ globalNowMs: GLOBAL, realNowMs: REAL, startDate, era, multiplier });

describe("realm clock", () => {
  it("switches on continuous with global IxTime, its calendar reading the chosen date", () => {
    const clock = start();
    expect(realmClockNow(clock, REAL)).toBe(GLOBAL);
    expect(formatRealmDate(clock, REAL)).toBe("14 March 1203 AE");
    // The time of day carries over, so greetings do not jump at switch-on.
    expect(new Date(realmCalendarMs(clock, REAL)).getUTCHours()).toBe(9);
  });

  it("runs at its speed, and holds still when paused", () => {
    expect(realmClockNow(start(3), REAL + HOUR)).toBe(GLOBAL + 3 * HOUR);
    expect(realmClockNow(start(0), REAL + 100 * HOUR)).toBe(GLOBAL);
  });

  it("changes speed without moving the clock, and starts the cooldown", () => {
    const clock = start(3);
    const later = REAL + 10 * HOUR;
    const faster = withSpeed(clock, 6, later);
    expect(realmClockNow(faster, later)).toBe(realmClockNow(clock, later));
    expect(realmClockNow(faster, later + HOUR)).toBe(realmClockNow(clock, later) + 6 * HOUR);
    expect(faster.calendarOffsetMs).toBe(clock.calendarOffsetMs);
    expect(nextSpeedChangeAt(faster)).toBe(later + SPEED_CHANGE_COOLDOWN_MS);
  });

  it("formats years below 1000 and an empty era", () => {
    expect(formatRealmDate(start(2, "0800-03-14", "  "), REAL)).toBe("14 March 800");
  });

  it("refuses impossible and out-of-range start dates", () => {
    for (const bad of ["2026-02-30", "0000-01-01", "10000-01-01", "1203-3-14", "yesterday"]) {
      expect(RealmStartDateSchema.safeParse(bad).success).toBe(false);
    }
    expect(RealmStartDateSchema.safeParse("0800-03-14").success).toBe(true);
  });

  it("reads only well-formed stored clocks", () => {
    const clock = start();
    expect(parseRealmClock(JSON.parse(JSON.stringify(clock)))).toEqual(clock);
    expect(parseRealmClock({ ...clock, multiplier: 13 })).toBeNull();
    expect(parseRealmClock({ ...clock, multiplier: -1 })).toBeNull();
    expect(parseRealmClock("clock")).toBeNull();
  });

  it("names the speed", () => {
    expect(formatRealmSpeed(0)).toBe("Paused");
    expect(formatRealmSpeed(2)).toBe("×2");
    expect(formatRealmSpeed(0.5)).toBe("×0.5");
  });
});
