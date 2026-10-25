/** @jest-environment node */
/**
 * Realm time design §2: policies and politics run on each nation's realm clock. Ending a policy logs its nation's
 * time; the maintenance job charges each nation for its realm's budget year (a 6× realm years ahead, a paused realm
 * behind, Ixnay's on IxTime); politics drift leaves a paused realm's nations alone.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));

import { IxTime } from "~/lib/ixtime";
import { runPoliticsDrift } from "~/lib/government/politics-drift-cron";
import { endPolicy } from "~/lib/policies/lifecycle";
import { runPolicyMaintenanceDebits } from "~/lib/policies/maintenance-cron";
import { realmClocks, resetRealmClockCache } from "~/server/shared/realm-time";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addIxnay,
  addNation,
  addOwner,
  addRealm,
  ixnayRunningAt,
} from "~/tests/helpers/nation-world";

const YEAR = 365.25 * 86_400_000;
const IXNAY_NOW = Date.UTC(2043, 5, 15);
const FROZEN_NOW = IXNAY_NOW - YEAR;
const FAST_NOW = IXNAY_NOW + 3 * YEAR;
const NATIONS = [
  ["ixland", undefined],
  ["frostland", "frozen"],
  ["swiftland", "fast"],
] as const;

let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(IXNAY_NOW);
  resetRealmClockCache();
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addRealm(db as never, "frozen", { nowMs: FROZEN_NOW, multiplier: 0 });
  await addRealm(db as never, "fast", { nowMs: FAST_NOW, multiplier: 6 });
  for (const [id, realmId] of NATIONS) {
    await addNation(db as never, {
      id,
      realmId,
      baselineDate: new Date(FROZEN_NOW - YEAR),
      budgetYear: 2040,
    });
    await addOwner(db as never, `${id}-owner`, id);
    await db.policy.create({
      data: {
        id: `${id}-policy`,
        countryId: id,
        userId: `${id}-owner`,
        name: "Stipend",
        description: "Upkeep",
        policyType: "economic",
        category: "fiscal",
        status: "active",
        maintenanceCost: 1000,
      },
    });
  }
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const logOf = (policyId: string, effectType: string) =>
  db.policyEffectLog.findFirstOrThrow({ where: { policyId, effectType } });

it("charges each nation's maintenance in its realm's budget year, stamped with its time", async () => {
  await runPolicyMaintenanceDebits(db as never);
  expect((await logOf("ixland-policy", "MAINTENANCE_DEBIT")).notes).toBe("FY2043");
  expect((await logOf("frostland-policy", "MAINTENANCE_DEBIT")).notes).toBe("FY2042");
  expect((await logOf("swiftland-policy", "MAINTENANCE_DEBIT")).notes).toBe("FY2046");
  expect((await logOf("frostland-policy", "MAINTENANCE_DEBIT")).appliedIxTime).toBe(FROZEN_NOW);
  expect((await logOf("ixland-policy", "MAINTENANCE_DEBIT")).appliedIxTime).toBe(IXNAY_NOW);
});

it("logs an ended policy at its nation's time", async () => {
  for (const [id] of NATIONS)
    expect(await endPolicy(db as never, `${id}-policy`, "repealed")).toBe(true);
  expect((await logOf("ixland-policy", "POLICY_ENDED")).appliedIxTime).toBe(IXNAY_NOW);
  expect((await logOf("frostland-policy", "POLICY_ENDED")).appliedIxTime).toBe(FROZEN_NOW);
  const swift = (await logOf("swiftland-policy", "POLICY_ENDED")).appliedIxTime!;
  expect(swift - FAST_NOW).toBeGreaterThanOrEqual(0);
  expect(swift - FAST_NOW).toBeLessThan(60_000);
});

it("politics drift skips a paused realm's nations", async () => {
  const result = await runPoliticsDrift({
    clocks: ixnayRunningAt(IXNAY_NOW, await realmClocks(db as never)),
  });
  expect(result).toMatchObject({ countriesProcessed: 2, skippedPaused: 1 });
});
