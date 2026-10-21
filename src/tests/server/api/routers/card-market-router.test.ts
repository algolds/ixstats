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
  },
}));

jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
import { auctionService } from "~/lib/economy/auction-service";
import { notificationAPI } from "~/lib/notifications/api";
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
  service.executeBuyout!.mockResolvedValue({
    success: true,
    xp: { prevLevel: 1, newLevel: 2, prevXP: 950, newXP: 1000, leveledUp: true, xpGained: 50 },
  });
  service.cancelAuction!.mockResolvedValue({ success: true, refund: 2.5 });
  service.placeBid!.mockResolvedValue(undefined);
});

describe("authentication", () => {
  it("rejects signed-out callers on every kind of procedure", async () => {
    const anon = callerAs(null, db);
    await expect(
      anon.createAuction({ cardId: "own_1", startingPrice: 10, duration: "24h" })
    ).rejects.toThrow(/Authentication required/);
    await expect(anon.placeBid({ auctionId: "a1", amount: 5 })).rejects.toThrow(
      /Authentication required/
    );
    await expect(anon.browse({})).rejects.toThrow(/Authentication required/);
    await expect(anon.getMyActiveBids()).rejects.toThrow(/Authentication required/);
    expect(service.createAuction).not.toHaveBeenCalled();
    expect(service.placeBid).not.toHaveBeenCalled();
  });
});

describe("createAuction", () => {
  it("lists the card as the caller for the duration picked, and notifies them", async () => {
    const result = await callerAs("seller", db).createAuction({
      cardId: "own_1",
      startingPrice: 10,
      buyoutPrice: 50,
      duration: "3d",
    });

    expect(service.createAuction).toHaveBeenCalledWith(
      {
        userId: "seller",
        cardId: "own_1",
        startingPrice: 10,
        buyoutPrice: 50,
        duration: "3d",
        isFeatured: false,
      },
      db
    );
    expect(result).toMatchObject({
      success: true,
      auction: { id: "auction_1" },
      message: "Auction created. It ends in 3 days.",
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "clerk_seller",
        title: "Auction listed",
        message: "Auction created. It ends in 3 days.",
      })
    );
  });

  it("refuses prices that are not whole IxC before reaching the service", async () => {
    const seller = callerAs("seller", db);
    await expect(
      seller.createAuction({ cardId: "own_1", startingPrice: 10.5, duration: "24h" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      seller.createAuction({
        cardId: "own_1",
        startingPrice: 10,
        buyoutPrice: 20.5,
        duration: "24h",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.createAuction).not.toHaveBeenCalled();
  });
  it("validates the duration and starting price", async () => {
    const seller = callerAs("seller", db);
    // The old 30 and 60 minute auctions are gone
    for (const duration of ["30", "60", "1d"]) {
      await expect(
        seller.createAuction({ cardId: "own_1", startingPrice: 10, duration: duration as never })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      seller.createAuction({ cardId: "own_1", startingPrice: 0, duration: "24h" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.createAuction).not.toHaveBeenCalled();
  });
  it("hides unexpected failures behind a generic error", async () => {
    service.createAuction!.mockRejectedValue(new Error("connection reset"));
    await expect(
      callerAs("seller", db).createAuction({ cardId: "own_1", startingPrice: 10, duration: "7d" })
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
  it("rejects a zero bid before reaching the service", async () => {
    await expect(
      callerAs("bidder", db).placeBid({ auctionId: "a1", amount: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.placeBid).not.toHaveBeenCalled();
  });
});

describe("executeBuyout", () => {
  it("buys as the caller and reports the XP the service granted in its transaction", async () => {
    db.cardAuction.findUnique.mockResolvedValue({
      sellerId: "seller",
      User: { clerkUserId: "clerk_seller" },
    });

    const result = await callerAs("buyer", db).executeBuyout({ auctionId: "a1" });

    expect(service.executeBuyout).toHaveBeenCalledWith({ userId: "buyer", auctionId: "a1" }, db);
    // The service tells the seller after its commit; the router sends nothing of its own
    expect(notify).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: "Card purchased.",
      leveledUp: true,
      newLevel: 2,
      xpGained: 50,
    });
  });
});

describe("cancelAuction", () => {
  it("cancels as the caller and says what came back, telling no bidder (an auction with a bid cannot be cancelled)", async () => {
    const result = await callerAs("seller", db).cancelAuction({ auctionId: "a1" });

    expect(service.cancelAuction).toHaveBeenCalledWith({ userId: "seller", auctionId: "a1" }, db);
    expect(result).toEqual({
      success: true,
      message: "Auction cancelled. We refunded 2.5 IxC of the listing fee.",
    });
    expect(db.cardAuction.findUnique).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
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
});
