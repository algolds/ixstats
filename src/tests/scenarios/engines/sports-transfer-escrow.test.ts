/** @jest-environment node */
/**
 * The transfer market's escrow under concurrency, on the in-memory client (transactions one at a time, reads outside
 * them interleaving, so a stale "still pending" read really happens). Two accepts of one bid pay the seller once; two
 * rejects refund the bidder once; accepting two bids on one listing at once sells the player once, pays one bid and
 * refunds the other; an accept racing a reject settles one of them. Every payout and refund carries the bid's
 * idempotency key. A bid needs a whole amount within the Exchange ceiling and a club other than the seller's, and a
 * bid racing an accept never leaves escrow behind on a closed listing. Two players claiming one club at once: one owns
 * it and pays ₷50, the other pays nothing.
 *
 * Regressions: respondToTransferBid checked `status === "pending"` outside its transaction, updated the bid by id and
 * paid with no idempotency key (N parallel accepts paid N×); claimTeam charged, then wrote the owner unconditionally.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import type { PrismaClient } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsTransfersRouter } from "~/server/api/routers/sports/transfers";
import { sportsTeamsRouter } from "~/server/api/routers/sports/teams";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addLeague,
  addPerson,
  asPerson,
  sovereignsOf,
  type Person,
} from "~/tests/helpers/sports-world";

const transfers = createCallerFactory(sportsTransfersRouter);
const teams = createCallerFactory(sportsTeamsRouter);

let db: MemoryPrisma;
let cleo: Person; // owns North and East
let dev: Person; // owns South
let ben: Person; // owns West

const market = (who: Person) => transfers(asPerson(db as never, who));
const star = "north-p00";

async function wallets() {
  return sovereignsOf(db as never, [cleo.id, dev.id, ben.id]);
}

/** Ledger rows written with an idempotency key starting `prefix`. */
async function keyed(prefix: string) {
  return db.exchangeTransaction.findMany({
    where: { idempotencyKey: { startsWith: prefix } },
    select: { sovereigns: true, source: true, idempotencyKey: true },
  });
}

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  db.store.onRaw(/SELECT id FROM "sport_teams" WHERE id = \? FOR SHARE/, ([id]) => [{ id }]);
  db.store.onRaw(/SELECT id FROM "sport_players" WHERE id = \? FOR UPDATE/, ([id], _t, store) =>
    store.rows("SportPlayer").some((p) => p.id === id) ? [{ id }] : []
  );
  db.store.onRaw(/SELECT id FROM "exchange_wallets" WHERE id = \? FOR UPDATE/, ([id]) => [{ id }]);
  mockDb = db;
  const manager = await addPerson(db as never, "manager");
  cleo = await addPerson(db as never, "cleo", 0);
  dev = await addPerson(db as never, "dev", 1000);
  ben = await addPerson(db as never, "ben", 1000);
  await addLeague(db as never, {
    id: "league",
    managerId: manager.id,
    sportPreset: "hockey",
    clubs: [
      { id: "north", ownerUserId: cleo.id, base: 60, rosterSize: 3 },
      { id: "east", ownerUserId: cleo.id, base: 60, rosterSize: 3 },
      { id: "south", ownerUserId: dev.id, base: 60, rosterSize: 3 },
      { id: "west", ownerUserId: ben.id, base: 60, rosterSize: 3 },
    ],
  });
});
afterEach(() => jest.restoreAllMocks());

