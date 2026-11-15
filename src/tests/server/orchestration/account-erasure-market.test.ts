/** @jest-environment node */
/**
 * Account erasure's market step: open listings and auctions end by the admin cancel paths (which refund other players'
 * bids), trades the user proposed are withdrawn and those waiting on them turned down, and one that cannot end is
 * logged without stopping the rest.
 */
jest.mock("~/server/modules/cards/cards.tools", () => ({
  adminCancelListing: jest.fn().mockResolvedValue(undefined),
  adminCancelAuction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/modules/cards/trading/trade-service", () => ({
  cancelTradeOffer: jest.fn().mockResolvedValue({}),
  rejectTradeOffer: jest.fn().mockResolvedValue({}),
}));

import { describe, it, expect, beforeEach, jest as jestGlobal } from "@jest/globals";
import { adminCancelAuction, adminCancelListing } from "~/server/modules/cards/cards.tools";
import { cancelTradeOffer, rejectTradeOffer } from "~/server/modules/cards/trading/trade-service";
import { closeMarketItems } from "~/server/orchestration/account-erasure.market";
import { createFakeExchangeDb } from "~/tests/helpers/fake-exchange-db";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-11-01T00:00:00Z");
const USER = { id: "alice", clerkUserId: "alice-clerk" };

let db: ReturnType<typeof createMockPrisma>;

beforeEach(() => {
  jestGlobal.clearAllMocks();
  db = createMockPrisma();
  db.cardListing.findMany.mockResolvedValue([{ id: "l1" }, { id: "l2" }]);
  db.cardAuction.findMany.mockResolvedValue([{ id: "a1" }]);
  db.tradeOffer.findMany.mockResolvedValue([
    { id: "t-mine", proposerId: "alice" },
    { id: "t-theirs", proposerId: "bob" },
  ]);
});

