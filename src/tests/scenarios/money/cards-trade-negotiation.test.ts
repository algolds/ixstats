/** @jest-environment node */
/**
 * Alice offers two copies for Bob's one plus 300 IxC; Bob counters on the same row (250 IxC), so the revision goes up,
 * the roles swap and the locks move to his copy; Alice accepts at that revision. Both sides' copies move in one
 * transaction, Bob's IxC leg pays Alice net of the fee with the nation owner's royalty out of it, the cross-realm XP is
 * doubled, and the Trades list says whose turn it is at each step. A second trade is withdrawn and a third expires
 * through the job. On Postgres: an accept racing a withdraw, an accept racing a counter at one revision, and the
 * responder's copy listed while the accept runs.
 *
 * Folds trading-queries: `myTurn` and the live-PENDING read, checked on the Trades list after each step. Folds the
 * trade-service (offers, counter, accept), trade-settlement, credit-leg, trade-queries and market-art suites: what an
 * offer, an accept and a counter refuse (yourself, credits alone, one copy twice, a blocking partner, bound, not yours,
 * listed, unaffordable, maintenance, trading off, expired, signed after the table, a payer who can no longer pay), each
 * moving nothing; the fee preview; a trade hidden from anyone outside it; a gift; a withdraw while trading is off.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(
    async (ids: string[]) =>
      new Map(ids.map((id) => [id, { displayName: `Player ${id.split("-").at(-1)}`, handle: id }]))
  ),
}));

import type { PrismaClient } from "@prisma/client";
import { processExpiredTrades } from "~/lib/economy/trade-expiry-cron";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketListingsRouter } from "~/server/api/routers/card-market/listings";
import { tradingOffersRouter } from "~/server/api/routers/trading/offers";
import { tradingQueriesRouter } from "~/server/api/routers/trading/queries";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addCard,
  addCopy,
  addCountry,
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
const offers = createCallerFactory(tradingOffersRouter);
const queries = createCallerFactory(tradingQueriesRouter);
const listings = createCallerFactory(cardMarketListingsRouter);

interface World {
  db: PrismaClient;
  p: string;
  alice: Player;
  bob: Player;
  nia: Player;
  /** Alice's: a nation card of Nia's and three Lore cards, all of her realm. */
  a: [string, string, string, string];
  /** Bob's: a Lore card of his own realm. */
  b1: string;
}

async function seed(db: PrismaClient, p: string): Promise<World> {
  const { id: north } = await addRealm(db, `${p}north`);
  const { id: south } = await addRealm(db, `${p}south`);
  const alice = await addPlayer(db, `${p}alice`, 1000);
  const bob = await addPlayer(db, `${p}bob`, 1000);
  const nia = await addPlayer(db, `${p}nia`, 0);
  const { id: countryId } = await addCountry(db, `${p}aurelia`, north, nia.id);
  await addCard(db, {
    id: `${p}nation`,
    realmId: north,
    rarity: "RARE",
    cardType: "NATION",
    title: "Aurelia",
    countryId,
  });
  await addCard(db, { id: `${p}lore`, realmId: north, rarity: "COMMON", title: "North Lore" });
  await addCard(db, { id: `${p}south`, realmId: south, rarity: "RARE", title: "South Lore" });
  const a = [`${p}a1`, `${p}a2`, `${p}a3`, `${p}a4`] as World["a"];
  await addCopy(db, { id: a[0], cardId: `${p}nation`, ownerId: alice.id, serialNumber: 1 });
  for (const [i, id] of a.slice(1).entries()) {
    await addCopy(db, { id, cardId: `${p}lore`, ownerId: alice.id, serialNumber: i + 1 });
  }
  const b1 = `${p}b1`;
  await addCopy(db, { id: b1, cardId: `${p}south`, ownerId: bob.id, serialNumber: 1 });
  return { db, p, alice, bob, nia, a, b1 };
}

const locks = async (db: PrismaClient, ids: string[]) =>
  Object.fromEntries(
    (
      await db.cardOwnership.findMany({
        where: { id: { in: ids } },
        select: { id: true, isLocked: true },
      })
    ).map((c) => [c.id, c.isLocked])
  );
