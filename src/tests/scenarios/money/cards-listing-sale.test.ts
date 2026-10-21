/** @jest-environment node */
/**
 * A seller lists a Foil nation card at 500 IxC as a featured listing; two buyers race and one buys it. The buyer pays
 * the price, the seller gets it less the market fee, the nation's owner gets the royalty out of that fee, the copy
 * moves unlocked with its sale on its trail, and the loser pays nothing. A second listing is cancelled and a third
 * expires through the expiry job; each refunds the stored fee's share. Settlement runs for real (nothing is mocked
 * below the routers), on the in-memory Prisma and then on Postgres, where a cancel races a purchase and two players buy
 * each other's listings at once.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import type { PrismaClient } from "@prisma/client";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketListingsRouter } from "~/server/api/routers/card-market/listings";
import { processExpiredListings } from "~/server/modules/cards/market/listing-expiry-cron";
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
const market = createCallerFactory(cardMarketListingsRouter);

/** The numbers a run expects: the stored Economy tab on the memory client, the defaults on Postgres. */
interface Fees {
  fee: number;
  featured: number;
  refundPct: number;
  /** The market fee on a 500 IxC sale, and the royalty out of it. */
  saleFee: number;
  royalty: number;
}

interface World {
  db: PrismaClient;
  p: string;
  sam: Player;
  bea: Player;
  ben: Player;
  nia: Player;
  card: string;
  copies: [string, string, string];
}

/** Sam holds three copies of Aurelia, a Rare nation card of Nia's nation; Bea and Ben have 2,000 IxC each. */
async function seed(db: PrismaClient, p: string): Promise<World> {
  const { id: realmId } = await addRealm(db, `${p}realm`);
  const sam = await addPlayer(db, `${p}sam`, 1000);
  const bea = await addPlayer(db, `${p}bea`, 2000);
  const ben = await addPlayer(db, `${p}ben`, 2000);
  const nia = await addPlayer(db, `${p}nia`, 0);
  const { id: countryId } = await addCountry(db, `${p}aurelia`, realmId, nia.id);
  const card = `${p}card`;
  await addCard(db, {
    id: card,
    realmId,
    rarity: "RARE",
    cardType: "NATION",
    title: "Aurelia",
    countryId,
  });
  const copies = [`${p}own1`, `${p}own2`, `${p}own3`] as [string, string, string];
  for (const [i, id] of copies.entries()) {
    await addCopy(db, { id, cardId: card, ownerId: sam.id, serialNumber: i + 1 });
  }
  await db.cardOwnership.update({ where: { id: copies[0] }, data: { finish: "FOIL" } });
  return { db, p, sam, bea, ben, nia, card, copies };
}

const total = (balances: Record<string, number>) =>
  Math.round(Object.values(balances).reduce((s, v) => s + v, 0) * 100) / 100;

