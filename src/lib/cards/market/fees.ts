/** Market fee arithmetic (client-safe): sales, trade credit legs, the royalty and listing refunds. */

/** The highest fixed listing price, in IxC. */
export const MAX_LISTING_PRICE = 1_000_000;

export interface FeeRule {
  /** The admin house rake, in percent (clamped to 0..50). */
  ratePct: number;
  /** Amounts at or under this pay nothing. */
  threshold: number;
}

/**
 * A percentage clamped to 0..`maxPct`, in whole basis points (hundredths of a percent) rounded down, so the money
 * below is integer arithmetic: a float 200 × 0.29 is 57.99..., which would lose a whole IxC, and a finer rate never
 * charges or pays more than stated. The epsilon keeps a hundredth that a float stores just below itself
 * (0.29 × 100 is 28.999...) at its own value.
 */
function basisPoints(pct: number, maxPct: number): number {
  return Math.floor(Math.min(Math.max(pct, 0), maxPct) * 100 + 1e-9);
}

/** The market fee on a sale or a trade's credit leg (whole IxC), rounded down. */
export function saleFee(amount: number, rule: FeeRule): number {
  if (amount <= rule.threshold) return 0;
  return Math.floor((amount * basisPoints(rule.ratePct, 50)) / 10_000);
}

/** `pct` of `amount` in IxC, rounded down to the cent. */
function centsOf(amount: number, pct: number): number {
  return Math.floor((amount * basisPoints(pct, 100)) / 100) / 100;
}

/**
 * The nation royalty: `royaltyPct` of the amount in cents, paid out of the fee, so never more than the fee and never
 * below 0.
 */
export function royaltyFromFee(amount: number, fee: number, royaltyPct: number): number {
  return Math.max(0, Math.min(fee, centsOf(amount, royaltyPct)));
}

/** The listing-fee refund on cancel or expiry, in cents, never more than its share of the fee. */
export function listingRefund(fee: number, refundPct: number): number {
  return centsOf(fee, refundPct);
}
