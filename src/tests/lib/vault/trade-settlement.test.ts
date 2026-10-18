/**
 * Plan 331: transaction-scoped trade settlement helpers.
 * Every transition is a conditional updateMany checked through `count`.
 */

jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  earnCreditsTx: jest.fn(),
  spendCreditsTx: jest.fn(),
}));

import { earnCreditsTx, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import {
  claimPendingTradeTx,
  lockCardsTx,
  recordTradeTransfersTx,
  transferCardsTx,
  transferCreditsTx,
  unlockCardsTx,
} from "~/lib/vault/trade-settlement";

const spendMock = jest.mocked(spendCreditsTx);
const earnMock = jest.mocked(earnCreditsTx);

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

    await expect(claimPendingTradeTx(asTx(tx), "trade_1", "REJECTED", NOW)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("resolves when exactly one row moved, writing the new status and respondedAt", async () => {
    const tx = makeTx();
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      claimPendingTradeTx(asTx(tx), "trade_1", "CANCELLED", NOW)
    ).resolves.toBeUndefined();

    const call = tx.tradeOffer.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "trade_1", status: "PENDING" });
    expect(call.data).toEqual({ status: "CANCELLED", respondedAt: NOW });
  });

  it("requires expiresAt > now only for ACCEPTED", async () => {
    const tx = makeTx();
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 1 });

    await claimPendingTradeTx(asTx(tx), "trade_1", "ACCEPTED", NOW);

    expect(tx.tradeOffer.updateMany.mock.calls[0][0].where).toEqual({
      id: "trade_1",
      status: "PENDING",
      expiresAt: { gt: NOW },
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
  it("writes one TRADE row per moved copy, stamped with its card and serial", async () => {
    const tx = {
      cardOwnership: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", cardId: "card_a", serialNumber: 4 },
          { id: "c2", cardId: "card_b", serialNumber: 9 },
        ]),
      },
      cardTransferEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };

    await recordTradeTransfersTx(tx as never, {
      ids: ["c1", "c2"],
      fromId: "from_1",
      toId: "to_1",
    });

    expect(tx.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2"] } },
      select: { id: true, cardId: true, serialNumber: true },
    });
    expect(tx.cardTransferEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          ownershipId: "c1",
          cardId: "card_a",
          serialNumber: 4,
          fromUserId: "from_1",
          toUserId: "to_1",
          action: "TRADE",
        },
        {
          ownershipId: "c2",
          cardId: "card_b",
          serialNumber: 9,
          fromUserId: "from_1",
          toUserId: "to_1",
          action: "TRADE",
        },
      ],
    });
  });

  it("writes nothing for a side that gave no cards", async () => {
    const tx = {
      cardOwnership: { findMany: jest.fn() },
      cardTransferEvent: { createMany: jest.fn() },
    };

    await recordTradeTransfersTx(tx as never, { ids: [], fromId: "from_1", toId: "to_1" });

    expect(tx.cardOwnership.findMany).not.toHaveBeenCalled();
    expect(tx.cardTransferEvent.createMany).not.toHaveBeenCalled();
  });
});

describe("transferCreditsTx", () => {
  beforeEach(() => {
    spendMock.mockReset();
    earnMock.mockReset();
    spendMock.mockResolvedValue({ newBalance: 50, amount: 50 });
    earnMock.mockResolvedValue({ newBalance: 150, amount: 50 });
  });

  it("is a no-op when amount <= 0", async () => {
    await transferCreditsTx(asTx(makeTx()), {
      fromUserId: "a",
      toUserId: "b",
      amount: 0,
      tradeId: "trade_1",
    });

    expect(spendMock).not.toHaveBeenCalled();
    expect(earnMock).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST on a guarded-debit failure and never credits the other side", async () => {
    spendMock.mockRejectedValue(
      new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits for transaction.", 10)
    );

    await expect(
      transferCreditsTx(asTx(makeTx()), {
        fromUserId: "a",
        toUserId: "b",
        amount: 50,
        tradeId: "trade_1",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(earnMock).not.toHaveBeenCalled();
  });

  it("debits the sender as SPEND_MARKET and credits the receiver as EARN_CARDS, both tagged P2P_TRADE", async () => {
    const tx = makeTx();

    await transferCreditsTx(asTx(tx), {
      fromUserId: "a",
      toUserId: "b",
      amount: 50,
      tradeId: "trade_1",
    });

    expect(spendMock).toHaveBeenCalledWith(tx, {
      userId: "a",
      amount: 50,
      type: "SPEND_MARKET",
      source: "P2P_TRADE",
      metadata: { tradeId: "trade_1" },
    });
    expect(earnMock).toHaveBeenCalledWith(tx, {
      userId: "b",
      amount: 50,
      type: "EARN_CARDS",
      source: "P2P_TRADE",
      metadata: { tradeId: "trade_1" },
    });
    expect(spendMock.mock.invocationCallOrder[0]).toBeLessThan(
      earnMock.mock.invocationCallOrder[0]
    );
  });

  it("rethrows non-ledger errors unchanged", async () => {
    const boom = new Error("connection reset");
    spendMock.mockRejectedValue(boom);

    await expect(
      transferCreditsTx(asTx(makeTx()), {
        fromUserId: "a",
        toUserId: "b",
        amount: 5,
        tradeId: "trade_1",
      })
    ).rejects.toBe(boom);
  });
});