describe("closeMarketItems", () => {
  it("ends every open item by its cancel path", async () => {
    const ended = await closeMarketItems(db as never, USER, NOW);
    expect(ended).toBe(5);
    const actor = { dbId: "alice", clerkId: "system:account-erasure" };
    expect(adminCancelListing).toHaveBeenCalledWith(
      db as never,
      actor,
      expect.objectContaining({ listingId: "l1" })
    );
    expect(adminCancelListing).toHaveBeenCalledWith(
      db as never,
      actor,
      expect.objectContaining({ listingId: "l2" })
    );
    expect(adminCancelAuction).toHaveBeenCalledWith(
      db as never,
      actor,
      expect.objectContaining({ auctionId: "a1" })
    );
    expect(cancelTradeOffer).toHaveBeenCalledWith(db as never, {
      user: USER,
      tradeId: "t-mine",
      now: NOW,
    });
    expect(rejectTradeOffer).toHaveBeenCalledWith(db as never, {
      user: USER,
      tradeId: "t-theirs",
      now: NOW,
    });
    expect(db.tradeOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING", expiresAt: { gt: NOW } }),
      })
    );
  });

  it("logs an item that cannot end and carries on", async () => {
    (adminCancelListing as jest.Mock).mockRejectedValueOnce(new Error("sold meanwhile"));
    const error = jestGlobal.spyOn(console, "error").mockImplementation(() => undefined);
    const ended = await closeMarketItems(db as never, USER, NOW);
    expect(ended).toBe(4);
    expect(adminCancelListing).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(
      "[account-erasure] could not end listing l1:",
      "sold meanwhile"
    );
    error.mockRestore();
  });

  it("cancels the erased user's open Exchange share listings, buy orders and bond listings without touching another user's", async () => {
    const fake = createFakeExchangeDb({
      user: [
        { id: "alice", clerkUserId: "alice-clerk" },
        { id: "bob", clerkUserId: "bob-clerk" },
      ],
      exchangeWallet: [
        {
          id: "w_alice",
          userId: "alice",
          sovereigns: 1000_00n,
          lifetimeEarned: 1000_00n,
          lifetimeSpent: 0n,
        },
        {
          id: "w_bob",
          userId: "bob",
          sovereigns: 1000_00n,
          lifetimeEarned: 1000_00n,
          lifetimeSpent: 0n,
        },
      ],
      company: [
        {
          id: "co1",
          realmId: "default",
          founderId: "bob",
          name: "Bob Works",
          sectorKey: "industry",
          sharesIssued: 1000,
          sharesOutstanding: 1000,
          status: "ACTIVE",
        },
      ],
      shareholding: [
        { id: "sh_alice", companyId: "co1", ownerUserId: "alice", shares: 50, avgCost: 10_00n },
        { id: "sh_bob", companyId: "co1", ownerUserId: "bob", shares: 800, avgCost: 10_00n },
      ],
      shareListing: [
        {
          id: "sl_alice",
          companyId: "co1",
          sellerUserId: "alice",
          shares: 30,
          sharesListed: 30,
          pricePerShare: 12_00n,
          status: "OPEN",
          createdIxTime: 1,
        },
        {
          id: "sl_bob",
          companyId: "co1",
          sellerUserId: "bob",
          shares: 20,
          sharesListed: 20,
          pricePerShare: 15_00n,
          status: "OPEN",
          createdIxTime: 2,
        },
      ],
      shareBuyOrder: [
        {
          id: "bo_alice",
          companyId: "co1",
          buyerUserId: "alice",
          shares: 10,
          sharesOrdered: 10,
          maxPricePerShare: 25_00n,
          escrow: 250_00n,
          status: "OPEN",
          createdIxTime: 1,
        },
        {
          id: "bo_bob",
          companyId: "co1",
          buyerUserId: "bob",
          shares: 5,
          sharesOrdered: 5,
          maxPricePerShare: 20_00n,
          escrow: 100_00n,
          status: "OPEN",
          createdIxTime: 2,
        },
      ],
      nationBond: [
        {
          id: "bond1",
          countryId: "na",
          realmId: "default",
          issuerUserId: "bob",
          faceValue: 100_00n,
          unitsIssued: 100,
          unitsSold: 20,
          couponRate: 0.05,
          termWeeks: 4,
          weeksPaid: 0,
          status: "OPEN",
          issuedAt: NOW,
        },
      ],
      bondHolding: [
        { id: "bh_alice", bondId: "bond1", ownerUserId: "alice", units: 4, avgCost: 100_00n },
      ],
      bondListing: [
        {
          id: "bl_alice",
          bondId: "bond1",
          sellerUserId: "alice",
          units: 6,
          unitsListed: 6,
          pricePerUnit: 100_00n,
          status: "OPEN",
        },
        {
          id: "bl_bob",
          bondId: "bond1",
          sellerUserId: "bob",
          units: 3,
          unitsListed: 3,
          pricePerUnit: 100_00n,
          status: "OPEN",
        },
      ],
      systemConfig: [{ key: "vault_isExchangeEnabled", value: "false" }],
    });

    const ended = await closeMarketItems(fake.client, USER, NOW);
    expect(ended).toBe(3);

    // Alice's share listing is cancelled and its 30 shares returned to her holding (50 + 30 = 80).
    expect(fake.tables.shareListing!.find((l) => l.id === "sl_alice")).toMatchObject({
      status: "CANCELLED",
      shares: 0,
    });
    expect(fake.tables.shareholding!.find((h) => h.ownerUserId === "alice")?.shares).toBe(80);

    // Alice's buy order is cancelled and its ₷250 escrow refunded to her wallet (1,000 + 250 = 1,250).
    expect(fake.tables.shareBuyOrder!.find((o) => o.id === "bo_alice")).toMatchObject({
      status: "CANCELLED",
      shares: 0,
      escrow: 0n,
    });
    expect(fake.tables.exchangeWallet!.find((w) => w.userId === "alice")?.sovereigns).toBe(1250_00n);

    // Alice's bond listing is cancelled and its 6 units returned to her holding (4 + 6 = 10).
    expect(fake.tables.bondListing!.find((l) => l.id === "bl_alice")).toMatchObject({
      status: "CANCELLED",
      units: 0,
    });
    expect(fake.tables.bondHolding!.find((h) => h.ownerUserId === "alice")?.units).toBe(10);

    // Bob's open share listing, buy order, and bond listing remain untouched.
    expect(fake.tables.shareListing!.find((l) => l.id === "sl_bob")).toMatchObject({
      status: "OPEN",
      shares: 20,
    });
    expect(fake.tables.shareBuyOrder!.find((o) => o.id === "bo_bob")).toMatchObject({
      status: "OPEN",
      shares: 5,
      escrow: 100_00n,
    });
    expect(fake.tables.bondListing!.find((l) => l.id === "bl_bob")).toMatchObject({
      status: "OPEN",
      units: 3,
    });
  });
});
