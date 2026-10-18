/** @jest-environment node */
/**
 * Fixed-price listings: the copy locks while listed and the fee is charged after the lock. One buyer wins the
 * listing's claim and pays once, and the sale settles with the serial and finish the listing stored. Cancel, expiry
 * and the admin cancel each end a listing once, unlock the copy and refund the Economy tab's share of the stored fee.
 * The doubles honour the claims' `where`, and only `tx` can write.
 */
jest.mock("~/lib/vault/vault-ledger", () => {
  class LedgerError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
    }
  }
  return { earnCreditsTx: jest.fn(), spendCreditsTx: jest.fn(), LedgerError };
});
jest.mock("~/lib/cards/market/settle-sale", () => ({ settleCardSaleTx: jest.fn() }));
jest.mock("~/lib/cards/card-notify", () => ({ notifyCards: jest.fn() }));

import type { CardFinish, CardListingStatus, CardType } from "@prisma/client";
import { notifyCards } from "~/lib/cards/card-notify";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { settleCardSaleTx } from "~/lib/cards/market/settle-sale";
import { earnCreditsTx, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import {
  buyListing,
  cancelListing,
  createListing,
  endListingTx,
  expireListings,
  listMyListings,
} from "~/server/modules/cards/market/listings";

const NOW = new Date("2026-11-02T12:00:00Z");
const DAY = 86_400_000;
const spend = jest.mocked(spendCreditsTx);
const earn = jest.mocked(earnCreditsTx);
const settle = jest.mocked(settleCardSaleTx);
const notify = jest.mocked(notifyCards);

type Row = { key: string; value: string };
/** The Economy tab as stored: fees of 7 and 13 IxC, a 40% refund and 10 listing days (none of them the defaults). */
const ECONOMY: Row[] = [
  { key: "card_economy_listing_fee", value: "7" },
  { key: "card_economy_listing_fee_featured", value: "13" },
  { key: "card_economy_listing_refund_pct", value: "40" },
  { key: "card_economy_listing_days", value: "10" },
];

interface CopyState {
  id: string;
  ownerId: string;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  isLocked: boolean;
  cards: { isBound: boolean };
}

interface ListingState {
  id: string;
  ownershipId: string | null;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  sellerId: string;
  price: number;
  isFeatured: boolean;
  listingFee: number;
  status: CardListingStatus;
  expiresAt: Date;
  card: { title: string; cardType: CardType; countryId: string | null };
}

interface World {
  config: Row[];
  copy: CopyState | null;
  listing: ListingState | null;
}

/** A live listing of copy own_1, a Holo #4, while the copy itself reads Foil #9: the sale must use what was stored. */
const listingOf = (over: Partial<ListingState> = {}): ListingState => ({
  id: "l1",
  ownershipId: "own_1",
  cardId: "card_1",
  serialNumber: 4,
  finish: "HOLO",
  sellerId: "seller",
  price: 500,
  isFeatured: false,
  listingFee: 10,
  status: "ACTIVE",
  expiresAt: new Date(NOW.getTime() + DAY),
  card: { title: "Aurelia", cardType: "NATION", countryId: "country_1" },
  ...over,
});

const copyOf = (over: Partial<CopyState> = {}): CopyState => ({
  id: "own_1",
  ownerId: "seller",
  cardId: "card_1",
  serialNumber: 9,
  finish: "FOIL",
  isLocked: false,
  cards: { isBound: false },
  ...over,
});

interface ListingClaim {
  id: string;
  status: CardListingStatus;
  expiresAt?: { gt?: Date; lte?: Date };
}

interface CopyClaim {
  id: string;
  ownerId?: string;
  isLocked?: boolean;
}

/** Whether the listing as it stands matches a claim's `where`. */
function listingMatches(listing: ListingState | null, where: ListingClaim): boolean {
  if (!listing || listing.id !== where.id || listing.status !== where.status) return false;
  const end = where.expiresAt;
  if (end?.gt && !(listing.expiresAt > end.gt)) return false;
  return !(end?.lte && !(listing.expiresAt <= end.lte));
}

function copyMatches(copy: CopyState | null, where: CopyClaim): boolean {
  if (!copy || copy.id !== where.id) return false;
  if (where.ownerId !== undefined && copy.ownerId !== where.ownerId) return false;
  return where.isLocked === undefined || copy.isLocked === where.isLocked;
}

/** `tx` holds every write; `db` reads only, and runs `tx`. Reads return the world as it stands then. */
function makeDb(over: Partial<World> = {}) {
  const world: World = {
    config: ECONOMY,
    copy: copyOf({ isLocked: true }),
    listing: listingOf(),
    ...over,
  };
  const systemConfig = { findMany: jest.fn(async () => world.config) };
  const tx = {
    systemConfig,
    cardOwnership: {
      findFirst: jest.fn(async ({ where }: { where: CopyClaim }) =>
        copyMatches(world.copy, where) && world.copy ? { ...world.copy } : null
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: CopyClaim; data: { isLocked: boolean } }) => {
          if (!copyMatches(world.copy, where) || !world.copy) return { count: 0 };
          world.copy.isLocked = data.isLocked;
          return { count: 1 };
        }
      ),
    },
    cardListing: {
      create: jest.fn(async ({ data }: { data: Omit<ListingState, "id" | "status" | "card"> }) => {
        world.listing = { ...listingOf(), ...data, id: "l_new", status: "ACTIVE" };
        return { ...world.listing };
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: ListingClaim; data: { status: CardListingStatus } }) => {
          if (!listingMatches(world.listing, where) || !world.listing) return { count: 0 };
          world.listing.status = data.status;
          return { count: 1 };
        }
      ),
    },
    auditLog: { create: jest.fn() },
  };
  const db = {
    systemConfig,
    cardListing: {
      findUnique: jest.fn(async () => (world.listing ? { ...world.listing } : null)),
      findMany: jest.fn(async () => (world.listing ? [{ ...world.listing }] : [])),
    },
    $transaction: jest.fn(async <T>(work: (client: typeof tx) => Promise<T>) => work(tx)),
  };
  return { db, tx, world };
}

