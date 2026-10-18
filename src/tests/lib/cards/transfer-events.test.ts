/** @jest-environment node */
/** The ownership trail and the sales record: every row names the card, the serial and the finish at the time. */
import {
  SALE_ACTIONS,
  listCardSales,
  recordSaleTx,
  recordTransferTx,
} from "~/lib/cards/transfer-events";

const NOW = new Date("2026-11-02T12:00:00Z");

function makeTx() {
  return {
    cardTransferEvent: { create: jest.fn().mockResolvedValue({}) },
    card: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

describe("transfer events", () => {
  it("records the card, serial and finish on every event", async () => {
    const tx = makeTx();
    await recordTransferTx(tx as never, {
      ownershipId: "own_1",
      cardId: "card_1",
      serialNumber: 7,
      finish: "FOIL",
      fromUserId: "a",
      toUserId: "b",
      action: "TRADE",
    });
    expect(tx.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        cardId: "card_1",
        serialNumber: 7,
        finish: "FOIL",
        fromUserId: "a",
        toUserId: "b",
        action: "TRADE",
        price: null,
      },
    });
    expect(tx.card.updateMany).not.toHaveBeenCalled();
  });

  it("records a sale with its whole price and marks the card's first sale once", async () => {
    const tx = makeTx();
    await recordSaleTx(tx as never, {
      ownershipId: "own_1",
      cardId: "card_1",
      serialNumber: 3,
      finish: "STANDARD",
      sellerId: "s",
      buyerId: "b",
      price: 249.6,
      action: "LISTING_SALE",
      now: NOW,
    });
    expect(tx.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        cardId: "card_1",
        serialNumber: 3,
        finish: "STANDARD",
        fromUserId: "s",
        toUserId: "b",
        action: "LISTING_SALE",
        price: 250,
      },
    });
    expect(tx.card.updateMany).toHaveBeenCalledWith({
      where: { id: "card_1", firstSoldAt: null },
      data: { firstSoldAt: NOW },
    });
  });

  it("counts auctions and listings as sales, and nothing else", () => {
    expect(SALE_ACTIONS).toEqual(["AUCTION_END", "AUCTION_BUYOUT", "LISTING_SALE"]);
  });

  it("lists a card's priced sales newest first, leaving out a sale with no price", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { price: 120, finish: "FOIL", createdAt: NOW },
      { price: null, finish: "STANDARD", createdAt: NOW },
      { price: 90, finish: null, createdAt: NOW },
    ]);
    expect(await listCardSales({ cardTransferEvent: { findMany } } as never, "card_1", 5)).toEqual([
      { price: 120, finish: "FOIL", at: NOW },
      { price: 90, finish: null, at: NOW },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        cardId: "card_1",
        action: { in: ["AUCTION_END", "AUCTION_BUYOUT", "LISTING_SALE"] },
        price: { not: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { price: true, finish: true, createdAt: true },
    });
  });
});
