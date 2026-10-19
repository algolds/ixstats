/** @jest-environment node */
/** Cards refresh §5.4 and §5.6: a trade offer, an auction or a transfer with a bound copy is refused. */
jest.mock("~/lib/vault/vault-service", () => ({
  getVaultConfig: jest
    .fn()
    .mockResolvedValue({ isMaintenanceMode: false, isAuctionsEnabled: true }),
  vaultService: { spendCreditsTx: jest.fn() },
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
    const tx = createMockPrisma();
    db.$transaction = jest.fn((cb: (client: typeof tx) => Promise<object>) => cb(tx));
    // The listing transaction reads the copy
    tx.cardOwnership.findFirst.mockResolvedValue({
      id: "o1",
      cardId: "card_1",
      serialNumber: 1,
      cards: { isBound: true },
    });
    await expect(
      new AuctionService().createAuction(
        { userId: "u1", cardId: "o1", startingPrice: 10, duration: "24h" },
        db as never
      )
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(vaultService.spendCreditsTx).not.toHaveBeenCalled();
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(tx.cardAuction.create).not.toHaveBeenCalled();
  });
});
