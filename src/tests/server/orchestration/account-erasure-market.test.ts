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
});
