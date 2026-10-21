/** @jest-environment node */
/**
 * A member opens the Vault and takes the card: today's slot is claimed, capacity checked under its lock before the
 * serial lock, a card drawn from the daily pool and minted with DAILY_CLAIM XP, and the claim answers with the copy's
 * face. A second claim the same day, of either kind, awards nothing. The next day the credits pay once. At a full
 * collection the card is refused with the slot kept, so the credits can still be taken. On Postgres: two claims racing
 * one day, and a daily card racing a pack open for the last free slot.
 *
 * Folds vault-daily-claim-face (its "no second daily claim" tombstone is not carried) and daily-claim-mint (the mint
 * row, the XP, 7334 before 7331 and nothing minted at a full collection).
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
import { lockedCopyRoomTx } from "~/lib/cards/capacity";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { cardPacksUserRouter } from "~/server/api/routers/card-packs/user";
import { vaultDailyClaimsRouter } from "~/server/api/routers/vault/daily-claims";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addCard,
  addPack,
  addPlayer,
  addRealm,
  callerContext,
  clearEconomyCaches,
  creditsOf,
  ledgerOf,
  removeWorld,
  type Player,
} from "~/tests/helpers/money-world";
import { describeWithDb, prefix, scenarioDb } from "~/tests/helpers/scenario-db";

const create = jest.mocked(notificationAPI.create);
const vault = createCallerFactory(vaultDailyClaimsRouter);
const packs = createCallerFactory(cardPacksUserRouter);

interface World {
  db: PrismaClient;
  p: string;
  dee: Player;
  realmId: string;
}

/** Dee has an empty Vault; the realm's catalogue has a card of every rarity, so any daily roll draws. */
async function seed(db: PrismaClient, p: string): Promise<World> {
  const { id: realmId } = await addRealm(db, `${p}realm`);
  const dee = await addPlayer(db, `${p}dee`, 0);
  for (const rarity of ["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"] as const) {
    await addCard(db, { id: `${p}${rarity.toLowerCase()}`, realmId, rarity });
  }
  return { db, p, dee, realmId };
}

const claim = (w: World, choice: "CARD" | "CREDITS") =>
  vault(callerContext(w.db, w.dee)).claimCombinedDailyClaim({ choice });
/** Moves Dee's last claim to yesterday, as if a day had passed. */
const nextDay = (w: World) =>
  w.db.myVault.update({
    where: { userId: w.dee.id },
    data: { lastLoginDate: new Date(Date.now() - 86_400_000) },
  });

async function dailyClaim(w: World) {
  const { db, dee } = w;

  // The card: one copy, minted with its DAILY_CLAIM row and XP, returned as its face; the ledger marks the claim
  const card = await claim(w, "CARD");
  expect(card).toMatchObject({ success: true, rewardType: "card", streak: 1 });
  const ownershipId = card.cardAwarded!.ownershipId;
  expect(card.cardFace).toMatchObject({ copy: { ownershipId }, uncollected: false });
  expect(
    await db.cardOwnership.findMany({ where: { ownerId: dee.id }, select: { id: true } })
  ).toEqual([{ id: ownershipId }]);
  // The finish was rolled (none named) and the mint row records it, with the copy's serial
  const minted = await db.cardOwnership.findUniqueOrThrow({ where: { id: ownershipId } });
  expect(card.cardAwarded!.finish).toBe(minted.finish);
  expect(
    await db.cardTransferEvent.findMany({
      where: { ownershipId },
      select: { action: true, cardId: true, serialNumber: true, finish: true, toUserId: true },
    })
  ).toEqual([
    {
      action: "DAILY_CLAIM",
      cardId: minted.cardId,
      serialNumber: minted.serialNumber,
      finish: minted.finish,
      toUserId: dee.id,
    },
  ]);
  expect(
    await db.cardExperienceEvent.findMany({
      where: { ownershipId },
      select: { source: true, amount: true },
    })
  ).toEqual([{ source: "DAILY_CLAIM", amount: 10 }]);
  expect(await ledgerOf(db, dee.id)).toEqual([
    { credits: 0, balanceAfter: 0, type: "EARN_ACTIVE", source: "DAILY_LOGIN_CARD" },
  ]);

  // A second claim today, of either kind, awards nothing
  await expect(claim(w, "CREDITS")).rejects.toThrow("Daily claim already made today");
  await expect(claim(w, "CARD")).rejects.toThrow("Daily claim already made today");
  expect(await db.cardOwnership.count({ where: { ownerId: dee.id } })).toBe(1);
  expect(await ledgerOf(db, dee.id)).toHaveLength(1);

  // The next day the credits pay once, with no face and no face read
  await nextDay(w);
  const faces = jest.spyOn(db.cardOwnership, "findMany");
  const credits = await claim(w, "CREDITS");
  expect(faces).not.toHaveBeenCalled();
  faces.mockRestore();
  expect(credits).toMatchObject({
    success: true,
    rewardType: "credits",
    streak: 2,
    cardFace: null,
  });
  expect(credits.creditsAwarded).toBeGreaterThan(0);
  expect((await creditsOf(db, [dee.id]))[dee.id]).toBe(credits.creditsAwarded);
  expect((await ledgerOf(db, dee.id)).at(-1)).toEqual({
    credits: credits.creditsAwarded,
    balanceAfter: credits.creditsAwarded,
    type: "EARN_ACTIVE",
    source: "DAILY_LOGIN_CREDITS",
  });
  await expect(claim(w, "CARD")).rejects.toThrow("Daily claim already made today");
}