const owners = async (db: PrismaClient, ids: string[]) =>
  Object.fromEntries(
    (
      await db.cardOwnership.findMany({
        where: { id: { in: ids } },
        select: { id: true, ownerId: true },
      })
    ).map((c) => [c.id, c.ownerId])
  );
/** The Trades list as a player reads it: each open trade's id and whether it waits on them. */
const turns = async (db: PrismaClient, player: Player) =>
  (await queries(callerContext(db, player)).getActiveTrades()).map((t) => [t.id, t.myTurn]);

async function tradeNegotiation(w: World) {
  const { db, alice, bob, nia } = w;
  const [a1, a2, a3, a4] = w.a;

  // Alice offers a1 and a2 for Bob's b1 and 300 IxC: her copies lock, and it is Bob's turn
  const offer = await offers(callerContext(db, alice)).createtradeOffer({
    partnerId: bob.id,
    initiatorCardIds: [a1, a2],
    recipientCardIds: [w.b1],
    recipientCredits: 300,
  });
  expect(offer).toMatchObject({ revision: 0, proposerId: alice.id, status: "PENDING" });
  expect(await locks(db, [a1, a2, w.b1])).toEqual({ [a1]: true, [a2]: true, [w.b1]: false });
  expect(await turns(db, bob)).toEqual([[offer.id, true]]);
  expect(await turns(db, alice)).toEqual([[offer.id, false]]);

  // Bob counters on the same row at 250 IxC: revision 1, roles swapped, the locks follow, and it is Alice's turn
  create.mockClear();
  const countered = await offers(callerContext(db, bob)).counterTrade({
    tradeId: offer.id,
    revision: 0,
    initiatorCardIds: [a1, a2],
    recipientCardIds: [w.b1],
    recipientCredits: 250,
  });
  expect(countered).toMatchObject({ id: offer.id, revision: 1, proposerId: bob.id });
  expect(await locks(db, [a1, a2, w.b1])).toEqual({ [a1]: false, [a2]: false, [w.b1]: true });
  expect(await turns(db, alice)).toEqual([[offer.id, true]]);
  expect(await turns(db, bob)).toEqual([[offer.id, false]]);
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ userId: alice.id, title: "Counter-offer" })
  );

  // An answer to the old revision is stale; Alice accepts the one she saw
  await expect(
    offers(callerContext(db, alice)).respondToTrade({
      tradeId: offer.id,
      action: "ACCEPT",
      revision: 0,
    })
  ).rejects.toMatchObject({ code: "CONFLICT" });
  create.mockClear();
  const accepted = await offers(callerContext(db, alice)).respondToTrade({
    tradeId: offer.id,
    action: "ACCEPT",
    revision: 1,
  });
  expect(accepted).toMatchObject({ status: "ACCEPTED", isCrossRealm: true });
  expect(await owners(db, [a1, a2, w.b1])).toEqual({
    [a1]: bob.id,
    [a2]: bob.id,
    [w.b1]: alice.id,
  });
  expect(await locks(db, [a1, a2, w.b1])).toEqual({ [a1]: false, [a2]: false, [w.b1]: false });
  // Bob's 250 pays Alice net of the 25 IxC fee; Nia, whose nation card Bob receives, gets 2% out of that fee
  expect(await creditsOf(db, [alice.id, bob.id, nia.id])).toEqual({
    [alice.id]: 1225,
    [bob.id]: 750,
    [nia.id]: 5,
  });
  expect(await ledgerOf(db, nia.id)).toEqual([
    expect.objectContaining({ credits: 5, type: "EARN_CARDS", source: "nation_card_royalty" }),
  ]);
  // Every copy moved earned the doubled cross-realm XP, and each move is on its trail
  expect(
    await db.cardExperienceEvent.findMany({
      where: { ownershipId: { in: [a1, a2, w.b1] } },
      select: { source: true, amount: true },
    })
  ).toEqual([
    { source: "CROSS_REALM_TRADE", amount: 50 },
    { source: "CROSS_REALM_TRADE", amount: 50 },
    { source: "CROSS_REALM_TRADE", amount: 50 },
  ]);
  expect(
    await db.cardTransferEvent.count({
      where: { ownershipId: { in: [a1, a2, w.b1] }, action: "TRADE" },
    })
  ).toBe(3);
  expect(create.mock.calls.map(([n]) => [n.userId, n.title])).toEqual([
    [bob.id, "Trade accepted"],
    [nia.id, "Royalty paid"],
  ]);
  expect(await turns(db, alice)).toEqual([]);

  // A second trade is withdrawn: Alice's copy is freed
  const second = await offers(callerContext(db, alice)).createtradeOffer({
    partnerId: bob.id,
    initiatorCardIds: [a3],
  });
  await expect(
    offers(callerContext(db, bob)).cancelTrade({ tradeId: second.id })
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await offers(callerContext(db, alice)).cancelTrade({ tradeId: second.id });
  expect(await locks(db, [a3])).toEqual({ [a3]: false });

  // A third runs out: it leaves the Trades list once due, and the job ends it and frees the copy
  const third = await offers(callerContext(db, alice)).createtradeOffer({
    partnerId: bob.id,
    initiatorCardIds: [a4],
  });
  await db.tradeOffer.update({
    where: { id: third.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  expect(await turns(db, bob)).toEqual([]);
  expect(await processExpiredTrades()).toMatchObject({ processed: 1, failed: 0 });
  expect(
    await db.tradeOffer.findUnique({ where: { id: third.id }, select: { status: true } })
  ).toEqual({
    status: "EXPIRED",
  });
  expect(await locks(db, [a4])).toEqual({ [a4]: false });
  return { tradeId: offer.id };
}

beforeEach(() => {
  clearEconomyCaches();
  create.mockReset().mockResolvedValue("n1" as never);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("cards-trade-negotiation (memory)", () => {
  let db: MemoryPrisma;
  let w: World;

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it("offers, counters, accepts, withdraws and expires, settling in the lock order", async () => {
    const { tradeId } = await tradeNegotiation(w);
    // The accept claimed its row first, then every vault its credit leg writes at once, then moved the copies
    const log = db.store.log;
    const claim = log.findIndex(
      (e) =>
        e.kind === "write" &&
        e.model === "TradeOffer" &&
        e.op === "updateMany" &&
        e.where?.id === tradeId &&
        e.where?.revision === 1
    );
    const vaults = log.findIndex((e, i) => i > claim && e.kind === "vaults");
    const copies = log.findIndex(
      (e, i) => i > vaults && e.kind === "write" && e.model === "CardOwnership"
    );
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(log[vaults]).toEqual({
      kind: "vaults",
      userIds: [w.alice.id, w.bob.id, w.nia.id].sort(),
    });
    expect(copies).toBeGreaterThan(vaults);
  });

  it("gives the doubled XP once per partner a day", async () => {
    await tradeNegotiation(w);
    // A second cross-realm trade with Bob the same day: plain trade XP
    const next = await offers(callerContext(db as never, w.bob)).createtradeOffer({
      partnerId: w.alice.id,
      initiatorCardIds: [w.a[0]],
      recipientCardIds: [w.b1],
    });
    await offers(callerContext(db as never, w.alice)).respondToTrade({
      tradeId: next.id,
      action: "ACCEPT",
      revision: 0,
    });
    expect(
      await db.cardExperienceEvent.findMany({
        where: { ownershipId: w.a[0] },
        select: { source: true },
        orderBy: { createdAt: "asc" },
      })
    ).toEqual([{ source: "CROSS_REALM_TRADE" }, { source: "TRADE" }]);
  });
});

type OfferInput = Parameters<ReturnType<typeof offers>["createtradeOffer"]>[0];
type CounterTable = Omit<
  Parameters<ReturnType<typeof offers>["counterTrade"]>[0],
  "tradeId" | "revision"
>;

describe("cards-trade-negotiation (memory): what a trade refuses", () => {
  let db: MemoryPrisma;
  let w: World;
  const as = (player: Player) => offers(callerContext(db as never, player));
  const setConfig = async (key: string, value: string) => {
    await db.systemConfig.create({ data: { key, value } });
    clearEconomyCaches();
  };
  const signed = (id: string, inscribedAt: Date) =>
    db.cardOwnership.update({
      where: { id },
      data: { inscription: "gg", inscribedById: "m-bob", inscribedName: "@bob", inscribedAt },
    });

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it.each<[string, () => Promise<unknown>, (w: World) => OfferInput, object]>([
    [
      "a trade with yourself",
      async () => undefined,
      (w) => ({ partnerId: w.alice.id, initiatorCardIds: [w.a[1]] }),
      { code: "BAD_REQUEST", message: "Choose another player to trade with." },
    ],
    [
      "credits alone",
      async () => undefined,
      (w) => ({ partnerId: w.bob.id, initiatorCredits: 100 }),
      { code: "BAD_REQUEST", message: "Add at least one card. Credits alone can't be traded." },
    ],
    [
      "one copy twice",
      async () => undefined,
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.a[1], w.a[1]] }),
      { code: "BAD_REQUEST", message: "A card can only be in the trade once." },
    ],
    [
      "to a player who blocked you",
      () =>
        db.userConnection.create({
          data: { userId: "m-bob-clerk", targetUserId: "m-alice-clerk", connectionType: "blocked" },
        }),
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.a[1]] }),
      { code: "FORBIDDEN", message: "This player isn't taking trade offers from you." },
    ],
    [
      "a bound card's copy",
      () => db.card.update({ where: { id: "m-lore" }, data: { isBound: true } }),
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.a[1]] }),
      { code: "PRECONDITION_FAILED" },
    ],
    [
      "the other player's copy as yours",
      async () => undefined,
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.b1] }),
      { code: "CONFLICT", message: "Some cards in this trade are no longer that player's." },
    ],
    [
      "a listed copy",
      () => db.cardOwnership.update({ where: { id: "m-a2" }, data: { isLocked: true } }),
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.a[1]] }),
      {
        code: "CONFLICT",
        message: "Some cards in this trade are listed, at auction or in another trade.",
      },
    ],
    [
      "more credits than you hold",
      async () => undefined,
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.a[2]], initiatorCredits: 1001 }),
      { code: "BAD_REQUEST", message: "You don't have enough IxCredits for this trade." },
    ],
    [
      "in maintenance",
      () => setConfig("vault_isMaintenanceMode", "true"),
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.a[2]] }),
      { code: "BAD_REQUEST", message: "Vault economy is currently in maintenance mode." },
    ],
    [
      "while trading is switched off",
      () => setConfig("vault_isTradingEnabled", "false"),
      (w) => ({ partnerId: w.bob.id, initiatorCardIds: [w.a[2]] }),
      { code: "BAD_REQUEST", message: "Card trading is switched off right now." },
    ],
  ])("refuses to offer %s, locking nothing", async (_label, make, input, refusal) => {
    await make();
    const before = await locks(db as never, w.a);
    await expect(as(w.alice).createtradeOffer(input(w))).rejects.toMatchObject(refusal);
    expect(await locks(db as never, w.a)).toEqual(before);
    expect(await db.tradeOffer.count()).toBe(0);
  });

  /** Alice offers a2 and 100 IxC for Bob's b1. */
  const paidOffer = () =>
    as(w.alice).createtradeOffer({
      partnerId: w.bob.id,
      initiatorCardIds: [w.a[1]],
      initiatorCredits: 100,
      recipientCardIds: [w.b1],
    });

  it.each<[string, (tradeId: string) => Promise<unknown>, (w: World) => Player, object]>([
    [
      "your own table",
      async () => undefined,
      (w) => w.alice,
      { code: "FORBIDDEN", message: "Wait for the other player to respond." },
    ],
    [
      "a table that has expired",
      (id) =>
        db.tradeOffer.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } }),
      (w) => w.bob,
      { code: "BAD_REQUEST" },
    ],
    [
      "while trading is switched off",
      () => setConfig("vault_isTradingEnabled", "false"),
      (w) => w.bob,
      { code: "BAD_REQUEST" },
    ],
    [
      "once the copy it asks for is listed",
      () => db.cardOwnership.update({ where: { id: "m-b1" }, data: { isLocked: true } }),
      (w) => w.bob,
      { code: "CONFLICT" },
    ],
    [
      "once the copy it asks for was signed after the table was written",
      () => signed("m-b1", new Date(Date.now() + 60_000)),
      (w) => w.bob,
      { code: "CONFLICT" },
    ],
    [
      "once the payer can no longer pay",
      () => db.myVault.update({ where: { userId: "m-alice" }, data: { credits: 50 } }),
      (w) => w.bob,
      { code: "BAD_REQUEST" },
    ],
  ])("refuses to accept %s, moving nothing", async (_label, make, responder, refusal) => {
    const offer = await paidOffer();
    await make(offer.id);
    const credits = await creditsOf(db as never, [w.alice.id, w.bob.id]);
    await expect(
      as(responder(w)).respondToTrade({ tradeId: offer.id, action: "ACCEPT", revision: 0 })
    ).rejects.toMatchObject(refusal);
    expect(await owners(db as never, [w.a[1], w.b1])).toEqual({
      [w.a[1]]: w.alice.id,
      [w.b1]: w.bob.id,
    });
    expect(await creditsOf(db as never, [w.alice.id, w.bob.id])).toEqual(credits);
    expect(
      await db.tradeOffer.findUniqueOrThrow({ where: { id: offer.id }, select: { status: true } })
    ).toEqual({ status: "PENDING" });
  });

  it("accepts a copy signed before the table was written", async () => {
    await signed("m-b1", new Date(Date.now() - 60_000));
    const offer = await paidOffer();
    await expect(
      as(w.bob).respondToTrade({ tradeId: offer.id, action: "ACCEPT", revision: 0 })
    ).resolves.toMatchObject({ status: "ACCEPTED" });
  });

  it.each<
    [string, () => Promise<unknown>, (w: World) => Player, (w: World) => CounterTable, object]
  >([
    [
      "the proposer countering their own table",
      async () => undefined,
      (w) => w.alice,
      (w) => ({ initiatorCardIds: [w.a[1]], recipientCardIds: [w.b1] }),
      { code: "FORBIDDEN" },
    ],
    [
      "a counter asking for a copy listed elsewhere",
      () => db.cardOwnership.update({ where: { id: "m-a3" }, data: { isLocked: true } }),
      (w) => w.bob,
      (w) => ({ initiatorCardIds: [w.a[1], w.a[2]], recipientCardIds: [w.b1] }),
      { code: "CONFLICT" },
    ],
    [
      "a counter offering credits the counterer lacks",
      async () => undefined,
      (w) => w.bob,
      (w) => ({ initiatorCardIds: [w.a[1]], recipientCardIds: [w.b1], recipientCredits: 5000 }),
      { code: "BAD_REQUEST" },
    ],
  ])("refuses %s, changing nothing", async (_label, make, counterer, table, refusal) => {
    const offer = await paidOffer();
    await make();
    await expect(
      as(counterer(w)).counterTrade({ tradeId: offer.id, revision: 0, ...table(w) })
    ).rejects.toMatchObject(refusal);
    expect(
      await db.tradeOffer.findUniqueOrThrow({
        where: { id: offer.id },
        select: { revision: true, proposerId: true },
      })
    ).toEqual({ revision: 0, proposerId: w.alice.id });
    expect(await locks(db as never, [w.a[1], w.b1])).toEqual({ [w.a[1]]: true, [w.b1]: false });
  });

  it("shows each side's market fee, and hides the trade from a player outside it", async () => {
    const offer = await as(w.alice).createtradeOffer({
      partnerId: w.bob.id,
      initiatorCardIds: [w.a[1]],
      initiatorCredits: 100,
      recipientCardIds: [w.b1],
      recipientCredits: 1000,
    });
    expect(
      (await queries(callerContext(db as never, w.bob)).getTradeById({ tradeId: offer.id }))
        .feePreview
    ).toEqual({ initiator: 0, recipient: 100 });
    await expect(
      queries(callerContext(db as never, w.nia)).getTradeById({ tradeId: offer.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      as(w.nia).respondToTrade({ tradeId: offer.id, action: "ACCEPT", revision: 0 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("logs a one-sided table as a gift, never cross-realm", async () => {
    const gift = await as(w.alice).createtradeOffer({
      partnerId: w.bob.id,
      initiatorCardIds: [w.a[2]],
    });
    await expect(
      as(w.bob).respondToTrade({ tradeId: gift.id, action: "ACCEPT", revision: 0 })
    ).resolves.toMatchObject({ isCrossRealm: false });
    expect(
      await db.cardTransferEvent.findMany({
        where: { ownershipId: w.a[2], action: { in: ["GIFT", "TRADE"] } },
        select: { action: true, toUserId: true },
      })
    ).toEqual([{ action: "GIFT", toUserId: w.bob.id }]);
  });

  it("lets a player withdraw their offer while trading is switched off, freeing the copy", async () => {
    const offer = await as(w.alice).createtradeOffer({
      partnerId: w.bob.id,
      initiatorCardIds: [w.a[2]],
    });
    await setConfig("vault_isTradingEnabled", "false");
    await as(w.alice).cancelTrade({ tradeId: offer.id });
    expect(await locks(db as never, [w.a[2]])).toEqual({ [w.a[2]]: false });
  });
});

describeWithDb("cards-trade-negotiation (Postgres)", () => {
  const db = scenarioDb();
  let w: World;

  beforeEach(async () => {
    mockDb = db;
    w = await seed(db, prefix());
  });
  afterEach(() => removeWorld(db, w.p));
  afterAll(() => db.$disconnect());

  it("offers, counters, accepts, withdraws and expires", async () => {
    await tradeNegotiation(w);
  });

  it("lets an accept and a withdraw race: the copies' locks match whichever won", async () => {
    const offer = await offers(callerContext(db, w.alice)).createtradeOffer({
      partnerId: w.bob.id,
      initiatorCardIds: [w.a[1]],
      recipientCardIds: [w.b1],
    });
    const [accept, withdraw] = await Promise.allSettled([
      offers(callerContext(db, w.bob)).respondToTrade({
        tradeId: offer.id,
        action: "ACCEPT",
        revision: 0,
      }),
      offers(callerContext(db, w.alice)).cancelTrade({ tradeId: offer.id }),
    ]);
    expect([accept.status, withdraw.status].sort()).toEqual(["fulfilled", "rejected"]);
    const moved = accept.status === "fulfilled";
    expect(await owners(db, [w.a[1], w.b1])).toEqual({
      [w.a[1]]: moved ? w.bob.id : w.alice.id,
      [w.b1]: moved ? w.alice.id : w.bob.id,
    });
    expect(await locks(db, [w.a[1], w.b1])).toEqual({ [w.a[1]]: false, [w.b1]: false });
  });

  it("refuses the stale one of an accept and a counter to one revision", async () => {
    const offer = await offers(callerContext(db, w.alice)).createtradeOffer({
      partnerId: w.bob.id,
      initiatorCardIds: [w.a[1]],
      recipientCardIds: [w.b1],
    });
    const [accept, counter] = await Promise.allSettled([
      offers(callerContext(db, w.bob)).respondToTrade({
        tradeId: offer.id,
        action: "ACCEPT",
        revision: 0,
      }),
      offers(callerContext(db, w.bob)).counterTrade({
        tradeId: offer.id,
        revision: 0,
        initiatorCardIds: [w.a[1], w.a[2]],
        recipientCardIds: [w.b1],
      }),
    ]);
    expect([accept.status, counter.status].sort()).toEqual(["fulfilled", "rejected"]);
    const trade = await db.tradeOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(trade).toMatchObject(
      accept.status === "fulfilled"
        ? { status: "ACCEPTED", revision: 0 }
        : { status: "PENDING", revision: 1 }
    );
  });

  // Both wait behind a third transaction holding b1's row, so the one queued first takes b1 the moment it is free while
  // the other already holds what it took. When a listing locked the copy before the seller's vault, a listing queued
  // first held b1 and wanted Bob's vault while the accept held the vaults and wanted b1, and Postgres killed one.
  it.each([
    ["the listing", "listing"],
    ["the accept", "accept"],
  ] as const)(
    "lets a listing of the copy a paid trade gives race its accept without a deadlock: %s goes first",
    async (_label, first) => {
      const offer = await offers(callerContext(db, w.alice)).createtradeOffer({
        partnerId: w.bob.id,
        initiatorCardIds: [w.a[1]],
        initiatorCredits: 100,
        recipientCardIds: [w.b1],
      });
      const accept = () =>
        offers(callerContext(db, w.bob)).respondToTrade({
          tradeId: offer.id,
          action: "ACCEPT",
          revision: 0,
        });
      const list = () =>
        listings(callerContext(db, w.bob)).createListing({ ownershipId: w.b1, price: 50 });

      const blocker = await holdCopyRow(db, w.b1);
      const [start, next] = first === "listing" ? [list, accept] : [accept, list];
      const firstRun = Promise.allSettled([start()]);
      const firstPid = await waiterOn(db, blocker.pid);
      const secondRun = Promise.allSettled([next()]);
      await waiterOn(db, firstPid);
      await blocker.release();
      const [[won], [lost]] = await Promise.all([firstRun, secondRun]);

      expect(won).toMatchObject({ status: "fulfilled" });
      expect(lost).toMatchObject({ status: "rejected" });
      const refusal = (lost as PromiseRejectedResult).reason as Error;
      expect(refusal.message).not.toMatch(/try again/i);
      const credits = await creditsOf(db, [w.alice.id, w.bob.id]);
      if (first === "listing") {
        expect(refusal).toMatchObject({
          code: "CONFLICT",
          message: "Cards in this trade changed hands; trade cannot complete",
        });
        expect(await owners(db, [w.a[1], w.b1])).toEqual({
          [w.a[1]]: w.alice.id,
          [w.b1]: w.bob.id,
        });
        expect(await locks(db, [w.a[1], w.b1])).toEqual({ [w.a[1]]: true, [w.b1]: true });
        expect(credits).toEqual({ [w.alice.id]: 1000, [w.bob.id]: 995 });
      } else {
        expect(refusal).toMatchObject({ code: "NOT_FOUND", message: "You don't own this copy." });
        expect(await owners(db, [w.a[1], w.b1])).toEqual({
          [w.a[1]]: w.bob.id,
          [w.b1]: w.alice.id,
        });
        expect(await db.cardListing.count({ where: { ownershipId: w.b1 } })).toBe(0);
        expect(credits).toEqual({ [w.alice.id]: 900, [w.bob.id]: 1100 });
      }
    }
  );
});

/** Holds copy `id`'s row lock in a transaction of its own until `release`; `pid` is that transaction's backend. */
async function holdCopyRow(db: PrismaClient, id: string) {
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => (release = resolve));
  let held = (_pid: number): void => undefined;
  const pid = new Promise<number>((resolve) => (held = resolve));
  const done = db.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid FROM "CardOwnership" WHERE id = ${id} FOR UPDATE`;
      held(row!.pid);
      await released;
    },
    { timeout: 20_000 }
  );
  return {
    pid: await pid,
    release: () => {
      release();
      return done;
    },
  };
}

/** The backend that `pid` blocks, once one is waiting on it. */
async function waiterOn(db: PrismaClient, pid: number): Promise<number> {
  for (let tries = 0; tries < 200; tries++) {
    const [row] = await db.$queryRaw<
      { pid: number }[]
    >`SELECT pid FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
    if (row) return row.pid;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Nothing waited on backend ${pid}`);
}
