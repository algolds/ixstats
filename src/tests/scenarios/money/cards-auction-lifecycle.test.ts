/** @jest-environment node */
/**
 * A seller auctions a nation card: three bidders outbid each other (each outbid hold refunded in the same transaction,
 * a late bid extending the end by a minute), and the completion job settles the sale: the seller paid net of the fee,
 * the nation's owner the royalty out of it, the copy moved with its AUCTION_END row, and every notice sent once to the
 * right player after the commit. An unsold auction refunds the stored fee's share; a buyout under the fee threshold
 * pays no fee and is named a buyout. On Postgres: two bidders racing one minimum bid, a buyout racing the completion
 * at the end, and a cancel racing the first bid.
 *
 * Folds auction-notices: who hears what, through the notices completeAuction and executeBuyout really send. Folds
 * auction-service-ledger: every vault-taking step's lock order, what a listing, a bid and a buyout refuse (listed,
 * not yours, an unpayable fee, a buy-now at the start, the highest bidder again, an ended auction, a buyout at the
 * end), a buyout rolled back whole by a failed XP grant, and no royalty for the nation's own owner.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/server/market-broadcast-bridge", () => ({ publishMarketEvent: jest.fn() }));

import type { Prisma, PrismaClient } from "@prisma/client";
import { processExpiredAuctions } from "~/lib/economy/auction-completion-cron";
import { auctionService } from "~/lib/economy/auction-service";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
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
const market = createCallerFactory(cardMarketRouter);

interface World {
  db: PrismaClient;
  p: string;
  sam: Player;
  ann: Player;
  cy: Player;
  bob: Player;
  nia: Player;
  copies: [string, string, string];
}

/** Sam holds three copies of Aurelia, Nia's nation card; Ann, Cy and Bob have 1,000 IxC each. */
async function seed(db: PrismaClient, p: string): Promise<World> {
  const { id: realmId } = await addRealm(db, `${p}realm`);
  const sam = await addPlayer(db, `${p}sam`, 1000);
  const ann = await addPlayer(db, `${p}ann`, 1000);
  const cy = await addPlayer(db, `${p}cy`, 1000);
  const bob = await addPlayer(db, `${p}bob`, 1000);
  const nia = await addPlayer(db, `${p}nia`, 0);
  const { id: countryId } = await addCountry(db, `${p}aurelia`, realmId, nia.id);
  const card = `${p}card`;
  await addCard(db, {
    id: card,
    realmId,
    rarity: "EPIC",
    cardType: "NATION",
    title: "Aurelia",
    countryId,
  });
  const copies = [`${p}own1`, `${p}own2`, `${p}own3`] as [string, string, string];
  for (const [i, id] of copies.entries())
    await addCopy(db, { id, cardId: card, ownerId: sam.id, serialNumber: i + 1 });
  return { db, p, sam, ann, cy, bob, nia, copies };
}

const total = (b: Record<string, number>) =>
  Math.round(Object.values(b).reduce((s, v) => s + v, 0) * 100) / 100;
/**
 * The card notices sent, as [recipient, title, message] in recipient order (the bidders are read without an order),
 * leaving out the routers' own listing and bid notices.
 */
const cardNotices = () =>
  create.mock.calls
    .map(([n]) => n)
    .filter((n) => n.source === "cards")
    .map((n) => [n.userId, n.title, n.message])
    .sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0));
const byRecipient = (rows: string[][]) =>
  [...rows].sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0));
const endAuction = (db: PrismaClient, id: string) =>
  db.cardAuction.update({ where: { id }, data: { endTime: new Date(Date.now() - 1000) } });

