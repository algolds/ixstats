/** @jest-environment node */
/** P1-22 / realm time D2a: operations are rated on the realm clock; cooldown windows follow its speed. */
import { ixDaysAgo, ixDaysLater, operationSuccessRating } from "~/lib/military/operation-rules";

const DAY = 24 * 60 * 60 * 1000;

describe("operationSuccessRating", () => {
  const rate = (durationIxDays: number | null, ranIxDays: number) =>
    operationSuccessRating({ durationIxDays, startIxTime: 0, endIxTime: ranIxDays * DAY });

  it("rates by the share of the planned duration that ran", () => {
    expect(rate(30, 30)).toBe("success");
    expect(rate(30, 20)).toBe("partial");
    expect(rate(30, 5)).toBe("failure");
  });

  it("rates an operation with no planned duration a success", () => {
    expect(rate(null, 1)).toBe("success");
  });
});

describe("realm-clock windows", () => {
  const now = new Date(10_000 * DAY);

  it("turns in-game days into real time at the realm's speed", () => {
    expect(ixDaysAgo(30, { multiplier: 2 }, now).getTime()).toBe(now.getTime() - 15 * DAY);
    expect(ixDaysAgo(30, { multiplier: 6 }, now).getTime()).toBe(now.getTime() - 5 * DAY);
    expect(ixDaysLater(now, 30, { multiplier: 3 })!.getTime()).toBe(now.getTime() + 10 * DAY);
  });

  it("never closes a window on a paused realm", () => {
    expect(ixDaysAgo(30, { multiplier: 0 }, now).getTime()).toBe(0);
    expect(ixDaysLater(now, 30, { multiplier: 0 })).toBeNull();
  });
});
