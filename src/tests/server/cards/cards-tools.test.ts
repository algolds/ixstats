/** @jest-environment node */
/**
 * Player card tools: grant and revoke with reason and audit, cancel auctions refunding the held bid, void trades
 * releasing the held cards, award packs.
 */
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn() }));
jest.mock("~/lib/cards/capacity", () => ({ copyRoom: jest.fn() }));
jest.mock("~/lib/lorewards/trophy-cards", () => ({
  isTrophyCard: (card: { cardType: string }) => card.cardType === "TROPHY",
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  earnCreditsTx: jest.fn(),
  spendCreditsTx: jest.fn(),
  LedgerError: class LedgerError extends Error {},
}));

import { copyRoom } from "~/lib/cards/capacity";
import { mintCopy } from "~/lib/cards/mint";
import { notificationAPI } from "~/lib/notifications/api";
import { earnCreditsTx } from "~/lib/vault/vault-ledger";
import {
  adminCancelAuction,
  awardPack,
  grantCard,
  playerCardInventory,
  revokeCopy,
  voidTrade,
} from "~/server/modules/cards/cards.tools";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };

beforeEach(() => jest.clearAllMocks());

describe("playerCardInventory", () => {
  it("flags auctioned copies, summarises auctions and trades, and reports no limit for exempt staff", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "user_1", role: { level: 10 } });
    db.cardOwnership.findMany.mockResolvedValue([
      { id: "own_1", serialNumber: 3, _count: { CardAuction: 2 }, cards: { title: "Elm" } },
    ]);
    db.cardOwnership.count.mockResolvedValue(1);
    db.userPack.findMany.mockResolvedValue([
      {
        id: "up_1",
        acquiredMethod: "ADMIN_AWARD",
        acquiredDate: new Date(0),
        pack: { name: "Founders" },
      },
    ]);
    db.cardAuction.findMany.mockResolvedValue([
      {
        id: "auc_1",
        sellerId: "user_1",
        currentBid: 120,
        bidCount: 2,
        endTime: new Date(0),
        CardOwnership: { serialNumber: 3, cards: { title: "Elm" } },
      },
    ]);
    db.tradeOffer.findMany.mockResolvedValue([
      {
        id: "tr_1",
        initiatorId: "user_2",
        initiatorCardIds: ["a", "b"],
        recipientCardIds: "not an array",
        initiatorCredits: 5,
        recipientCredits: 0,
        expiresAt: new Date(0),
      },
    ]);
    jest.mocked(copyRoom).mockResolvedValue(Number.POSITIVE_INFINITY);

    const inventory = await playerCardInventory(db as never, "user_1");

    expect(copyRoom).toHaveBeenCalledWith(db, { id: "user_1", roleLevel: 10 });
    expect(inventory.room).toBeNull();
    expect(inventory.copies).toEqual([
      { id: "own_1", serialNumber: 3, auctioned: true, cards: { title: "Elm" } },
    ]);
    expect(inventory.packs).toEqual([
      { id: "up_1", name: "Founders", acquiredMethod: "ADMIN_AWARD", acquiredDate: new Date(0) },
    ]);
    expect(inventory.auctions[0]).toMatchObject({
      title: "Elm #3",
      selling: true,
      currentBid: 120,
    });
    expect(inventory.trades[0]).toMatchObject({
      initiating: false,
      copiesOffered: 2,
      copiesAsked: 0,
    });
  });

  it("refuses a player who does not exist", async () => {
    const db = createMockPrisma();
    await expect(playerCardInventory(db as never, "ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("grantCard", () => {
  function setup(card: { cardType: string }, room: number) {
    const db = createMockPrisma();
    db.card.findUnique.mockResolvedValue({ id: "card_1", title: "Elm", ...card });
    db.user.findUnique.mockResolvedValue({
      id: "user_1",
      clerkUserId: "clerk_1",
      role: { level: 100 },
    });
    jest.mocked(copyRoom).mockResolvedValue(room);
    jest.mocked(mintCopy).mockResolvedValue({ id: "own_9", serialNumber: 9 } as never);
    return db;
  }
  const input = {
    userId: "user_1",
    cardId: "card_1",
    finish: "STANDARD",
    reason: "Event prize",
  } as const;

  it("mints an ADMIN copy, writes the reason to the audit log and tells the player", async () => {
    const db = setup({ cardType: "LORE" }, 5);
    await expect(grantCard(db as never, actor, input)).resolves.toEqual({
      ownershipId: "own_9",
      serialNumber: 9,
    });
    expect(mintCopy).toHaveBeenCalledWith(db, {
      cardId: "card_1",
      ownerId: "user_1",
      finish: "STANDARD",
      source: "ADMIN",
    });
    expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      userId: "clerk_admin",
      action: "CARD_GRANT",
      target: "card_1",
      details: expect.stringContaining("Event prize"),
    });
    expect(notificationAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk_1", category: "cards" })
    );
  });

  it("refuses a trophy and a full inventory", async () => {
    await expect(
      grantCard(setup({ cardType: "TROPHY" }, 5) as never, actor, input)
    ).rejects.toThrow(/reassigning the Loreward/);
    await expect(grantCard(setup({ cardType: "LORE" }, 0) as never, actor, input)).rejects.toThrow(
      /inventory is full/
    );
    expect(mintCopy).not.toHaveBeenCalled();
  });

  it("refuses a card that does not exist", async () => {
    const db = setup({ cardType: "LORE" }, 5);
    db.card.findUnique.mockResolvedValue(null);
    await expect(grantCard(db as never, actor, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("revokeCopy", () => {
  const copy = (cardType = "LORE") => ({
    id: "own_1",
    ownerId: "user_1",
    serialNumber: 3,
    cards: { id: "card_1", title: "Elm", cardType },
  });
  const revoke = (db: ReturnType<typeof createMockPrisma>) =>
    revokeCopy(db as never, actor, { ownershipId: "own_1", reason: "Duplicate grant" });

  it("keeps the copy's trail, records the revoke before deleting the copy, and audits it", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findUnique.mockResolvedValue(copy());
    db.cardAuction.count.mockResolvedValue(0);
    db.tradeOffer.count.mockResolvedValue(0);
    db.cardOwnership.deleteMany.mockResolvedValue({ count: 1 });
    db.user.findUnique.mockResolvedValue({ clerkUserId: "clerk_1" });

    await revoke(db);

    expect(db.cardTransferEvent.updateMany).toHaveBeenCalledWith({
      where: { ownershipId: "own_1", cardId: null },
      data: { cardId: "card_1", serialNumber: 3 },
    });
    expect(db.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        cardId: "card_1",
        serialNumber: 3,
        fromUserId: "user_1",
        toUserId: null,
        action: "REVOKE",
      },
    });
    expect(db.cardOwnership.deleteMany).toHaveBeenCalledWith({
      where: { id: "own_1", ownerId: "user_1", isLocked: false },
    });
    expect(db.cardTransferEvent.create.mock.invocationCallOrder[0]).toBeLessThan(
      db.cardOwnership.deleteMany.mock.invocationCallOrder[0]!
    );
    expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_REVOKE",
      details: expect.stringContaining("Duplicate grant"),
    });
  });

  it("refuses a copy with any auction history, so the auction and its bids are never cascaded away", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findUnique.mockResolvedValue(copy());
    db.cardAuction.count.mockResolvedValue(1);

    await expect(revoke(db)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This copy has been auctioned, and removing it would erase that auction's history.",
    });
    expect(db.cardAuction.count).toHaveBeenCalledWith({ where: { cardInstanceId: "own_1" } });
    expect(db.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(db.cardOwnership.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses a copy named in a pending trade offer, on either side", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findUnique.mockResolvedValue(copy());
    db.cardAuction.count.mockResolvedValue(0);
    db.tradeOffer.count.mockResolvedValue(1);

    await expect(revoke(db)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This copy is in a pending trade. Void the trade first.",
    });
    expect(db.tradeOffer.count).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        OR: [
          { initiatorCardIds: { array_contains: ["own_1"] } },
          { recipientCardIds: { array_contains: ["own_1"] } },
        ],
      },
    });
    expect(db.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(db.cardOwnership.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses a copy that was locked or moved meanwhile, and a trophy", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findUnique.mockResolvedValueOnce(copy()).mockResolvedValueOnce(copy("TROPHY"));
    db.cardOwnership.deleteMany.mockResolvedValue({ count: 0 });

    await expect(revoke(db)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(revoke(db)).rejects.toThrow(/reassigning the Loreward/);
    expect(db.cardOwnership.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("adminCancelAuction", () => {
  const auction = {
    id: "auc_1",
    status: "ACTIVE",
    sellerId: "seller",
    cardInstanceId: "own_1",
    currentBid: 120,
    currentBidderId: "bidder",
  };

  it("cancels, unlocks the copy and refunds the held bid", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue(auction);
    db.cardAuction.updateMany.mockResolvedValue({ count: 1 });

    await adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" });

    expect(db.cardAuction.updateMany).toHaveBeenCalledWith({
      where: { id: "auc_1", status: "ACTIVE", currentBid: 120, currentBidderId: "bidder" },
      data: { status: "CANCELLED" },
    });
    expect(db.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1" },
      data: { isLocked: false },
    });
    expect(earnCreditsTx).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: "bidder",
        amount: 120,
        type: "REFUND",
        source: "auction_bid_refund",
      })
    );
    expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_AUCTION_CANCEL",
      target: "auc_1",
    });
  });

  it("refunds nothing when the auction has no bid", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue({ ...auction, currentBidderId: null });
    db.cardAuction.updateMany.mockResolvedValue({ count: 1 });

    await adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" });

    expect(earnCreditsTx).not.toHaveBeenCalled();
  });

  it("refuses an auction the completion cron settled after the admin loaded it, refunding nothing", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue(auction);
    db.cardAuction.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(earnCreditsTx).not.toHaveBeenCalled();
  });

  it("refuses an auction that has already ended", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue({ ...auction, status: "COMPLETED" });
    await expect(
      adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.cardAuction.updateMany).not.toHaveBeenCalled();
  });
});

