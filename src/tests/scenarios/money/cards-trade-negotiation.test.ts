/** @jest-environment node */
/**
 * Alice offers two copies for Bob's one plus 300 IxC; Bob counters on the same row (250 IxC), so the revision goes up,
 * the roles swap and the locks move to his copy; Alice accepts at that revision. Both sides' copies move in one
 * transaction, Bob's IxC leg pays Alice net of the fee with the nation owner's royalty out of it, the cross-realm XP is
 * doubled, and the Trades list says whose turn it is at each step. A second trade is withdrawn and a third expires
 * through the job. On Postgres: an accept racing a withdraw, an accept racing a counter at one revision, and the
 * responder's copy listed while the accept runs.
 *
 * Folds trading-queries: `myTurn` and the live-PENDING read, checked on the Trades list after each step.
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

  it("refuses an accept while the responder lists the copy it gives, moving nothing", async () => {
    const offer = await offers(callerContext(db, w.alice)).createtradeOffer({
      partnerId: w.bob.id,
      initiatorCardIds: [w.a[1]],
      recipientCardIds: [w.b1],
    });
    const [accept, listing] = await Promise.allSettled([
      offers(callerContext(db, w.bob)).respondToTrade({
        tradeId: offer.id,
        action: "ACCEPT",
        revision: 0,
      }),
      listings(callerContext(db, w.bob)).createListing({ ownershipId: w.b1, price: 50 }),
    ]);
    expect([accept.status, listing.status].sort()).toEqual(["fulfilled", "rejected"]);
    if (accept.status === "rejected") {
      expect(accept.reason).toMatchObject({ code: "CONFLICT" });
      expect(await owners(db, [w.a[1], w.b1])).toEqual({ [w.a[1]]: w.alice.id, [w.b1]: w.bob.id });
      expect(await locks(db, [w.a[1], w.b1])).toEqual({ [w.a[1]]: true, [w.b1]: true });
    } else {
      expect(await owners(db, [w.a[1], w.b1])).toEqual({ [w.a[1]]: w.bob.id, [w.b1]: w.alice.id });
      expect(await db.cardListing.count({ where: { ownershipId: w.b1 } })).toBe(0);
    }
  });
});