beforeEach(() => {
  clearEconomyCaches();
  create.mockReset().mockResolvedValue("n1" as never);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("vault-daily-claim (memory)", () => {
  let db: MemoryPrisma;
  let w: World;

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it("claims the card, refuses a second claim, pays the credits the next day, in the lock order", async () => {
    await dailyClaim(w);
    // The card claim's slot, then the owner's capacity lock (7334), then the card's serial lock (7331), then the copy
    const [copy] = await db.cardOwnership.findMany({
      where: { ownerId: w.dee.id },
      orderBy: { createdAt: "asc" },
    });
    const order = db.store.log
      .map((e) =>
        e.kind === "advisory"
          ? `lock ${e.ns} ${e.key}`
          : e.kind === "write"
            ? `${e.model}.${e.op}`
            : e.kind
      )
      .filter((e) => /^lock|MyVault.updateMany|CardOwnership.create/.test(e));
    expect(order.slice(0, 4)).toEqual([
      "MyVault.updateMany",
      `lock 7334 ${w.dee.id}`,
      `lock 7331 ${copy!.cardId}`,
      "CardOwnership.create",
    ]);
  });

  it("keeps the slot at a full collection and says to make room, so the credits can still be taken", async () => {
    await db.systemConfig.create({ data: { key: "card_system_max_inventory_cards", value: "0" } });
    await expect(claim(w, "CARD")).rejects.toThrow(
      "Your collection is full. Break down cards, or buy a capacity upgrade in the Store."
    );
    expect(await db.cardOwnership.count({ where: { ownerId: w.dee.id } })).toBe(0);
    expect(await claim(w, "CREDITS")).toMatchObject({ success: true, rewardType: "credits" });
  });

  it("still reports the committed card claim when its face cannot be read", async () => {
    jest.spyOn(db.cardOwnership, "findMany").mockRejectedValueOnce(new Error("connection reset"));
    const quiet = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await claim(w, "CARD");
    expect(result).toMatchObject({
      success: true,
      cardAwarded: { ownershipId: expect.any(String) },
      cardFace: null,
    });
    expect(quiet).toHaveBeenCalledWith(
      "[Cards] A daily card claim committed, but its faces could not be read:",
      expect.any(Error)
    );
    expect(await db.cardOwnership.count({ where: { ownerId: w.dee.id } })).toBe(1);
  });
});

describeWithDb("vault-daily-claim (Postgres)", () => {
  const db = scenarioDb();
  let w: World;

  beforeEach(async () => {
    mockDb = db;
    w = await seed(db, prefix());
  });
  afterEach(() => removeWorld(db, w.p));
  afterAll(() => db.$disconnect());

  it("claims the card, refuses a second claim and pays the credits the next day", async () => {
    await dailyClaim(w);
  });

  it("awards one of two claims racing one day: one ledger row or one copy, never both", async () => {
    const results = await Promise.allSettled([claim(w, "CARD"), claim(w, "CREDITS")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const copies = await db.cardOwnership.count({ where: { ownerId: w.dee.id } });
    const paid = await db.vaultTransaction.count({
      where: { vault: { userId: w.dee.id }, source: "DAILY_LOGIN_CREDITS" },
    });
    expect(copies + paid).toBe(1);
  });

  it("lets only one of a daily card and a pack open take the last free slot", async () => {
    await db.myVault.update({ where: { userId: w.dee.id }, data: { credits: 50 } });
    await addPack(db, {
      id: `${w.p}single`,
      realmId: w.realmId,
      priceCredits: 50,
      cardCount: 1,
      rarity: "COMMON",
    });
    const bought = await packs(callerContext(db, w.dee)).purchasePack({ packId: `${w.p}single` });
    const room = await db.$transaction((tx) => lockedCopyRoomTx(tx, w.dee.id));
    await db.cardOwnership.createMany({
      data: Array.from({ length: room - 1 }, (_, i) => ({
        cardId: `${w.p}common`,
        ownerId: w.dee.id,
        serialNumber: 1000 + i,
      })),
    });
    const results = await Promise.allSettled([
      claim(w, "CARD"),
      packs(callerContext(db, w.dee)).openPack({ userPackId: bought.userPack.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.cardOwnership.count({ where: { ownerId: w.dee.id } })).toBe(room);
  });
});