describe("voidTrade", () => {
  it("cancels a pending trade, releases the initiator's locked cards and audits it", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findUnique.mockResolvedValue({
      id: "tr_1",
      initiatorId: "user_1",
      recipientId: "user_2",
      initiatorCardIds: ["own_1", "own_2"],
    });
    db.tradeOffer.updateMany.mockResolvedValue({ count: 1 });

    await voidTrade(db as never, actor, { tradeId: "tr_1", reason: "Scam report" });

    expect(db.tradeOffer.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: "tr_1", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    expect(db.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["own_1", "own_2"] }, ownerId: "user_1" },
      data: { isLocked: false },
    });
    expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_TRADE_VOID",
      details: expect.stringContaining("Scam report"),
    });
  });

  it("refuses a trade that is no longer pending, releasing nothing", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findUnique.mockResolvedValue({
      id: "tr_1",
      initiatorId: "user_1",
      recipientId: "user_2",
      initiatorCardIds: ["own_1"],
    });
    db.tradeOffer.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      voidTrade(db as never, actor, { tradeId: "tr_1", reason: "Scam report" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
  });
});

describe("awardPack", () => {
  it("gives an unopened pack and audits it", async () => {
    const db = createMockPrisma();
    db.cardPack.findUnique.mockResolvedValue({ id: "pack_1", name: "Founders" });
    db.user.findUnique.mockResolvedValue({ id: "user_1", clerkUserId: "clerk_1" });
    db.userPack.create.mockResolvedValue({ id: "up_1" });

    await awardPack(db as never, actor, { userId: "user_1", packId: "pack_1" });

    expect(db.userPack.create).toHaveBeenCalledWith({
      data: { userId: "user_1", packId: "pack_1", acquiredMethod: "ADMIN_AWARD" },
    });
    expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_PACK_AWARD",
      target: "user_1",
    });
  });

  it("refuses a pack that does not exist", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "user_1", clerkUserId: "clerk_1" });
    await expect(
      awardPack(db as never, actor, { userId: "user_1", packId: "gone" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.userPack.create).not.toHaveBeenCalled();
  });
});
