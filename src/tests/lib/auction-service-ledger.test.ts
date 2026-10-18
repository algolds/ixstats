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
  notifyCard: jest.fn().mockResolvedValue(undefined),
  notifyCards: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/websocket/market-websocket-server", () => ({
  getMarketWebSocketServer: () => null,
}));
jest.mock("~/server/market-broadcast-bridge", () => ({ publishMarketEvent: jest.fn() }));

import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { AuctionService, refundListingFeeTx } from "~/lib/economy/auction-service";
import { VAULTS_BUSY_MESSAGE } from "~/lib/vault/vault-locks";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { notifyCard, notifyCards } from "~/lib/cards/card-notify";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { publishMarketEvent } from "~/server/market-broadcast-bridge";
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
    cardAuction: {
      // A claim that names an end matches only while the auction's end is still ahead of it
      updateMany: jest.fn().mockImplementation(async ({ where }: { where: ClaimWhere }) => ({
        count: endsAfter(auction.endTime, where.endTime) ? 1 : 0,
      })),
      create: jest.fn().mockImplementation(async ({ data }: { data: object }) => data),
    },
    auctionBid: { create: jest.fn().mockResolvedValue({ id: "bid" }) },
    cardOwnership: {
      findFirst: jest.fn().mockResolvedValue({
        id: "c1",
        cardId: "card1",
        serialNumber: 7,
        cards: { isBound: false },
      }),
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
    auctionBid: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn().mockResolvedValue({ clerkUserId: "b" }) },
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
  };
  return { balances, rows, tx, db };
}

/** The part of an auction claim's `where` the harness honours. */
interface ClaimWhere {
  endTime?: { gt?: Date; gte?: Date };
}

/** Whether `end` passes a claim's `endTime` filter (no filter passes). */
function endsAfter(end: Date, filter: ClaimWhere["endTime"]): boolean {
  if (!filter) return true;
  return (
    (filter.gt === undefined || end > filter.gt) && (filter.gte === undefined || end >= filter.gte)
  );
}

const rowsFor = (h: Harness, userId: string) =>
  h.rows.filter((r) => r.vaultId === vaultIdFor(userId));

const inTenMinutes = () => new Date(Date.now() + 10 * 60 * 1000);
const tenMinutesAgo = () => new Date(Date.now() - 10 * 60 * 1000);

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    cardInstanceId: "c1",
    cardId: "card1",
    serialNumber: 7,
    card: { title: "Test Card" },
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
    listingFee: 5,
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

const XP = {
  prevLevel: 1,
  newLevel: 2,
  prevXP: 900,
  newXP: 1100,
  leveledUp: true,
  xpGained: 200,
};

/** Economy tab rows, as `systemConfig.findMany` returns them. */
const economyRows = (values: Record<string, number>) =>
  Object.entries(values).map(([key, value]) => ({
    key: `card_economy_${key}`,
    value: String(value),
  }));

