/** @jest-environment node */
/**
 * Real time ↔ a realm's clock time, for real timestamps a nation's simulation reads on its realm's clock (a world
 * event's start, a meeting's date, a bill's passing) and back. Ixnay's reader goes through IxTime's own history; a
 * realm's through its anchor and speed; a paused realm's later times are far out, never infinite.
 */
import { IxTime } from "~/lib/ixtime";
import { ixnayClockReader, realmClockReader, type RealmClock } from "~/lib/realms/realm-clock";
import {
  clockTimeAt,
  divisorSpeed,
  MIN_DIVISOR_SPEED,
  realTimeAt,
} from "~/lib/realms/realm-time-convert";

const DAY = 86_400_000;
const REAL = Date.UTC(2026, 9, 25, 12);
const CLOCK = Date.UTC(2046, 2, 14);
const clock = (multiplier: number): RealmClock => ({
  anchorRealMs: REAL,
  anchorClockMs: CLOCK,
  multiplier,
  changedAt: REAL,
  calendarOffsetMs: 0,
  era: "AE",
});

describe("realm time conversion", () => {
  it("reads Ixnay's clock through IxTime's history, both ways", () => {
    const ixnay = ixnayClockReader("default", { now: () => 0, multiplier: 2 });
    expect(clockTimeAt(ixnay, REAL)).toBe(IxTime.convertToIxTime(REAL));
    expect(realTimeAt(ixnay, CLOCK)).toBe(IxTime.convertFromIxTime(CLOCK));
  });

  it("runs a realm's clock from its anchor at its speed, both ways", () => {
    const fast = realmClockReader("fast", clock(6));
    expect(clockTimeAt(fast, REAL + DAY)).toBe(CLOCK + 6 * DAY);
    expect(clockTimeAt(fast, REAL - DAY)).toBe(CLOCK - 6 * DAY);
    expect(realTimeAt(fast, CLOCK + 6 * DAY)).toBe(REAL + DAY);
  });

  it("holds a paused realm's clock still, and puts its later times far out rather than at infinity", () => {
    const paused = realmClockReader("paused", clock(0));
    expect(clockTimeAt(paused, REAL + 30 * DAY)).toBe(CLOCK);
    expect(realTimeAt(paused, CLOCK + DAY)).toBe(REAL + DAY / MIN_DIVISOR_SPEED);
    expect(Number.isFinite(realTimeAt(paused, CLOCK + 365 * DAY))).toBe(true);
    expect(divisorSpeed(0)).toBe(MIN_DIVISOR_SPEED);
    expect(divisorSpeed(6)).toBe(6);
  });
});
