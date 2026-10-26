/** @jest-environment node */
/**
 * A pack's purchase limits hold under concurrency: the per-pack purchase lock (7341, keyed by the pack) is the first
 * thing a purchase takes, before it counts the buyer's purchases and the packs sold and before the ledger's vault row,
 * so of two buyers racing for the last limited pack one gets it, and a buyer's two requests at a one-per-player pack
 * buy one. On Postgres: the same two races, for real.
 *
 * Regression: purchasePack counted `purchaseLimit` and `limitedQuantity` under READ COMMITTED with no lock, so N
 * parallel purchases all passed the counts and oversold.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import type { PrismaClient } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { cardPacksUserRouter } from "~/server/api/routers/card-packs/user";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addCard,
  addPack,
  addPlayer,
  addRealm,
  callerContext,
  clearEconomyCaches,
  creditsOf,
  removeWorld,
  type Player,
} from "~/tests/helpers/money-world";
import { describeWithDb, prefix, scenarioDb } from "~/tests/helpers/scenario-db";

const packs = createCallerFactory(cardPacksUserRouter);

interface World {
  db: PrismaClient;
  p: string;
  ana: Player;
  bo: Player;
  pack: string;
}

/** Ana and Bo hold 1,000 IxC each; a one-card Common pack costs 100. */
async function seed(db: PrismaClient, p: string): Promise<World> {
  const { id: realmId } = await addRealm(db, `${p}realm`);
  const ana = await addPlayer(db, `${p}ana`, 1000);
  const bo = await addPlayer(db, `${p}bo`, 1000);
  await addCard(db, { id: `${p}c1`, realmId, rarity: "COMMON" });
  await addPack(db, { id: `${p}pack`, realmId, priceCredits: 100, cardCount: 1, rarity: "COMMON" });
  return { db, p, ana, bo, pack: `${p}pack` };
}

const buy = (w: World, who: Player) =>
  packs(callerContext(w.db, who)).purchasePack({ packId: w.pack });

/** Two buyers race for the last of a limited run: one pack sold, one buyer charged. */
async function lastLimitedPack(w: World) {
  await w.db.cardPack.update({ where: { id: w.pack }, data: { limitedQuantity: 1 } });
  const results = await Promise.allSettled([buy(w, w.ana), buy(w, w.bo)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { message: "Pack sold out" },
  });
  expect(await w.db.userPack.count({ where: { packId: w.pack } })).toBe(1);
  const credits = await creditsOf(w.db, [w.ana.id, w.bo.id]);
  expect(credits[w.ana.id]! + credits[w.bo.id]!).toBe(1900);
}

/** One buyer's two requests at a one-per-player pack: one pack, one charge. */
async function onePerPlayer(w: World) {
  await w.db.cardPack.update({ where: { id: w.pack }, data: { purchaseLimit: 1 } });
  const results = await Promise.allSettled([buy(w, w.ana), buy(w, w.ana)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await w.db.userPack.count({ where: { userId: w.ana.id } })).toBe(1);
  expect((await creditsOf(w.db, [w.ana.id]))[w.ana.id]).toBe(900);
}

beforeEach(() => {
  clearEconomyCaches();
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("pack purchase limits (memory)", () => {
  let db: MemoryPrisma;
  let w: World;

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it("takes the pack's purchase lock before counting and before the vault", async () => {
    await db.cardPack.update({ where: { id: w.pack }, data: { limitedQuantity: 5 } });
    const start = db.store.log.length;
    await buy(w, w.ana);
    const order = db.store.log
      .slice(start)
      .map((e) =>
        e.kind === "advisory" ? `lock ${e.ns}:${e.key}` : e.kind === "write" ? e.model : e.kind
      )
      .filter((e) => e.startsWith("lock") || e === "MyVault" || e === "UserPack");
    expect(order[0]).toBe(`lock 7341:${w.pack}`);
    expect(order).toContain("MyVault");
  });

  it("sells the last limited pack once", async () => {
    await lastLimitedPack(w);
  });

  it("sells a one-per-player pack once to one player's two requests", async () => {
    await onePerPlayer(w);
  });
});

describeWithDb("pack purchase limits (Postgres)", () => {
  const db = scenarioDb();
  let w: World;

  beforeEach(async () => {
    mockDb = db;
    w = await seed(db, prefix());
  });
  afterEach(() => removeWorld(db, w.p));
  afterAll(() => db.$disconnect());

  it("sells the last limited pack once when two buyers race", async () => {
    await lastLimitedPack(w);
  });

  it("sells a one-per-player pack once when one player's two requests race", async () => {
    await onePerPlayer(w);
  });
});