const create = (
  db: object,
  over: { price?: number; isFeatured?: boolean; sellerId?: string } = {}
) =>
  createListing(db as never, {
    sellerId: over.sellerId ?? "seller",
    ownershipId: "own_1",
    price: over.price ?? 500,
    isFeatured: over.isFeatured ?? false,
    now: NOW,
  });

beforeEach(() => {
  clearEconomyConfigCache();
  invalidateVaultConfigCache();
  spend.mockReset().mockResolvedValue({ newBalance: 0, amount: 0 });
  earn.mockReset().mockResolvedValue({ newBalance: 0, amount: 0 });
  settle.mockReset().mockResolvedValue({ fee: 50, sellerNet: 450, royalties: [] });
  notify.mockReset().mockResolvedValue(undefined);
});

describe("createListing", () => {
  it("locks the copy, then charges the fee, and lists it with its serial and finish for the listing days", async () => {
    const { db, tx, world } = makeDb({ copy: copyOf(), listing: null });
    const listing = await create(db);

    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", ownerId: "seller", isLocked: false },
      data: { isLocked: true },
    });
    expect(world.copy?.isLocked).toBe(true);
    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend).toHaveBeenCalledWith(tx, {
      userId: "seller",
      amount: 7,
      type: "SPEND_MARKET",
      source: "listing_fee",
      metadata: { ownershipId: "own_1", isFeatured: false },
    });
    // The fee follows the lock: a lost lock charges nothing
    expect(tx.cardOwnership.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      spend.mock.invocationCallOrder[0]!
    );
    expect(tx.cardListing.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        cardId: "card_1",
        serialNumber: 9,
        finish: "FOIL",
        sellerId: "seller",
        price: 500,
        isFeatured: false,
        listingFee: 7,
        expiresAt: new Date(NOW.getTime() + 10 * DAY),
      },
    });
    expect(listing).toMatchObject({ price: 500, listingFee: 7 });
  });

  it("charges the featured fee for a featured listing and stores it", async () => {
    const { db, tx } = makeDb({ copy: copyOf(), listing: null });
    await create(db, { isFeatured: true });
    expect(spend).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: 13 }));
    expect(tx.cardListing.create.mock.calls[0]![0].data).toMatchObject({
      isFeatured: true,
      listingFee: 13,
    });
  });

  it("charges nothing for a free listing and stores a fee of 0", async () => {
    const { db, tx } = makeDb({
      copy: copyOf(),
      listing: null,
      config: [{ key: "card_economy_listing_fee", value: "0" }],
    });
    await create(db);
    expect(spend).not.toHaveBeenCalled();
    expect(tx.cardListing.create.mock.calls[0]![0].data.listingFee).toBe(0);
  });

  it("charges nothing and lists nothing when the copy is already locked", async () => {
    const { db, tx } = makeDb({ copy: copyOf({ isLocked: true }), listing: null });
    await expect(create(db)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(spend).not.toHaveBeenCalled();
    expect(tx.cardListing.create).not.toHaveBeenCalled();
  });

  it("refuses bound copies, copies that are not yours, and prices that are not whole IxC in range", async () => {
    const bound = makeDb({ copy: copyOf({ cards: { isBound: true } }), listing: null });
    await expect(create(bound.db)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(bound.tx.cardOwnership.updateMany).not.toHaveBeenCalled();

    const theirs = makeDb({ copy: copyOf(), listing: null });
    await expect(create(theirs.db, { sellerId: "someone" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(theirs.tx.cardOwnership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "own_1", ownerId: "someone" } })
    );

    for (const price of [0, 2.5, 1_000_001, Number.NaN]) {
      const { db, tx } = makeDb({ copy: copyOf(), listing: null });
      await expect(create(db, { price })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    }
    // The bounds themselves list
    for (const price of [1, 1_000_000]) {
      const { db } = makeDb({ copy: copyOf(), listing: null });
      await expect(create(db, { price })).resolves.toMatchObject({ price });
    }
  });

  it("reports a fee the seller can't pay as a bad request", async () => {
    spend.mockRejectedValueOnce(new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits"));
    const { db } = makeDb({ copy: copyOf(), listing: null });
    await expect(create(db)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Insufficient credits",
    });
  });

  it("is closed in maintenance and while the market switch is off", async () => {
    for (const row of [
      { key: "vault_isMaintenanceMode", value: "true" },
      { key: "vault_isAuctionsEnabled", value: "false" },
    ]) {
      invalidateVaultConfigCache();
      const { db, tx } = makeDb({ copy: copyOf(), listing: null, config: [row] });
      await expect(create(db)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(tx.cardOwnership.findFirst).not.toHaveBeenCalled();
    }
  });
});

describe("buyListing", () => {
  const buy = (db: object, buyerId = "buyer") =>
    buyListing(db as never, { buyerId, listingId: "l1", now: NOW });

  it("claims the listing, charges the buyer once and settles with the stored serial and finish", async () => {
    const { db, tx, world } = makeDb();
    const result = await buy(db);

    expect(tx.cardListing.updateMany).toHaveBeenCalledWith({
      where: { id: "l1", status: "ACTIVE", expiresAt: { gt: NOW } },
      data: { status: "SOLD", buyerId: "buyer", soldAt: NOW },
    });
    expect(world.listing?.status).toBe("SOLD");
    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend).toHaveBeenCalledWith(tx, {
      userId: "buyer",
      amount: 500,
      type: "SPEND_MARKET",
      source: "card_purchase_listing",
      metadata: { listingId: "l1", ownershipId: "own_1" },
    });
    expect(settle).toHaveBeenCalledWith(tx, {
      ownershipId: "own_1",
      cardId: "card_1",
      serialNumber: 4,
      finish: "HOLO",
      cardType: "NATION",
      countryId: "country_1",
      sellerId: "seller",
      buyerId: "buyer",
      price: 500,
      action: "LISTING_SALE",
      sellerSource: "card_sale_listing",
      context: { listingId: "l1" },
      now: NOW,
    });
    // The claim, then the buyer's payment, then the copy and the seller
    const order = [
      tx.cardListing.updateMany.mock.invocationCallOrder[0]!,
      spend.mock.invocationCallOrder[0]!,
      settle.mock.invocationCallOrder[0]!,
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(result).toEqual({
      listingId: "l1",
      ownershipId: "own_1",
      cardId: "card_1",
      sellerId: "seller",
      price: 500,
      settlement: { fee: 50, sellerNet: 450, royalties: [] },
    });
  });

  it("tells the seller after the commit, and each paid nation owner", async () => {
    settle.mockResolvedValueOnce({
      fee: 50,
      sellerNet: 450,
      royalties: [{ recipientId: "owner", amount: 10, cardId: "card_1" }],
    });
    const { db } = makeDb();
    await buy(db);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.invocationCallOrder[0]).toBeGreaterThan(
      db.$transaction.mock.invocationCallOrder[0]!
    );
    expect(notify.mock.calls[0]![0]).toBe(db);
    expect(notify.mock.calls[0]![1]).toEqual([
      {
        userId: "seller",
        cardId: "card_1",
        title: "Your listing sold",
        message: "Aurelia sold for 500 IxC. You received 450 IxC after the market fee.",
        type: "success",
        priority: "high",
        href: "/vault/cards/market?tab=selling",
        metadata: { listingId: "l1" },
      },
      expect.objectContaining({ userId: "owner", title: "Royalty paid", cardId: "card_1" }),
    ]);
  });

  it("names no market fee when the sale paid none", async () => {
    settle.mockResolvedValueOnce({ fee: 0, sellerNet: 90, royalties: [] });
    const { db } = makeDb({ listing: listingOf({ price: 90 }) });
    await buy(db);
    expect(notify.mock.calls[0]![1][0]!.message).toBe(
      "Aurelia sold for 90 IxC. You received 90 IxC."
    );
  });

  it("lets only one of two buyers through, and the loser is charged nothing", async () => {
    // The loser read the listing while it was live; the winner's claim landed first
    const { db, tx, world } = makeDb();
    db.cardListing.findUnique.mockResolvedValueOnce(listingOf());
    world.listing = listingOf({ status: "SOLD" });
    await expect(buy(db, "late")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.cardListing.updateMany).toHaveBeenCalledTimes(1);
    expect(spend).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("settles once when two buyers race for the same listing", async () => {
    const { db } = makeDb();
    const outcomes = await Promise.allSettled([buy(db, "b1"), buy(db, "b2")]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(spend).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it("refuses a listing that ends before the claim, even one read as live", async () => {
    // Read a moment before its end; the claim compares the end with the purchase time
    const { db, world } = makeDb();
    db.cardListing.findUnique.mockResolvedValueOnce(listingOf());
    world.listing = listingOf({ expiresAt: NOW });
    await expect(buy(db)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(spend).not.toHaveBeenCalled();
  });

  it("refuses your own listing, one that has expired or ended, and one that is missing", async () => {
    await expect(buy(makeDb().db, "seller")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    for (const listing of [
      listingOf({ expiresAt: NOW }),
      listingOf({ status: "CANCELLED" }),
      null,
    ]) {
      const { db, tx } = makeDb({ listing });
      await expect(buy(db)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(tx.cardListing.updateMany).not.toHaveBeenCalled();
    }
    expect(spend).not.toHaveBeenCalled();
  });

  it("refuses a live listing whose copy is gone, before anything moves", async () => {
    const { db, tx } = makeDb({ listing: listingOf({ ownershipId: null }) });
    await expect(buy(db)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.cardListing.updateMany).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
  });

  it("reports a buyer who can't pay as a bad request and sends nothing", async () => {
    spend.mockRejectedValueOnce(new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits"));
    const { db } = makeDb();
    await expect(buy(db)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Insufficient credits",
    });
    expect(settle).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("is closed in maintenance and while the market switch is off", async () => {
    const { db, tx } = makeDb({ config: [{ key: "vault_isAuctionsEnabled", value: "false" }] });
    await expect(buy(db)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.cardListing.updateMany).not.toHaveBeenCalled();
  });
});

describe("cancelListing", () => {
  const cancel = (db: object, sellerId = "seller") =>
    cancelListing(db as never, { sellerId, listingId: "l1", now: NOW });

  it("ends the listing, unlocks the copy and refunds the Economy tab's share of the stored fee", async () => {
    const { db, tx, world } = makeDb();
    expect(await cancel(db)).toEqual({ refund: 4 });
    expect(tx.cardListing.updateMany).toHaveBeenCalledWith({
      where: { id: "l1", status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    expect(world.listing?.status).toBe("CANCELLED");
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", ownerId: "seller" },
      data: { isLocked: false },
    });
    expect(world.copy?.isLocked).toBe(false);
    expect(earn).toHaveBeenCalledTimes(1);
    expect(earn).toHaveBeenCalledWith(tx, {
      userId: "seller",
      amount: 4,
      type: "REFUND",
      source: "listing_fee_refund",
      metadata: { listingId: "l1", reason: "cancelled" },
    });
  });

  it("refunds a share of what the listing stored, not of today's fee", async () => {
    const { db } = makeDb({ listing: listingOf({ listingFee: 5 }) });
    expect(await cancel(db)).toEqual({ refund: 2 });
    expect(earn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 2 }));
  });

  it("refunds nothing on a free listing", async () => {
    const { db, world } = makeDb({ listing: listingOf({ listingFee: 0 }) });
    expect(await cancel(db)).toEqual({ refund: 0 });
    expect(earn).not.toHaveBeenCalled();
    expect(world.copy?.isLocked).toBe(false);
  });

  it("a cancel that loses to a sale refunds nothing and unlocks nothing", async () => {
    const { db, world } = makeDb();
    db.cardListing.findUnique.mockResolvedValueOnce(listingOf());
    world.listing = listingOf({ status: "SOLD" });
    await expect(cancel(db)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(earn).not.toHaveBeenCalled();
    expect(world.copy?.isLocked).toBe(true);
  });

  it("refuses someone else's listing and a missing one", async () => {
    await expect(cancel(makeDb().db, "someone")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(cancel(makeDb({ listing: null }).db)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(earn).not.toHaveBeenCalled();
  });

  it("is closed in maintenance, as an auction's cancel is", async () => {
    const { db, tx } = makeDb({ config: [{ key: "vault_isMaintenanceMode", value: "true" }] });
    await expect(cancel(db)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.cardListing.updateMany).not.toHaveBeenCalled();
  });
});

describe("endListingTx", () => {
  it("unlocks no copy when the listing's copy is gone, and still refunds", async () => {
    const { tx, world } = makeDb({ listing: listingOf({ ownershipId: null }) });
    const ended = await endListingTx(
      tx as never,
      { id: "l1", sellerId: "seller", ownershipId: null, listingFee: 10 },
      "admin_cancel",
      NOW
    );
    expect(ended).toBe(4);
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(world.copy?.isLocked).toBe(true);
    expect(earn).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ metadata: { listingId: "l1", reason: "admin_cancel" } })
    );
    expect(world.listing?.status).toBe("CANCELLED");
  });
});

describe("expireListings", () => {
  it("expires a due listing once: the copy unlocks, the fee share comes back and the seller hears", async () => {
    const { db, tx, world } = makeDb({ listing: listingOf({ expiresAt: NOW }) });
    expect(await expireListings(db as never, NOW)).toEqual({ expired: 1, failed: 0 });

    expect(db.cardListing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "ACTIVE", expiresAt: { lte: NOW } },
        orderBy: { expiresAt: "asc" },
        take: 200,
      })
    );
    expect(tx.cardListing.updateMany).toHaveBeenCalledWith({
      where: { id: "l1", status: "ACTIVE", expiresAt: { lte: NOW } },
      data: { status: "EXPIRED" },
    });
    expect(world.listing?.status).toBe("EXPIRED");
    expect(world.copy?.isLocked).toBe(false);
    expect(earn).toHaveBeenCalledTimes(1);
    expect(earn).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: 4, metadata: { listingId: "l1", reason: "expired" } })
    );
    expect(notify).toHaveBeenCalledWith(db, [
      {
        userId: "seller",
        cardId: "card_1",
        title: "Your listing expired",
        message: "Aurelia is back in your collection. We refunded 4 IxC of the listing fee.",
        priority: "low",
        href: "/vault/cards/market?tab=selling",
        metadata: { listingId: "l1" },
      },
    ]);
  });

  it("names no refund when none was paid", async () => {
    const { db } = makeDb({ listing: listingOf({ expiresAt: NOW, listingFee: 0 }) });
    await expireListings(db as never, NOW);
    expect(notify.mock.calls[0]![1][0]!.message).toBe("Aurelia is back in your collection.");
  });

  it("skips a listing that sold meanwhile, and one the claim finds not yet due, paying and sending nothing", async () => {
    for (const listing of [
      listingOf({ expiresAt: NOW, status: "SOLD" }),
      listingOf({ expiresAt: new Date(NOW.getTime() + 1) }),
    ]) {
      earn.mockClear();
      notify.mockClear();
      const { db, world } = makeDb({ listing });
      db.cardListing.findMany.mockResolvedValueOnce([listingOf({ expiresAt: NOW })]);
      expect(await expireListings(db as never, NOW)).toEqual({ expired: 0, failed: 0 });
      expect(earn).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      expect(world.copy?.isLocked).toBe(true);
    }
  });

  it("counts a listing whose refund fails and goes on with the rest", async () => {
    const { db, tx } = makeDb();
    db.cardListing.findMany.mockResolvedValueOnce([
      listingOf({ id: "l_bad", expiresAt: NOW }),
      listingOf({ id: "l2", expiresAt: NOW }),
    ]);
    tx.cardListing.updateMany.mockResolvedValue({ count: 1 });
    earn.mockRejectedValueOnce(new LedgerError("MAINTENANCE", "Vault economy is in maintenance."));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await expireListings(db as never, NOW);
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
    expect(result).toEqual({ expired: 1, failed: 1 });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]![1][0]!.metadata).toEqual({ listingId: "l2" });
  });

  it("reads no config and opens no transaction when nothing is due", async () => {
    const { db } = makeDb({ listing: null });
    expect(await expireListings(db as never, NOW, 50)).toEqual({ expired: 0, failed: 0 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("listMyListings", () => {
  it("lists the seller's live listings first, then the last 30 days' ended ones, from what each stored", async () => {
    const soldAt = new Date(NOW.getTime() - DAY);
    const db = {
      cardListing: {
        findMany: jest.fn(async (_read: MyListingsRead) => [
          {
            id: "l1",
            price: 500,
            isFeatured: true,
            expiresAt: NOW,
            sellerId: "seller",
            ownershipId: null,
            finish: "HOLO",
            serialNumber: 4,
            status: "SOLD",
            cardId: "card_1",
            soldAt,
            card: { title: "Aurelia" },
          },
        ]),
      },
    };
    expect(await listMyListings(db as never, "seller", NOW)).toEqual([
      {
        id: "l1",
        price: 500,
        isFeatured: true,
        expiresAt: NOW,
        sellerId: "seller",
        ownershipId: null,
        finish: "HOLO",
        serialNumber: 4,
        status: "SOLD",
        cardId: "card_1",
        cardTitle: "Aurelia",
        soldAt,
      },
    ]);
    const [read] = db.cardListing.findMany.mock.calls[0]!;
    expect(read.where).toEqual({
      sellerId: "seller",
      OR: [{ status: "ACTIVE" }, { updatedAt: { gte: new Date(NOW.getTime() - 30 * DAY) } }],
    });
    expect(read.orderBy).toEqual([{ status: "asc" }, { updatedAt: "desc" }, { id: "asc" }]);
    expect(read.take).toBe(100);
    // A finished listing outlives its copy: nothing is read from the copy, and the seller is the viewer
    expect(read.select.ownership).toBeUndefined();
    expect(read.select.seller).toBeUndefined();
  });
});

interface MyListingsRead {
  where: object;
  orderBy: object;
  take: number;
  select: { ownership?: object; seller?: object };
}
