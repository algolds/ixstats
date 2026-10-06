/**
 * The share market. Spec: docs/specs/2026-10-06-exchange-economy-design.md §8.
 *
 * Fixed-price listings, no order book: a seller puts N shares up at a price per share and
 * buyers take any part of them at that price. Two kinds:
 *   - primary: the founder issues new shares, priced at fair value per share; the ₷ go to
 *     the company's capital. One open issue per company.
 *   - secondary: any holder sells shares they own; the shares are escrowed out of their
 *     holding until sold or cancelled, and the ₷ go to their wallet.
 * Founder controls: trading on or off (`Company.tradingOpen`, off at charter), issuing new
 * shares, cancelling the issue, dividends (dividends.ts). Control never moves with shares.
 *
 * Every trade locks the company row first, then wallets, and moves ₷ with the wallet
 * ledger's conditional decrement under an idempotency key: a retried purchase is applied
 * once, a buyer can't overdraw, and a listing can't sell more shares than it has.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { refreshFairValue, requireOwnedCompany } from "./companies";
import { assertExchangeOpen, lockWallet, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { fromCents, lockCompany, toCents } from "./ownership";
import { formatSovereigns } from "./quote";

/** Most shares a company may ever have issued. */
export const MAX_SHARES_ISSUED = 1_000_000;
/** Open secondary listings one holder may have per company. */
export const MAX_OPEN_LISTINGS_PER_HOLDER = 5;

function assertWholeShares(shares: number): void {
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Shares must be a whole number above zero");
  }
}

function assertPrice(price: number): void {
  if (!Number.isFinite(price) || price < 0.01 || toCents(price) / 100 !== price) {
    throw new ExchangeError("INVALID_AMOUNT", "Price must be at least ₷0.01, in whole cents");
  }
}

/** Primary issue price: fair value per outstanding share, rounded down to a cent, at least ₷0.01. */
export function primaryPricePerShare(fairValue: number, sharesOutstanding: number): number {
  if (sharesOutstanding <= 0) return 0.01;
  return Math.max(0.01, Math.floor((fairValue * 100) / sharesOutstanding) / 100);
}

async function requireTradable(tx: Db, companyId: string) {
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  if (company.status !== "ACTIVE") {
    throw new ExchangeError("CONFLICT", "This company is no longer active");
  }
  if (!company.tradingOpen) {
    throw new ExchangeError("CONFLICT", `Share trading in ${company.name} is closed`);
  }
  return company;
}

/** Founder control: open or close trading in the company's shares. */
export async function setShareTrading(
  db: PrismaClient,
  input: { userId: string; companyId: string; open: boolean }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await lockCompany(tx, input.companyId);
    await requireOwnedCompany(tx, input.companyId, input.userId);
    await tx.company.update({ where: { id: input.companyId }, data: { tradingOpen: input.open } });
    return { tradingOpen: input.open };
  });
}

/**
 * Founder issues new shares as a primary listing at fair value per share. At most doubles
 * the shares issued per issue, never past MAX_SHARES_ISSUED, one open issue at a time.
 */
