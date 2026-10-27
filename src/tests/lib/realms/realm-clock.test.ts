/** @jest-environment node */
/**
 * Realm clock math (realm time design §1): continuity across speed changes and pauses, founding a clock continuous
 * with Ixnay's time, switching calendars without moving the clock, and forward jumps capped at 5 of the realm's years.
 */
import {
  createRealmClock,
  daysUntil,
  formatRealmDate,
  maxJumpDays,
  nextJumpAt,
  parseRealmClock,
  parseRealmSpeed,
  realmCalendarMs,
  realmClockNow,
  realmClockReader,
  RealmFoundingClockSchema,
  realmToday,
  withCalendar,
  withJump,
  withSpeed,
  JUMP_COOLDOWN_MS,
  type RealmClock,
} from "~/lib/realms/realm-clock";
import { DAY_MS, type RealmMonth } from "~/lib/realms/realm-calendar";

const GLOBAL = Date.UTC(2041, 5, 2, 9, 30);
const REAL = Date.UTC(2026, 9, 25, 12);
const HOUR = 3_600_000;
const FROST: RealmMonth[] = [
  { name: "Thaw", days: 30 },
  { name: "Frostfall", days: 40 },
];

function founded(multiplier = 2): RealmClock {
  return createRealmClock({
    globalNowMs: GLOBAL,
    realNowMs: REAL,
    startDate: "1203-03-14",
    era: " AE ",
    multiplier,
  });
}

describe("founding and running", () => {
  it("starts equal to Ixnay's time, reading the start date at its time of day", () => {
    const clock = founded();
    expect(realmClockNow(clock, REAL)).toBe(GLOBAL);
    expect(formatRealmDate(realmClockNow(clock, REAL), clock)).toBe("14 March 1203 AE");
    expect(new Date(realmCalendarMs(clock, REAL)).getUTCHours()).toBe(9);
    expect(realmClockNow(clock, REAL + HOUR)).toBe(GLOBAL + 2 * HOUR);
  });

  it("asks founding for a start date, an era and a speed that defaults to ×2", () => {
    expect(RealmFoundingClockSchema.parse({ startDate: "0812-01-01", era: "AE" }).multiplier).toBe(
      2
    );
    expect(RealmFoundingClockSchema.safeParse({ era: "AE" }).success).toBe(false);
    expect(RealmFoundingClockSchema.safeParse({ startDate: "1203-02-30", era: "" }).success).toBe(
      false
    );
    expect(
      RealmFoundingClockSchema.safeParse({ startDate: "1203-02-03", era: "", multiplier: 13 })
        .success
    ).toBe(false);
  });

  it("never jumps across a speed change or a pause", () => {
    const clock = founded(3);
    const paused = withSpeed(clock, 0, REAL + HOUR);
    expect(realmClockNow(paused, REAL + HOUR)).toBe(realmClockNow(clock, REAL + HOUR));
    expect(realmClockNow(paused, REAL + 10 * HOUR)).toBe(GLOBAL + 3 * HOUR);
    const resumed = withSpeed(paused, 6, REAL + 10 * HOUR);
    expect(realmClockNow(resumed, REAL + 11 * HOUR)).toBe(GLOBAL + 9 * HOUR);
    expect(resumed.changedAt).toBe(REAL + 10 * HOUR);
  });

  it("reads through the reader, which knows its speed and calendar", () => {
    const reader = realmClockReader("eurth", withSpeed(founded(), 0, REAL), () => REAL + DAY_MS);
    expect(reader.now()).toBe(GLOBAL);
    expect(reader.paused).toBe(true);
    expect(reader.fallback).toBe(false);
    expect(formatRealmDate(reader.now(), reader.calendar)).toBe("14 March 1203 AE");
  });

  it("parses speed text, where empty is not a pause", () => {
    expect(parseRealmSpeed("")).toBeNull();
    expect(parseRealmSpeed("0")).toBe(0);
    expect(parseRealmSpeed("12.5")).toBeNull();
    expect(parseRealmSpeed("6")).toBe(6);
  });
});

describe("custom calendars", () => {
  it("keep the clock's time and today's year when the months change, and survive a save", () => {
    const clock = founded();
    const later = REAL + 5 * HOUR;
    const custom = withCalendar(clock, FROST, later);
    expect(realmClockNow(custom, later)).toBe(realmClockNow(clock, later));
    // 14 March: month 2 does not exist, so the last month; day 14 exists in Frostfall.
    expect(formatRealmDate(realmClockNow(custom, later), custom)).toBe("14 Frostfall 1203 AE");
    expect(parseRealmClock(JSON.parse(JSON.stringify(custom)))).toEqual(custom);
    const back = withCalendar(custom, null, later);
    expect(back.months).toBeUndefined();
    expect(formatRealmDate(realmClockNow(back, later), back)).toBe("14 February 1203 AE");
  });

  it("refuses a stored clock whose months are invalid", () => {
    expect(parseRealmClock({ ...founded(), months: [{ name: "A", days: 0 }] })).toBeNull();
  });
});

describe("forward jumps", () => {
  it("move the clock ahead by whole days, really passing time, and start the cooldown", () => {
    const clock = founded();
    const jumped = withJump(clock, 10, REAL + HOUR);
    expect(realmClockNow(jumped, REAL + HOUR)).toBe(
      realmClockNow(clock, REAL + HOUR) + 10 * DAY_MS
    );
    expect(jumped.calendarOffsetMs).toBe(clock.calendarOffsetMs);
    expect(nextJumpAt(jumped)).toBe(REAL + HOUR + JUMP_COOLDOWN_MS);
    expect(nextJumpAt(clock)).toBe(0);
  });

  it("allow at most 5 of the realm's years", () => {
    const clock = founded();
    // 14 March 1203 to 14 March 1208: 1827 days with leap days 1204.
    expect(maxJumpDays(realmCalendarMs(clock, REAL))).toBe(1827);
    const custom = withCalendar(clock, FROST, REAL);
    expect(maxJumpDays(realmCalendarMs(custom, REAL), custom.months)).toBe(350);
  });

  it("count the days to a target date in the realm's calendar", () => {
    const clock = withCalendar(founded(), FROST, REAL);
    const today = realmToday(clock, REAL);
    const calendarMs = realmCalendarMs(clock, REAL);
    expect(daysUntil(calendarMs, today, clock.months)).toBe(0);
    expect(daysUntil(calendarMs, { ...today, year: today.year + 1 }, clock.months)).toBe(70);
    expect(daysUntil(calendarMs, { ...today, day: 41 }, clock.months)).toBeNull();
  });
});