async function listingSale(w: World, fees: Fees) {
  const { db, sam, bea, ben, nia } = w;
  const people = [sam.id, bea.id, ben.id, nia.id];
  const start = total(await creditsOf(db, people));

  // Sam lists the Foil #1 at 500 as featured: the copy locks, and the featured fee is charged and stored
  const listing = await market(callerContext(db, sam)).createListing({
    ownershipId: w.copies[0],
    price: 500,
    isFeatured: true,
  });
  expect(listing).toMatchObject({
    price: 500,
    isFeatured: true,
    listingFee: fees.featured,
    serialNumber: 1,
    finish: "FOIL",
  });
  expect(
    await db.cardOwnership.findUnique({ where: { id: w.copies[0] }, select: { isLocked: true } })
  ).toEqual({
    isLocked: true,
  });
  expect((await ledgerOf(db, sam.id)).at(-1)).toMatchObject({
    credits: -fees.featured,
    type: "SPEND_MARKET",
    source: "listing_fee",
  });

  // Bea and Ben race for it: exactly one buys, the other is charged nothing
  create.mockClear();
  const results = await Promise.allSettled([
    market(callerContext(db, bea)).buyListing({ listingId: listing.id }),
    market(callerContext(db, ben)).buyListing({ listingId: listing.id }),
  ]);
  const won = results.findIndex((r) => r.status === "fulfilled");
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const [buyer, loser] = won === 0 ? [bea, ben] : [ben, bea];
  expect((results[1 - won] as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });

  const after = await creditsOf(db, people);
  expect(after[buyer.id]).toBe(1500);
  expect(after[loser.id]).toBe(2000);
  expect(after[sam.id]).toBe(1000 - fees.featured + 500 - fees.saleFee);
  expect(after[nia.id]).toBe(fees.royalty);
  // IxC is conserved: the house keeps the listing fee and the market fee less the royalty
  expect(total(after)).toBe(start - fees.featured - (fees.saleFee - fees.royalty));
  expect(await ledgerOf(db, loser.id)).toEqual([]);
  expect(await ledgerOf(db, buyer.id)).toEqual([
    { credits: -500, balanceAfter: 1500, type: "SPEND_MARKET", source: "card_purchase_listing" },
  ]);
  expect((await ledgerOf(db, sam.id)).at(-1)).toMatchObject({
    credits: 500 - fees.saleFee,
    type: "EARN_CARDS",
    source: "card_sale_listing",
  });
  expect(await ledgerOf(db, nia.id)).toEqual([
    expect.objectContaining({
      credits: fees.royalty,
      type: "EARN_CARDS",
      source: "nation_card_royalty",
    }),
  ]);

  // The copy is the buyer's, unlocked; the sale is on its trail with the listing's serial and finish, and it earned XP
  expect(
    await db.cardOwnership.findUnique({
      where: { id: w.copies[0] },
      select: { ownerId: true, isLocked: true },
    })
  ).toEqual({ ownerId: buyer.id, isLocked: false });
  expect(
    await db.cardListing.findUnique({
      where: { id: listing.id },
      select: { status: true, buyerId: true },
    })
  ).toEqual({ status: "SOLD", buyerId: buyer.id });
  expect(
    await db.cardTransferEvent.findMany({
      where: { ownershipId: w.copies[0], action: "LISTING_SALE" },
      select: { fromUserId: true, toUserId: true, price: true, serialNumber: true, finish: true },
    })
  ).toEqual([
    { fromUserId: sam.id, toUserId: buyer.id, price: 500, serialNumber: 1, finish: "FOIL" },
  ]);
  expect(
    await db.cardExperienceEvent.count({
      where: { ownershipId: w.copies[0], source: "LISTING_PURCHASE" },
    })
  ).toBe(1);
  expect(
    await db.card.findUnique({ where: { id: w.card }, select: { firstSoldAt: true } })
  ).toEqual({
    firstSoldAt: expect.any(Date),
  });
  expect(create.mock.calls.map(([n]) => [n.userId, n.title])).toEqual([
    [sam.id, "Your listing sold"],
    [nia.id, "Royalty paid"],
  ]);

  // A second listing is cancelled: the copy unlocks and the refund share of the fee it stored comes back
  const second = await market(callerContext(db, sam)).createListing({
    ownershipId: w.copies[1],
    price: 80,
  });
  const refund = Math.floor(fees.fee * fees.refundPct) / 100;
  expect(await market(callerContext(db, sam)).cancelListing({ listingId: second.id })).toEqual({
    refund,
  });
  expect(
    await db.cardOwnership.findUnique({ where: { id: w.copies[1] }, select: { isLocked: true } })
  ).toEqual({
    isLocked: false,
  });
  expect((await ledgerOf(db, sam.id)).at(-1)).toMatchObject({
    credits: refund,
    type: "REFUND",
    source: "listing_fee_refund",
  });
  await expect(
    market(callerContext(db, sam)).cancelListing({ listingId: second.id })
  ).rejects.toMatchObject({
    code: "CONFLICT",
  });

  // A third expires through the job: it ends once, unlocks, refunds and tells the seller
  const third = await market(callerContext(db, sam)).createListing({
    ownershipId: w.copies[2],
    price: 90,
  });
  await db.cardListing.update({
    where: { id: third.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  create.mockClear();
  expect(await processExpiredListings()).toEqual({ expired: 1, failed: 0 });
  expect(await processExpiredListings()).toEqual({ expired: 0, failed: 0 });
  expect(
    await db.cardListing.findUnique({ where: { id: third.id }, select: { status: true } })
  ).toEqual({
    status: "EXPIRED",
  });
  expect(
    await db.cardOwnership.findUnique({ where: { id: w.copies[2] }, select: { isLocked: true } })
  ).toEqual({
    isLocked: false,
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ userId: sam.id, title: "Your listing expired" })
  );

  expect(total(await creditsOf(db, people))).toBe(
    Math.round(
      (start - fees.featured - (fees.saleFee - fees.royalty) - 2 * (fees.fee - refund)) * 100
    ) / 100
  );
  return { listingId: listing.id, buyer };
}

beforeEach(() => {
  clearEconomyCaches();
  create.mockReset().mockResolvedValue("n1" as never);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("cards-listing-sale (memory)", () => {
  let db: MemoryPrisma;
  let w: World;

  beforeEach(async () => {
    db = createMemoryPrisma();
    mockDb = db;
    w = await seed(db as never, "m-");
  });

  it("lists, sells to one of two buyers, cancels and expires, at the stored fees and in the lock order", async () => {
    // The Economy tab as stored: fees of 7 and 13 IxC and a 40% refund, none of them the defaults
    await db.systemConfig.createMany({
      data: [
        { key: "card_economy_listing_fee", value: "7" },
        { key: "card_economy_listing_fee_featured", value: "13" },
        { key: "card_economy_listing_refund_pct", value: "40" },
      ],
    });
    const { listingId, buyer } = await listingSale(w, {
      fee: 7,
      featured: 13,
      refundPct: 40,
      saleFee: 50,
      royalty: 10,
    });

    // The purchase took the claim row first, then every party's vault at once in user-id order, then the copy
    const log = db.store.log;
    const claim = log.findIndex(
      (e) =>
        e.kind === "write" &&
        e.model === "CardListing" &&
        e.op === "updateMany" &&
        e.where?.id === listingId &&
        e.where?.status === "ACTIVE"
    );
    const vaults = log.findIndex((e, i) => i > claim && e.kind === "vaults");
    const copy = log.findIndex(
      (e, i) => i > vaults && e.kind === "write" && e.model === "CardOwnership"
    );
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(log[vaults]).toEqual({ kind: "vaults", userIds: [buyer.id, w.nia.id, w.sam.id].sort() });
    expect(copy).toBeGreaterThan(vaults);
  });

  it("refunds a share of the fee the listing stored, not of today's fee", async () => {
    const listing = await market(callerContext(db as never, w.sam)).createListing({
      ownershipId: w.copies[1],
      price: 80,
    });
    await db.systemConfig.create({ data: { key: "card_economy_listing_fee", value: "40" } });
    clearEconomyCaches();
    expect(
      await market(callerContext(db as never, w.sam)).cancelListing({ listingId: listing.id })
    ).toEqual({ refund: 2.5 });
  });
});

describeWithDb("cards-listing-sale (Postgres)", () => {
  const db = scenarioDb();
  let w: World;

  beforeEach(async () => {
    mockDb = db;
    w = await seed(db, prefix());
  });
  afterEach(() => removeWorld(db, w.p));
  afterAll(() => db.$disconnect());

  it("lists, sells to one of two racing buyers, cancels and expires at the default fees", async () => {
    await listingSale(w, { fee: 5, featured: 10, refundPct: 50, saleFee: 50, royalty: 10 });
  });

  it("lets a cancel and a purchase race: whichever loses moves and refunds nothing", async () => {
    const listing = await market(callerContext(db, w.sam)).createListing({
      ownershipId: w.copies[1],
      price: 300,
    });
    const [cancel, buy] = await Promise.allSettled([
      market(callerContext(db, w.sam)).cancelListing({ listingId: listing.id }),
      market(callerContext(db, w.bea)).buyListing({ listingId: listing.id }),
    ]);
    expect([cancel.status, buy.status].sort()).toEqual(["fulfilled", "rejected"]);
    const credits = await creditsOf(db, [w.sam.id, w.bea.id]);
    const { ownerId } = await db.cardOwnership.findUniqueOrThrow({ where: { id: w.copies[1] } });
    if (buy.status === "fulfilled") {
      expect(ownerId).toBe(w.bea.id);
      expect(credits[w.bea.id]).toBe(1700);
      expect(
        await db.vaultTransaction.count({ where: { vault: { userId: w.sam.id }, type: "REFUND" } })
      ).toBe(0);
    } else {
      expect(ownerId).toBe(w.sam.id);
      expect(credits[w.bea.id]).toBe(2000);
      expect(credits[w.sam.id]).toBe(1000 - 5 + 2.5);
    }
  });

  it("lets two players buy each other's listings at once without a deadlock", async () => {
    // Bea owns a copy too, listed against Sam's; each buys the other's
    await db.cardOwnership.update({ where: { id: w.copies[2] }, data: { ownerId: w.bea.id } });
    const sams = await market(callerContext(db, w.sam)).createListing({
      ownershipId: w.copies[1],
      price: 200,
    });
    const beas = await market(callerContext(db, w.bea)).createListing({
      ownershipId: w.copies[2],
      price: 250,
    });
    const results = await Promise.allSettled([
      market(callerContext(db, w.bea)).buyListing({ listingId: sams.id }),
      market(callerContext(db, w.sam)).buyListing({ listingId: beas.id }),
    ]);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONFLICT" });
    }
    const owners = await db.cardOwnership.findMany({
      where: { id: { in: [w.copies[1], w.copies[2]] } },
      select: { id: true, ownerId: true, isLocked: true },
      orderBy: { id: "asc" },
    });
    expect(owners).toEqual([
      {
        id: w.copies[1],
        ownerId: results[0].status === "fulfilled" ? w.bea.id : w.sam.id,
        isLocked: results[0].status === "rejected",
      },
      {
        id: w.copies[2],
        ownerId: results[1].status === "fulfilled" ? w.sam.id : w.bea.id,
        isLocked: results[1].status === "rejected",
      },
    ]);
  });
});