export async function issueShares(
  db: PrismaClient,
  input: { userId: string; companyId: string; shares: number; requestId: string }
) {
  assertWholeShares(input.shares);
  const key = `exchange:share-issue:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const existing = await tx.shareListing.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { listing: existing, alreadyApplied: true };

      await requireOwnedCompany(tx, input.companyId, input.userId);
      const company = await requireTradable(tx, input.companyId);
      const open = await tx.shareListing.count({
        where: { companyId: company.id, status: "OPEN", sellerUserId: null },
      });
      if (open > 0) throw new ExchangeError("CONFLICT", "This company already has shares on sale");
      if (input.shares > company.sharesIssued) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `An issue can at most double the shares: up to ${company.sharesIssued.toLocaleString("en-US")} now`
        );
      }
      if (company.sharesIssued + input.shares > MAX_SHARES_ISSUED) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `A company can issue at most ${MAX_SHARES_ISSUED.toLocaleString("en-US")} shares`
        );
      }

      const now = IxTime.getCurrentIxTime();
      const pricePerShare = primaryPricePerShare(company.fairValue, company.sharesOutstanding);
      await tx.company.update({
        where: { id: company.id },
        data: { sharesIssued: { increment: input.shares } },
      });
      await tx.shareIssuance.create({
        data: { companyId: company.id, shares: input.shares, pricePerShare, issuedIxTime: now },
      });
      const listing = await tx.shareListing.create({
        data: {
          companyId: company.id,
          sellerUserId: null,
          shares: input.shares,
          sharesListed: input.shares,
          pricePerShare,
          createdIxTime: now,
          idempotencyKey: key,
        },
      });
      return { listing, alreadyApplied: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const listing = await db.shareListing.findUnique({ where: { idempotencyKey: key } });
      if (listing) return { listing, alreadyApplied: true };
    }
    throw error;
  }
}

/** A holder lists shares they own for sale; the shares leave their holding until sold or cancelled. */
export async function listShares(
  db: PrismaClient,
  input: {
    userId: string;
    companyId: string;
    shares: number;
    pricePerShare: number;
    requestId: string;
  }
) {
  assertWholeShares(input.shares);
  assertPrice(input.pricePerShare);
  const key = `exchange:share-list:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const existing = await tx.shareListing.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { listing: existing, alreadyApplied: true };

      await requireTradable(tx, input.companyId);
      const open = await tx.shareListing.count({
        where: { companyId: input.companyId, sellerUserId: input.userId, status: "OPEN" },
      });
      if (open >= MAX_OPEN_LISTINGS_PER_HOLDER) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `You can have up to ${MAX_OPEN_LISTINGS_PER_HOLDER} open listings per company`
        );
      }
      const { count } = await tx.shareholding.updateMany({
        where: {
          companyId: input.companyId,
          ownerUserId: input.userId,
          shares: { gte: input.shares },
        },
        data: { shares: { decrement: input.shares } },
      });
      if (count !== 1) throw new ExchangeError("INVALID_AMOUNT", "You don't hold that many shares");

      const listing = await tx.shareListing.create({
        data: {
          companyId: input.companyId,
          sellerUserId: input.userId,
          shares: input.shares,
          sharesListed: input.shares,
          pricePerShare: input.pricePerShare,
          createdIxTime: IxTime.getCurrentIxTime(),
          idempotencyKey: key,
        },
      });
      return { listing, alreadyApplied: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const listing = await db.shareListing.findUnique({ where: { idempotencyKey: key } });
      if (listing) return { listing, alreadyApplied: true };
    }
    throw error;
  }
}

/**
 * Withdraw what is left of a listing: the seller's shares go back to their holding; an
 * unsold primary issue (founder only) is un-issued. Works while trading is closed.
 */
export async function cancelListing(
  db: PrismaClient,
  input: { userId: string; listingId: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const found = await tx.shareListing.findUnique({ where: { id: input.listingId } });
    if (!found) throw new ExchangeError("NOT_FOUND", "Listing not found");
    await lockCompany(tx, found.companyId);
    const listing = await tx.shareListing.findUnique({ where: { id: input.listingId } });
    if (!listing || listing.status !== "OPEN") {
      throw new ExchangeError("CONFLICT", "This listing is already closed");
    }
    if (listing.sellerUserId === null) {
      await requireOwnedCompany(tx, listing.companyId, input.userId);
    } else if (listing.sellerUserId !== input.userId) {
      throw new ExchangeError("FORBIDDEN", "This is not your listing");
    }
    const { count } = await tx.shareListing.updateMany({
      where: { id: listing.id, status: "OPEN", shares: listing.shares },
      data: { status: "CANCELLED", shares: 0 },
    });
    if (count !== 1) throw new ExchangeError("CONFLICT", "The listing changed; try again");
    if (listing.sellerUserId) {
      await tx.shareholding.update({
        where: {
          companyId_ownerUserId: {
            companyId: listing.companyId,
            ownerUserId: listing.sellerUserId,
          },
        },
        data: { shares: { increment: listing.shares } },
      });
    } else {
      await tx.company.update({
        where: { id: listing.companyId },
        data: { sharesIssued: { decrement: listing.shares } },
      });
    }
    return { returned: listing.shares };
  });
}

