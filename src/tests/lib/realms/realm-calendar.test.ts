/** @jest-environment node */
/**
 * Realm calendars (realm time design §1): Gregorian by default, or the founder's month names and lengths. Dates
 * format as "14 Frostfall 812 AE" and parse back; a year is the sum of its months.
 */
import {
  addCalendarYears,
  calendarParts,
  DAY_MS,
  formatRealmDate,
  parseRealmDate,
  partsToCalendarMs,
  realmMonthsError,
  remapCalendarMs,
  yearDays,
  type RealmCalendar,
  type RealmMonth,
} from "~/lib/realms/realm-calendar";

const FROST: RealmMonth[] = [
  { name: "Thaw", days: 30 },
  { name: "Frostfall", days: 40 },
  { name: "Second Dawn", days: 20 },
];
const custom: RealmCalendar = { calendarOffsetMs: 0, era: "AE", months: FROST };
const gregorian: RealmCalendar = { calendarOffsetMs: 0, era: "" };

describe("custom months", () => {
  it("counts a year as the sum of its months, from day 1 of year 1 at 0", () => {
    expect(yearDays(FROST)).toBe(90);
    expect(calendarParts(0, FROST)).toEqual({ year: 1, month: 0, day: 1 });
    expect(calendarParts(30 * DAY_MS, FROST)).toEqual({ year: 1, month: 1, day: 1 });
    expect(calendarParts(89 * DAY_MS + 5, FROST)).toEqual({ year: 1, month: 2, day: 20 });
    expect(calendarParts(90 * DAY_MS, FROST)).toEqual({ year: 2, month: 0, day: 1 });
  });

  it("formats with the era and parses back, era optional and any case", () => {
    const ms = partsToCalendarMs({ year: 812, month: 1, day: 14 }, FROST)! + 3_600_000;
    expect(formatRealmDate(ms, custom)).toBe("14 Frostfall 812 AE");
    const start = parseRealmDate("14 Frostfall 812 AE", custom);
    expect(start).toBe(ms - 3_600_000);
    expect(parseRealmDate("14 frostfall 812", custom)).toBe(start);
    expect(parseRealmDate("3 Second Dawn 9 ae", custom)).not.toBeNull();
  });

  it("refuses dates the calendar does not have", () => {
    expect(parseRealmDate("41 Frostfall 812", custom)).toBeNull();
    expect(parseRealmDate("14 March 812", custom)).toBeNull();
    expect(parseRealmDate("Frostfall 812", custom)).toBeNull();
    expect(partsToCalendarMs({ year: 1, month: 3, day: 1 }, FROST)).toBeNull();
  });

  it("round-trips every day of a year through format and parse, offset included", () => {
    const offset: RealmCalendar = { ...custom, calendarOffsetMs: -1234 * DAY_MS };
    for (let day = 0; day < 90; day += 1) {
      const clockMs = (5000 + day) * DAY_MS;
      const text = formatRealmDate(clockMs, offset);
      const parsed = parseRealmDate(text, offset);
      expect(parsed).toBe(clockMs);
      expect(formatRealmDate(parsed!, offset)).toBe(text);
    }
  });
});

describe("the Gregorian default", () => {
  it("reads and parses UTC dates, early years included", () => {
    const ms = Date.UTC(2041, 2, 14, 9);
    expect(formatRealmDate(ms, gregorian)).toBe("14 March 2041");
    expect(parseRealmDate("14 March 2041", gregorian)).toBe(Date.UTC(2041, 2, 14));
    const early = parseRealmDate("1 January 45", { ...gregorian, era: "AE" });
    expect(formatRealmDate(early!, { ...gregorian, era: "AE" })).toBe("1 January 45 AE");
    expect(parseRealmDate("30 February 2041", gregorian)).toBeNull();
  });

  it("adds years on the same day, clamped at a month's end", () => {
    const leap = Date.UTC(2040, 1, 29, 6);
    expect(new Date(addCalendarYears(leap, 1)).toISOString()).toBe("2041-02-28T06:00:00.000Z");
    expect(addCalendarYears(5 * DAY_MS, 2, FROST)).toBe(185 * DAY_MS);
  });
});

describe("switching calendars", () => {
  it("keeps the year, the month and day where they exist, and the time of day", () => {
    const march31 = Date.UTC(1203, 2, 31, 7);
    const remapped = remapCalendarMs(march31, null, FROST);
    // March is month 2: the last month (Second Dawn, 20 days) on its last day.
    expect(calendarParts(remapped, FROST)).toEqual({ year: 1203, month: 2, day: 20 });
    expect(remapped % DAY_MS).toBe(7 * 3_600_000);
    const back = remapCalendarMs(remapped, FROST, null);
    expect(new Date(back).toISOString()).toBe("1203-03-20T07:00:00.000Z");
  });
});

describe("validating months", () => {
  it("allows 1 to 24 months of 1 to 100 days with unique, non-empty names", () => {
    expect(realmMonthsError(FROST)).toBeNull();
    expect(realmMonthsError([])).toMatch(/at least one month/);
    expect(
      realmMonthsError(Array.from({ length: 25 }, (_, i) => ({ name: `M${i}`, days: 10 })))
    ).toMatch(/at most 24/);
    expect(realmMonthsError([{ name: "A", days: 101 }])).toMatch(/at most 100/);
    expect(realmMonthsError([{ name: "A", days: 0 }])).toMatch(/at least 1 day/);
    expect(realmMonthsError([{ name: "  ", days: 10 }])).toMatch(/needs a name/);
    expect(
      realmMonthsError([
        { name: "Thaw", days: 10 },
        { name: "thaw ", days: 10 },
      ])
    ).toMatch(/its own name/);
  });
});
