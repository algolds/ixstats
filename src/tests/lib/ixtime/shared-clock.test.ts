/** @jest-environment node */
/**
 * P1-32: the bot's clock override is shared across processes. The process that adopts it persists the override state
 * to SystemConfig; another process (the cron runner, a restarted web process) loads it and reads the same IxTime.
 * Reads are cached for CLOCK_REFRESH_TTL_MS; a missing or malformed row leaves the local clock alone.
 */
import { IxTime } from "~/lib/ixtime";
import {
  CLOCK_REFRESH_TTL_MS,
  IXTIME_CLOCK_CONFIG_KEY,
  persistSharedClock,
  refreshSharedClock,
  resetSharedClockCache,
} from "~/lib/ixtime/shared-clock";

const BOT_TIME = Date.UTC(2050, 5, 1);

function store() {
  const rows = new Map<string, string>();
  return {
    rows,
    systemConfig: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
        rows.has(where.key) ? { value: rows.get(where.key)! } : null
      ),
      upsert: jest.fn(async (args: { where: { key: string }; create: { value: string } }) => {
        rows.set(args.where.key, args.create.value);
        return {};
      }),
    },
  };
}

function clearClock() {
  IxTime.loadClockState({ timeOverride: null, timeOverrideSetAt: null, multiplierOverride: null });
}

beforeEach(() => {
  clearClock();
  resetSharedClockCache();
});
afterAll(clearClock);

it("another process reads the clock the web process adopted from the bot", async () => {
  const db = store();
  // Web process: the bot pauses the clock at BOT_TIME
  IxTime.adoptBotClock(BOT_TIME, 0);
  await persistSharedClock(db);
  expect(db.rows.has(IXTIME_CLOCK_CONFIG_KEY)).toBe(true);

  // Cron process: starts on the canonical clock, then loads the shared one
  clearClock();
  expect(IxTime.getCurrentIxTime()).not.toBe(BOT_TIME);
  await refreshSharedClock(db, { force: true });
  expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);
  expect(IxTime.isPaused()).toBe(true);
});

it("a cleared bot override clears the other processes' clocks", async () => {
  const db = store();
  IxTime.adoptBotClock(BOT_TIME, 0);
  await persistSharedClock(db);
  IxTime.applyBotState({
    ixTimeTimestamp: BOT_TIME,
    multiplier: 2,
    isPaused: false,
    hasTimeOverride: false,
    hasMultiplierOverride: false,
  });
  await persistSharedClock(db);

  IxTime.adoptBotClock(BOT_TIME, 0); // a stale local override
  await refreshSharedClock(db, { force: true });
  expect(IxTime.getClockState()).toEqual({
    timeOverride: null,
    timeOverrideSetAt: null,
    multiplierOverride: null,
  });
});

it("reads the row at most once per TTL unless forced", async () => {
  const db = store();
  jest.useFakeTimers({ now: Date.UTC(2026, 9, 25) });
  try {
    await refreshSharedClock(db);
    await refreshSharedClock(db);
    expect(db.systemConfig.findUnique).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + CLOCK_REFRESH_TTL_MS + 1);
    await refreshSharedClock(db);
    expect(db.systemConfig.findUnique).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

it("keeps the local clock when the row is missing or malformed", async () => {
  const db = store();
  IxTime.adoptBotClock(BOT_TIME, 0);
  await refreshSharedClock(db, { force: true });
  expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);

  db.rows.set(IXTIME_CLOCK_CONFIG_KEY, '{"timeOverride":"soon"}');
  await refreshSharedClock(db, { force: true });
  expect(IxTime.getCurrentIxTime()).toBe(BOT_TIME);
});
