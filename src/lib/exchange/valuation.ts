/**
 * The Exchange money math the UI shows and the server settles on: one copy, client-safe (no Prisma at runtime).
 * companies.ts, credit.ts and src/components/exchange/shared.tsx re-export these.
 */
import { fromCents, toCents } from "./amounts";
import { CREDIT_RATINGS, borrowRateFor } from "./taxonomy";

/** The index level every sector starts at (SectorIndex.value default). */
export const INDEX_BASE = 1000;

export interface FairValueWeights {
  valuationSectorWeight: number;
  valuationStandingWeight: number;
  valuationDecisionWeight: number;
}

export interface FairValueBreakdown {
  capital: number;
  contracts: number;
  standing: number;
  /** Multiplier from the company's sector index (1 at the base level of 1,000). */
  sectorFactor: number;
  decisions: number;
  fairValue: number;
}

const DEFAULT_WEIGHTS: FairValueWeights = {
  valuationSectorWeight: 1,
  valuationStandingWeight: 0.5,
  valuationDecisionWeight: 1,
};

/**
 * Fair value, from the sector-index valuation:
 *   book   = capital + 0.25 × contracts won + 200 × standingWeight × positive standing
 *   factor = 1 + sectorWeight × (sector index ÷ 1,000 − 1), held to 0.5 .. 2
 *   value  = book × factor + decisionWeight × decisionValue (applied EXPAND decisions)
 * With the default weights and an index at 1,000 this is the MVP formula (100 per point of
 * standing). It is a reference price for primary share issues and the directory, not money.
 */
export function computeFairValue(
  c: {
    capital: number;
    creditDrawn?: number;
    contractsWonValue: number;
    standing: number;
    decisionValue?: number;
  },
  sectorIndexValue: number = INDEX_BASE,
  weights: FairValueWeights = DEFAULT_WEIGHTS
): FairValueBreakdown {
  const netCapitalCents = Math.max(0, toCents(c.capital) - toCents(c.creditDrawn ?? 0));
  const contractsCents = Math.round(0.25 * toCents(c.contractsWonValue));
  const standingCents = Math.round(
    200_00 * weights.valuationStandingWeight * Math.max(0, c.standing)
  );
  const rawFactor = 1 + weights.valuationSectorWeight * (sectorIndexValue / INDEX_BASE - 1);
  const sectorFactor = Math.round(Math.min(2, Math.max(0.5, rawFactor)) * 10_000) / 10_000;
  const decisionsCents = Math.round(
    weights.valuationDecisionWeight * toCents(c.decisionValue ?? 0)
  );
  const fairValueCents = Math.round(
    (netCapitalCents + contractsCents + standingCents) * sectorFactor + decisionsCents
  );
  return {
    capital: fromCents(netCapitalCents),
    contracts: fromCents(contractsCents),
    standing: fromCents(standingCents),
    sectorFactor,
    decisions: fromCents(decisionsCents),
    fairValue: fromCents(fairValueCents),
  };
}

const CREDIT_LIMIT_CAP = 250_000;
const CREDIT_LIMIT_SHARE = 0.5;
const CONTRACT_CREDIT_SHARE = 0.25;

/** The Central Bank credit line a company's productive plant and contract record support. */
/** The line a company's record supports, held to its home treasury's cap (lending terms; ₷250,000 by default). */
export function creditLimitFor(
  c: { decisionValue: number; contractsWonValue: number },
  cap: number = CREDIT_LIMIT_CAP
): number {
  const basis = c.decisionValue + CONTRACT_CREDIT_SHARE * c.contractsWonValue;
  return Math.min(CREDIT_LIMIT_CAP, cap, CREDIT_LIMIT_SHARE * basis);
}

/**
 * The rate a company borrows at: the HQ nation's rate plus the rating spread, plus the nation's extra spread (lending
 * terms). A D-rated borrower already owes money it cannot repay, so it pays the CCC rate rather than no spread.
 */
export function borrowRateOf(hqRate: number | null, rating: string, spread = 0): number {
  const r = CREDIT_RATINGS.find((x) => x === rating) ?? "D";
  const base = borrowRateFor(hqRate, r) ?? borrowRateFor(hqRate, "CCC") ?? 0;
  return Math.max(0, base + spread);
}
