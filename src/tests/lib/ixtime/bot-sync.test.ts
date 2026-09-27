/**
 * @jest-environment node
 */
import { IxTime } from "~/lib/ixtime";
import type { BotTimeResponse } from "~/types/ixstats";

const HOUR_MS = 3_600_000;
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
    IxTime.clearMultiplierOverride();
    IxTime.clearTimeOverride();
  });

  afterEach(() => {
    IxTime.clearMultiplierOverride();
    IxTime.clearTimeOverride();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("1. a paused bot freezes the local clock at the bot's time", async () => {
    mockBot(botState({ isPaused: true, hasTimeOverride: true }));

    const result = await IxTime.syncWithBot();
    expect(result.success).toBe(true);
    expect(IxTime.isPaused()).toBe(true);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);
  });

  it("2. a bot at an overridden speed is adopted with its time and speed", async () => {
    mockBot(botState({ multiplier: 5, hasMultiplierOverride: true }));

    await IxTime.syncWithBot();
    expect(IxTime.getTimeMultiplier()).toBe(5);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME + 5 * HOUR_MS);
  });

  it("3. the local clock moves only to the bot's reported time, whatever its local state", async () => {
    IxTime.setTimeOverride(LOCAL_TIME);
    IxTime.setMultiplierOverride(0);
    mockBot(botState({ multiplier: 3, hasTimeOverride: true, hasMultiplierOverride: true }));

    await IxTime.syncWithBot();
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);
    expect(IxTime.convertToIxTime(Date.now())).toBe(BOT_TIME);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME + 3 * HOUR_MS);
  });

  it("4. a failed sync leaves the local clock untouched", async () => {
    IxTime.setTimeOverride(LOCAL_TIME);
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await IxTime.syncWithBot();
    expect(result.success).toBe(false);
    expect(IxTime.getCurrentIxTime()).toBe(LOCAL_TIME);
  });

  it("5. a natural bot clears a local time and speed override", async () => {
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

  it("6. a pushed `/time set` (no speed) moves the time and keeps the current speed", () => {
    IxTime.setMultiplierOverride(3);

    IxTime.adoptBotClock(BOT_TIME, null);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME + 3 * HOUR_MS);
  });
});
