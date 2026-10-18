/** @jest-environment node */
/**
 * Card market router: every procedure needs a signed-in user; mutations always act as ctx.user
 * (never an id from the input) and leave ownership rules to auctionService, whose TRPCErrors
 * reach the caller unchanged; the "my ..." reads are scoped to the caller.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/economy/auction-service", () => ({
  __esModule: true,
  auctionService: {
    createAuction: jest.fn(),
    executeBuyout: jest.fn(),
    cancelAuction: jest.fn(),
    placeBid: jest.fn(),
    getActiveAuctions: jest.fn(),
  },
}));

jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("~/lib/cards/xp-utils", () => ({
  __esModule: true,
  grantCardXp: jest.fn().mockResolvedValue({ leveledUp: true, newLevel: 2, xpGained: 50 }),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
import { auctionService } from "~/lib/economy/auction-service";
import { notificationAPI } from "~/lib/notifications/api";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardMarketRouter);
const service = auctionService as unknown as Record<string, jest.Mock>;
const notify = notificationAPI.create as jest.Mock;

function callerAs(userId: string | null, db: MockPrismaProxy) {
  return createCaller(
    createMockRouterContext({
      db,
      auth: userId ? { userId: `clerk_${userId}` } : null,
      user: userId ? { id: userId, clerkUserId: `clerk_${userId}` } : null,
      rateLimitIdentifier: `${userId}_${Math.random()}`,
    }) as never
  );
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  service.createAuction!.mockResolvedValue({ id: "auction_1" });
  service.executeBuyout!.mockResolvedValue(undefined);
  service.cancelAuction!.mockResolvedValue(undefined);
  service.placeBid!.mockResolvedValue(undefined);
  service.getActiveAuctions!.mockResolvedValue({ auctions: [], total: 0 });
});

describe("authentication", () => {
  it("rejects signed-out callers on every kind of procedure", async () => {
    const anon = callerAs(null, db);
    await expect(
      anon.createAuction({ cardId: "own_1", startingPrice: 10, duration: "30" })
    ).rejects.toThrow(/Authentication required/);
    await expect(anon.placeBid({ auctionId: "a1", amount: 5 })).rejects.toThrow(
      /Authentication required/
    );
    await expect(anon.getActiveAuctions({})).rejects.toThrow(/Authentication required/);
    await expect(anon.getMyActiveBids()).rejects.toThrow(/Authentication required/);
    expect(service.createAuction).not.toHaveBeenCalled();
    expect(service.placeBid).not.toHaveBeenCalled();
  });
});

describe("createAuction", () => {
  it("lists the card as the caller and notifies them", async () => {
    const result = await callerAs("seller", db).createAuction({
      cardId: "own_1",
      startingPrice: 10,
      buyoutPrice: 50,
      duration: "60",
    });

    expect(service.createAuction).toHaveBeenCalledWith(
      {
        userId: "seller",
        cardId: "own_1",
        startingPrice: 10,
        buyoutPrice: 50,
        duration: 60,
        isFeatured: false,
      },
      db
    );
    expect(result).toMatchObject({ success: true, auction: { id: "auction_1" } });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk_seller", title: "Auction Listed" })
    );
  });

  it("rejects a buyout at or below the starting price", async () => {
    await expect(
      callerAs("seller", db).createAuction({
        cardId: "own_1",
        startingPrice: 50,
        buyoutPrice: 50,
        duration: "30",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.createAuction).not.toHaveBeenCalled();
  });

  it("validates the duration and starting price", async () => {
    const seller = callerAs("seller", db);
    await expect(
      seller.createAuction({ cardId: "own_1", startingPrice: 10, duration: "45" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      seller.createAuction({ cardId: "own_1", startingPrice: 0, duration: "30" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.createAuction).not.toHaveBeenCalled();
  });

  it("passes an ownership refusal from the service through unchanged", async () => {
    service.createAuction!.mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "You do not own this card" })
    );
    await expect(
      callerAs("thief", db).createAuction({ cardId: "own_1", startingPrice: 10, duration: "30" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "You do not own this card" });
  });

  it("hides unexpected failures behind a generic error", async () => {
    service.createAuction!.mockRejectedValue(new Error("connection reset"));
    await expect(
      callerAs("seller", db).createAuction({ cardId: "own_1", startingPrice: 10, duration: "30" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create auction" });
  });
});

describe("placeBid", () => {
  it("bids as the caller and tells the seller", async () => {
    db.cardAuction.findUnique
      .mockResolvedValueOnce({ currentBidderId: null })
      .mockResolvedValueOnce({ sellerId: "seller", User: { clerkUserId: "clerk_seller" } });

    await callerAs("bidder", db).placeBid({ auctionId: "a1", amount: 25 });

    expect(service.placeBid).toHaveBeenCalledWith(
      { userId: "bidder", auctionId: "a1", amount: 25 },
      db
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk_seller", title: "New Bid on Your Auction" })
    );
  });

  it("passes the service's refusal of a seller bidding on their own auction", async () => {
    service.placeBid!.mockRejectedValue(
      new TRPCError({ code: "BAD_REQUEST", message: "You cannot bid on your own auction" })
    );
    await expect(
      callerAs("seller", db).placeBid({ auctionId: "a1", amount: 25 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "You cannot bid on your own auction" });
    expect(notify).not.toHaveBeenCalled();
  });

  it("rejects a zero bid before reaching the service", async () => {
    await expect(
      callerAs("bidder", db).placeBid({ auctionId: "a1", amount: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.placeBid).not.toHaveBeenCalled();
  });
});

describe("executeBuyout", () => {
  it("buys as the caller, notifies the seller and grants card XP", async () => {
    db.cardAuction.findUnique.mockResolvedValue({
      sellerId: "seller",
      buyoutPrice: 90,
      cardInstanceId: "own_1",
      User: { clerkUserId: "clerk_seller" },
    });

    const result = await callerAs("buyer", db).executeBuyout({ auctionId: "a1" });

    expect(service.executeBuyout).toHaveBeenCalledWith({ userId: "buyer", auctionId: "a1" }, db);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk_seller", title: "Card Sold!" })
    );
    expect(grantCardXp).toHaveBeenCalledWith(db as never, "own_1", "AUCTION_WIN");
    expect(result).toMatchObject({ success: true, leveledUp: true, newLevel: 2 });
  });
});

describe("cancelAuction", () => {
  it("cancels as the caller and tells the outbid bidder", async () => {
    db.cardAuction.findUnique.mockResolvedValue({ currentBidderId: "bidder" });
    db.user.findUnique.mockResolvedValue({ clerkUserId: "clerk_bidder" });

    await callerAs("seller", db).cancelAuction({ auctionId: "a1" });

    expect(service.cancelAuction).toHaveBeenCalledWith({ userId: "seller", auctionId: "a1" }, db);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk_bidder", title: "Auction Cancelled" })
    );
  });

  it("passes the service's refusal for someone else's auction", async () => {
    service.cancelAuction!.mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Only the seller can cancel" })
    );
    await expect(callerAs("intruder", db).cancelAuction({ auctionId: "a1" })).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("caller-scoped reads", () => {
  it("lists only the caller's own active auctions and bids", async () => {
    await callerAs("u1", db).getMyActiveAuctions();
    await callerAs("u1", db).getMyActiveBids();

    expect(db.cardAuction.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { sellerId: "u1", status: "ACTIVE" } })
    );
    expect(db.cardAuction.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          AuctionBid: { some: { bidderId: "u1" } },
          status: "ACTIVE",
          endTime: { gt: expect.any(Date) },
        },
      })
    );
  });

  it("filters active auctions by realm", async () => {
    await callerAs("u1", db).getActiveAuctions({ realmId: "r1", sortBy: "ending_soon" });
    expect(service.getActiveAuctions).toHaveBeenCalledWith(
      expect.objectContaining({ realmId: "r1", sortBy: "ending_soon" }),
      db
    );
  });

  it("marks the caller's own listings, which they cannot bid on", async () => {
    const listed = (id: string, sellerId: string) => ({
      id,
      sellerId,
      cardInstanceId: `o_${id}`,
      CardOwnership: { cards: { id: `c_${id}` } },
    });
    service.getActiveAuctions!.mockResolvedValue({
      auctions: [listed("a", "u1"), listed("b", "u2")],
      total: 2,
      hasMore: false,
    });
    const result = await callerAs("u1", db).getActiveAuctions({});
    expect(result.auctions.map((a) => [a.id, a.isMine])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("labels past auctions by the caller's part in them", async () => {
    db.cardAuction.count.mockResolvedValue(3);
    // Each past auction as the query includes it: the listed copy with its card
    const listed = (id: string) => ({
      cardInstanceId: `o_${id}`,
      CardOwnership: { cards: { id } },
    });
    db.cardAuction.findMany.mockResolvedValue([
      { id: "a", status: "COMPLETED", winnerId: "u1", sellerId: "x", ...listed("a") },
      { id: "b", status: "COMPLETED", winnerId: "y", sellerId: "u1", ...listed("b") },
      { id: "c", status: "CANCELLED", winnerId: null, sellerId: "u1", ...listed("c") },
    ]);

    const result = await callerAs("u1", db).getMyAuctionParticipation({ limit: 2 });

    expect(result.auctions.map((a) => a.participation)).toEqual(["won", "sold", "cancelled"]);
    expect(result.hasMore).toBe(true);
    expect(db.cardAuction.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ sellerId: "u1" }, { winnerId: "u1" }, { AuctionBid: { some: { bidderId: "u1" } } }],
      }),
    });
  });

  it("has no ending-soon list: ending soon is a sort (spec §2.3 Market)", () => {
    expect("getEndingSoon" in cardMarketRouter._def.procedures).toBe(false);
  });

  it("caps the active-auction page size", async () => {
    await expect(callerAs("u1", db).getActiveAuctions({ limit: 101 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(service.getActiveAuctions).not.toHaveBeenCalled();
  });
});

describe("analytics", () => {
  it("falls back to completed auction prices when no value history is stored", async () => {
    db.cardValueHistory.findMany.mockResolvedValue([]);
    db.cardOwnership.findMany.mockResolvedValue([{ id: "own_1" }]);
    db.cardAuction.findMany.mockResolvedValue([{ finalPrice: 40, endTime: new Date(0) }]);

    const history = await callerAs("u1", db).getCardValueHistory({ cardId: "card_1" });

    expect(history).toEqual([{ cardId: "card_1", value: 40, recordedAt: new Date(0) }]);
  });

  it("names transfer parties by their country", async () => {
    db.cardTransferEvent.findMany.mockResolvedValue([
      { id: "t1", fromUserId: null, toUserId: "u2" },
    ]);
    db.user.findMany.mockResolvedValue([{ id: "u2", country: { name: "Caphiria", flag: null } }]);

    const events = await callerAs("u1", db).getCardTransferHistory({ ownershipId: "own_1" });

    expect(events).toEqual([
      expect.objectContaining({ id: "t1", fromUserName: null, toUserName: "Caphiria" }),
    ]);
  });
});
