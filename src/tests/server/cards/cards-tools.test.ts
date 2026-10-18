/** @jest-environment node */
/**
 * Player card tools: grant and revoke with reason and audit, cancel auctions refunding the held bid and half the
 * listing fee, void trades releasing the held cards, award packs. Each clears the touched players' vault caches.
 */
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn() }));
jest.mock("~/lib/cards/capacity", () => ({ copyRoom: jest.fn() }));
jest.mock("~/lib/lorewards/trophy-cards", () => ({
  isTrophyCard: (card: { cardType: string }) => card.cardType === "TROPHY",
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/economy/auction-service", () => ({
  refundListingFeeTx: jest.fn().mockResolvedValue(2.5),
}));
jest.mock("~/lib/vault/vault-cache", () => ({ clearVaultCaches: jest.fn() }));
jest.mock("~/lib/vault/vault-ledger", () => ({
  earnCreditsTx: jest.fn(),
  spendCreditsTx: jest.fn(),
  LedgerError: class LedgerError extends Error {},
}));

import { copyRoom } from "~/lib/cards/capacity";
import { refundListingFeeTx } from "~/lib/economy/auction-service";
import { mintCopy } from "~/lib/cards/mint";
import { notificationAPI } from "~/lib/notifications/api";
import { clearVaultCaches } from "~/lib/vault/vault-cache";
import { earnCreditsTx } from "~/lib/vault/vault-ledger";
import {
  adminCancelAuction,
  awardPack,
  grantCard,
  playerCardInventory,
  revokeCopy,
  voidTrade,
} from "~/server/modules/cards/cards.tools";
import { createMockPrisma as createProxy } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
/** The proxy, plus the raw call the serial lock makes. */
const createMockPrisma = () => createProxy({ $executeRaw: jest.fn().mockResolvedValue(1) });

beforeEach(() => jest.clearAllMocks());

