/** @jest-environment node */
/**
 * A member buys packs in the Store, opens them, breaks two copies down for their realm's dust and crafts a Common at
 * exactly the previewed price. The real routers and modules run on the in-memory Prisma, then on the scratch Postgres
 * with the races a mock cannot prove: two opens of one pack, a pack open against a break-down over the same cards, two
 * new-copy sources at the last free slot, and a dust credit at the Int ceiling.
 *
 * Folds card-packs-notices, card-packs-open-faces, workshop-numbers and ledger-bypass-routes (the VT-4/5/23
 * regression: a purchase goes through the ledger, its switches and its counters).
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
import { TRPCError } from "@trpc/server";
import { assertCapacityTx, lockedCopyRoomTx } from "~/lib/cards/capacity";
import { craftQuote, dustYield } from "~/lib/cards/dust";
import { getEconomyConfig } from "~/lib/cards/economy-config";
import { mintCopy } from "~/lib/cards/mint";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { cardPacksUserRouter } from "~/server/api/routers/card-packs/user";
import { craftingRouter } from "~/server/api/routers/crafting";
import { breakDownCopies } from "~/server/modules/cards/workshop/breakdown";
import { creditDustTx, MAX_DUST_BALANCE } from "~/server/modules/cards/workshop/dust-ledger";
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
const packs = createCallerFactory(cardPacksUserRouter);
const workshop = createCallerFactory(craftingRouter);

interface World {
  db: PrismaClient;
  p: string;
  alice: Player;
  realmId: string;
  epicPack: string;
  ultraPack: string;
  common: string;
}

/** Alice holds 1,000 IxC. Her realm has three Epics, one Ultra Rare and a Common; two packs draw only from it. */
async function seed(db: PrismaClient, p: string): Promise<World> {
  const { id: realmId } = await addRealm(db, `${p}realm`);
  const alice = await addPlayer(db, `${p}alice`, 1000);
  for (const [n, rarity] of [
    ["e1", "EPIC"],
    ["e2", "EPIC"],
    ["e3", "EPIC"],
    ["u1", "ULTRA_RARE"],
    ["c1", "COMMON"],
  ] as const) {
    await addCard(db, { id: `${p}${n}`, realmId, rarity });
  }
  await addPack(db, { id: `${p}epic5`, realmId, priceCredits: 100, cardCount: 5, rarity: "EPIC" });
  await addPack(db, {
    id: `${p}ultra1`,
    realmId,
    priceCredits: 50,
    cardCount: 1,
    rarity: "ULTRA_RARE",
  });
  return {
    db,
    p,
    alice,
    realmId,
    epicPack: `${p}epic5`,
    ultraPack: `${p}ultra1`,
    common: `${p}c1`,
  };
}

const copiesOf = (db: PrismaClient, ownerId: string) =>
  db.cardOwnership.findMany({
    where: { ownerId },
    select: {
      id: true,
      cardId: true,
      serialNumber: true,
      finish: true,
      cards: { select: { rarity: true } },
    },
    orderBy: { id: "asc" },
  });

