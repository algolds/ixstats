/**
 * @jest-environment node
 */
/**
 * The IxTime corpus. The calendar: 4x before July 2025, 2x from the 2040 pivot, an exact round trip, the IxDay
 * boundary before the epoch, UTC month arithmetic, and the built-in accuracy suites. The clock: a speed change keeps
 * game time continuous (no snap back), conversions agree under an override and never rewrite history. The Discord
 * bot's clock is adopted as it reports it (paused, overridden, natural, a pushed `/time set`), and a failed sync
 * leaves the local clock alone.
 *
 * Folds accuracy, day, multiplier-continuity and bot-sync.
 */
import { IxTime, IxTimeAccuracyVerifier } from "~/lib/ixtime";
import { roundToIxDay } from "~/lib/ixtime/day";
import type { BotTimeResponse } from "~/types/ixstats";

const HOUR_MS = 3_600_000;
const IX_DAY_MS = 86_400_000;

beforeEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("the IxTime calendar", () => {
  it("runs 4x before July 2025: two real years from 2020 are eight IxTime years", () => {
    const ixDate = new Date(IxTime.convertToIxTime(Date.parse("2022-10-04T00:00:00.000Z")));
    expect(ixDate.getUTCFullYear()).toBe(2028);
  });

  it("pivots to 2x at 1 January 2040 (27 July 2025 real time)", () => {
    const realPivot = Date.parse("2025-07-27T00:00:00.000Z");
    expect(new Date(IxTime.convertToIxTime(realPivot)).toISOString()).toBe(
      "2040-01-01T00:00:00.000Z"
    );
    // 183.5 real days after the pivot are 367 IxDays: a full IxTime year (2040 is a leap year)
    const later = IxTime.convertToIxTime(realPivot + 183.5 * IX_DAY_MS);
    expect(new Date(later).getUTCFullYear()).toBe(2041);
  });

  it("converts back to real time exactly", () => {
    const realNow = Date.now();
    expect(
      Math.abs(IxTime.convertFromIxTime(IxTime.convertToIxTime(realNow)) - realNow)
    ).toBeLessThanOrEqual(1);
  });

  it("rounds before the epoch down too, so the IxDay boundary stays put", () => {
    expect(roundToIxDay(-1)).toBe(-IX_DAY_MS);
    expect(roundToIxDay(0)).toBe(0);
  });

  it("adds months in UTC and clamps to the last day of the month", () => {
    expect(IxTime.addMonths(Date.UTC(2041, 0, 31), 1)).toBe(Date.UTC(2041, 1, 28));
    expect(IxTime.addMonths(Date.UTC(2041, 2, 31, 15, 30), -1)).toBe(Date.UTC(2041, 1, 28, 15, 30));
    expect(IxTime.addMonths(Date.UTC(2041, 11, 15), 1)).toBe(Date.UTC(2042, 0, 15));
    expect(IxTime.addMonths(Date.UTC(2043, 1, 28), -12)).toBe(Date.UTC(2042, 1, 28));
  });

  it("passes every built-in accuracy suite", () => {
    const report = IxTimeAccuracyVerifier.runAllTests();
    expect(report.totalTests).toBeGreaterThanOrEqual(11);
    expect(report.failedTests).toBe(0);
    expect(report.passedTests).toBe(report.totalTests);
    expect(report.overallAccuracy).toBeGreaterThanOrEqual(99.9998);
    expect(report.criticalIssues).toHaveLength(0);
  });
});

