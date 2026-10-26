/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import {
  DAY_MS,
  deadlineBadgeOf,
  formatReveal,
  parseOptions,
  reconArrivalOf,
} from "~/lib/national-issues/issue-brief";
import { CLOCK_PENDING } from "~/lib/realms/nation-time";
import {
  CLOCK_NOW,
  ixnayReader,
  pausedReader,
  sixTimesReader,
} from "~/tests/fixtures/realm-readers";

describe("parseOptions", () => {
  it("reads the stored options and falls back to none", () => {
    expect(parseOptions('[{"id":"o1","label":"Act"}]')).toEqual([{ id: "o1", label: "Act" }]);
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
    expect(parseOptions("")).toEqual([]);
    expect(parseOptions("{not json")).toEqual([]);
  });
});

describe("formatReveal", () => {
  it("labels each operation", () => {
    expect(formatReveal({ targetField: "x", value: null })).toBe("—");
    expect(formatReveal({ targetField: "x" })).toBe("—");
    expect(formatReveal({ targetField: "x", value: 1.5, operation: "multiply" })).toBe("×1.5");
    expect(formatReveal({ targetField: "x", value: 40, operation: "set" })).toBe("=40");
    expect(formatReveal({ targetField: "x", value: 3, operation: "subtract" })).toBe("-3");
    expect(formatReveal({ targetField: "x", value: -3, operation: "add" })).toBe("+3");
    expect(formatReveal({ targetField: "x", value: 0 })).toBe("+0");
  });
});

describe("deadlineBadgeOf", () => {
  it("waits for the clock", () => {
    expect(deadlineBadgeOf(CLOCK_NOW, null, ixnayReader())).toEqual({
      text: CLOCK_PENDING,
      urgent: false,
    });
    expect(deadlineBadgeOf(CLOCK_NOW, CLOCK_NOW, null)).toEqual({
      text: CLOCK_PENDING,
      urgent: false,
    });
  });

  it("says a deadline at or before now has passed, even while paused", () => {
    expect(deadlineBadgeOf(CLOCK_NOW, CLOCK_NOW, pausedReader())).toEqual({
      text: "Deadline passed",
      urgent: true,
    });
  });

  it("says paused while the realm is stopped", () => {
    expect(deadlineBadgeOf(CLOCK_NOW + DAY_MS, CLOCK_NOW, pausedReader())).toEqual({
      text: "Paused",
      urgent: false,
    });
  });

  it("counts in-world days and is urgent under a day and a half of real time", () => {
    // ×2: three in-world days are a day and a half of real time, the boundary (not urgent).
    expect(deadlineBadgeOf(CLOCK_NOW + 3 * DAY_MS, CLOCK_NOW, ixnayReader())).toEqual({
      text: "3 days remaining",
      urgent: false,
    });
    expect(deadlineBadgeOf(CLOCK_NOW + 2.5 * DAY_MS, CLOCK_NOW, ixnayReader())).toEqual({
      text: "3 days remaining",
      urgent: true,
    });
    // ×6: eight in-world days are 1⅓ real days.
    expect(deadlineBadgeOf(CLOCK_NOW + 8 * DAY_MS, CLOCK_NOW, sixTimesReader())).toEqual({
      text: "8 days remaining",
      urgent: true,
    });
  });
});

describe("reconArrivalOf", () => {
  it("waits for the clock, then reports paused or whole days (at least one)", () => {
    expect(reconArrivalOf(CLOCK_NOW, null, ixnayReader())).toBe(
      `Findings arrive in ${CLOCK_PENDING}.`
    );
    expect(reconArrivalOf(CLOCK_NOW, CLOCK_NOW, null)).toBe(`Findings arrive in ${CLOCK_PENDING}.`);
    expect(reconArrivalOf(CLOCK_NOW + DAY_MS, CLOCK_NOW, pausedReader())).toBe(
      "Paused: findings arrive when the realm resumes."
    );
    expect(reconArrivalOf(CLOCK_NOW + 2.2 * DAY_MS, CLOCK_NOW, ixnayReader())).toBe(
      "Findings arrive in 3 day(s)."
    );
    expect(reconArrivalOf(CLOCK_NOW - DAY_MS, CLOCK_NOW, ixnayReader())).toBe(
      "Findings arrive in 1 day(s)."
    );
    expect(reconArrivalOf(undefined, CLOCK_NOW, ixnayReader())).toBe(
      "Findings arrive in 1 day(s)."
    );
  });
});
