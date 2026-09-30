/**
 * Auction service <-> ledger regression (plan 327).
 *
 * The auction engine moves IxCredits inside its own Prisma interactive
 * transactions. The transaction client has NO `$transaction`, so every money
 * move must go through the *Tx ledger functions, and settlement must be
 * compare-and-swap guarded so nothing is paid twice.
 */

jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/auth", () => ({ SYSTEM_OWNER_IDS: [] }));
jest.mock("~/lib/websocket/market-websocket-server", () => ({
  getMarketWebSocketServer: () => null,
}));

import { TRPCError } from "@trpc/server";
import { AuctionService } from "~/lib/economy/auction-service";
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
    cardOwnership: { update: jest.fn().mockResolvedValue({}) },
    card: { update: jest.fn().mockResolvedValue({}) },
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
      cards: { id: "card1", title: "Test Card", cardType: "LORE", countryId: null },
    },
    AuctionBid: [],
    ...overrides,
  };
}

describe("AuctionService <-> ledger (transaction client without $transaction)", () => {
  let service: AuctionService;

  beforeEach(() => {
    service = new AuctionService();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(vaultService, "getBalance").mockResolvedValue(BALANCE);
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
    expect(h.tx.cardOwnership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: "p", isLocked: false }) })
    );
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
    expect(h.balances).toEqual({ s: 0 });
  });

  it("cancelAuction refund is type REFUND and not capped", async () => {
    const h = makeHarness(
      makeAuction({ currentBidderId: null, bidCount: 0 }),
      { s: 0 },
      [{ credits: VAULT_CONFIG_DEFAULTS.activeDailyCap }] // EARN_ACTIVE cap saturated
    );

    await expect(
      service.cancelAuction({ userId: "s", auctionId: "a1" }, h.db)
    ).resolves.toEqual({ success: true });

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
