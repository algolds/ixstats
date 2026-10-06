/**
 * Who owns a company, and exact pro rata splits of ₷ between its owners. Shared by
 * dividends, dissolution and the share market. Spec: docs/specs/2026-10-06-exchange-economy-design.md §8.
 *
 * Shares a holder has put up for sale (an OPEN secondary ShareListing) are escrowed out of
 * their Shareholding but still theirs, so they count toward dividends. Unsold primary shares
 * (a listing with no seller) belong to nobody yet and earn nothing.
 */

import type { Db } from "./guards";

export interface Holder {
  userId: string;
  shares: number;
}

export const toCents = (n: number): number => Math.round(n * 100);
export const fromCents = (c: number): number => c / 100;

/**
 * Row-lock a company until the transaction ends. Every share trade, dividend, decision and
 * dissolution takes it first, so they run one at a time per company and a dividend's view of
 * the holders can't change under it.
 */
export async function lockCompany(tx: Db, companyId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "exchange_companies" WHERE id = ${companyId} FOR UPDATE`;
}

/** Each owner's shares: their holding plus what they have listed for sale. */
export async function holdersOf(tx: Db, companyId: string): Promise<Holder[]> {
  const [holdings, listings] = await Promise.all([
    tx.shareholding.findMany({
      where: { companyId, shares: { gt: 0 } },
      select: { ownerUserId: true, shares: true },
    }),
    tx.shareListing.findMany({
      where: { companyId, status: "OPEN", sellerUserId: { not: null } },
      select: { sellerUserId: true, shares: true },
    }),
  ]);
  const byUser = new Map<string, number>();
  for (const h of holdings) byUser.set(h.ownerUserId, (byUser.get(h.ownerUserId) ?? 0) + h.shares);
  for (const l of listings) {
    if (l.sellerUserId) byUser.set(l.sellerUserId, (byUser.get(l.sellerUserId) ?? 0) + l.shares);
  }
  return [...byUser.entries()]
    .filter(([, shares]) => shares > 0)
    .map(([userId, shares]) => ({ userId, shares }))
    .sort((a, b) => b.shares - a.shares || a.userId.localeCompare(b.userId));
}

export interface ProRataSplit {
  payouts: Array<{ userId: string; cents: number }>;
  /** Whole cents paid in total (never more than asked). */
  paidCents: number;
  /** Cents left over from rounding each payout down. */
  remainderCents: number;
}

/**
 * Split `totalCents` across holders by shares, rounding each payout down to a whole cent.
 * The payouts plus the remainder always equal the total: nothing is created or lost.
 */
export function splitProRata(totalCents: number, holders: readonly Holder[]): ProRataSplit {
  const total = Math.max(0, Math.floor(totalCents));
  const shareCount = holders.reduce((s, h) => s + h.shares, 0);
  if (shareCount <= 0 || total === 0) return { payouts: [], paidCents: 0, remainderCents: total };
  const payouts = holders
    .map((h) => ({ userId: h.userId, cents: Math.floor((total * h.shares) / shareCount) }))
    .filter((p) => p.cents > 0);
  const paidCents = payouts.reduce((s, p) => s + p.cents, 0);
  return { payouts, paidCents, remainderCents: total - paidCents };
}
