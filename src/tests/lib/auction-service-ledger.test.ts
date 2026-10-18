/**
 * Auction service <-> ledger regression (plan 327).
 *
 * The auction engine moves IxCredits inside its own Prisma interactive
 * transactions. The transaction client has NO `$transaction`, so every money
 * move must go through the *Tx ledger functions, and settlement must be
 * compare-and-swap guarded so nothing is paid twice.
 */

jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/cards/card-notify", () => ({
  notifyCards: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/websocket/market-websocket-server", () => ({
  getMarketWebSocketServer: () => null,
}));

import { TRPCError } from "@trpc/server";
import { AuctionService, refundListingFeeTx } from "~/lib/economy/auction-service";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { notifyCards } from "~/lib/cards/card-notify";
import { vaultService } from "~/lib/vault/vault-service";
import { VAULT_CONFIG_DEFAULTS } from "~/lib/vault/vault-perks";

const BALANCE = {
  credits: 1000,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  todayEarned: 0,
  vaultLevel: 1,
  vaultXp: 0,
  loginStreak: 0,
  canClaimDailyBonus: false,
  claimStreak: 0,
  premiumMultiplier: 1,
  isPremium: false,
};

interface Harness {
  balances: Record<string, number>;
  rows: any[];
  tx: any;
  db: any;
}

const vaultIdFor = (userId: string) => `vault:${userId}`;
const userIdFor = (vaultId: string) => vaultId.slice("vault:".length);

