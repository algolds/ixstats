/** @jest-environment node */
/**
 * Realm time design §2: stat progression projects each nation to its realm's time now. Ixnay's nation follows IxTime;
 * a nation in a realm at 6× is projected years ahead; a paused realm's nation is brought to its realm's time once and
 * then skipped. A forward date jump is caught up by the next run, with a history point for every month it passed.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { IxTime } from "~/lib/ixtime";
import { parseRealmClock, withJump } from "~/lib/realms/realm-clock";
import {
  MAX_CATCH_UP_MONTHS,
  missedHistoryMonths,
  runStatProgression,
} from "~/server/cron/stat-progression";
import { realmClocks, resetRealmClockCache } from "~/server/shared/realm-time";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addRealm, ixnayRunningAt } from "~/tests/helpers/nation-world";

const YEAR = 365.25 * 86_400_000;
const NOW = Date.UTC(2043, 0, 15);
const FAST_NOW = NOW + 2 * YEAR;
const FROZEN_NOW = NOW + YEAR / 2;

let db: MemoryPrisma;

const country = (id: string) => db.country.findUniqueOrThrow({ where: { id } });
const points = (countryId: string) => db.historicalDataPoint.count({ where: { countryId } });
const run = async () =>
  runStatProgression({
    db: db as never,
    clocks: ixnayRunningAt(NOW, await realmClocks(db as never)),
  });

async function jump(realmId: string, days: number) {
  const realm = await db.realm.findUniqueOrThrow({ where: { id: realmId } });
  const clock = parseRealmClock((realm.settings as { clock: unknown }).clock)!;
  await db.realm.update({
    where: { id: realmId },
    data: { settings: { clock: withJump(clock, days, Date.now()) } },
  });
  resetRealmClockCache();
}

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  // Ixnay's IxTime stands still; the runs read Ixnay at NOW, running (ixnayRunningAt)
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  resetRealmClockCache();
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addRealm(db as never, "frozen", { nowMs: FROZEN_NOW, multiplier: 0 });
  await addRealm(db as never, "fast", { nowMs: FAST_NOW, multiplier: 6 });
  const baselineDate = new Date(NOW - YEAR);
  await addNation(db as never, { id: "ixland", baselineDate });
  await addNation(db as never, { id: "frostland", baselineDate, realmId: "frozen" });
  await addNation(db as never, { id: "swiftland", baselineDate, realmId: "fast" });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("projects each nation to its realm's time, brings a paused realm's nation to its time once, then skips it", async () => {
  expect(await run()).toMatchObject({ processed: 3, skippedPaused: 0, ixTime: NOW });

  const [ix, frost, swift] = await Promise.all(["ixland", "frostland", "swiftland"].map(country));
  expect(ix.lastCalculated.getTime()).toBe(NOW);
  expect(frost.lastCalculated.getTime()).toBe(FROZEN_NOW);
  // Six times faster: a little past FAST_NOW by the time the run reads it, never behind
  expect(swift.lastCalculated.getTime()).toBeGreaterThanOrEqual(FAST_NOW);
  expect(swift.lastCalculated.getTime() - FAST_NOW).toBeLessThan(60_000);
  expect(ix.currentGdpPerCapita).toBeLessThan(frost.currentGdpPerCapita);
  expect(frost.currentGdpPerCapita).toBeLessThan(swift.currentGdpPerCapita);
  expect([await points("ixland"), await points("frostland"), await points("swiftland")]).toEqual([
    1, 1, 1,
  ]);

  // The paused realm stands at its time: the next run leaves its nation alone
  const again = await run();
  expect(again).toMatchObject({ processed: 2, skippedPaused: 1 });
  expect((await country("frostland")).updatedAt).toEqual(frost.updatedAt);
});

it("catches up a forward jump, paused or not, with a history point for each month it passed", async () => {
  await run();
  const before = await country("swiftland");

  await jump("fast", 365);
  await jump("frozen", 90);
  const result = await run();
  expect(result.skippedPaused).toBe(0);

  const after = await country("swiftland");
  expect(after.lastCalculated.getTime() - before.lastCalculated.getTime()).toBeGreaterThanOrEqual(
    365 * 86_400_000
  );
  expect(after.currentGdpPerCapita).toBeGreaterThan(before.currentGdpPerCapita);
  // Eleven months passed between the two runs' months, plus the new month's point
  expect(await points("swiftland")).toBe(1 + 12);
  expect((await country("frostland")).lastCalculated.getTime()).toBe(FROZEN_NOW + 90 * 86_400_000);
  expect(await points("frostland")).toBe(1 + 3);
  expect(await points("ixland")).toBe(1);
});

it("fills at most MAX_CATCH_UP_MONTHS past months, the latest", () => {
  const months = missedHistoryMonths(Date.UTC(2000, 0, 10), Date.UTC(2040, 5, 3));
  expect(months).toHaveLength(MAX_CATCH_UP_MONTHS);
  expect(months.at(-1)).toBe(Date.UTC(2040, 4, 1));
  expect(missedHistoryMonths(Date.UTC(2040, 4, 30), Date.UTC(2040, 5, 1))).toEqual([]);
});
