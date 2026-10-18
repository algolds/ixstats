/**
 * Plan 331: transaction-scoped trade settlement helpers.
 * Every transition is a conditional updateMany checked through `count`.
 */

import {
  claimPendingTradeTx,
  lockCardsTx,
  recordTradeTransfersTx,
  transferCardsTx,
  unlockCardsTx,
} from "~/lib/vault/trade-settlement";

const NOW = new Date("2026-09-25T12:00:00.000Z");

function makeTx() {
  return {
    tradeOffer: { updateMany: jest.fn() },
    cardOwnership: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
  };
}
const asTx = (tx: ReturnType<typeof makeTx>) => tx as never;

describe("claimPendingTradeTx", () => {
  it("takes the status from the TradeOfferStatus enum, with no string stand-in left", async () => {
    expect(await import("~/lib/vault/trade-settlement")).not.toHaveProperty("TradeStatus");
  });

  it("throws CONFLICT when the trade is no longer PENDING (count 0)", async () => {
    const tx = makeTx();
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      claimPendingTradeTx(asTx(tx), { tradeId: "trade_1", next: "REJECTED", now: NOW })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This trade changed. Review the latest table.",
    });
  });

  it("resolves when exactly one row moved, writing the new status and respondedAt", async () => {
    const tx = makeTx();
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      claimPendingTradeTx(asTx(tx), { tradeId: "trade_1", next: "CANCELLED", now: NOW })
    ).resolves.toBeUndefined();

    const call = tx.tradeOffer.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "trade_1", status: "PENDING" });
    expect(call.data).toEqual({ status: "CANCELLED", respondedAt: NOW });
  });

  it("requires expiresAt > now only for ACCEPTED", async () => {
    const tx = makeTx();
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 1 });

    await claimPendingTradeTx(asTx(tx), { tradeId: "trade_1", next: "ACCEPTED", now: NOW });

    expect(tx.tradeOffer.updateMany.mock.calls[0][0].where).toEqual({
      id: "trade_1",
      status: "PENDING",
      expiresAt: { gt: NOW },
    });
  });

  it("guards the revision when one is given", async () => {
    const tx = makeTx();
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 1 });
    await claimPendingTradeTx(asTx(tx), {
      tradeId: "trade_1",
      next: "ACCEPTED",
      now: NOW,
      revision: 4,
    });
    expect(tx.tradeOffer.updateMany.mock.calls[0][0].where).toEqual({
      id: "trade_1",
      status: "PENDING",
      revision: 4,
      expiresAt: { gt: NOW },
    });
  });

  it("guards revision 0 too, the first table", async () => {
    const tx = makeTx();
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 1 });
    await claimPendingTradeTx(asTx(tx), {
      tradeId: "trade_1",
      next: "REJECTED",
      now: NOW,
      revision: 0,
    });
    expect(tx.tradeOffer.updateMany.mock.calls[0][0].where).toEqual({
      id: "trade_1",
      status: "PENDING",
      revision: 0,
    });
  });
});

describe("lockCardsTx", () => {
  it("throws CONFLICT when fewer cards than requested were lockable", async () => {
    const tx = makeTx();
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 1 });

    await expect(lockCardsTx(asTx(tx), ["c1", "c2"], "owner_1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(tx.cardOwnership.updateMany.mock.calls[0][0]).toEqual({
      where: { id: { in: ["c1", "c2"] }, ownerId: "owner_1", isLocked: false },
      data: { isLocked: true },
    });
  });

  it("resolves when every card was locked", async () => {
    const tx = makeTx();
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 2 });

    await expect(lockCardsTx(asTx(tx), ["c1", "c2"], "owner_1")).resolves.toBeUndefined();
  });
});

describe("unlockCardsTx", () => {
  it("is scoped to the owner and does not check the count (best-effort release)", async () => {
    const tx = makeTx();
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

    await expect(unlockCardsTx(asTx(tx), ["c1"], "owner_1")).resolves.toBeUndefined();
    expect(tx.cardOwnership.updateMany.mock.calls[0][0]).toEqual({
      where: { id: { in: ["c1"] }, ownerId: "owner_1" },
      data: { isLocked: false },
    });
  });
});

describe("transferCardsTx", () => {
  it("throws CONFLICT when a card is no longer held by fromId in the expected lock state", async () => {
    const tx = makeTx();
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      transferCardsTx(asTx(tx), {
        ids: ["c1", "c2"],
        fromId: "from_1",
        toId: "to_1",
        expectLocked: false,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(tx.cardOwnership.updateMany.mock.calls[0][0]).toEqual({
      where: { id: { in: ["c1", "c2"] }, ownerId: "from_1", isLocked: false },
      data: { ownerId: "to_1", isLocked: false, acquiredAt: NOW },
    });
  });

  it("matches on isLocked: true for cards locked at offer time", async () => {
    const tx = makeTx();
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 1 });

    await transferCardsTx(asTx(tx), {
      ids: ["c1"],
      fromId: "from_1",
      toId: "to_1",
      expectLocked: true,
      now: NOW,
    });

    expect(tx.cardOwnership.updateMany.mock.calls[0][0].where).toEqual({
      id: { in: ["c1"] },
      ownerId: "from_1",
      isLocked: true,
    });
  });
});

describe("recordTradeTransfersTx", () => {
  it("writes one row per moved copy, stamped with its card, serial, finish and the move's action", async () => {
    const tx = {
      cardOwnership: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", cardId: "card_a", serialNumber: 4, finish: "HOLO" },
          { id: "c2", cardId: "card_b", serialNumber: 9, finish: "STANDARD" },
        ]),
      },
      cardTransferEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };

    await recordTradeTransfersTx(tx as never, {
      ids: ["c1", "c2"],
      fromId: "from_1",
      toId: "to_1",
      action: "TRADE",
    });

    expect(tx.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2"] } },
      select: { id: true, cardId: true, serialNumber: true, finish: true },
    });
    expect(tx.cardTransferEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          ownershipId: "c1",
          cardId: "card_a",
          serialNumber: 4,
          finish: "HOLO",
          fromUserId: "from_1",
          toUserId: "to_1",
          action: "TRADE",
        },
        {
          ownershipId: "c2",
          cardId: "card_b",
          serialNumber: 9,
          finish: "STANDARD",
          fromUserId: "from_1",
          toUserId: "to_1",
          action: "TRADE",
        },
      ],
    });
  });

  it("logs a gift's copies as GIFT", async () => {
    const tx = {
      cardOwnership: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "c1", cardId: "card_a", serialNumber: 4, finish: "FOIL" }]),
      },
      cardTransferEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    await recordTradeTransfersTx(tx as never, {
      ids: ["c1"],
      fromId: "from_1",
      toId: "to_1",
      action: "GIFT",
    });
    expect(tx.cardTransferEvent.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ ownershipId: "c1", action: "GIFT" }),
    ]);
  });

  it("writes nothing for a side that gave no cards", async () => {
    const tx = {
      cardOwnership: { findMany: jest.fn() },
      cardTransferEvent: { createMany: jest.fn() },
    };

    await recordTradeTransfersTx(tx as never, {
      ids: [],
      fromId: "from_1",
      toId: "to_1",
      action: "TRADE",
    });

    expect(tx.cardOwnership.findMany).not.toHaveBeenCalled();
    expect(tx.cardTransferEvent.createMany).not.toHaveBeenCalled();
  });
});

describe("the credit transfer", () => {
  it("is gone: a trade's credits move through its credit legs (fee and royalty)", async () => {
    expect(await import("~/lib/vault/trade-settlement")).not.toHaveProperty("transferCreditsTx");
  });
});