/** The flow both clients run: buy, open, refuse a second open, break down, read the numbers, craft. */
async function packToDust(w: World) {
  const { db, alice } = w;
  const store = packs(callerContext(db, alice));

  // Buy: the ledger takes the price once and the pack waits unopened
  const bought = await store.purchasePack({ packId: w.epicPack });
  expect(bought.success).toBe(true);
  expect(create).toHaveBeenCalledWith({
    userId: alice.id,
    title: "Pack bought",
    message: "Your card pack is ready to open.",
    type: "info",
    priority: "medium",
    category: "packs",
    source: "cards",
    href: null,
    metadata: { packId: w.epicPack },
  });
  expect((await creditsOf(db, [alice.id]))[alice.id]).toBe(900);
  expect(await ledgerOf(db, alice.id)).toEqual([
    { credits: -100, balanceAfter: 900, type: "SPEND_PACKS", source: "PACK_PURCHASE" },
  ]);
  expect(
    await db.myVault.findUnique({ where: { userId: alice.id }, select: { lifetimeSpent: true } })
  ).toEqual({
    lifetimeSpent: 100,
  });
  const waiting = await store.getMyPacks({ isOpened: false });
  expect(waiting.packs.map((up) => up.id)).toEqual([bought.userPack.id]);

  // Open: five Epics minted, each with a rolled finish and a PACK_OPEN mint row, returned as faces in pull order
  create.mockClear();
  const opened = await store.openPack({ userPackId: bought.userPack.id });
  expect(opened).not.toHaveProperty("cards");
  const copies = await copiesOf(db, alice.id);
  expect(copies).toHaveLength(5);
  expect(opened.faces.map((f) => f.copy?.ownershipId).sort()).toEqual(
    copies.map((c) => c.id).sort()
  );
  expect(opened.faces.every((f) => f.rarity === "EPIC" && !f.uncollected)).toBe(true);
  const serials = copies.map((c) => `${c.cardId}#${c.serialNumber}`);
  expect(new Set(serials).size).toBe(5);
  expect(
    await db.cardTransferEvent.count({
      where: { ownershipId: { in: copies.map((c) => c.id) }, action: "PACK_OPEN" },
    })
  ).toBe(5);
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: alice.id,
      title: "Cards revealed",
      message: "5 cards. Best: Epic.",
      category: "packs",
      priority: "high",
      metadata: { cardCount: 5, bestRarity: "EPIC" },
    })
  );

  // A second open of the same pack is refused and mints nothing
  await expect(store.openPack({ userPackId: bought.userPack.id })).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(await db.cardOwnership.count({ where: { ownerId: alice.id } })).toBe(5);

  // A one-card pack's notice is singular, and an Ultra Rare best pull is not high priority
  const single = await store.purchasePack({ packId: w.ultraPack });
  create.mockClear();
  await store.openPack({ userPackId: single.userPack.id });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ message: "1 card. Best: Ultra Rare.", priority: "medium" })
  );
  expect((await creditsOf(db, [alice.id]))[alice.id]).toBe(850);

  // Break two Epic copies down: the realm's dust is the sum of their yields, one BREAKDOWN row each, and they burn
  const cfg = await getEconomyConfig(db);
  const burned = copies.slice(0, 2);
  const expected = burned.reduce(
    (sum, c) =>
      sum + dustYield({ rarity: c.cards.rarity, finish: c.finish, importDiscounted: false }, cfg),
    0
  );
  const crafting = workshop(callerContext(db, alice));
  expect(await crafting.breakDown({ ownershipIds: burned.map((c) => c.id) })).toEqual({
    broken: 2,
    dust: [{ realmId: w.realmId, amount: expected }],
  });
  expect(await crafting.getDust()).toEqual([
    expect.objectContaining({ realmId: w.realmId, balance: expected }),
  ]);
  expect(
    await db.cardDustEvent.count({
      where: { userId: alice.id, source: "BREAKDOWN", delta: { gt: 0 } },
    })
  ).toBe(2);
  expect(await db.cardOwnership.count({ where: { id: { in: burned.map((c) => c.id) } } })).toBe(0);
  expect(
    await db.cardTransferEvent.findMany({
      where: { action: "BREAKDOWN", fromUserId: alice.id },
      select: { cardId: true, serialNumber: true, finish: true, toUserId: true },
      orderBy: { serialNumber: "asc" },
    })
  ).toEqual(
    expect.arrayContaining(
      burned.map((c) => ({
        cardId: c.cardId,
        serialNumber: c.serialNumber,
        finish: c.finish,
        toUserId: null,
      }))
    )
  );

  // Craft a Common at the previewed price: credits (SPEND_CRAFT), then dust (a CRAFT event), then one Standard copy
  const numbers = await crafting.getNumbers();
  const quote = craftQuote("COMMON", numbers.economy, numbers.valuation);
  const before = (await creditsOf(db, [alice.id]))[alice.id]!;
  const crafted = await crafting.craft({ cardId: w.common });
  expect(crafted).toMatchObject({ dust: quote.dust, credits: quote.credits });
  expect((await creditsOf(db, [alice.id]))[alice.id]).toBeCloseTo(before - quote.credits, 2);
  expect((await crafting.getDust())[0]?.balance).toBe(expected - quote.dust);
  expect((await ledgerOf(db, alice.id)).at(-1)).toMatchObject({
    credits: -quote.credits,
    type: "SPEND_CRAFT",
    source: "card_craft",
  });
  expect(
    await db.cardDustEvent.findFirst({
      where: { userId: alice.id, source: "CRAFT" },
      select: { delta: true },
    })
  ).toEqual({ delta: -quote.dust });
  expect(
    await db.cardOwnership.findUnique({
      where: { id: crafted.ownershipId },
      select: { cardId: true, finish: true },
    })
  ).toEqual({ cardId: w.common, finish: "STANDARD" });
  expect(
    await db.cardTransferEvent.count({
      where: { ownershipId: crafted.ownershipId, action: "CRAFT" },
    })
  ).toBe(1);
  return { numbers, quote };
}

beforeEach(() => {
  clearEconomyCaches();
  create.mockReset().mockResolvedValue("n1" as never);
});