async function auctionLifecycle(w: World, listingFee: number, refundPct: number) {
  const { db, sam, ann, cy, bob, nia } = w;
  const people = [sam.id, ann.id, cy.id, bob.id, nia.id];
  const start = total(await creditsOf(db, people));

  // Sam lists the copy for 24 hours: start 100, buy-now 1,000; the fee is charged and stored, the copy locks
  const { auction } = await market(callerContext(db, sam)).createAuction({
    cardId: w.copies[0],
    startingPrice: 100,
    buyoutPrice: 1000,
    duration: "24h",
  });
  expect(auction).toMatchObject({ listingFee, currentBid: 100, status: "ACTIVE" });
  expect(auction.endTime.getTime() - Date.now()).toBeGreaterThan(23.9 * 3_600_000);
  expect(
    await db.cardOwnership.findUnique({ where: { id: w.copies[0] }, select: { isLocked: true } })
  ).toEqual({
    isLocked: true,
  });

  // A bid must beat the current one by 5%, rounded up; each new bid holds its IxC and refunds the one it beat
  await expect(
    market(callerContext(db, ann)).placeBid({ auctionId: auction.id, amount: 104 })
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  await market(callerContext(db, ann)).placeBid({ auctionId: auction.id, amount: 105 });
  expect((await ledgerOf(db, ann.id)).at(-1)).toMatchObject({
    credits: -105,
    source: "auction_bid_reserve",
  });
  create.mockClear();
  await market(callerContext(db, cy)).placeBid({ auctionId: auction.id, amount: 111 });
  expect((await ledgerOf(db, ann.id)).at(-1)).toMatchObject({
    credits: 105,
    type: "REFUND",
    source: "auction_bid_refund",
  });
  expect(cardNotices()).toEqual([
    [ann.id, "You've been outbid", "Someone placed a higher bid of 111 IxC on Aurelia."],
  ]);

  // With under 5 minutes left, a bid adds a minute
  const late = new Date(Date.now() + 2 * 60_000);
  await db.cardAuction.update({ where: { id: auction.id }, data: { endTime: late } });
  await market(callerContext(db, bob)).placeBid({ auctionId: auction.id, amount: 117 });
  const held = await db.cardAuction.findUniqueOrThrow({ where: { id: auction.id } });
  expect(held.endTime.getTime()).toBe(late.getTime() + 60_000);
  expect(await creditsOf(db, [ann.id, cy.id, bob.id])).toEqual({
    [ann.id]: 1000,
    [cy.id]: 1000,
    [bob.id]: 883,
  });

  // The completion job settles it: Bob already paid; Sam gets 117 less the 11 IxC fee, Nia 2% out of that fee
  await endAuction(db, auction.id);
  create.mockClear();
  expect(await processExpiredAuctions()).toMatchObject({ processed: 1, failed: 0 });
  const after = await creditsOf(db, people);
  expect(after[bob.id]).toBe(883);
  expect(after[sam.id]).toBe(1000 - listingFee + 106);
  expect(after[nia.id]).toBe(2.34);
  expect(total(after)).toBe(Math.round((start - listingFee - (11 - 2.34)) * 100) / 100);
  expect((await ledgerOf(db, sam.id)).at(-1)).toMatchObject({
    credits: 106,
    type: "EARN_CARDS",
    source: "card_sale_auction",
  });
  expect(
    await db.cardOwnership.findUnique({
      where: { id: w.copies[0] },
      select: { ownerId: true, isLocked: true },
    })
  ).toEqual({ ownerId: bob.id, isLocked: false });
  expect(
    await db.cardTransferEvent.findMany({
      where: { ownershipId: w.copies[0], action: "AUCTION_END" },
      select: { fromUserId: true, toUserId: true, price: true },
    })
  ).toEqual([{ fromUserId: sam.id, toUserId: bob.id, price: 117 }]);
  expect(
    await db.cardExperienceEvent.count({
      where: { ownershipId: w.copies[0], source: "AUCTION_WIN" },
    })
  ).toBe(1);
  // Each player is told once: the winner, the seller, every other bidder, and the royalty's owner; nobody else
  expect(cardNotices()).toEqual(
    byRecipient([
      [bob.id, "You won an auction", "Aurelia is yours for 117 IxC."],
      [
        sam.id,
        "Your auction sold",
        "Aurelia sold for 117 IxC. You received 106 IxC after the market fee.",
      ],
      [ann.id, "An auction you bid on ended", "Aurelia went for 117 IxC. Your bid was refunded."],
      [cy.id, "An auction you bid on ended", "Aurelia went for 117 IxC. Your bid was refunded."],
      [
        nia.id,
        "Royalty paid",
        "A copy of your nation's card, Aurelia, changed hands. You received 2.34 IxC.",
      ],
    ])
  );
  expect(await processExpiredAuctions()).toMatchObject({ processed: 0 });

  // An auction with no bids comes back with the refund share of its stored fee, and the notice names it
  const { auction: unsold } = await market(callerContext(db, sam)).createAuction({
    cardId: w.copies[1],
    startingPrice: 100,
    duration: "3d",
  });
  await endAuction(db, unsold.id);
  create.mockClear();
  await processExpiredAuctions();
  const refund = Math.floor(listingFee * refundPct) / 100;
  expect(
    await db.cardAuction.findUnique({ where: { id: unsold.id }, select: { status: true } })
  ).toEqual({
    status: "CANCELLED",
  });
  expect((await ledgerOf(db, sam.id)).at(-1)).toMatchObject({
    credits: refund,
    type: "REFUND",
    source: "auction_fee_refund",
  });
  expect(
    await db.cardOwnership.findUnique({ where: { id: w.copies[1] }, select: { isLocked: true } })
  ).toEqual({
    isLocked: false,
  });
  expect(cardNotices()).toEqual([
    [
      sam.id,
      "Your auction ended with no bids",
      `Aurelia is back in your collection. We refunded ${refund} IxC of the listing fee.`,
    ],
  ]);

  // A buyout under the fee threshold pays no fee, refunds the high bid, and is named a buyout
  const { auction: cheap } = await market(callerContext(db, sam)).createAuction({
    cardId: w.copies[2],
    startingPrice: 50,
    buyoutPrice: 90,
    duration: "7d",
  });
  await market(callerContext(db, ann)).placeBid({ auctionId: cheap.id, amount: 53 });
  create.mockClear();
  const samBefore = (await creditsOf(db, [sam.id]))[sam.id]!;
  await market(callerContext(db, cy)).executeBuyout({ auctionId: cheap.id });
  expect((await creditsOf(db, [sam.id]))[sam.id]).toBe(samBefore + 90);
  expect((await creditsOf(db, [ann.id]))[ann.id]).toBe(1000);
  expect(
    await db.cardTransferEvent.count({
      where: { ownershipId: w.copies[2], action: "AUCTION_BUYOUT", price: 90 },
    })
  ).toBe(1);
  expect(cardNotices()).toEqual(
    byRecipient([
      [cy.id, "You won an auction", "Aurelia is yours for 90 IxC."],
      [sam.id, "Your auction was bought out", "Aurelia sold for 90 IxC. You received 90 IxC."],
      [ann.id, "An auction you bid on ended", "Aurelia went for 90 IxC. Your bid was refunded."],
    ])
  );
  return { auctionId: auction.id };
}

beforeEach(() => {
  clearEconomyCaches();
  create.mockReset().mockResolvedValue("n1" as never);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("cards-auction-lifecycle (memory)", () => {
  let db: MemoryPrisma;
  let w: World;

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it("bids, extends, settles, refunds an unsold auction and names a cheap buyout, at the stored fee", async () => {
    await db.systemConfig.createMany({
      data: [
        { key: "card_economy_listing_fee", value: "7" },
        { key: "card_economy_listing_refund_pct", value: "40" },
      ],
    });
    await auctionLifecycle(w, 7, 40);

    // Listing the auction took Sam's vault before the copy, as a trade's accept does
    const log = db.store.log;
    const copyLock = log.findIndex(
      (e) =>
        e.kind === "write" &&
        e.model === "CardOwnership" &&
        e.op === "updateMany" &&
        e.where?.id === w.copies[0] &&
        e.where?.isLocked === false
    );
    const sellerVault = log.findIndex((e) => e.kind === "vaults");
    expect(log[sellerVault]).toEqual({ kind: "vaults", userIds: [w.sam.id] });
    expect(sellerVault).toBeLessThan(copyLock);
    // Every vault-taking step locks its parties at once, in user-id order: each listing the seller, each bid the bidder
    // and the bidder it outbids, the completion the winner, the seller and the royalty's owner, the buyout the buyer,
    // the seller, the refunded bidder and the royalty's owner
    const ids = (...players: Player[]) => players.map((p) => p.id).sort();
    expect(log.filter((e) => e.kind === "vaults").map((e) => e.userIds)).toEqual([
      [w.sam.id],
      [w.ann.id],
      ids(w.ann, w.cy),
      ids(w.cy, w.bob),
      ids(w.bob, w.nia, w.sam),
      [w.sam.id],
      [w.sam.id],
      [w.ann.id],
      ids(w.cy, w.sam, w.ann, w.nia),
    ]);
  });

  it("names no refund for a free listing that ends unsold", async () => {
    await db.systemConfig.create({ data: { key: "card_economy_listing_fee", value: "0" } });
    const { auction } = await market(callerContext(db as never, w.sam)).createAuction({
      cardId: w.copies[1],
      startingPrice: 100,
      duration: "24h",
    });
    expect(auction.listingFee).toBe(0);
    await endAuction(db as never, auction.id);
    create.mockClear();
    await processExpiredAuctions();
    expect(cardNotices()).toEqual([
      [w.sam.id, "Your auction ended with no bids", "Aurelia is back in your collection."],
    ]);
    expect(await ledgerOf(db as never, w.sam.id)).toEqual([]);
  });

  it("moves no money for a bid that lost the auction it read", async () => {
    const { auction } = await market(callerContext(db as never, w.sam)).createAuction({
      cardId: w.copies[0],
      startingPrice: 100,
      duration: "24h",
    });
    // Cy's bid lands between Ann's read and her claim: her compare-and-swap loses
    const realFind = db.cardAuction.findUnique;
    // a plain promise where the client returns its own query object (the service only awaits it)
    jest.spyOn(db.cardAuction, "findUnique").mockImplementationOnce((async (
      args: Prisma.CardAuctionFindUniqueArgs
    ) => {
      const read = await realFind(args);
      await auctionService.placeBid(
        { userId: w.cy.id, auctionId: auction.id, amount: 105 },
        db as never
      );
      return read;
    }) as never);
    await expect(
      auctionService.placeBid({ userId: w.ann.id, auctionId: auction.id, amount: 106 }, db as never)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await ledgerOf(db as never, w.ann.id)).toEqual([]);
    expect((await creditsOf(db as never, [w.cy.id]))[w.cy.id]).toBe(895);
  });
});

describe("cards-auction-lifecycle (memory): what an auction refuses", () => {
  let db: MemoryPrisma;
  let w: World;
  const as = (player: Player) => market(callerContext(db as never, player));
  const list = (over: { buyoutPrice?: number } = {}) =>
    as(w.sam).createAuction({ cardId: w.copies[0], startingPrice: 100, duration: "24h", ...over });
  const moneyOf = () => creditsOf(db as never, [w.sam.id, w.ann.id, w.cy.id, w.nia.id]);

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it.each<[string, () => Promise<unknown>, (w: World) => Player, { buyoutPrice?: number }, object]>(
    [
      [
        "a copy already listed or in a trade",
        () => db.cardOwnership.update({ where: { id: "m-own1" }, data: { isLocked: true } }),
        (w) => w.sam,
        {},
        { code: "CONFLICT" },
      ],
      ["another player's copy", async () => undefined, (w) => w.ann, {}, { code: "FORBIDDEN" }],
      [
        "with a fee the seller cannot pay",
        () => db.myVault.update({ where: { userId: "m-sam" }, data: { credits: 2 } }),
        (w) => w.sam,
        {},
        { code: "BAD_REQUEST", message: expect.stringMatching(/^Insufficient/) },
      ],
      [
        "with a buy-now at the starting price",
        async () => undefined,
        (w) => w.sam,
        { buyoutPrice: 100 },
        { code: "BAD_REQUEST", message: "Buyout price must be higher than starting price" },
      ],
    ]
  )("refuses to auction %s, charging nothing", async (_label, make, seller, over, refusal) => {
    await make();
    const credits = await moneyOf();
    await expect(
      as(seller(w)).createAuction({
        cardId: w.copies[0],
        startingPrice: 100,
        duration: "24h",
        ...over,
      })
    ).rejects.toMatchObject(refusal);
    expect(await moneyOf()).toEqual(credits);
    expect(await db.cardAuction.count()).toBe(0);
  });

  it.each<[string, (auctionId: string) => Promise<unknown>, (w: World) => Player, object]>([
    [
      "from the bidder already highest",
      (id) => as(w.ann).placeBid({ auctionId: id, amount: 105 }),
      (w) => w.ann,
      { code: "BAD_REQUEST", message: "You are already the highest bidder" },
    ],
    [
      "on an auction that has ended though the job has not settled it",
      (id) => endAuction(db as never, id),
      (w) => w.cy,
      { code: "BAD_REQUEST", message: "Auction has expired" },
    ],
    [
      "from the seller",
      async () => undefined,
      (w) => w.sam,
      { code: "BAD_REQUEST", message: "Cannot bid on your own auction" },
    ],
  ])("refuses a bid %s, moving nothing", async (_label, make, bidder, refusal) => {
    const { auction } = await list();
    await make(auction.id);
    const credits = await moneyOf();
    await expect(
      as(bidder(w)).placeBid({ auctionId: auction.id, amount: 200 })
    ).rejects.toMatchObject(refusal);
    expect(await moneyOf()).toEqual(credits);
  });

  it("refuses a buyout at the moment the auction ends, so the completion alone settles it", async () => {
    const { auction } = await list({ buyoutPrice: 500 });
    await db.cardAuction.update({ where: { id: auction.id }, data: { endTime: new Date() } });
    const credits = await moneyOf();
    await expect(as(w.cy).executeBuyout({ auctionId: auction.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await moneyOf()).toEqual(credits);
  });

  it("rolls a buyout back whole when the buyer's XP cannot be granted", async () => {
    const { auction } = await list({ buyoutPrice: 500 });
    await as(w.ann).placeBid({ auctionId: auction.id, amount: 105 });
    const credits = await moneyOf();
    const realTx = db.$transaction.bind(db);
    jest.spyOn(db, "$transaction").mockImplementationOnce(((
      work: (tx: Prisma.TransactionClient) => Promise<unknown>
    ) =>
      realTx(async (tx) => {
        jest.spyOn(tx.cardExperienceEvent, "create").mockRejectedValueOnce(new Error("disk full"));
        return work(tx);
      })) as never);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(as(w.cy).executeBuyout({ auctionId: auction.id })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to execute buyout",
    });
    expect(await moneyOf()).toEqual(credits);
    expect(
      await db.cardOwnership.findUniqueOrThrow({
        where: { id: w.copies[0] },
        select: { ownerId: true, isLocked: true },
      })
    ).toEqual({ ownerId: w.sam.id, isLocked: true });
    expect(
      await db.cardAuction.findUniqueOrThrow({
        where: { id: auction.id },
        select: { status: true },
      })
    ).toEqual({ status: "ACTIVE" });
  });

  it("pays no royalty on a nation card its own nation's owner sells", async () => {
    await db.cardOwnership.update({ where: { id: w.copies[0] }, data: { ownerId: w.nia.id } });
    await db.myVault.update({ where: { userId: w.nia.id }, data: { credits: 100 } });
    const { auction } = await as(w.nia).createAuction({
      cardId: w.copies[0],
      startingPrice: 200,
      duration: "24h",
    });
    await as(w.ann).placeBid({ auctionId: auction.id, amount: 210 });
    await endAuction(db as never, auction.id);
    create.mockClear();
    await processExpiredAuctions();
    expect((await ledgerOf(db as never, w.nia.id)).map((r) => r.source)).toEqual([
      "auction_listing_fee",
      "card_sale_auction",
    ]);
    expect(cardNotices().map(([, title]) => title)).not.toContain("Royalty paid");
  });
});

describeWithDb("cards-auction-lifecycle (Postgres)", () => {
  const db = scenarioDb();
  let w: World;

  beforeEach(async () => {
    mockDb = db;
    w = await seed(db, prefix());
  });
  afterEach(() => removeWorld(db, w.p));
  afterAll(() => db.$disconnect());

  it("bids, extends, settles, refunds an unsold auction and names a cheap buyout, at the default fee", async () => {
    await auctionLifecycle(w, 5, 50);
  });

  it("lets one of two bidders racing one minimum bid hold it; the other is never charged", async () => {
    const { auction } = await market(callerContext(db, w.sam)).createAuction({
      cardId: w.copies[0],
      startingPrice: 100,
      duration: "24h",
    });
    const results = await Promise.allSettled([
      market(callerContext(db, w.ann)).placeBid({ auctionId: auction.id, amount: 105 }),
      market(callerContext(db, w.cy)).placeBid({ auctionId: auction.id, amount: 105 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const credits = await creditsOf(db, [w.ann.id, w.cy.id]);
    expect(Object.values(credits).sort()).toEqual([1000, 895].sort());
    const held = await db.cardAuction.findUniqueOrThrow({ where: { id: auction.id } });
    expect(credits[held.currentBidderId!]).toBe(895);
  });

  it("settles once when a buyout races the completion at the end", async () => {
    const { auction } = await market(callerContext(db, w.sam)).createAuction({
      cardId: w.copies[0],
      startingPrice: 100,
      buyoutPrice: 400,
      duration: "24h",
    });
    await market(callerContext(db, w.ann)).placeBid({ auctionId: auction.id, amount: 105 });
    const end = Date.now() + 150;
    await db.cardAuction.update({ where: { id: auction.id }, data: { endTime: new Date(end) } });
    await new Promise((r) => setTimeout(r, 140));
    const complete = async () => {
      while (Date.now() <= end + 50) await new Promise((r) => setTimeout(r, 5));
      await auctionService.completeAuction(auction.id, db);
    };
    await Promise.allSettled([
      market(callerContext(db, w.bob)).executeBuyout({ auctionId: auction.id }),
      complete(),
    ]);
    const sales = await db.cardTransferEvent.findMany({
      where: { ownershipId: w.copies[0], action: { in: ["AUCTION_END", "AUCTION_BUYOUT"] } },
      select: { action: true, toUserId: true },
    });
    expect(sales).toHaveLength(1);
    const { ownerId } = await db.cardOwnership.findUniqueOrThrow({ where: { id: w.copies[0] } });
    expect(ownerId).toBe(sales[0]!.toUserId);
    expect(
      await db.vaultTransaction.count({
        where: { vault: { userId: w.sam.id }, type: "EARN_CARDS" },
      })
    ).toBe(1);
    const credits = await creditsOf(db, [w.ann.id, w.bob.id]);
    expect(credits).toEqual(
      sales[0]!.action === "AUCTION_BUYOUT"
        ? { [w.ann.id]: 1000, [w.bob.id]: 600 }
        : { [w.ann.id]: 895, [w.bob.id]: 1000 }
    );
  });

  it("lets a cancel and the first bid race: whichever loses moves nothing", async () => {
    const { auction } = await market(callerContext(db, w.sam)).createAuction({
      cardId: w.copies[0],
      startingPrice: 100,
      duration: "24h",
    });
    const [cancel, bid] = await Promise.allSettled([
      market(callerContext(db, w.sam)).cancelAuction({ auctionId: auction.id }),
      market(callerContext(db, w.ann)).placeBid({ auctionId: auction.id, amount: 105 }),
    ]);
    expect([cancel.status, bid.status].sort()).toEqual(["fulfilled", "rejected"]);
    const credits = await creditsOf(db, [w.sam.id, w.ann.id]);
    if (cancel.status === "fulfilled") {
      expect(credits).toEqual({ [w.sam.id]: 997.5, [w.ann.id]: 1000 });
    } else {
      expect(credits).toEqual({ [w.sam.id]: 995, [w.ann.id]: 895 });
    }
  });
});
