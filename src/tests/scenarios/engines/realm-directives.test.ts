/** @jest-environment node */
/**
 * Realm time design §2: executive directives run on each nation's realm clock. A directive is committed at its
 * nation's time (its GDP effect starts then) and the weekly slots and executive bandwidth windows count on that
 * clock: a paused realm's directive from yesterday still holds a slot, a 6× realm's directive from three of its years
 * ago does not.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/intent/intent-summation", () => ({
  generateIntentSummationDraft: jest.fn(async () => null),
}));

import { IxTime } from "~/lib/ixtime";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { resetRealmClockCache } from "~/server/shared/realm-time";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, addRealm, asOwner } from "~/tests/helpers/nation-world";

const intents = createCallerFactory(intentRouter);
const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
const IXNAY_NOW = Date.UTC(2043, 0, 15);
const FROZEN_NOW = IXNAY_NOW - YEAR;
const FAST_NOW = IXNAY_NOW + 3 * YEAR;
const JOBS = "Create jobs and grow the economy";

let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(IXNAY_NOW);
  resetRealmClockCache();
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addRealm(db as never, "frozen", { nowMs: FROZEN_NOW, multiplier: 0 });
  await addRealm(db as never, "fast", { nowMs: FAST_NOW, multiplier: 6 });
  for (const [id, realmId] of [
    ["frostland", "frozen"],
    ["swiftland", "fast"],
  ] as const) {
    await addNation(db as never, {
      id,
      realmId,
      baselineDate: new Date(FROZEN_NOW - YEAR),
      budgetYear: 2040,
    });
  }
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

async function ownerOf(countryId: string) {
  return intents(
    asOwner(db as never, await addOwner(db as never, `${countryId}-owner`, countryId))
  );
}

it("commits each nation's directive at its realm's time", async () => {
  const frost = await ownerOf("frostland");
  const { intent } = await frost.commit({ countryId: "frostland", goal: JOBS, tier: "measured" });
  expect(intent.createdIxTime).toBe(FROZEN_NOW);

  const swift = await ownerOf("swiftland");
  const { intent: swiftIntent } = await swift.commit({
    countryId: "swiftland",
    goal: JOBS,
    tier: "measured",
  });
  expect(swiftIntent.createdIxTime! - FAST_NOW).toBeGreaterThanOrEqual(0);
  expect(swiftIntent.createdIxTime! - FAST_NOW).toBeLessThan(60_000);
});

it("counts the weekly slots on each nation's clock", async () => {
  const committed = (countryId: string, at: number) =>
    db.intent.create({
      data: {
        countryId,
        goal: JOBS,
        tier: "measured",
        category: "economy",
        status: "active",
        changesJson: "[]",
        summary: "",
        createdIxTime: at,
      },
    });
  // A day ago on the paused realm's clock; IxTime's now, three of its years ago, on the 6× realm's
  await committed("frostland", FROZEN_NOW - DAY);
  await committed("swiftland", IXNAY_NOW);
  expect(
    (await (await ownerOf("frostland")).getStatus({ countryId: "frostland" })).usedThisWeek
  ).toBe(1);
  expect(
    (await (await ownerOf("swiftland")).getStatus({ countryId: "swiftland" })).usedThisWeek
  ).toBe(0);
});