describe("cards-pack-to-dust (memory)", () => {
  let db: MemoryPrisma;
  let w: World;

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it("buys, opens, breaks down and crafts at the stored numbers, in the lock order", async () => {
    // The Economy tab as stored, none of it the defaults: the craft is previewed and charged from these
    await db.systemConfig.createMany({
      data: [
        { key: "card_economy_dust_rare", value: "60" },
        { key: "card_valuation_floor_common", value: "12" },
        { key: "card_system_auction_rake_pct", value: "7" },
      ],
    });
    const log = db.store.log;
    const { numbers, quote } = await packToDust(w);
    expect(numbers.economy.dustRare).toBe(60);
    expect(numbers.valuation.floorCommon).toBe(12);
    expect(numbers.feeRatePct).toBe(7);
    expect(quote.credits).toBe(12);

    // The craft's lock order: the my_vault row, the dust row, capacity (7334), the serial (7331), then the copy
    const craftStart = log.map((e) => e.kind === "write" && e.model === "MyVault").lastIndexOf(true);
    const order = log
      .slice(craftStart)
      .map((e) =>
        e.kind === "advisory" ? `lock ${e.ns}` : e.kind === "write" ? `${e.model}.${e.op}` : e.kind
      )
      .filter((e) => /^lock|MyVault|CardDustBalance|CardOwnership/.test(e));
    expect(order).toEqual([
      "MyVault.updateMany",
      "CardDustBalance.updateMany",
      "lock 7334",
      "lock 7331",
      "CardOwnership.create",
    ]);
  });

  it("still completes a purchase whose notice fails", async () => {
    create.mockRejectedValueOnce(new Error("down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(
        packs(callerContext(db as never, w.alice)).purchasePack({ packId: w.epicPack })
      ).resolves.toMatchObject({
        success: true,
      });
    } finally {
      warn.mockRestore();
    }
  });

  it("still reports a committed open whose faces cannot be read, so a retry is not refused", async () => {
    const store = packs(callerContext(db as never, w.alice));
    const bought = await store.purchasePack({ packId: w.ultraPack });
    // The open commits on the transaction's client; the face read after it is the first on the app's client
    jest.spyOn(db.cardOwnership, "findMany").mockRejectedValueOnce(new Error("connection reset"));
    const quiet = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(await store.openPack({ userPackId: bought.userPack.id })).toMatchObject({
        success: true,
        faces: [],
      });
      expect(quiet).toHaveBeenCalledWith(
        "[Cards] A pack open committed, but its faces could not be read:",
        expect.any(Error)
      );
    } finally {
      quiet.mockRestore();
    }
    expect(await db.cardOwnership.count({ where: { ownerId: w.alice.id } })).toBe(1);
  });

  // Code audit VT-4/5/23: pack purchases once wrote myVault directly, skipping the ledger's switches and counters
  it("is closed by maintenance mode and the packs switch, charging nothing and granting no pack", async () => {
    const buy = () =>
      packs(callerContext(db as never, w.alice)).purchasePack({ packId: w.epicPack });
    await db.systemConfig.create({ data: { key: "vault_isMaintenanceMode", value: "true" } });
    await expect(buy()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/maintenance/),
    });
    await db.systemConfig.update({
      where: { key: "vault_isMaintenanceMode" },
      data: { value: "false" },
    });
    await db.systemConfig.create({ data: { key: "vault_isPacksEnabled", value: "false" } });
    clearEconomyCaches();
    await expect(buy()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/disabled/),
    });
    expect((await creditsOf(db as never, [w.alice.id]))[w.alice.id]).toBe(1000);
    expect(await db.userPack.count({ where: { userId: w.alice.id } })).toBe(0);
    expect(await ledgerOf(db as never, w.alice.id)).toEqual([]);
  });

  it("never sells a pack whose odds or guarantee name a rarity its pool has no card of", async () => {
    const buy = (packId: string) =>
      packs(callerContext(db as never, w.alice)).purchasePack({ packId });
    // The default odds give every rarity; the realm has no Uncommon, Rare or Legendary card
    await db.cardPack.create({
      data: {
        id: "m-default",
        name: "Default",
        packType: "BASIC",
        priceCredits: 150,
        cardCount: 5,
        themeFilter: { realmIds: [w.realmId] },
      },
    });
    await expect(buy("m-default")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "This pack is not on sale right now: it has no Uncommon, Rare and Legendary cards to give.",
    });
    // Odds of Epic only, but a Legendary guarantee
    await db.cardPack.update({
      where: { id: w.epicPack },
      data: { guaranteedRarity: "LEGENDARY" },
    });
    await expect(buy(w.epicPack)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This pack is not on sale right now: it has no Legendary cards to give.",
    });
    expect((await creditsOf(db as never, [w.alice.id]))[w.alice.id]).toBe(1000);
    expect(await db.userPack.count({ where: { userId: w.alice.id } })).toBe(0);
  });

  it("refuses a pack the buyer cannot afford, charging nothing and granting no pack", async () => {
    await db.myVault.update({ where: { userId: w.alice.id }, data: { credits: 99 } });
    await expect(
      packs(callerContext(db as never, w.alice)).purchasePack({ packId: w.epicPack })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await creditsOf(db as never, [w.alice.id]))[w.alice.id]).toBe(99);
    expect(await db.userPack.count({ where: { userId: w.alice.id } })).toBe(0);
  });
});

