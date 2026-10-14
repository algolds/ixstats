/** @jest-environment node */
/**
 * Real-time bucketing for achievement durations: UTC, ISO weeks, never IxTime (V4), so realms
 * running other clocks are on equal footing.
 */
import { IxTime } from "~/lib/ixtime";
import {
  MONTH_MS,
  distinctBuckets,
  longestConsecutiveWeeks,
  monthKey,
  spanMs,
  weekKey,
} from "~/lib/achievements/time-buckets";

const utc = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe("weekKey", () => {
  it.each([
    ["2026-10-14", "2026-W42"],
    ["2026-01-01", "2026-W01"],
    ["2024-12-30", "2025-W01"],
    ["2021-01-03", "2020-W53"],
    ["2026-12-31", "2026-W53"],
    ["2027-01-01", "2026-W53"],
    ["2027-01-04", "2027-W01"],
  ])("%s is %s", (day, expected) => {
    expect(weekKey(utc(day))).toBe(expected);
  });

  it("puts Monday 00:00 UTC and Sunday 23:59 UTC of one week together, whatever the host zone", () => {
    expect(weekKey(new Date("2026-10-12T00:00:00.000Z"))).toBe("2026-W42");
    expect(weekKey(new Date("2026-10-18T23:59:59.999Z"))).toBe("2026-W42");
    expect(weekKey(new Date("2026-10-19T00:00:00.000Z"))).toBe("2026-W43");
  });
});

describe("monthKey", () => {
  it("is the UTC year and month", () => {
    expect(monthKey(new Date("2026-10-31T23:59:59.000Z"))).toBe("2026-10");
    expect(monthKey(new Date("2026-11-01T00:00:00.000Z"))).toBe("2026-11");
    expect(monthKey(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01");
  });
});

describe("distinctBuckets", () => {
  it("counts different buckets once each", () => {
    const dates = [utc("2026-10-12"), utc("2026-10-14"), utc("2026-10-20"), utc("2026-11-02")];
    expect(distinctBuckets(dates, weekKey)).toBe(3);
    expect(distinctBuckets(dates, monthKey)).toBe(2);
    expect(distinctBuckets([], weekKey)).toBe(0);
  });
});

describe("longestConsecutiveWeeks", () => {
  it("is 0 for no dates and 1 for one", () => {
    expect(longestConsecutiveWeeks([])).toBe(0);
    expect(longestConsecutiveWeeks([utc("2026-10-14")])).toBe(1);
  });

  it("counts several dates in one week as one week", () => {
    expect(longestConsecutiveWeeks([utc("2026-10-12"), utc("2026-10-18")])).toBe(1);
  });

  it("finds the longest unbroken run, ignoring order", () => {
    const dates = [
      utc("2026-10-26"),
      utc("2026-10-05"),
      utc("2026-10-12"),
      utc("2026-10-19"),
      utc("2026-09-14"),
    ];
    expect(longestConsecutiveWeeks(dates)).toBe(4);
  });

  it("runs across a year boundary (2026-W53 into 2027-W01)", () => {
    expect(longestConsecutiveWeeks([utc("2026-12-30"), utc("2027-01-05"), utc("2027-01-12")])).toBe(
      3
    );
  });

  it("is broken by a skipped week", () => {
    expect(longestConsecutiveWeeks([utc("2026-10-05"), utc("2026-10-19")])).toBe(1);
  });
});

describe("spanMs", () => {
  it("is the real time between the earliest and latest date", () => {
    expect(spanMs([])).toBe(0);
    expect(spanMs([utc("2026-10-14")])).toBe(0);
    expect(spanMs([utc("2026-10-20"), utc("2026-10-14"), utc("2026-10-17")])).toBe(6 * 86_400_000);
  });

  it("measures months with MONTH_MS", () => {
    expect(MONTH_MS).toBe(30.44 * 86_400_000);
    expect(spanMs([utc("2026-01-01"), utc("2026-07-01")]) / MONTH_MS).toBeGreaterThan(5.9);
  });
});

describe("real time only (V4)", () => {
  const dates = [utc("2026-10-05"), utc("2026-10-12"), utc("2026-10-14"), utc("2026-11-02")];
  const run = () => ({
    weeks: distinctBuckets(dates, weekKey),
    months: distinctBuckets(dates, monthKey),
    streak: longestConsecutiveWeeks(dates),
    span: spanMs(dates),
  });

  afterEach(() => {
    jest.restoreAllMocks();
    IxTime.setMultiplierOverride(2);
  });

  it("returns the same buckets at a 4x IxTime clock as at 0.5x, and never reads IxTime", () => {
    const read = jest.spyOn(IxTime, "getCurrentIxTime");
    IxTime.setMultiplierOverride(0.5);
    read.mockClear(); // setting the multiplier reads the clock; the helpers must not
    const slow = run();
    IxTime.setMultiplierOverride(4);
    read.mockClear();
    const fast = run();

    expect(fast).toEqual(slow);
    expect(fast).toEqual({ weeks: 3, months: 2, streak: 2, span: 28 * 86_400_000 });
    expect(read).not.toHaveBeenCalled();
  });
});