describe("transfer bids", () => {
  it("pays the seller once when two accepts of one bid race, and keys the payout by the bid", async () => {
    const listing = await market(cleo).listPlayerForTransfer({ playerId: star, price: 300 });
    const bid = await market(dev).placeTransferBid({
      listingId: listing.id,
      amount: 300,
      bidderTeamId: "south",
    });

    const results = await Promise.allSettled([
      market(cleo).respondToTransferBid({ bidId: bid.id, action: "accept" }),
      market(cleo).respondToTransferBid({ bidId: bid.id, action: "accept" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "BAD_REQUEST" },
    });
    expect(await wallets()).toEqual({ [cleo.id]: 300, [dev.id]: 700, [ben.id]: 1000 });
    expect(await keyed("TRANSFER_ACCEPT:")).toEqual([
      {
        sovereigns: 300,
        source: `TRANSFER_ACCEPT:${bid.id}`,
        idempotencyKey: `TRANSFER_ACCEPT:${bid.id}`,
      },
    ]);
    expect((await db.sportPlayer.findUniqueOrThrow({ where: { id: star } })).teamId).toBe("south");
  });

  it("refunds the bidder once when two rejects race, under the bid's refund key", async () => {
    const listing = await market(cleo).listPlayerForTransfer({ playerId: star, price: 300 });
    const bid = await market(dev).placeTransferBid({
      listingId: listing.id,
      amount: 250,
      bidderTeamId: "south",
    });

    const results = await Promise.allSettled([
      market(cleo).respondToTransferBid({ bidId: bid.id, action: "reject" }),
      market(cleo).respondToTransferBid({ bidId: bid.id, action: "reject" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "BAD_REQUEST" },
    });
    expect((await wallets())[dev.id]).toBe(1000);
    expect(await keyed("TRANSFER_BID_REFUND:")).toEqual([
      {
        sovereigns: 250,
        source: `TRANSFER_BID_REFUND:${bid.id}`,
        idempotencyKey: `TRANSFER_BID_REFUND:${bid.id}`,
      },
    ]);
  });

  it("sells the player once when two bids on one listing are accepted at once", async () => {
    const listing = await market(cleo).listPlayerForTransfer({ playerId: star, price: 300 });
    const low = await market(dev).placeTransferBid({
      listingId: listing.id,
      amount: 300,
      bidderTeamId: "south",
    });
    const high = await market(ben).placeTransferBid({
      listingId: listing.id,
      amount: 400,
      bidderTeamId: "west",
    });

    const results = await Promise.allSettled([
      market(cleo).respondToTransferBid({ bidId: low.id, action: "accept" }),
      market(cleo).respondToTransferBid({ bidId: high.id, action: "accept" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "BAD_REQUEST" },
    });
    const bids = await db.sportTransferBid.findMany({ select: { id: true, status: true } });
    const won = bids.find((b) => b.status === "accepted")!;
    expect(bids.map((b) => b.status).sort()).toEqual(["accepted", "rejected"]);
    const [winner, loser] = won.id === low.id ? [low, high] : [high, low];
    // The seller holds the winning bid only; the losing bidder has all of theirs back
    const paid = await wallets();
    expect(paid[cleo.id]).toBe(winner.amount);
    expect(paid[cleo.id]! + paid[dev.id]! + paid[ben.id]!).toBe(2000);
    expect(paid[loser.bidderUserId]).toBe(1000);
    expect((await db.sportPlayer.findUniqueOrThrow({ where: { id: star } })).teamId).toBe(
      winner.bidderTeamId
    );
    expect(await keyed("TRANSFER_ACCEPT:")).toHaveLength(1);
    expect(await keyed("TRANSFER_BID_REFUND:")).toEqual([
      expect.objectContaining({ idempotencyKey: `TRANSFER_BID_REFUND:${loser.id}` }),
    ]);
  });

  it("settles one of an accept and a reject racing on one bid", async () => {
    const listing = await market(cleo).listPlayerForTransfer({ playerId: star, price: 300 });
    const bid = await market(dev).placeTransferBid({
      listingId: listing.id,
      amount: 300,
      bidderTeamId: "south",
    });

    const results = await Promise.allSettled([
      market(cleo).respondToTransferBid({ bidId: bid.id, action: "accept" }),
      market(cleo).respondToTransferBid({ bidId: bid.id, action: "reject" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const paid = await wallets();
    expect(paid[cleo.id]! + paid[dev.id]!).toBe(1000);
    const { status } = await db.sportTransferBid.findUniqueOrThrow({ where: { id: bid.id } });
    expect(paid).toEqual(
      status === "accepted"
        ? { [cleo.id]: 300, [dev.id]: 700, [ben.id]: 1000 }
        : { [cleo.id]: 0, [dev.id]: 1000, [ben.id]: 1000 }
    );
  });

  it("never leaves escrow on a closed listing when a bid races the accept", async () => {
    const listing = await market(cleo).listPlayerForTransfer({ playerId: star, price: 300 });
    const first = await market(dev).placeTransferBid({
      listingId: listing.id,
      amount: 300,
      bidderTeamId: "south",
    });

    await Promise.allSettled([
      market(cleo).respondToTransferBid({ bidId: first.id, action: "accept" }),
      market(ben).placeTransferBid({ listingId: listing.id, amount: 500, bidderTeamId: "west" }),
    ]);

    expect(await db.sportTransferBid.count({ where: { status: "pending" } })).toBe(0);
    const paid = await wallets();
    expect(paid).toEqual({ [cleo.id]: 300, [dev.id]: 700, [ben.id]: 1000 });
  });

  it("refuses a bid on the bidder's own player, a fractional amount and one past the ceiling", async () => {
    const listing = await market(cleo).listPlayerForTransfer({ playerId: star, price: 300 });
    await db.exchangeWallet.update({ where: { userId: cleo.id }, data: { sovereigns: 1000 } });

    // From the selling club itself, and from another club of the same owner
    await expect(
      market(cleo).placeTransferBid({ listingId: listing.id, amount: 300, bidderTeamId: "north" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      market(cleo).placeTransferBid({ listingId: listing.id, amount: 300, bidderTeamId: "east" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      market(dev).placeTransferBid({ listingId: listing.id, amount: 0.5, bidderTeamId: "south" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      market(dev).placeTransferBid({
        listingId: listing.id,
        amount: 10_000_001,
        bidderTeamId: "south",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      market(cleo).listPlayerForTransfer({ playerId: star, price: 1e12 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(await db.sportTransferBid.count()).toBe(0);
    expect(await wallets()).toEqual({ [cleo.id]: 1000, [dev.id]: 1000, [ben.id]: 1000 });
  });
});

describe("claimTeam", () => {
  async function licence(db: PrismaClient, who: Person) {
    const vault = await db.myVault.create({ data: { userId: who.id } });
    await db.vaultTransaction.create({
      data: {
        vaultId: vault.id,
        credits: -5000,
        balanceAfter: 0,
        type: "SPEND_BOOST",
        source: "STORE",
        metadata: { itemId: "upgrade_myclub_license" },
      },
    });
  }

  beforeEach(async () => {
    await db.sportTeam.update({ where: { id: "west" }, data: { ownerUserId: null } });
    await licence(db as never, dev);
    await licence(db as never, ben);
  });

  it("gives a club to one of two concurrent claimers and charges only that one", async () => {
    const results = await Promise.allSettled([
      teams(asPerson(db as never, dev)).claimTeam({ teamId: "west" }),
      teams(asPerson(db as never, ben)).claimTeam({ teamId: "west" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "BAD_REQUEST", message: "Team is already claimed" },
    });
    const { ownerUserId } = await db.sportTeam.findUniqueOrThrow({ where: { id: "west" } });
    const paid = await sovereignsOf(db as never, [dev.id, ben.id]);
    expect(paid[ownerUserId!]).toBe(950);
    expect(paid[ownerUserId === dev.id ? ben.id : dev.id]).toBe(1000);
    expect(await db.exchangeTransaction.count({ where: { type: "CHARTER_FEE" } })).toBe(1);
  });

  it("leaves the club unowned when the claimer cannot pay", async () => {
    await db.exchangeWallet.update({ where: { userId: dev.id }, data: { sovereigns: 10 } });

    await expect(
      teams(asPerson(db as never, dev)).claimTeam({ teamId: "west" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect((await db.sportTeam.findUniqueOrThrow({ where: { id: "west" } })).ownerUserId).toBe(
      null
    );
  });
});
