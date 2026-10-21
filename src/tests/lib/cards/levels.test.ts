/** @jest-environment node */
import { cappedXpGrant, clampLevel, levelForXp } from "~/lib/cards/levels";

const NOW = new Date("2026-11-02T15:00:00Z");

describe("card levels", () => {
  it("is 1 to 10 from XP, 1,000 a level, and XP past the cap is kept", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(999)).toBe(1);
    expect(levelForXp(1000)).toBe(2);
    expect(levelForXp(9000)).toBe(10);
    expect(levelForXp(250_000)).toBe(10);
    expect(clampLevel(37)).toBe(10);
    expect(clampLevel(0)).toBe(1);
  });

  it("caps a copy's XP per UTC day and starts each day at zero", () => {
    const today = new Date("2026-11-02T00:00:00Z");
    expect(cappedXpGrant({ xpDay: today, xpToday: 90 }, 25, 100, NOW)).toEqual({
      grant: 10,
      xpToday: 100,
    });
    expect(cappedXpGrant({ xpDay: today, xpToday: 100 }, 25, 100, NOW)).toEqual({
      grant: 0,
      xpToday: 100,
    });
    const yesterday = new Date("2026-11-01T00:00:00Z");
    expect(cappedXpGrant({ xpDay: yesterday, xpToday: 100 }, 25, 100, NOW)).toEqual({
      grant: 25,
      xpToday: 25,
    });
    expect(cappedXpGrant({ xpDay: null, xpToday: 0 }, 50, 100, NOW)).toEqual({
      grant: 50,
      xpToday: 50,
    });
  });

  it("turns over at UTC midnight, not local midnight", () => {
    const lateDay = new Date("2026-11-02T23:59:59.999Z");
    const nextDay = new Date("2026-11-03T00:00:00.000Z");
    const state = { xpDay: new Date("2026-11-02T00:00:00Z"), xpToday: 100 };
    expect(cappedXpGrant(state, 10, 100, lateDay).grant).toBe(0);
    expect(cappedXpGrant(state, 10, 100, nextDay).grant).toBe(10);
  });
});
