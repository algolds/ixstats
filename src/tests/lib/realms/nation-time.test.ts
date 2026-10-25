/** @jest-environment node */
/**
 * A nation's time as its pages show it (realm time design §1): dates in its realm's calendar, countdowns at its
 * realm's speed, "Paused" while the realm is stopped, and "–" while the clock loads.
 */
import {
  CLOCK_PENDING,
  clockTimeAt,
  formatClockDate,
  formatRealmCountdown,
  formatStampAsClockDate,
  realMsUntil,
  realmFractionalYear,
  realmYear,
} from "~/lib/realms/nation-time";
import { IxTime } from "~/lib/ixtime";
import {
  CLOCK_NOW,
  DAY,
  REAL_NOW,
  ixnayReader,
  pausedReader,
  sixTimesReader,
} from "~/tests/fixtures/realm-readers";

describe("nation dates", () => {
  it("shows a nation's date in its realm's calendar and era", () => {
    const reader = sixTimesReader();
    expect(formatClockDate(CLOCK_NOW, reader)).toBe("14 Thaw 812 AE");
    expect(formatClockDate(CLOCK_NOW + 20 * DAY, reader)).toBe("4 Frostfall 812 AE");
    expect(formatClockDate(CLOCK_NOW, ixnayReader())).toBe("2 June 2041");
  });

  it("shows a placeholder while the clock loads, and the fallback for no date", () => {
    expect(formatClockDate(CLOCK_NOW, null)).toBe(CLOCK_PENDING);
    expect(formatClockDate(null, sixTimesReader(), "Never")).toBe("Never");
  });

  it("reads a real stamp on the realm's own clock after its anchor, at its speed", () => {
    const reader = sixTimesReader();
    expect(clockTimeAt(reader, REAL_NOW + DAY)).toBe(CLOCK_NOW + 6 * DAY);
    expect(formatStampAsClockDate(new Date(REAL_NOW + DAY), reader)).toBe("20 Thaw 812 AE");
    expect(formatStampAsClockDate(null, reader)).toBe("N/A");
    expect(formatStampAsClockDate(REAL_NOW, null)).toBe(CLOCK_PENDING);
  });

  it("reads a stamp before the anchor as IxTime, never past the anchor", () => {
    const before = REAL_NOW - 30 * DAY;
    expect(clockTimeAt(sixTimesReader(), before)).toBe(
      Math.min(IxTime.convertToIxTime(before), CLOCK_NOW)
    );
    expect(clockTimeAt(ixnayReader(), before)).toBe(IxTime.convertToIxTime(before));
  });

  it("counts years in the realm's calendar (70-day Frostfall years)", () => {
    const calendar = sixTimesReader().calendar;
    expect(realmYear(CLOCK_NOW, calendar)).toBe(812);
    expect(realmYear(CLOCK_NOW + 60 * DAY, calendar)).toBe(813);
    expect(realmFractionalYear(CLOCK_NOW, calendar)).toBeCloseTo(812 + 13 / 70 + 9.5 / 24 / 70, 6);
  });
});

describe("nation countdowns", () => {
  it("counts down in real time at the realm's speed", () => {
    // Six in-world days in a 6× realm are one real day.
    expect(realMsUntil(CLOCK_NOW + 6 * DAY, CLOCK_NOW, 6)).toBe(DAY);
    expect(formatRealmCountdown(CLOCK_NOW + 6 * DAY + 6 * 3_600_000, CLOCK_NOW, 6)).toBe("1d 1h");
    expect(formatRealmCountdown(CLOCK_NOW + 2 * DAY, CLOCK_NOW, 2)).toBe("1d 0h");
  });

  it("shows Paused instead of a countdown while the realm is stopped", () => {
    const reader = pausedReader();
    expect(reader.paused).toBe(true);
    expect(realMsUntil(CLOCK_NOW + DAY, reader.now(), reader.multiplier)).toBeNull();
    expect(formatRealmCountdown(CLOCK_NOW + DAY, reader.now(), reader.multiplier)).toBe("Paused");
    expect(formatRealmCountdown(CLOCK_NOW - DAY, reader.now(), reader.multiplier)).toBe("now");
  });
});