describe("speed changes keep game time continuous", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("speeding up keeps the current game time and only changes the rate going forward", () => {
    const before = IxTime.getCurrentIxTime();
    IxTime.setNaturalMultiplier(4);
    expect(IxTime.getCurrentIxTime()).toBe(before);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(before + 4 * HOUR_MS);
  });

  it("returning to natural speed after a pause resumes from the paused time (no snap back)", () => {
    IxTime.setMultiplierOverride(0);
    const paused = IxTime.getCurrentIxTime();
    jest.advanceTimersByTime(HOUR_MS);

    const result = IxTime.setNaturalMultiplier(2);
    expect(result.isNatural).toBe(true);
    expect(IxTime.isMultiplierNatural()).toBe(true);
    expect(IxTime.getCurrentIxTime()).toBe(paused);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(paused + 2 * HOUR_MS);
  });

  it("convertToIxTime agrees with getCurrentIxTime under an override and does not rewrite history", () => {
    const beforeAnchor = Date.now() - HOUR_MS;
    const canonicalBeforeAnchor = IxTime.convertToIxTime(beforeAnchor);

    IxTime.setNaturalMultiplier(3);
    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.convertToIxTime(Date.now())).toBe(IxTime.getCurrentIxTime());
    expect(IxTime.convertToIxTime(beforeAnchor)).toBe(canonicalBeforeAnchor);

    IxTime.setMultiplierOverride(0);
    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.convertToIxTime(Date.now())).toBe(IxTime.getCurrentIxTime());
    expect(IxTime.convertToIxTime(beforeAnchor)).toBe(canonicalBeforeAnchor);
  });

  it("an explicit time override followed by a pause reads back exactly", () => {
    const overrideTime = Date.UTC(2050, 0, 1);
    IxTime.setTimeOverride(overrideTime);
    IxTime.setMultiplierOverride(0);
    expect(IxTime.getCurrentIxTime()).toBe(overrideTime);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(overrideTime);
  });
});

const BOT_TIME = Date.UTC(2051, 5, 15, 12);
const LOCAL_TIME = Date.UTC(2060, 0, 1);

function botState(overrides: Partial<BotTimeResponse>): BotTimeResponse {
  return {
    ixTimeTimestamp: BOT_TIME,
    ixTimeFormatted: "",
    multiplier: 2,
    isPaused: false,
    hasTimeOverride: false,
    hasMultiplierOverride: false,
    realWorldTime: Date.now(),
    gameYear: 2051,
    ...overrides,
  };
}

function mockBot(state: BotTimeResponse): void {
  jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => ({ ok: true, status: 200, json: async () => state }) as Response
    );
}

describe("syncWithBot adopts the Discord bot's clock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("a paused bot freezes the local clock at the bot's time", async () => {
    mockBot(botState({ isPaused: true, hasTimeOverride: true }));

    const result = await IxTime.syncWithBot();
    expect(result.success).toBe(true);
    expect(IxTime.isPaused()).toBe(true);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);
  });

  it("the local clock moves only to the bot's reported time, whatever its local state", async () => {
    IxTime.setTimeOverride(LOCAL_TIME);
    IxTime.setMultiplierOverride(0);
    mockBot(botState({ multiplier: 3, hasTimeOverride: true, hasMultiplierOverride: true }));

    await IxTime.syncWithBot();
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);
    expect(IxTime.convertToIxTime(Date.now())).toBe(BOT_TIME);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME + 3 * HOUR_MS);
  });

  it("a failed sync leaves the local clock untouched", async () => {
    IxTime.setTimeOverride(LOCAL_TIME);
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await IxTime.syncWithBot();
    expect(result.success).toBe(false);
    expect(IxTime.getCurrentIxTime()).toBe(LOCAL_TIME);
  });

  it("a natural bot clears a local time and speed override", async () => {
    const canonicalNow = IxTime.getCurrentIxTime();
    IxTime.setTimeOverride(LOCAL_TIME);
    IxTime.setMultiplierOverride(0);
    mockBot(botState({ ixTimeTimestamp: canonicalNow }));

    await IxTime.syncWithBot();
    expect(IxTime.isMultiplierNatural()).toBe(true);
    expect((await IxTime.getStatus()).hasTimeOverride).toBe(false);
    expect(IxTime.getCurrentIxTime()).toBe(canonicalNow);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(canonicalNow + 2 * HOUR_MS);
  });

  it("a pushed `/time set` (no speed) moves the time and keeps the current speed", () => {
    IxTime.setMultiplierOverride(3);

    IxTime.adoptBotClock(BOT_TIME, null);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME + 3 * HOUR_MS);
  });
});