/** `tx` is shaped like Prisma.TransactionClient (no `$transaction`); `db` wraps it. */
function makeHarness(
  auction: any,
  balances: Record<string, number>,
  todayRows: Array<{ credits: number }> = []
): Harness {
  const rows: any[] = [];
  const tx: any = {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        const id = where.OR[0].id;
        return { id, clerkUserId: id };
      }),
    },
    myVault: {
      upsert: jest.fn().mockImplementation(async ({ where }: any) => ({
        id: vaultIdFor(where.userId),
        userId: where.userId,
        credits: balances[where.userId] ?? 0,
        lastDailyReset: new Date(),
        todayEarned: 0,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const u = userIdFor(where.id);
        if (data.credits?.increment) balances[u] = (balances[u] ?? 0) + data.credits.increment;
        return { id: where.id, credits: balances[u] ?? 0 };
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const u = userIdFor(where.id);
        if (where.credits?.gte !== undefined && (balances[u] ?? 0) < where.credits.gte) {
          return { count: 0 };
        }
        balances[u] = (balances[u] ?? 0) - data.credits.decrement;
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(async ({ where }: any) => ({
        id: where.id,
        credits: balances[userIdFor(where.id)] ?? 0,
      })),
    },
    vaultTransaction: {
      findMany: jest.fn().mockImplementation(async () => todayRows),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        rows.push(data);
        return { id: `row_${rows.length}` };
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    cardAuction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auctionBid: { create: jest.fn().mockResolvedValue({ id: "bid" }) },
    cardOwnership: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    // No `card.update`: the sale writes only the first-sale date; the cron owns Card.marketValue
    card: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    cardTransferEvent: { create: jest.fn().mockResolvedValue({}) },
    country: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const db: any = {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    cardAuction: { findUnique: jest.fn().mockResolvedValue(auction) },
    user: { findUnique: jest.fn().mockResolvedValue({ clerkUserId: "b" }) },
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
  };
  return { balances, rows, tx, db };
}

const rowsFor = (h: Harness, userId: string) =>
  h.rows.filter((r) => r.vaultId === vaultIdFor(userId));

const inTenMinutes = () => new Date(Date.now() + 10 * 60 * 1000);
const tenMinutesAgo = () => new Date(Date.now() - 10 * 60 * 1000);

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    cardInstanceId: "c1",
    sellerId: "s",
    startingPrice: 100,
    currentBid: 100,
    buyoutPrice: null,
    currentBidderId: "p",
    winnerId: null,
    finalPrice: null,
    bidCount: 1,
    status: "ACTIVE",
    isFeatured: false,
    endTime: inTenMinutes(),
    CardOwnership: {
      id: "c1",
      cardId: "card1",
      serialNumber: 7,
      finish: "FOIL",
      cards: { id: "card1", title: "Test Card", cardType: "LORE", countryId: null },
    },
    AuctionBid: [],
    ...overrides,
  };
}

// A listed copy is locked, so nothing burns it; the auction row outlives a copy only once the auction has ended
const goneCopy = { cardInstanceId: null, CardOwnership: null, cardId: "card1", serialNumber: 7 };

const nationCopy = {
  id: "c1",
  cardId: "card1",
  serialNumber: 7,
  finish: "STANDARD",
  cards: { id: "card1", title: "Aurelia", cardType: "NATION", countryId: "country_1" },
};

/** Every card notice sent, across calls. */
const noticesSent = () => jest.mocked(notifyCards).mock.calls.flatMap(([, notices]) => notices);

/** For each send that carried notices, whether the transaction had committed by then. */
function committedAtEachNotice(h: Harness): boolean[] {
  let committed = false;
  const sends: boolean[] = [];
  h.db.$transaction.mockImplementation(
    async (cb: (client: Harness["tx"]) => Promise<object | null>) => {
      const result = await cb(h.tx);
      committed = true;
      return result;
    }
  );
  jest.mocked(notifyCards).mockImplementation(async (_db, notices) => {
    if (notices.length > 0) sends.push(committed);
  });
  return sends;
}

describe("AuctionService <-> ledger (transaction client without $transaction)", () => {
  let service: AuctionService;

  beforeEach(() => {
    service = new AuctionService();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(vaultService, "getBalance").mockResolvedValue(BALANCE);
    jest.mocked(notifyCards).mockReset().mockResolvedValue(undefined);
    jest.mocked(grantCardXp).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("placeBid succeeds with a transaction client that has no $transaction", async () => {
    const h = makeHarness(makeAuction(), { b: 1000, p: 0 });
    expect("$transaction" in h.tx).toBe(false);

    await expect(
      service.placeBid({ userId: "b", auctionId: "a1", amount: 200 }, h.db)
    ).resolves.toEqual({ success: true });

    expect(h.balances).toEqual({ b: 800, p: 100 });
    expect(rowsFor(h, "b")).toHaveLength(1);
    expect(rowsFor(h, "b")[0]).toMatchObject({
      credits: -200,
      type: "SPEND_MARKET",
      source: "auction_bid_reserve",
    });
    expect(rowsFor(h, "p")).toHaveLength(1);
    expect(rowsFor(h, "p")[0]).toMatchObject({
      credits: 100,
      type: "REFUND",
      source: "auction_bid_refund",
    });
    expect(h.tx.cardAuction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "a1",
          status: "ACTIVE",
          currentBid: 100,
          currentBidderId: "p",
        }),
        data: expect.objectContaining({ currentBid: 200, currentBidderId: "b" }),
      })
    );
    expect(h.tx.auctionBid.create).toHaveBeenCalledTimes(1);
  });

  it("placeBid rejects when the caller is already the highest bidder", async () => {
    const h = makeHarness(makeAuction({ currentBidderId: "b" }), { b: 1000 });

    const err = await service
      .placeBid({ userId: "b", auctionId: "a1", amount: 200 }, h.db)
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("You are already the highest bidder");
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.balances).toEqual({ b: 1000 });
  });

  it("placeBid fails with CONFLICT and moves no money when the auction changed", async () => {
    const h = makeHarness(makeAuction(), { b: 1000, p: 0 });
    h.tx.cardAuction.updateMany.mockResolvedValue({ count: 0 });

    const err = await service
      .placeBid({ userId: "b", auctionId: "a1", amount: 200 }, h.db)
      .catch((e) => e);

    expect(err).toBeInstanceOf(TRPCError);
    expect(err.code).toBe("CONFLICT");
    expect(h.tx.myVault.updateMany).not.toHaveBeenCalled();
    expect(h.tx.vaultTransaction.create).not.toHaveBeenCalled();
    expect(h.tx.auctionBid.create).not.toHaveBeenCalled();
    expect(h.balances).toEqual({ b: 1000, p: 0 });
  });

  it("completeAuction pays the seller", async () => {
    const h = makeHarness(
      makeAuction({ currentBid: 500, currentBidderId: "p", endTime: tenMinutesAgo() }),
      { s: 0 }
    );
    jest.mocked(grantCardXp).mockClear();

    await service.completeAuction("a1", h.db);

    expect(h.tx.cardAuction.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", status: "ACTIVE", currentBidderId: "p", currentBid: 500 },
      data: { status: "COMPLETED", winnerId: "p", finalPrice: 500 },
    });
    // 500 IxC sale, 10% fee above 100 IxC
    expect(rowsFor(h, "s")).toHaveLength(1);
    expect(rowsFor(h, "s")[0]).toMatchObject({
      credits: 450,
      type: "EARN_CARDS",
      source: "card_sale_auction",
    });
    expect(h.balances.s).toBe(450);
    // A compare-and-swap on the seller's locked copy, never a plain update; the holding tick counts from acquiredAt
    expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerId: "s", isLocked: true },
      data: { ownerId: "p", isLocked: false, acquiredAt: expect.any(Date) },
    });
    expect(h.tx.cardOwnership.update).not.toHaveBeenCalled();
    expect(h.tx.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "c1",
        cardId: "card1",
        serialNumber: 7,
        finish: "FOIL",
        fromUserId: "s",
        toUserId: "p",
        action: "AUCTION_END",
        price: 500,
      },
    });
    // The first sale here is stamped once; the sale no longer writes Card.marketValue
    expect(h.tx.card.updateMany).toHaveBeenCalledWith({
      where: { id: "card1", firstSoldAt: null },
      data: { firstSoldAt: expect.any(Date) },
    });
    expect(jest.mocked(grantCardXp)).toHaveBeenCalledWith(
      h.tx,
      "c1",
      "AUCTION_WIN",
      JSON.stringify({ auctionId: "a1" })
    );
  });

  it("executeBuyout records the sale in the copy's trail as AUCTION_BUYOUT, with its price", async () => {
    const h = makeHarness(makeAuction({ buyoutPrice: 300, currentBidderId: null }), {
      b: 1000,
      s: 0,
    });

    await expect(service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)).resolves.toEqual({
      success: true,
    });

    expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerId: "s", isLocked: true },
      data: { ownerId: "b", isLocked: false, acquiredAt: expect.any(Date) },
    });
    expect(h.tx.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "c1",
        cardId: "card1",
        serialNumber: 7,
        finish: "FOIL",
        fromUserId: "s",
        toUserId: "b",
        action: "AUCTION_BUYOUT",
        price: 300,
      },
    });
  });

  it("executeBuyout: the buyer pays once, the outbid bidder is refunded, the seller is paid net", async () => {
    const h = makeHarness(
      makeAuction({ buyoutPrice: 800, currentBid: 300, currentBidderId: "p" }),
      { b: 1000, p: 0, s: 0 }
    );

    await service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db);

    expect(h.balances).toEqual({ b: 200, p: 300, s: 720 });
    expect(rowsFor(h, "b")).toEqual([
      expect.objectContaining({ credits: -800, source: "card_purchase_buyout" }),
    ]);
    expect(rowsFor(h, "s")).toEqual([
      expect.objectContaining({ credits: 720, type: "EARN_CARDS", source: "card_sale_buyout" }),
    ]);
    expect(h.tx.cardTransferEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "AUCTION_BUYOUT", price: 800 }),
    });
  });

  it("executeBuyout: a lost compare-and-swap moves no money", async () => {
    const h = makeHarness(makeAuction({ buyoutPrice: 800 }), { b: 1000, s: 0 });
    h.tx.cardAuction.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.tx.vaultTransaction.create).not.toHaveBeenCalled();
    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(h.balances).toEqual({ b: 1000, s: 0 });
  });

  it("executeBuyout: a copy no longer the seller's locked copy fails inside the transaction, so the payment rolls back", async () => {
    const h = makeHarness(makeAuction({ buyoutPrice: 800, currentBidderId: null }), {
      b: 1000,
      s: 0,
    });
    h.tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // The CONFLICT leaves $transaction rejected (Prisma rolls back the buyer's spend); the seller is never paid
    await expect(h.db.$transaction.mock.results[0].value).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(rowsFor(h, "s")).toEqual([]);
    expect(h.tx.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(noticesSent()).toEqual([]);
  });

  it("executeBuyout refuses a copy that is gone before anything moves", async () => {
    const h = makeHarness(makeAuction({ ...goneCopy, buyoutPrice: 800, currentBidderId: null }), {
      b: 1000,
      s: 0,
    });

    await expect(
      service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.balances).toEqual({ b: 1000, s: 0 });
  });

  it("executeBuyout pays a third party's nation royalty out of the fee and tells them after the commit", async () => {
    const h = makeHarness(
      makeAuction({ buyoutPrice: 1000, currentBidderId: null, CardOwnership: nationCopy }),
      { b: 1000, s: 0, o: 0 }
    );
    h.tx.country.findMany.mockResolvedValue([{ id: "country_1", ownerUserId: "o" }]);
    const sends = committedAtEachNotice(h);

    await service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db);

    // 1,000 IxC: the seller gets 900, the owner 20 of the 100 fee, the house the other 80; nothing is minted
    expect(h.balances).toEqual({ b: 0, s: 900, o: 20 });
    expect(rowsFor(h, "o")).toEqual([
      expect.objectContaining({ credits: 20, type: "EARN_CARDS", source: "nation_card_royalty" }),
    ]);
    expect(notifyCards).toHaveBeenCalledWith(h.db, [
      expect.objectContaining({ userId: "o", cardId: "card1", title: "Royalty paid" }),
    ]);
    expect(sends).toEqual([true]);
  });

  it("completeAuction is a no-op when already settled", async () => {
    const h = makeHarness(
      makeAuction({ currentBid: 500, currentBidderId: "p", endTime: tenMinutesAgo() }),
      { s: 0 }
    );
    h.tx.cardAuction.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.completeAuction("a1", h.db)).resolves.toBeUndefined();

    expect(h.tx.vaultTransaction.create).not.toHaveBeenCalled();
    expect(h.tx.myVault.update).not.toHaveBeenCalled();
    expect(h.tx.cardOwnership.update).not.toHaveBeenCalled();
    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(h.balances).toEqual({ s: 0 });
    expect(noticesSent()).toEqual([]);
  });

  it("completeAuction: a copy no longer the seller's locked copy fails with CONFLICT, paying nobody", async () => {
    const h = makeHarness(
      makeAuction({ currentBid: 500, currentBidderId: "p", endTime: tenMinutesAgo() }),
      { s: 0 }
    );
    h.tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.completeAuction("a1", h.db)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(h.db.$transaction.mock.results[0].value).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(rowsFor(h, "s")).toEqual([]);
    expect(h.tx.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(grantCardXp).not.toHaveBeenCalled();
  });

  it("completeAuction: a nation card sold by its own nation's owner pays no royalty and mints nothing", async () => {
    const h = makeHarness(
      makeAuction({ currentBid: 1000, endTime: tenMinutesAgo(), CardOwnership: nationCopy }),
      { s: 0, p: 0 }
    );
    h.tx.country.findMany.mockResolvedValue([{ id: "country_1", ownerUserId: "s" }]);

    await service.completeAuction("a1", h.db);

    expect(h.rows.filter((r) => r.source === "nation_card_royalty")).toHaveLength(0);
    expect(h.balances.s).toBe(900);
  });

  it("completeAuction pays a third party's nation royalty out of the fee and tells them after the commit", async () => {
    const h = makeHarness(
      makeAuction({ currentBid: 1000, endTime: tenMinutesAgo(), CardOwnership: nationCopy }),
      { s: 0, p: 0, o: 0 }
    );
    h.tx.country.findMany.mockResolvedValue([{ id: "country_1", ownerUserId: "o" }]);
    const sends = committedAtEachNotice(h);

    await service.completeAuction("a1", h.db);

    // The winner's 1,000 was reserved at bid time: 900 to the seller and 20 to the owner come out of it
    expect(h.balances).toEqual({ s: 900, p: 0, o: 20 });
    expect(notifyCards).toHaveBeenCalledWith(h.db, [
      {
        userId: "o",
        cardId: "card1",
        title: "Royalty paid",
        message: "A copy of your nation's card, Aurelia, changed hands. You received 20 IxC.",
        type: "success",
        priority: "low",
      },
    ]);
    expect(sends).toEqual([true]);
  });

  it("completeAuction refuses to sell a copy that is gone, paying the seller nothing", async () => {
    const h = makeHarness(
      makeAuction({ ...goneCopy, currentBid: 500, currentBidderId: "p", endTime: tenMinutesAgo() }),
      { s: 0 }
    );

    await expect(service.completeAuction("a1", h.db)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(rowsFor(h, "s")).toEqual([]);
    expect(h.tx.cardOwnership.update).not.toHaveBeenCalled();
    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(h.tx.cardTransferEvent.create).not.toHaveBeenCalled();
  });

  it("completeAuction with no bids unlocks no copy when it is gone, still refunding half the fee", async () => {
    const h = makeHarness(
      makeAuction({ ...goneCopy, currentBidderId: null, endTime: tenMinutesAgo() }),
      { s: 0 }
    );

    await service.completeAuction("a1", h.db);

    expect(h.tx.cardOwnership.update).not.toHaveBeenCalled();
    expect(h.balances.s).toBe(2.5);
  });

  it("cancelAuction unlocks no copy when it is gone, still refunding half the fee", async () => {
    const h = makeHarness(makeAuction({ ...goneCopy, currentBidderId: null, bidCount: 0 }), {
      s: 0,
    });

    await expect(service.cancelAuction({ userId: "s", auctionId: "a1" }, h.db)).resolves.toEqual({
      success: true,
    });

    expect(h.tx.cardOwnership.update).not.toHaveBeenCalled();
    expect(h.balances.s).toBe(2.5);
  });

  it("refundListingFeeTx gives the seller half the listing fee: 5 IxC of a featured listing's 10", async () => {
    const h = makeHarness(makeAuction(), { s: 0 });

    await expect(
      refundListingFeeTx(h.tx, { id: "a1", sellerId: "s", isFeatured: true }, "admin_cancel")
    ).resolves.toBe(5);

    expect(rowsFor(h, "s")).toEqual([
      expect.objectContaining({ credits: 5, type: "REFUND", source: "auction_fee_refund" }),
    ]);
    expect(JSON.parse(rowsFor(h, "s")[0].metadata)).toEqual({
      auctionId: "a1",
      reason: "admin_cancel",
    });
  });

  it("cancelAuction refund is type REFUND and not capped", async () => {
    const h = makeHarness(
      makeAuction({ currentBidderId: null, bidCount: 0 }),
      { s: 0 },
      [{ credits: VAULT_CONFIG_DEFAULTS.activeDailyCap }] // EARN_ACTIVE cap saturated
    );

    await expect(service.cancelAuction({ userId: "s", auctionId: "a1" }, h.db)).resolves.toEqual({
      success: true,
    });

    expect(h.tx.cardAuction.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", status: "ACTIVE", sellerId: "s", bidCount: 0 },
      data: { status: "CANCELLED" },
    });
    expect(rowsFor(h, "s")).toHaveLength(1);
    expect(rowsFor(h, "s")[0]).toMatchObject({
      credits: 2.5,
      type: "REFUND",
      source: "auction_fee_refund",
    });
    expect(h.balances.s).toBe(2.5);
    expect(h.tx.$queryRaw).not.toHaveBeenCalled();
    expect(h.tx.cardOwnership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isLocked: false } })
    );
  });
});