describeWithDb("cards-pack-to-dust (Postgres)", () => {
  const db = scenarioDb();
  let w: World;

  beforeEach(async () => {
    mockDb = db;
    w = await seed(db, prefix());
  });
  afterEach(() => removeWorld(db, w.p));
  afterAll(() => db.$disconnect());

  it("buys, opens, breaks down and crafts at the previewed price", async () => {
    await packToDust(w);
  });

  it("lets one of two concurrent opens of one pack mint; the other reads CONFLICT and mints nothing", async () => {
    const bought = await packs(callerContext(db, w.alice)).purchasePack({ packId: w.epicPack });
    const open = () =>
      packs(callerContext(db, w.alice)).openPack({ userPackId: bought.userPack.id });
    const results = await Promise.allSettled([open(), open()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(lost?.reason).toBeInstanceOf(TRPCError);
    expect(lost?.reason.code).toBe("CONFLICT");
    expect(await db.cardOwnership.count({ where: { ownerId: w.alice.id } })).toBe(5);
  });

  it("runs a pack open and a break-down over the same cards at once without a deadlock", async () => {
    const store = packs(callerContext(db, w.alice));
    const first = await store.purchasePack({ packId: w.epicPack });
    await store.openPack({ userPackId: first.userPack.id });
    const owned = await copiesOf(db, w.alice.id);
    // The break-down names the cards in the opposite id order to the pack's mint order
    const burn = [...owned].sort((a, b) => (a.cardId < b.cardId ? 1 : -1)).slice(0, 3);
    const second = await store.purchasePack({ packId: w.epicPack });
    const results = await Promise.allSettled([
      store.openPack({ userPackId: second.userPack.id }),
      breakDownCopies(db, { userId: w.alice.id, ownershipIds: burn.map((c) => c.id) }),
    ]);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONFLICT" });
    }
    const left = await db.cardOwnership.count({ where: { ownerId: w.alice.id } });
    const opened = results[0].status === "fulfilled" ? 5 : 0;
    const broken = results[1].status === "fulfilled" ? 3 : 0;
    expect(left).toBe(5 + opened - broken);
  });

  it("lets only one of two new-copy sources take the last free slot (lock 7334)", async () => {
    // Fill the collection to one short of its capacity, then race two single-copy mints
    const room = await db.$transaction((tx) => lockedCopyRoomTx(tx, w.alice.id));
    await db.cardOwnership.createMany({
      data: Array.from({ length: room - 1 }, (_, i) => ({
        cardId: w.common,
        ownerId: w.alice.id,
        serialNumber: 1000 + i,
      })),
    });
    const mintOne = (cardId: string) =>
      db.$transaction(async (tx) => {
        await assertCapacityTx(tx, w.alice.id, 1);
        return mintCopy(tx, { cardId, ownerId: w.alice.id, source: "ADMIN" });
      });
    const results = await Promise.allSettled([mintOne(`${w.p}e1`), mintOne(`${w.p}u1`)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.cardOwnership.count({ where: { ownerId: w.alice.id } })).toBe(room);
  });

  it("takes the dust credit that fills the Int column and refuses the one that would pass it", async () => {
    const credit = (amount: number) =>
      db.$transaction((tx) =>
        creditDustTx(tx, {
          userId: w.alice.id,
          realmId: w.realmId,
          source: "BREAKDOWN",
          entries: [{ amount }],
        })
      );
    await credit(MAX_DUST_BALANCE - 10);
    expect(await credit(10)).toBe(MAX_DUST_BALANCE);
    await expect(credit(1)).rejects.toThrow(/can't go past/);
    expect(
      await db.cardDustBalance.findUnique({
        where: { userId_realmId: { userId: w.alice.id, realmId: w.realmId } },
        select: { balance: true },
      })
    ).toEqual({ balance: MAX_DUST_BALANCE });
  });
});
