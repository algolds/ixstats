/** @jest-environment node */
/**
 * A member opens the Vault and takes the card: today's slot is claimed, capacity checked under its lock before the
 * serial lock, a card drawn from the daily pool and minted with DAILY_CLAIM XP, and the claim answers with the copy's
 * face. A second claim the same day, of either kind, awards nothing. The next day the credits pay once. At a full
 * collection the card is refused with the slot kept, so the credits can still be taken. On Postgres: two claims racing
 * one day, and a daily card racing a pack open for the last free slot.
 *
 * Folds vault-daily-claim-face (its "no second daily claim" tombstone is not carried) and daily-claim-mint (the mint
 * row, the XP, 7334 before 7331 and nothing minted at a full collection), and daily-claim-atomic and pool-draw: the
 * streak on the next day and after a missed one, the Economy tab's daily odds, every reason a card stays out of the
 * daily pool (an empty pool keeps the slot for the credits), and a failed ledger write that takes no slot.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import type { Prisma, PrismaClient } from "@prisma/client";
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

  // Regression: the card claim's ledger marker wrote balanceAfter from the vault read before the transaction, so a
  // balance that moved in between (a sale, a purchase) left a marker disagreeing with the ledger around it
  it("marks the card claim with the balance inside its transaction, not one read before it", async () => {
    await db.myVault.update({ where: { userId: w.dee.id }, data: { credits: 40 } });
    const upsert = db.myVault.upsert.bind(db.myVault);
    jest.spyOn(db.myVault, "upsert").mockImplementationOnce((async (args: never) => ({
      ...(await upsert(args)),
      credits: 999,
    })) as never);

    await claim(w, "CARD");

    expect(await ledgerOf(db as never, w.dee.id)).toEqual([
      { credits: 0, balanceAfter: 40, type: "EARN_ACTIVE", source: "DAILY_LOGIN_CARD" },
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

describe("vault-daily-claim (memory): the streak, the pool and a failed write", () => {
  let db: MemoryPrisma;
  let w: World;
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it.each([
    ["on the next UTC day, one more", 1, 6],
    ["after a missed day, back to 1", 2, 1],
  ])("counts the streak %s", async (_label, last, streak) => {
    await db.myVault.update({
      where: { userId: w.dee.id },
      data: { lastLoginDate: daysAgo(last), loginStreak: 5 },
    });
    await expect(claim(w, "CREDITS")).resolves.toMatchObject({ success: true, streak });
  });

  it("rolls the daily card's rarity by the Economy tab's daily odds", async () => {
    await db.systemConfig.create({
      data: { key: "card_economy_daily_legendary_pct", value: "100" },
    });
    const { cardAwarded } = await claim(w, "CARD");
    expect(
      await db.cardOwnership.findUniqueOrThrow({
        where: { id: cardAwarded!.ownershipId },
        select: { cards: { select: { rarity: true } } },
      })
    ).toEqual({ cards: { rarity: "LEGENDARY" } });
  });

  // Every catalogue card but one is retired; the one left is kept out of the pool for one reason each time
  it.each<[string, (cardId: string) => Promise<unknown>]>([
    [
      "waiting in review",
      (id) => db.card.update({ where: { id }, data: { reviewState: "PENDING" } }),
    ],
    ["retired", (id) => db.card.update({ where: { id }, data: { isRetired: true } })],
    ["bound", (id) => db.card.update({ where: { id }, data: { isBound: true } })],
    ["a Special card", (id) => db.card.update({ where: { id }, data: { cardType: "SPECIAL" } })],
    ["a Trophy card", (id) => db.card.update({ where: { id }, data: { cardType: "TROPHY" } })],
    ["a Nation card", (id) => db.card.update({ where: { id }, data: { cardType: "NATION" } })],
    [
      "art whose licence is restricted",
      (id) =>
        db.cardArtLicence.create({ data: { cardId: id, wiki: "ixwiki", status: "RESTRICTED" } }),
    ],
    [
      "homed in a draft realm",
      () => db.realm.update({ where: { id: w.realmId }, data: { status: "draft" } }),
    ],
  ])("never draws a card %s, and keeps the slot for the credits", async (_label, exclude) => {
    await db.card.updateMany({ where: { id: { not: "m-common" } }, data: { isRetired: true } });
    await exclude("m-common");
    await expect(claim(w, "CARD")).rejects.toThrow(
      "There is no card to draw right now. Take the credits instead."
    );
    expect(await db.cardOwnership.count({ where: { ownerId: w.dee.id } })).toBe(0);
    await expect(claim(w, "CREDITS")).resolves.toMatchObject({ success: true, streak: 1 });
  });

  it("takes no slot when the credits' ledger write fails, so the claim can be made again", async () => {
    const realTx = db.$transaction.bind(db);
    jest.spyOn(db, "$transaction").mockImplementationOnce(((
      work: (tx: Prisma.TransactionClient) => Promise<unknown>
    ) =>
      realTx(async (tx) => {
        jest.spyOn(tx.vaultTransaction, "create").mockRejectedValueOnce(new Error("disk full"));
        return work(tx);
      })) as never);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(claim(w, "CREDITS")).rejects.toThrow();
    expect(
      await db.myVault.findUniqueOrThrow({
        where: { userId: w.dee.id },
        select: { credits: true, lastLoginDate: true },
      })
    ).toEqual({ credits: 0, lastLoginDate: null });
    await expect(claim(w, "CREDITS")).resolves.toMatchObject({ success: true, streak: 1 });
    expect(await ledgerOf(db as never, w.dee.id)).toHaveLength(1);
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
