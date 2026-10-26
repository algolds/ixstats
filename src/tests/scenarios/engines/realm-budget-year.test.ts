/** @jest-environment node */
/**
 * Realm time design §2: a nation's budget year is the game year of its realm's clock. Ixnay's nation follows IxTime;
 * a nation in a paused realm stays in its year; a nation in a realm at 6× is years ahead, reads its budget carried
 * forward and gets the rollover reminder for its own year. A forward date jump rolls the paused realm's year at once.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications", () => ({ notificationAPI: { create: jest.fn() } }));

import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications";
import { countryBudgetYear, loadEffectiveBudget } from "~/lib/government/budget-allocations";
import { runBudgetYearRollover } from "~/lib/government/budget-year-rollover-cron";
import { parseRealmClock, withJump } from "~/lib/realms/realm-clock";
import { resetRealmClockCache } from "~/server/shared/realm-time";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, addRealm } from "~/tests/helpers/nation-world";

const notify = jest.mocked(notificationAPI.create);
const IXNAY_NOW = Date.UTC(2042, 5, 15);

let db: MemoryPrisma;

beforeEach(async () => {
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(IXNAY_NOW);
  resetRealmClockCache();
  notify.mockReset().mockResolvedValue("n1");
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addRealm(db as never, "frozen", { nowMs: Date.UTC(2041, 8, 1), multiplier: 0 });
  await addRealm(db as never, "fast", { nowMs: Date.UTC(2044, 3, 1), multiplier: 6 });
  for (const [id, realmId] of [
    ["ixland", undefined],
    ["frostland", "frozen"],
    ["swiftland", "fast"],
  ] as const) {
    await addNation(db as never, {
      id,
      realmId,
      baselineDate: new Date(IXNAY_NOW),
      budgetYear: 2041,
    });
    await addOwner(db as never, `${id}-owner`, id);
  }
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
});

it("reads each nation's budget year from its realm's clock", async () => {
  expect(await countryBudgetYear(db as never, "ixland")).toBe(IxTime.getCurrentGameYear());
  expect(await countryBudgetYear(db as never, "ixland")).toBe(2042);
  expect(await countryBudgetYear(db as never, "frostland")).toBe(2041);
  expect(await countryBudgetYear(db as never, "swiftland")).toBe(2044);

  expect(await loadEffectiveBudget(db as never, "swiftland")).toMatchObject({
    budgetYear: 2041,
    currentYear: 2044,
    carriedForward: true,
  });
  expect(await loadEffectiveBudget(db as never, "frostland")).toMatchObject({
    currentYear: 2041,
    carriedForward: false,
  });
});

it("reminds each nation for its realm's year, and a forward jump rolls the paused realm's year", async () => {
  const first = await runBudgetYearRollover(db as never);
  expect(first).toMatchObject({ budgetYears: { default: 2042, fast: 2044 }, notified: 2 });
  expect(notify.mock.calls.map(([n]) => [n.countryId, n.metadata])).toEqual(
    expect.arrayContaining([
      ["ixland", { budgetYear: 2042, carriedForwardFrom: 2041 }],
      ["swiftland", { budgetYear: 2044, carriedForwardFrom: 2041 }],
    ])
  );

  // The founder jumps the paused realm a year ahead: its year rolls without the clock running
  const realm = await db.realm.findUniqueOrThrow({ where: { id: "frozen" } });
  const clock = parseRealmClock((realm.settings as { clock: unknown }).clock)!;
  await db.realm.update({
    where: { id: "frozen" },
    data: { settings: { clock: withJump(clock, 365, Date.now()) } },
  });
  resetRealmClockCache();
  expect(await countryBudgetYear(db as never, "frostland")).toBe(2042);
  notify.mockClear();
  const second = await runBudgetYearRollover(db as never);
  expect(second.budgetYears).toMatchObject({ frozen: 2042 });
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({
      countryId: "frostland",
      metadata: { budgetYear: 2042, carriedForwardFrom: 2041 },
    })
  );
});

it("names the year in the nation's own calendar", async () => {
  await runBudgetYearRollover(db as never);
  const byCountry = new Map(notify.mock.calls.map(([n]) => [n.countryId, n]));
  // Realm "fast" read 1 January 1200 AE when its shared-timeline year was 2044: its 2041 budget falls years before.
  expect(byCountry.get("swiftland")).toMatchObject({
    title: "FY 1200 AE budget needed",
    message: expect.stringMatching(/Your FY 119\d AE budget stays in effect until you set the FY 1200 AE budget\.$/),
  });
  expect(byCountry.get("ixland")).toMatchObject({ title: "FY 2042 budget needed" });
});