const nationCopy = {
  id: "c1",
  cardId: "card1",
  serialNumber: 7,
  finish: "STANDARD",
  cards: { id: "card1", title: "Aurelia", cardType: "NATION", countryId: "country_1" },
};
/** An auction of the nation copy: its stored card is the copy's card. */
const ofNation = { CardOwnership: nationCopy, card: { title: "Aurelia" } };

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
    jest.mocked(notifyCard).mockClear();
    jest.mocked(grantCardXp).mockReset().mockResolvedValue(XP);
    jest.mocked(publishMarketEvent).mockReset();
    clearEconomyConfigCache();
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
    expect(err.message).toBe("This auction changed. Reload and try again.");
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
      xp: XP,
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
    const h = makeHarness(makeAuction({ buyoutPrice: 1000, currentBidderId: null, ...ofNation }), {
      b: 1000,
      s: 0,
      o: 0,
    });
    h.tx.country.findMany.mockResolvedValue([{ id: "country_1", ownerUserId: "o" }]);
    const sends = committedAtEachNotice(h);

    await service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db);

    // 1,000 IxC: the seller gets 900, the owner 20 of the 100 fee, the house the other 80; nothing is minted
    expect(h.balances).toEqual({ b: 0, s: 900, o: 20 });
    expect(rowsFor(h, "o")).toEqual([
      expect.objectContaining({ credits: 20, type: "EARN_CARDS", source: "nation_card_royalty" }),
    ]);
    expect(notifyCards).toHaveBeenCalledWith(
      h.db,
      expect.arrayContaining([
        expect.objectContaining({ userId: "o", cardId: "card1", title: "Royalty paid" }),
      ])
    );
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
      makeAuction({ currentBid: 1000, endTime: tenMinutesAgo(), ...ofNation }),
      { s: 0, p: 0 }
    );
    h.tx.country.findMany.mockResolvedValue([{ id: "country_1", ownerUserId: "s" }]);

    await service.completeAuction("a1", h.db);

    expect(h.rows.filter((r) => r.source === "nation_card_royalty")).toHaveLength(0);
    expect(h.balances.s).toBe(900);
  });

  it("completeAuction pays a third party's nation royalty out of the fee and tells them after the commit", async () => {
    const h = makeHarness(
      makeAuction({ currentBid: 1000, endTime: tenMinutesAgo(), ...ofNation }),
      { s: 0, p: 0, o: 0 }
    );
    h.tx.country.findMany.mockResolvedValue([{ id: "country_1", ownerUserId: "o" }]);
    const sends = committedAtEachNotice(h);

    await service.completeAuction("a1", h.db);

    // The winner's 1,000 was reserved at bid time: 900 to the seller and 20 to the owner come out of it
    expect(h.balances).toEqual({ s: 900, p: 0, o: 20 });
    expect(notifyCards).toHaveBeenCalledWith(
      h.db,
      expect.arrayContaining([
        {
          userId: "o",
          cardId: "card1",
          title: "Royalty paid",
          message: "A copy of your nation's card, Aurelia, changed hands. You received 20 IxC.",
          type: "success",
          priority: "low",
        },
      ])
    );
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
    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(h.balances.s).toBe(2.5);
  });

  it("cancelAuction unlocks no copy when it is gone, still refunding half the fee", async () => {
    const h = makeHarness(makeAuction({ ...goneCopy, currentBidderId: null, bidCount: 0 }), {
      s: 0,
    });

    await expect(service.cancelAuction({ userId: "s", auctionId: "a1" }, h.db)).resolves.toEqual({
      success: true,
      refund: 2.5,
    });

    expect(h.tx.cardOwnership.update).not.toHaveBeenCalled();
    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(h.balances.s).toBe(2.5);
  });

  it("refundListingFeeTx gives the seller half the fee the auction stored: 5 IxC of 10", async () => {
    const h = makeHarness(makeAuction(), { s: 0 });

    await expect(
      refundListingFeeTx(h.tx, { id: "a1", sellerId: "s", listingFee: 10 }, "admin_cancel")
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
      refund: 2.5,
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
    // The seller's own copy, and no throw if it went in the meantime
    expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerId: "s" },
      data: { isLocked: false },
    });
  });
  it("cancelAuction refunds the Economy tab's share of the fee it stored", async () => {
    const h = makeHarness(
      makeAuction({ currentBidderId: null, bidCount: 0, isFeatured: true, listingFee: 10 }),
      { s: 0 }
    );
    h.tx.systemConfig.findMany.mockResolvedValue(economyRows({ listing_refund_pct: 30 }));

    await expect(service.cancelAuction({ userId: "s", auctionId: "a1" }, h.db)).resolves.toEqual({
      success: true,
      refund: 3,
    });
    expect(h.balances.s).toBe(3);
  });

  it("refundListingFeeTx pays nothing and writes no row for a free listing", async () => {
    const h = makeHarness(makeAuction(), { s: 0 });

    await expect(
      refundListingFeeTx(h.tx, { id: "a1", sellerId: "s", listingFee: 0 }, "cancelled")
    ).resolves.toBe(0);
    expect(h.rows).toEqual([]);
  });

  it("placeBid tells the outbid bidder after the commit, through the card's mute", async () => {
    const h = makeHarness(makeAuction(), { b: 1000, p: 0 });
    let committed = false;
    h.db.$transaction.mockImplementation(async (cb: (client: Harness["tx"]) => Promise<void>) => {
      await cb(h.tx);
      committed = true;
    });
    const sends: boolean[] = [];
    jest.mocked(notifyCard).mockImplementation(async () => {
      sends.push(committed);
    });

    await service.placeBid({ userId: "b", auctionId: "a1", amount: 200 }, h.db);

    expect(notifyCard).toHaveBeenCalledWith(h.db, {
      userId: "p",
      cardId: "card1",
      title: "You've been outbid",
      message: "Someone placed a higher bid of 200 IxC on Test Card.",
      type: "warning",
      priority: "high",
      metadata: { auctionId: "a1", newBid: 200 },
    });
    expect(sends).toEqual([true]);
  });

  it("placeBid tells no one when nobody was outbid", async () => {
    const h = makeHarness(makeAuction({ currentBidderId: null, bidCount: 0 }), { b: 1000 });

    await service.placeBid({ userId: "b", auctionId: "a1", amount: 200 }, h.db);

    expect(notifyCard).not.toHaveBeenCalled();
  });

  describe("createAuction", () => {
    const listing = { userId: "s", cardId: "c1", startingPrice: 50 };

    it("charges the listing fee inside the listing transaction, stores it and ends at the chosen duration", async () => {
      const h = makeHarness(makeAuction(), { s: 100 });
      const before = Date.now();

      const auction = await service.createAuction(
        { ...listing, duration: "3d", isFeatured: true },
        h.db
      );

      expect(h.balances.s).toBe(90);
      expect(rowsFor(h, "s")).toEqual([
        expect.objectContaining({
          credits: -10,
          type: "SPEND_MARKET",
          source: "auction_listing_fee",
        }),
      ]);
      expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledWith({
        where: { id: "c1", ownerId: "s", isLocked: false },
        data: { isLocked: true },
      });
      expect(auction).toMatchObject({
        cardInstanceId: "c1",
        cardId: "card1",
        serialNumber: 7,
        sellerId: "s",
        startingPrice: 50,
        currentBid: 50,
        listingFee: 10,
        isFeatured: true,
        status: "ACTIVE",
      });
      const lasts = auction.endTime.getTime() - before;
      expect(lasts).toBeGreaterThanOrEqual(72 * 60 * 60 * 1000);
      expect(lasts).toBeLessThan(72 * 60 * 60 * 1000 + 60_000);
    });

    it.each([
      [false, 7],
      [true, 12],
    ])(
      "charges and stores the Economy tab's fee (featured %s: %i IxC)",
      async (isFeatured, fee) => {
        const h = makeHarness(makeAuction(), { s: 100 });
        h.db.systemConfig.findMany.mockResolvedValue(
          economyRows({ listing_fee: 7, listing_fee_featured: 12 })
        );

        const auction = await service.createAuction(
          { ...listing, duration: "24h", isFeatured },
          h.db
        );

        expect(auction).toMatchObject({ listingFee: fee, isFeatured });
        expect(h.balances.s).toBe(100 - fee);
      }
    );

    it("lists for free when the Economy tab's fee is 0, writing no ledger row", async () => {
      const h = makeHarness(makeAuction(), { s: 100 });
      h.db.systemConfig.findMany.mockResolvedValue(economyRows({ listing_fee: 0 }));

      const auction = await service.createAuction({ ...listing, duration: "7d" }, h.db);

      expect(auction).toMatchObject({ listingFee: 0, isFeatured: false });
      expect(h.rows).toEqual([]);
    });

    it("charges nothing when the copy is already locked", async () => {
      const h = makeHarness(makeAuction(), { s: 100 });
      h.tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.createAuction({ ...listing, duration: "24h" }, h.db)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(h.balances.s).toBe(100);
      expect(h.rows).toEqual([]);
      expect(h.tx.cardAuction.create).not.toHaveBeenCalled();
    });

    it("refuses a copy the seller does not hold, charging nothing", async () => {
      const h = makeHarness(makeAuction(), { s: 100 });
      h.tx.cardOwnership.findFirst.mockResolvedValue(null);

      await expect(
        service.createAuction({ ...listing, duration: "24h" }, h.db)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(h.tx.cardOwnership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "c1", ownerId: "s" } })
      );
      expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
      expect(h.rows).toEqual([]);
    });

    it("refuses a fee the seller cannot pay, listing nothing", async () => {
      const h = makeHarness(makeAuction(), { s: 3 });

      await expect(
        service.createAuction({ ...listing, duration: "24h" }, h.db)
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/^Insufficient/),
      });
      await expect(h.db.$transaction.mock.results[0].value).rejects.toBeDefined();
      expect(h.tx.cardAuction.create).not.toHaveBeenCalled();
    });

    it.each([50, 40])(
      "refuses a buy-now price of %i IxC, at or under the start, before anything moves",
      async (buyoutPrice) => {
        const h = makeHarness(makeAuction(), { s: 100 });

        await expect(
          service.createAuction({ ...listing, buyoutPrice, duration: "24h" }, h.db)
        ).rejects.toMatchObject({
          code: "BAD_REQUEST",
          message: "Buyout price must be higher than starting price",
        });
        expect(h.db.$transaction).not.toHaveBeenCalled();
      }
    );

    it("refuses a starting price that is not a whole IxC", async () => {
      const h = makeHarness(makeAuction(), { s: 100 });

      await expect(
        service.createAuction({ ...listing, startingPrice: 1.5, duration: "24h" }, h.db)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(h.db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("completeAuction", () => {
    const unsold = (overrides: Parameters<typeof makeAuction>[0] = {}) =>
      makeAuction({ currentBidderId: null, endTime: tenMinutesAgo(), ...overrides });
    const sold = () =>
      makeAuction({ currentBid: 500, currentBidderId: "p", endTime: tenMinutesAgo() });

    it("an auction with no bids refunds half of the fee it stored and unlocks the seller's copy", async () => {
      const h = makeHarness(unsold({ listingFee: 10 }), { s: 0 });

      await service.completeAuction("a1", h.db);

      expect(h.tx.cardAuction.updateMany).toHaveBeenCalledWith({
        where: { id: "a1", status: "ACTIVE", currentBidderId: null, currentBid: 100 },
        data: { status: "CANCELLED" },
      });
      expect(rowsFor(h, "s")).toEqual([
        expect.objectContaining({ credits: 5, type: "REFUND", source: "auction_fee_refund" }),
      ]);
      expect(JSON.parse(rowsFor(h, "s")[0].metadata)).toEqual({
        auctionId: "a1",
        reason: "no_bids",
      });
      expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledWith({
        where: { id: "c1", ownerId: "s" },
        data: { isLocked: false },
      });
    });

    it("an unsold auction whose claim is lost writes no row, unlocks nothing and tells no one", async () => {
      const h = makeHarness(unsold({ listingFee: 10 }), { s: 0 });
      // A player cancel or another cron run settled it first
      h.tx.cardAuction.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeAuction("a1", h.db)).resolves.toBeUndefined();

      expect(h.rows).toEqual([]);
      expect(h.balances.s).toBe(0);
      expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
      expect(notifyCards).not.toHaveBeenCalled();
    });

    it("a broadcast failure after the commit neither fails the sale nor skips its notices", async () => {
      const h = makeHarness(sold(), { s: 0 });
      jest.mocked(publishMarketEvent).mockImplementation(() => {
        throw new Error("socket closed");
      });

      await expect(service.completeAuction("a1", h.db)).resolves.toBeUndefined();

      expect(h.balances.s).toBe(450);
      expect(noticesSent().map((n) => n.userId)).toEqual(["p", "s"]);
    });

    it("refunds the Economy tab's share of the stored fee", async () => {
      const h = makeHarness(unsold({ listingFee: 10 }), { s: 0 });
      h.tx.systemConfig.findMany.mockResolvedValue(economyRows({ listing_refund_pct: 25 }));

      await service.completeAuction("a1", h.db);

      expect(h.balances.s).toBe(2.5);
    });

    it("tells the seller of an unsold auction after the commit, and reads no bidders", async () => {
      const h = makeHarness(unsold(), { s: 0 });
      const sends = committedAtEachNotice(h);

      await service.completeAuction("a1", h.db);

      expect(noticesSent()).toEqual([
        {
          userId: "s",
          cardId: "card1",
          metadata: { auctionId: "a1" },
          title: "Your auction ended with no bids",
          message: "Test Card is back in your collection. We refunded 2.5 IxC of the listing fee.",
          priority: "low",
        },
      ]);
      expect(sends).toEqual([true]);
      expect(h.db.auctionBid.findMany).not.toHaveBeenCalled();
    });

    it("refunds nothing for a free listing, and the notice names no refund", async () => {
      const h = makeHarness(unsold({ listingFee: 0 }), { s: 0 });

      await service.completeAuction("a1", h.db);

      expect(h.rows).toEqual([]);
      expect(noticesSent()).toEqual([
        expect.objectContaining({ userId: "s", message: "Test Card is back in your collection." }),
      ]);
    });

    it("grants the winner's XP inside the transaction and tells every bidder after the commit", async () => {
      const h = makeHarness(sold(), { s: 0 });
      h.db.auctionBid.findMany.mockResolvedValue([{ bidderId: "p" }, { bidderId: "q" }]);
      const sends = committedAtEachNotice(h);

      await service.completeAuction("a1", h.db);

      expect(grantCardXp).toHaveBeenCalledWith(
        h.tx,
        "c1",
        "AUCTION_WIN",
        JSON.stringify({ auctionId: "a1" })
      );
      expect(h.db.auctionBid.findMany).toHaveBeenCalledWith({
        where: { auctionId: "a1" },
        select: { bidderId: true },
        distinct: ["bidderId"],
      });
      expect(noticesSent().map((n) => [n.userId, n.title, n.message])).toEqual([
        ["p", "You won an auction", "Test Card is yours for 500 IxC."],
        [
          "s",
          "Your auction sold",
          "Test Card sold for 500 IxC. You received 450 IxC after the market fee.",
        ],
        ["q", "An auction you bid on ended", "Test Card went for 500 IxC. Your bid was refunded."],
      ]);
      expect(sends).toEqual([true]);
    });

    it.each([
      ["sending the notices", (h: Harness) => h.db.auctionBid.findMany.mockResolvedValue([])],
      [
        "reading the bidders",
        (h: Harness) => h.db.auctionBid.findMany.mockRejectedValue(new Error("db blip")),
      ],
    ])("a failure %s after the commit never fails the sale", async (_step, arrange) => {
      const h = makeHarness(sold(), { s: 0 });
      arrange(h);
      jest.mocked(notifyCards).mockRejectedValue(new Error("tray down"));

      await expect(service.completeAuction("a1", h.db)).resolves.toBeUndefined();
      expect(h.balances.s).toBe(450);
    });
  });

  describe("executeBuyout", () => {
    const withBid = (overrides: Parameters<typeof makeAuction>[0] = {}) =>
      makeAuction({ buyoutPrice: 800, currentBid: 300, currentBidderId: "p", ...overrides });

    it("refuses an auction that has ended though the cron has not settled it, moving no money", async () => {
      const h = makeHarness(withBid({ endTime: new Date(Date.now() - 30_000) }), {
        b: 1000,
        p: 0,
        s: 0,
      });

      await expect(
        service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(h.tx.cardAuction.updateMany.mock.calls[0][0].where).toEqual({
        id: "a1",
        status: "ACTIVE",
        currentBid: 300,
        currentBidderId: "p",
        endTime: { gt: expect.any(Date) },
      });
      expect(h.rows).toEqual([]);
      expect(h.balances).toEqual({ b: 1000, p: 0, s: 0 });
      expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    });

    it("refuses a buyout at the very moment the auction ends", async () => {
      const end = new Date("2026-10-18T12:00:00.000Z");
      jest.useFakeTimers({ now: end, doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
      try {
        const h = makeHarness(withBid({ endTime: end }), { b: 1000, p: 0, s: 0 });

        await expect(
          service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(h.rows).toEqual([]);
      } finally {
        jest.useRealTimers();
      }
    });

    it("grants the buyer's XP inside the buyout's transaction and returns it", async () => {
      const h = makeHarness(withBid(), { b: 1000, p: 0, s: 0 });

      await expect(service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)).resolves.toEqual({
        success: true,
        xp: XP,
      });
      expect(grantCardXp).toHaveBeenCalledWith(
        h.tx,
        "c1",
        "AUCTION_WIN",
        JSON.stringify({ auctionId: "a1" })
      );
    });

    it("a broadcast failure after the commit neither fails the buyout nor skips its notices", async () => {
      const h = makeHarness(withBid(), { b: 1000, p: 0, s: 0 });
      jest.mocked(publishMarketEvent).mockImplementation(() => {
        throw new Error("socket closed");
      });

      await expect(service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)).resolves.toEqual({
        success: true,
        xp: XP,
      });
      expect(h.balances).toEqual({ b: 200, p: 300, s: 720 });
      expect(noticesSent().map((n) => n.userId)).toEqual(["b", "s"]);
    });

    it("rolls the whole buyout back when the XP grant fails", async () => {
      const h = makeHarness(withBid(), { b: 1000, p: 0, s: 0 });
      jest.mocked(grantCardXp).mockRejectedValue(new Error("deadlock"));

      await expect(
        service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to execute buyout",
      });
      await expect(h.db.$transaction.mock.results[0].value).rejects.toThrow("deadlock");
      expect(noticesSent()).toEqual([]);
    });

    it("tells the buyer, the seller and the outbid bidder after the commit", async () => {
      const h = makeHarness(withBid(), { b: 1000, p: 0, s: 0 });
      h.db.auctionBid.findMany.mockResolvedValue([{ bidderId: "p" }, { bidderId: "b" }]);
      const sends = committedAtEachNotice(h);

      await service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db);

      expect(noticesSent().map((n) => [n.userId, n.title, n.message])).toEqual([
        ["b", "You won an auction", "Test Card is yours for 800 IxC."],
        [
          "s",
          "Your auction was bought out",
          "Test Card sold for 800 IxC. You received 720 IxC after the market fee.",
        ],
        ["p", "An auction you bid on ended", "Test Card went for 800 IxC. Your bid was refunded."],
      ]);
      expect(sends).toEqual([true]);
    });

    it.each([
      ["sending the notices", (h: Harness) => h.db.auctionBid.findMany.mockResolvedValue([])],
      [
        "reading the bidders",
        (h: Harness) => h.db.auctionBid.findMany.mockRejectedValue(new Error("db blip")),
      ],
    ])("a failure %s after the commit never fails the buyout", async (_step, arrange) => {
      const h = makeHarness(withBid(), { b: 1000, p: 0, s: 0 });
      arrange(h);
      jest.mocked(notifyCards).mockRejectedValue(new Error("tray down"));

      await expect(service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db)).resolves.toEqual({
        success: true,
        xp: XP,
      });
      expect(h.balances).toEqual({ b: 200, p: 300, s: 720 });
    });
  });

  describe("vault locks", () => {
    /** Each vault-row lock the transaction took, as the user ids it locked. */
    const vaultLocks = (h: Harness): string[][] =>
      h.tx.$queryRaw.mock.calls
        .filter(([query]: [Prisma.Sql]) => query.sql.includes('FROM "my_vault"'))
        .map(([query]: [Prisma.Sql]) => query.values);
    /** The order of the claim, the lock and the first credit write. */
    const order = (h: Harness, write: jest.Mock) => [
      h.tx.cardAuction.updateMany.mock.invocationCallOrder[0],
      h.tx.$queryRaw.mock.invocationCallOrder[0],
      write.mock.invocationCallOrder[0],
    ];
    const ascending = (values: number[]) => [...values].sort((a, b) => a - b);
    const deadlock = () =>
      new Prisma.PrismaClientKnownRequestError("Transaction failed due to a deadlock", {
        code: "P2034",
        clientVersion: "6",
      });

    it("placeBid locks the bidder's and the outbid bidder's vaults in user-id order, after the claim", async () => {
      const h = makeHarness(makeAuction({ currentBidderId: "a_prev" }), { b: 1000, a_prev: 0 });
      await service.placeBid({ userId: "b", auctionId: "a1", amount: 200 }, h.db);
      expect(vaultLocks(h)).toEqual([["a_prev", "b"]]);
      const seen = order(h, h.tx.myVault.updateMany);
      expect(ascending(seen)).toEqual(seen);
    });

    it("executeBuyout locks the buyer's, the seller's, the refunded bidder's and the nation owner's vaults", async () => {
      const h = makeHarness(
        makeAuction({ buyoutPrice: 1000, currentBid: 300, currentBidderId: "p", ...ofNation }),
        { b: 2000, p: 0, s: 0, o: 0 }
      );
      h.tx.country.findMany.mockResolvedValue([{ id: "country_1", ownerUserId: "o" }]);
      await service.executeBuyout({ userId: "b", auctionId: "a1" }, h.db);
      expect(vaultLocks(h)).toEqual([["b", "o", "p", "s"]]);
      // The claim, then the locks, then the bidder's refund
      const seen = order(h, h.tx.myVault.update);
      expect(ascending(seen)).toEqual(seen);
    });

    it("completeAuction locks the seller's and the winner's vaults after its claim", async () => {
      const h = makeHarness(
        makeAuction({ currentBid: 500, currentBidderId: "p", endTime: tenMinutesAgo() }),
        { s: 0 }
      );
      await service.completeAuction("a1", h.db);
      expect(vaultLocks(h)).toEqual([["p", "s"]]);
      const seen = order(h, h.tx.myVault.update);
      expect(ascending(seen)).toEqual(seen);
    });

    it("answers a bid or a buyout that lost a deadlock as a CONFLICT to retry", async () => {
      const bid = makeHarness(makeAuction(), { b: 1000, p: 0 });
      bid.tx.auctionBid.create.mockRejectedValueOnce(deadlock());
      await expect(
        service.placeBid({ userId: "b", auctionId: "a1", amount: 200 }, bid.db)
      ).rejects.toMatchObject({ code: "CONFLICT", message: VAULTS_BUSY_MESSAGE });

      const buyout = makeHarness(makeAuction({ buyoutPrice: 800 }), { b: 1000, p: 0, s: 0 });
      buyout.tx.cardTransferEvent.create.mockRejectedValueOnce(deadlock());
      await expect(
        service.executeBuyout({ userId: "b", auctionId: "a1" }, buyout.db)
      ).rejects.toMatchObject({ code: "CONFLICT", message: VAULTS_BUSY_MESSAGE });
      expect(noticesSent()).toEqual([]);
      // A lost deadlock is a retry, not a server error to log
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
