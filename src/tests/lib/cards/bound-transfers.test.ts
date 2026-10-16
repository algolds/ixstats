/** @jest-environment node */
/** Cards refresh §5.4 and §5.6: a trade offer, an auction or a transfer with a bound copy is refused. */
jest.mock("~/lib/vault/vault-service", () => ({
  getVaultConfig: jest
    .fn()
    .mockResolvedValue({ isMaintenanceMode: false, isAuctionsEnabled: true }),
  vaultService: { getBalance: jest.fn(), spendCredits: jest.fn(), earnCredits: jest.fn() },
  LedgerError: class LedgerError extends Error {},
}));
jest.mock("~/lib/websocket/market-websocket-server", () => ({
  getMarketWebSocketServer: () => null,
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { AuctionService } from "~/lib/economy/auction-service";
import { transferCardsTx } from "~/lib/vault/trade-settlement";
import { vaultService } from "~/lib/vault/vault-service";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-10-27T12:00:00.000Z");

describe("bound copies never move", () => {
  it("refuses a transfer that holds a bound copy, before moving anything", async () => {
    const tx = { cardOwnership: { count: jest.fn().mockResolvedValue(1), updateMany: jest.fn() } };
    await expect(
      transferCardsTx(tx as never, {
        ids: ["o1"],
        fromId: "a",
        toId: "b",
        expectLocked: true,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
  });

  it("moves an unbound copy, writing only its owner, lock and acquisition", async () => {
    const tx = {
      cardOwnership: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    await transferCardsTx(tx as never, {
      ids: ["o1"],
      fromId: "a",
      toId: "b",
      expectLocked: true,
      now: NOW,
    });
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["o1"] }, ownerId: "a", isLocked: true },
      data: { ownerId: "b", isLocked: false, acquiredAt: NOW },
    });
  });

  it("refuses to list a bound copy at auction, charging no fee", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findFirst.mockResolvedValue({
      id: "o1",
      ownerId: "u1",
      isLocked: false,
      cards: { isBound: true },
    });
    await expect(
      new AuctionService().createAuction(
        { userId: "u1", cardId: "o1", startingPrice: 10, duration: 60 },
        db as never
      )
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(vaultService.spendCredits).not.toHaveBeenCalled();
    expect(db.cardAuction.create).not.toHaveBeenCalled();
  });
});

describe("getActiveAuctions", () => {
  it("filters by card in the query, so the total and hasMore are true", async () => {
    const db = createMockPrisma();
    db.cardAuction.count.mockResolvedValue(42);
    const result = await new AuctionService().getActiveAuctions(
      { cardId: "c1", limit: 20 },
      db as never
    );
    expect(db.cardAuction.count.mock.calls[0]![0].where).toMatchObject({
      CardOwnership: { cards: { id: "c1" } },
    });
    expect(result).toMatchObject({ total: 42, hasMore: true });
  });

  it("puts every filter and the sort in the one query, and pages by offset", async () => {
    const db = createMockPrisma();
    db.cardAuction.count.mockResolvedValue(30);
    const result = await new AuctionService().getActiveAuctions(
      {
        sellerId: "s1",
        isFeatured: false,
        rarity: "EPIC",
        cardType: "LORE",
        minPrice: 5,
        maxPrice: 50,
        sortBy: "price_low",
        limit: 20,
        offset: 20,
      },
      db as never
    );
    const where = {
      status: "ACTIVE",
      endTime: { gt: expect.any(Date) },
      sellerId: "s1",
      isFeatured: false,
      CardOwnership: { cards: { rarity: "EPIC", cardType: "LORE" } },
      currentBid: { gte: 5, lte: 50 },
    };
    expect(db.cardAuction.count).toHaveBeenCalledWith({ where });
    expect(db.cardAuction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ isFeatured: "desc" }, { currentBid: "asc" }],
        take: 20,
        skip: 20,
      })
    );
    expect(result).toMatchObject({ total: 30, hasMore: false });
  });

  it("adds no empty filters and sorts by the soonest end when no sort is given", async () => {
    const db = createMockPrisma();
    db.cardAuction.count.mockResolvedValue(0);
    await new AuctionService().getActiveAuctions({}, db as never);
    expect(db.cardAuction.count).toHaveBeenCalledWith({
      where: { status: "ACTIVE", endTime: { gt: expect.any(Date) } },
    });
    expect(db.cardAuction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isFeatured: "desc" }, { endTime: "asc" }],
        take: 20,
        skip: 0,
      })
    );
  });
});
