/**
 * The Exchange money math the UI shows and the server settles on: one copy, client-safe (no Prisma at runtime).
 * companies.ts, credit.ts and src/components/exchange/shared.tsx re-export these.
 */
import { round2 } from "./amounts";
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
  const netCapital = Math.max(0, round2(c.capital - (c.creditDrawn ?? 0)));
  const contracts = round2(0.25 * c.contractsWonValue);
  const standing = round2(200 * weights.valuationStandingWeight * Math.max(0, c.standing));
  const rawFactor = 1 + weights.valuationSectorWeight * (sectorIndexValue / INDEX_BASE - 1);
  const sectorFactor = Math.round(Math.min(2, Math.max(0.5, rawFactor)) * 10_000) / 10_000;
  const decisions = round2(weights.valuationDecisionWeight * (c.decisionValue ?? 0));
  const fairValue = round2((netCapital + contracts + standing) * sectorFactor + decisions);
  return { capital: netCapital, contracts, standing, sectorFactor, decisions, fairValue };
}

const CREDIT_LIMIT_CAP = 250_000;
const CREDIT_LIMIT_SHARE = 0.5;
const CONTRACT_CREDIT_SHARE = 0.25;

/** The Central Bank credit line a company's productive plant and contract record support. */
export function creditLimitFor(c: { decisionValue: number; contractsWonValue: number }): number {
  const basis = c.decisionValue + CONTRACT_CREDIT_SHARE * c.contractsWonValue;
  return Math.min(CREDIT_LIMIT_CAP, CREDIT_LIMIT_SHARE * basis);
}

/**
 * The rate a company borrows at: the HQ nation's rate plus the rating spread. A D-rated borrower
 * already owes money it cannot repay, so it pays the CCC rate rather than a rate with no spread.
 */
export function borrowRateOf(hqRate: number | null, rating: string): number {
  const r = CREDIT_RATINGS.find((x) => x === rating) ?? "D";
  return borrowRateFor(hqRate, r) ?? borrowRateFor(hqRate, "CCC") ?? 0;
}
