/** @jest-environment node */
/**
 * Realm time design §2: elections run on each nation's realm clock. A first election is called 30 days out on its
 * nation's clock (Ixnay's IxTime, a paused realm's frozen time, a 6× realm's time years ahead), and the elections
 * job counts only the elections due on their own nation's clock.
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
import { processDueElections } from "~/lib/government/election-cron";
import {
  ensureUpcomingElection,
  FIRST_ELECTION_DELAY_IX_DAYS,
} from "~/lib/government/election-lifecycle";
import { resetRealmClockCache } from "~/server/shared/realm-time";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addRealm } from "~/tests/helpers/nation-world";

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
const IXNAY_NOW = Date.UTC(2043, 0, 15);
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
    await addNation(db as never, { id, realmId, baselineDate: new Date(FROZEN_NOW - YEAR) });
    await db.legislature.create({ data: { id: `${id}-leg`, countryId: id, name: "Assembly" } });
    for (const party of ["a", "b"]) {
      await db.politicalParty.create({
        data: {
          countryId: id,
          name: `${id} ${party}`,
          ideology: "center",
          baseSupport: 50,
          currentSupport: 50,
        },
      });
    }
  }
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("calls each nation's first election 30 days out on its realm's clock", async () => {
  const at = async (countryId: string) => {
    const ensured = await ensureUpcomingElection(db as never, countryId);
    return ensured.status === "created" ? ensured.scheduledIxTime : null;
  };
  const delay = FIRST_ELECTION_DELAY_IX_DAYS * DAY;
  expect(await at("ixland")).toBe(IXNAY_NOW + delay);
  expect(await at("frostland")).toBe(FROZEN_NOW + delay);
  const swift = (await at("swiftland"))!;
  expect(swift - (FAST_NOW + delay)).toBeGreaterThanOrEqual(0);
  expect(swift - (FAST_NOW + delay)).toBeLessThan(60_000);
});

it("counts only the elections due on their own nation's clock", async () => {
  for (const [id] of NATIONS) {
    await db.election.create({
      data: {
        id: `${id}-election`,
        countryId: id,
        legislatureId: `${id}-leg`,
        name: "General Election",
        scheduledIxTime: IXNAY_NOW + YEAR,
      },
    });
  }
  await processDueElections();
  const status = async (id: string) =>
    (await db.election.findUniqueOrThrow({ where: { id: `${id}-election` } })).status;
  // A year out for Ixnay and the paused realm; two years past for the 6× realm
  expect(await status("ixland")).toBe("upcoming");
  expect(await status("frostland")).toBe("upcoming");
  expect(await status("swiftland")).toBe("completed");
});
