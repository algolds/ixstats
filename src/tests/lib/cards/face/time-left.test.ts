/** @jest-environment node */
import { formatTimeLeft } from "~/lib/cards/face/time-left";

const now = new Date("2026-10-15T12:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatTimeLeft", () => {
  it("names what is left in the two largest units", () => {
    expect(formatTimeLeft(later(2 * DAY + 4 * HOUR + MINUTE), now)).toBe("2d 4h");
    expect(formatTimeLeft(later(3 * HOUR + 12 * MINUTE), now)).toBe("3h 12m");
    expect(formatTimeLeft(later(8 * MINUTE + 30_000), now)).toBe("8m");
    expect(formatTimeLeft(later(20_000), now)).toBe("under 1m");
    expect(formatTimeLeft(later(-1), now)).toBe("Ended");
  });

  it("switches unit exactly at a day, an hour and a minute", () => {
    expect(formatTimeLeft(later(DAY), now)).toBe("1d 0h");
    expect(formatTimeLeft(later(DAY - 1), now)).toBe("23h 59m");
    expect(formatTimeLeft(later(HOUR), now)).toBe("1h 0m");
    expect(formatTimeLeft(later(HOUR - 1), now)).toBe("59m");
    expect(formatTimeLeft(later(MINUTE), now)).toBe("1m");
    expect(formatTimeLeft(later(MINUTE - 1), now)).toBe("under 1m");
  });

  it("is still running at the end instant and has ended a moment after", () => {
    expect(formatTimeLeft(later(0), now)).toBe("under 1m");
    expect(formatTimeLeft(later(-MINUTE), now)).toBe("Ended");
  });

  it("measures from the present by default", () => {
    jest.useFakeTimers({ now });
    try {
      expect(formatTimeLeft(later(5 * MINUTE))).toBe("5m");
    } finally {
      jest.useRealTimers();
    }
  });
});