describe("playerCardInventory", () => {
  it("flags auctioned and listed copies, summarises auctions and trades, and reports no limit for exempt staff", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "user_1", role: { level: 10 } });
    db.cardOwnership.findMany.mockResolvedValue([
      {
        id: "own_1",
        serialNumber: 3,
        _count: { CardAuction: 2, listings: 0 },
        cards: { title: "Elm" },
      },
      {
        id: "own_2",
        serialNumber: 4,
        _count: { CardAuction: 0, listings: 1 },
        cards: { title: "Elm" },
      },
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
        currentBidderId: null,
        bidCount: 2,
        endTime: new Date(0),
        serialNumber: 3,
        card: { title: "Elm" },
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
    // Market history of either kind means no revoke (removeCopyTx), so the sheet offers none
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: { select: { CardAuction: true, listings: true } },
        }),
      })
    );
    expect(inventory.copies).toEqual([
      { id: "own_1", serialNumber: 3, auctioned: true, listed: false, cards: { title: "Elm" } },
      { id: "own_2", serialNumber: 4, auctioned: false, listed: true, cards: { title: "Elm" } },
    ]);
    expect(inventory.packs).toEqual([
      { id: "up_1", name: "Founders", acquiredMethod: "ADMIN_AWARD", acquiredDate: new Date(0) },
    ]);
    // An auction names its card and serial from its own row, which outlives the copy
    expect(db.cardAuction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ serialNumber: true, card: { select: { title: true } } }),
      })
    );
    expect(inventory.auctions[0]).toMatchObject({
      title: "Elm #3",
      selling: true,
      hasBid: false,
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
  function setup(
    card: {
      cardType?: string;
      reviewState?: string;
      isRetired?: boolean;
      artLicence?: { status: string } | null;
    },
    room: number
  ) {
    const db = createMockPrisma();
    db.card.findUnique.mockResolvedValue({
      id: "card_1",
      title: "Elm",
      cardType: "LORE",
      reviewState: "APPROVED",
      isRetired: false,
      artLicence: null,
      ...card,
    });
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
    expect(clearVaultCaches).toHaveBeenCalledWith({ id: "user_1", clerkUserId: "clerk_1" });
  });

  it.each([
    [{ reviewState: "PENDING" }, "This card is waiting for review."],
    [{ reviewState: "REJECTED" }, "This card was rejected."],
    [{ isRetired: true }, "This card is retired."],
    [{ artLicence: { status: "RESTRICTED" } }, "This card's art licence is restricted."],
  ])("respects the review and licence gates: refuses %o", async (card, message) => {
    const db = setup(card, 5);
    await expect(grantCard(db as never, actor, input)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message,
    });
    expect(db.card.findUnique.mock.calls[0]![0].select).toMatchObject({
      reviewState: true,
      isRetired: true,
      artLicence: { select: { status: true } },
    });
    expect(mintCopy).not.toHaveBeenCalled();
  });

  it.each(["OPEN", "UNKNOWN"])("grants a card whose art licence is %s", async (status) => {
    const db = setup({ artLicence: { status } }, 5);
    await expect(grantCard(db as never, actor, input)).resolves.toMatchObject({ serialNumber: 9 });
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
    finish: "HOLO",
    cards: { id: "card_1", title: "Elm", cardType },
  });
  const revoke = (db: ReturnType<typeof createMockPrisma>) =>
    revokeCopy(db as never, actor, { ownershipId: "own_1", reason: "Duplicate grant" });

  it("keeps the copy's trail, records the revoke (with its finish) before deleting the copy, and audits it", async () => {
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
        finish: "HOLO",
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
    expect(clearVaultCaches).toHaveBeenCalledWith({ id: "user_1", clerkUserId: "clerk_1" });
  });

  it("takes the card's serial lock before it checks or writes anything", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findUnique.mockResolvedValue(copy());
    db.cardOwnership.deleteMany.mockResolvedValue({ count: 1 });

    await revoke(db);

    const [strings, namespace, cardId] = db.$executeRaw.mock.calls[0]!;
    expect((strings as string[]).join("?")).toContain("pg_advisory_xact_lock(?::int, hashtext(?))");
    expect([namespace, cardId]).toEqual([7331, "card_1"]);
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.cardAuction.count.mock.invocationCallOrder[0]!
    );
  });

  // The owner's rule, kept though a removed copy's auctions and listings would now stay
  it.each([
    ["an auction", "cardAuction", []],
    ["a listing", "cardListing", [[{ where: { ownershipId: "own_1" } }]]],
  ] as const)(
    "refuses a copy with %s in its history, of any status",
    async (_, model, listingChecks) => {
      const db = createMockPrisma();
      db.cardOwnership.findUnique.mockResolvedValue(copy());
      db.cardAuction.count.mockResolvedValue(0);
      db.cardListing.count.mockResolvedValue(0);
      db[model].count.mockResolvedValue(1);

      await expect(revoke(db)).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "This copy has been on the market, so it can't be removed.",
      });
      expect(db.cardAuction.count).toHaveBeenCalledWith({ where: { cardInstanceId: "own_1" } });
      expect(db.cardListing.count.mock.calls).toEqual(listingChecks);
      expect(db.cardTransferEvent.create).not.toHaveBeenCalled();
      expect(db.cardOwnership.deleteMany).not.toHaveBeenCalled();
    }
  );

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
    isFeatured: false,
    endTime: new Date(Date.now() + 3_600_000),
  };

  it("cancels, unlocks the copy, refunds the held bid and half the listing fee, and audits who got what", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue(auction);
    db.cardAuction.updateMany.mockResolvedValue({ count: 1 });

    await adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" });

    // Still running: the swap itself requires the end to be ahead, so it cannot race the end passing
    expect(db.cardAuction.updateMany).toHaveBeenCalledWith({
      where: {
        id: "auc_1",
        status: "ACTIVE",
        currentBid: 120,
        currentBidderId: "bidder",
        endTime: { gt: expect.any(Date) },
      },
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
    // The seller's own cancel path: half the listing fee back through the ledger
    expect(refundListingFeeTx).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: "auc_1", sellerId: "seller", isFeatured: false }),
      "admin_cancel"
    );
    expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_AUCTION_CANCEL",
      target: "auc_1",
      details:
        "Cancelled the auction of seller seller: refunded the 120 IxC bid to bidder, refunded 2.5 IxC of the listing fee to the seller. Reason: Seller asked",
    });
    expect(clearVaultCaches).toHaveBeenCalledWith(expect.objectContaining({ id: "seller" }));
    expect(clearVaultCaches).toHaveBeenCalledWith(expect.objectContaining({ id: "bidder" }));
  });

  it("refunds no bid when the auction has none, still returning half the fee to the seller", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue({ ...auction, currentBidderId: null });
    db.cardAuction.updateMany.mockResolvedValue({ count: 1 });

    await adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" });

    expect(earnCreditsTx).not.toHaveBeenCalled();
    expect(refundListingFeeTx).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create.mock.calls[0]![0].data.details).toContain("no bid to refund");
    expect(clearVaultCaches).toHaveBeenCalledTimes(1);
  });

  it("unlocks no copy when the auction's copy is gone, still refunding the bid and the fee", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue({ ...auction, cardInstanceId: null });
    db.cardAuction.updateMany.mockResolvedValue({ count: 1 });

    await adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" });

    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(earnCreditsTx).toHaveBeenCalledTimes(1);
    expect(refundListingFeeTx).toHaveBeenCalledTimes(1);
  });

  it("refuses an auction the completion cron settled after the admin loaded it, refunding nothing", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue(auction);
    db.cardAuction.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(earnCreditsTx).not.toHaveBeenCalled();
    expect(refundListingFeeTx).not.toHaveBeenCalled();
  });

  it("refuses an auction past its end that the cron has not settled yet, refunding nothing", async () => {
    const db = createMockPrisma();
    db.cardAuction.findUnique.mockResolvedValue({
      ...auction,
      endTime: new Date(Date.now() - 1000),
    });
    // The swap's endTime condition matches no row once the end has passed
    db.cardAuction.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      adminCancelAuction(db as never, actor, { auctionId: "auc_1", reason: "Seller asked" })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This auction has ended; it settles on its own.",
    });
    expect(db.cardAuction.updateMany.mock.calls[0]![0].where.endTime).toEqual({
      gt: expect.any(Date),
    });
    expect(earnCreditsTx).not.toHaveBeenCalled();
    expect(refundListingFeeTx).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
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
      details: "Voided the trade from user_1 to user_2. Reason: Scam report",
    });
    expect(clearVaultCaches).toHaveBeenCalledWith(expect.objectContaining({ id: "user_1" }));
    expect(clearVaultCaches).toHaveBeenCalledWith(expect.objectContaining({ id: "user_2" }));
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
