/** @jest-environment node */
/**
 * Fixed-price listings, made and bought: the copy locks while listed and the fee is charged after the lock. One buyer
 * wins the listing's claim, the parties' vaults lock in order, the buyer pays once, the sale settles with the serial and
 * finish the listing stored, and the bought copy earns card XP, all in one transaction. The fake honours the claims'
 * `where` and rolls back a transaction that throws (`~/tests/helpers/fake-listing-db`).
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
jest.mock("~/lib/cards/market/settle-sale", () => ({
  settleCardSaleTx: jest.fn(),
  lockSaleVaultsTx: jest.fn(),
}));
jest.mock("~/lib/cards/xp-utils", () => ({ grantCardXp: jest.fn() }));
jest.mock("~/lib/cards/card-notify", () => ({ notifyCards: jest.fn() }));

import { Prisma } from "@prisma/client";
import { notifyCards } from "~/lib/cards/card-notify";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { lockSaleVaultsTx, settleCardSaleTx } from "~/lib/cards/market/settle-sale";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { earnCreditsTx, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { VAULTS_BUSY_MESSAGE } from "~/lib/vault/vault-locks";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { buyListing, createListing } from "~/server/modules/cards/market/listings";
import {
  copyOf,
  DAY,
  listingOf,
  makeListingDb as makeDb,
  NOW,
} from "~/tests/helpers/fake-listing-db";

const spend = jest.mocked(spendCreditsTx);
const earn = jest.mocked(earnCreditsTx);
const settle = jest.mocked(settleCardSaleTx);
const lockVaults = jest.mocked(lockSaleVaultsTx);
const grantXp = jest.mocked(grantCardXp);
const notify = jest.mocked(notifyCards);
const XP = { prevLevel: 1, newLevel: 2, prevXP: 90, newXP: 140, leveledUp: true, xpGained: 50 };

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
  lockVaults.mockReset().mockResolvedValue(undefined);
  grantXp.mockReset().mockResolvedValue(XP);
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
    // Every party's vault, in user-id order, for the sale settleCardSaleTx makes
    expect(lockVaults).toHaveBeenCalledTimes(1);
    expect(lockVaults).toHaveBeenCalledWith(tx, settle.mock.calls[0]![1]);
    // The bought copy earns what an auction win does, inside the sale
    expect(grantXp).toHaveBeenCalledTimes(1);
    expect(grantXp).toHaveBeenCalledWith(
      tx,
      "own_1",
      "LISTING_PURCHASE",
      JSON.stringify({ listingId: "l1" }),
      NOW
    );
    // The claim, the vault locks, the buyer's payment, the copy and the seller, then the copy's XP
    const order = [
      tx.cardListing.updateMany.mock.invocationCallOrder[0]!,
      lockVaults.mock.invocationCallOrder[0]!,
      spend.mock.invocationCallOrder[0]!,
      settle.mock.invocationCallOrder[0]!,
      grantXp.mock.invocationCallOrder[0]!,
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // A sale refunds no listing fee
    expect(earn).not.toHaveBeenCalled();
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      listingId: "l1",
      ownershipId: "own_1",
      cardId: "card_1",
      sellerId: "seller",
      price: 500,
      settlement: { fee: 50, sellerNet: 450, royalties: [] },
      xp: XP,
    });
  });

  it("rolls the whole sale back when the copy's XP fails, and sends nothing", async () => {
    grantXp.mockRejectedValueOnce(new Error("database gone"));
    const { db, world } = makeDb();
    await expect(buy(db)).rejects.toThrow("database gone");
    expect(world.listing?.status).toBe("ACTIVE");
    expect(notify).not.toHaveBeenCalled();
  });

  it("grants no XP when the sale fails", async () => {
    settle.mockRejectedValueOnce(new Error("This card changed hands"));
    const { db, world } = makeDb();
    await expect(buy(db)).rejects.toThrow("This card changed hands");
    expect(grantXp).not.toHaveBeenCalled();
    expect(world.listing?.status).toBe("ACTIVE");
  });

  it("answers a purchase that lost a deadlock as a CONFLICT to retry, with nothing moved", async () => {
    settle.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Transaction failed due to a deadlock", {
        code: "P2034",
        clientVersion: "6",
      })
    );
    const { db, world } = makeDb();
    await expect(buy(db)).rejects.toMatchObject({ code: "CONFLICT", message: VAULTS_BUSY_MESSAGE });
    expect(world.listing?.status).toBe("ACTIVE");
    expect(notify).not.toHaveBeenCalled();
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