/** Add shares to a holding at `cost`, keeping the average cost per share. */
async function creditHolding(
  tx: Db,
  companyId: string,
  userId: string,
  shares: number,
  cost: number
) {
  const holding = await tx.shareholding.findUnique({
    where: { companyId_ownerUserId: { companyId, ownerUserId: userId } },
  });
  if (!holding) {
    await tx.shareholding.create({
      data: {
        companyId,
        ownerUserId: userId,
        shares,
        avgCost: Math.round((cost / shares) * 100) / 100,
      },
    });
    return;
  }
  const total = holding.shares + shares;
  const avgCost = Math.round(((holding.shares * holding.avgCost + cost) / total) * 100) / 100;
  await tx.shareholding.update({
    where: { id: holding.id },
    data: { shares: { increment: shares }, avgCost },
  });
}

/** Buy `shares` from a listing at its price. A retry with the same requestId is applied once. */
export async function buyShares(
  db: PrismaClient,
  input: { userId: string; listingId: string; shares: number; requestId: string }
) {
  assertWholeShares(input.shares);
  const key = `exchange:share-buy:${input.userId}:${input.requestId}`;
  const notices: ExchangeNotice[] = [];
  try {
    const result = await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      const found = await tx.shareListing.findUnique({ where: { id: input.listingId } });
      if (!found) throw new ExchangeError("NOT_FOUND", "Listing not found");
      await lockCompany(tx, found.companyId);
      // Wallets in user-id order (as dividends pay them), so two trades can't deadlock.
      const parties = [input.userId, found.sellerUserId].filter((u): u is string => !!u);
      for (const u of [...new Set(parties)].sort()) await lockWallet(tx, u);
      const applied = await tx.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (applied) return { shares: input.shares, cost: -applied.sovereigns, alreadyApplied: true };

      const listing = await tx.shareListing.findUnique({ where: { id: input.listingId } });
      if (!listing || listing.status !== "OPEN") {
        throw new ExchangeError("CONFLICT", "This listing is closed");
      }
      const company = await requireTradable(tx, listing.companyId);
      if (listing.sellerUserId === input.userId) {
        throw new ExchangeError("FORBIDDEN", "You can't buy your own listing");
      }
      if (input.shares > listing.shares) {
        throw new ExchangeError("CONFLICT", `Only ${listing.shares} shares are left`);
      }

      const cost = fromCents(toCents(listing.pricePerShare) * input.shares);
      const { count } = await tx.shareListing.updateMany({
        where: { id: listing.id, status: "OPEN", shares: { gte: input.shares } },
        data: { shares: { decrement: input.shares } },
      });
      if (count !== 1) throw new ExchangeError("CONFLICT", "Those shares were just sold");
      if (listing.shares === input.shares) {
        await tx.shareListing.update({ where: { id: listing.id }, data: { status: "FILLED" } });
      }

      const meta = { listingId: listing.id, companyId: company.id, shares: input.shares };
      await spendSovereignsTx(tx, {
        userId: input.userId,
        amount: cost,
        type: "SHARE_BUY",
        source: `SHARES:${company.id}`,
        metadata: { ...meta, pricePerShare: listing.pricePerShare },
        idempotencyKey: key,
      });
      const seller = listing.sellerUserId;
      if (seller) {
        await earnSovereignsTx(tx, {
          userId: seller,
          amount: cost,
          type: "SHARE_SELL",
          source: `SHARES:${company.id}`,
          metadata: { ...meta, pricePerShare: listing.pricePerShare },
          idempotencyKey: `${key}:seller`,
        });
      } else {
        await tx.company.update({
          where: { id: company.id },
          data: { capital: { increment: cost }, sharesOutstanding: { increment: input.shares } },
        });
      }
      await creditHolding(tx, company.id, input.userId, input.shares, cost);
      if (!seller) await refreshFairValue(tx, company.id);

      const recipient = seller ?? company.founderId;
      if (recipient !== input.userId) {
        notices.push({
          userId: recipient,
          title: `${input.shares.toLocaleString("en-US")} ${company.name} shares sold`,
          message: seller
            ? `${formatSovereigns(cost)} is in your wallet.`
            : `${formatSovereigns(cost)} from the new issue went to ${company.name}'s capital.`,
          priority: "low",
        });
      }
      return { shares: input.shares, cost, alreadyApplied: false };
    });
    notifyExchange(notices);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const applied = await db.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (applied) return { shares: input.shares, cost: -applied.sovereigns, alreadyApplied: true };
    }
    throw error;
  }
}
