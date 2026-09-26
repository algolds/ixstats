import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { timeAgo } from "~/lib/format/compact";
import { formatTimeAgo } from "~/lib/utils/time-utils";

const NOW = new Date("2026-09-25T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("timeAgo (single relative-time formatter, plan 345)", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterAll(() => jest.useRealTimers());

  it("pins the ladder the UI relies on", () => {
    expect(timeAgo(ago(0))).toBe("just now");
    expect(timeAgo(ago(30_000))).toBe("just now");
    expect(timeAgo(ago(5 * MIN))).toBe("5m ago");
    expect(timeAgo(ago(2 * HOUR))).toBe("2h ago");
    expect(timeAgo(ago(3 * DAY))).toBe("3d ago");
  });

  it("drops the suffix for compact rows", () => {
    expect(timeAgo(ago(5 * MIN), { suffix: false })).toBe("5m");
    expect(timeAgo(ago(2 * HOUR), { suffix: false })).toBe("2h");
    expect(timeAgo(ago(3 * DAY), { suffix: false })).toBe("3d");
  });

  it("accepts ISO strings and epoch milliseconds", () => {
    expect(timeAgo(ago(5 * MIN).toISOString())).toBe("5m ago");
    expect(timeAgo(NOW - 5 * MIN)).toBe("5m ago");
  });

  it("falls back to a short date after 30 days and to an empty string for invalid input", () => {
    expect(timeAgo(ago(45 * DAY))).toMatch(/[A-Z][a-z]{2} \d{1,2}/);
    expect(timeAgo("not a date")).toBe("");
  });

  it("keeps the historical formatTimeAgo name as an alias", () => {
    expect(formatTimeAgo).toBe(timeAgo);
  });
});
