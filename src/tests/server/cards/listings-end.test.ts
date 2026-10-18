/** @jest-environment node */
/**
 * Fixed-price listings, ended unsold: the player's cancel, the expiry and the admin cancel each claim a listing once,
 * unlock its copy and refund the Economy tab's share of the fee it stored; and the seller's own list. The fake honours
 * the claims' `where` and rolls back a transaction that throws (`~/tests/helpers/fake-listing-db`).
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
jest.mock("~/lib/cards/card-notify", () => ({ notifyCards: jest.fn() }));

import { notifyCards } from "~/lib/cards/card-notify";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { earnCreditsTx, LedgerError } from "~/lib/vault/vault-ledger";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import {
  cancelListing,
  endListingTx,
  expireListings,
  listMyListings,
} from "~/server/modules/cards/market/listings";
import { DAY, listingOf, makeListingDb as makeDb, NOW } from "~/tests/helpers/fake-listing-db";

const earn = jest.mocked(earnCreditsTx);
const notify = jest.mocked(notifyCards);

beforeEach(() => {
  clearEconomyConfigCache();
  invalidateVaultConfigCache();
  earn.mockReset().mockResolvedValue({ newBalance: 0, amount: 0 });
  notify.mockReset().mockResolvedValue(undefined);
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
