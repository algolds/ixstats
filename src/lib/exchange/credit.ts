/**
 * The Central Bank credit line: the limit and rate a company borrows at, and the draw and repay
 * moves. The loan is funded by the HQ treasury, so it moves existing ₷ rather than minting it.
 * Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 */

import type { Company, PrismaClient } from "@prisma/client";
import { ExchangeError, isUniqueViolation } from "~/lib/vault/exchange-service";
import { formatSovereigns } from "./amounts";
import { refreshFairValue } from "./companies";
import { distressDecision } from "./distress";
import { assertExchangeOpen, type Db } from "./guards";
import { fromCents, lockCompany, toCents } from "./ownership";
import { macroOfCountry } from "./tariffs";
import { CREDIT_RATINGS, creditRatingFor, type CreditRating } from "./taxonomy";
import { transferToTreasuryTx, debitTreasuryTx } from "./treasury";

const LENDING_FLOOR: CreditRating = "B";
const EPS = 1e-9;

export interface CreditLineInput {
  userId: string;
  companyId: string;
  amount: number;
  requestId: string;
}

export interface BorrowResult {
  alreadyApplied: boolean;
  creditDrawn: number;
  creditLimit: number;
  rate: number;
}

export interface RepayResult {
  alreadyApplied: boolean;
  creditDrawn: number;
  cured: boolean;
}

function isLendable(rating: CreditRating): boolean {
  return CREDIT_RATINGS.indexOf(rating) <= CREDIT_RATINGS.indexOf(LENDING_FLOOR);
}

export { borrowRateOf, creditLimitFor } from "./valuation";
import { borrowRateOf, creditLimitFor } from "./valuation";

function liveRatingOf(
  c: Pick<Company, "standing" | "creditDrawn" | "capital" | "decisionValue" | "lastTickNetIncome">
): CreditRating {
  return creditRatingFor({
    standing: c.standing,
    debtToEquity: c.creditDrawn / Math.max(1, c.capital + c.decisionValue),
    lastTickNetIncome: c.lastTickNetIncome,
  });
}

/** A positive amount, rounded to whole cents. */
function wholeAmount(amount: number): number {
  const cents = toCents(amount);
  if (!Number.isFinite(amount) || cents <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive");
  }
  return fromCents(cents);
}

/**
 * Load a company the caller founded for a credit-line action. A distressed company may repay
 * (that is how it cures), but may not draw.
 */
async function creditLineOwnerTx(
  tx: Db,
  companyId: string,
  userId: string,
  allowDistress: boolean
): Promise<Company> {
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  if (company.founderId !== userId) {
    throw new ExchangeError("FORBIDDEN", "You did not found this company");
  }
  if (company.status === "DISTRESSED") {
    if (allowDistress) return company;
    throw new ExchangeError(
      "CONFLICT",
      "This company is in distress: it cannot draw on its credit line until it is cured"
    );
  }
  if (company.status !== "ACTIVE") {
    throw new ExchangeError("CONFLICT", "This company is no longer active");
  }
  return company;
}

/**
 * Draw on a company's Central Bank credit line. The loan is funded by the HQ treasury, so it
 * moves existing ₷ rather than minting it. The treasury moves first: a retry with the same key
 * then finds its ledger row before any limit check that its first attempt has now changed.
 */
export async function borrowCredit(
  db: PrismaClient,
  input: CreditLineInput
): Promise<BorrowResult> {
  const amount = wholeAmount(input.amount);
  const key = `exchange:credit:borrow:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const company = await creditLineOwnerTx(tx, input.companyId, input.userId, false);
      const hq = company.hqCountryId;
      const macro = hq ? await macroOfCountry(tx, hq) : null;
      if (!hq || !macro) {
        throw new ExchangeError(
          "CONFLICT",
          "The Central Bank lends only to a company with a home nation"
        );
      }
      const moved = await debitTreasuryTx(tx, {
        countryId: hq,
        amount,
        type: "SPEND",
        source: `CREDIT_LINE:${company.id}`,
        key,
      });
      const limit = creditLimitFor(company);
      if (moved === 0) {
        return {
          alreadyApplied: true,
          creditDrawn: company.creditDrawn,
          creditLimit: limit,
          rate: borrowRateOf(macro.interestRate, company.creditRating),
        };
      }
      const rating = liveRatingOf(company);
      if (!isLendable(rating)) {
        throw new ExchangeError(
          "CONFLICT",
          `Its credit rating (${rating}) is below B: the Central Bank will not lend`
        );
      }
      if (company.creditDrawn + amount > limit + EPS) {
        throw new ExchangeError(
          "CONFLICT",
          `This would take the credit line past its limit of ${formatSovereigns(limit)}`
        );
      }
      await tx.company.update({
        where: { id: company.id },
        data: {
          capital: { increment: amount },
          creditDrawn: { increment: amount },
          creditRating: rating,
        },
      });
      await refreshFairValue(tx, company.id);
      return {
        alreadyApplied: false,
        creditDrawn: company.creditDrawn + amount,
        creditLimit: limit,
        rate: borrowRateOf(macro.interestRate, rating),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error))
      return { alreadyApplied: true, creditDrawn: 0, creditLimit: 0, rate: 0 };
    throw error;
  }
}

/**
 * Repay part or all of a credit line from the company's capital into its HQ treasury. Once the
 * debt is covered and capital is back at or above zero, a distressed company is cured.
 */
export async function repayCredit(db: PrismaClient, input: CreditLineInput): Promise<RepayResult> {
  const amount = wholeAmount(input.amount);
  const key = `exchange:credit:repay:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const company = await creditLineOwnerTx(tx, input.companyId, input.userId, true);
      const hq = company.hqCountryId;
      if (!hq) throw new ExchangeError("CONFLICT", "This company has no lender on record");
      const moved = await transferToTreasuryTx(tx, {
        from: { kind: "COMPANY", companyId: company.id },
        countryId: hq,
        realmId: company.realmId,
        amount,
        type: "INTEREST",
        source: `CREDIT_REPAYMENT:${company.id}`,
        key,
      });
      if (moved === 0) {
        return { alreadyApplied: true, creditDrawn: company.creditDrawn, cured: false };
      }
      if (amount > company.creditDrawn + EPS) {
        throw new ExchangeError(
          "CONFLICT",
          `The credit line stands at ${formatSovereigns(company.creditDrawn)}`
        );
      }
      const { count } = await tx.company.updateMany({
        where: { id: company.id, creditDrawn: { gte: amount } },
        data: { creditDrawn: { decrement: amount } },
      });
      if (count !== 1) throw new ExchangeError("CONFLICT", "The credit line changed; try again");
      await refreshFairValue(tx, company.id);
      const after = await tx.company.findUniqueOrThrow({ where: { id: company.id } });
      const cured =
        distressDecision({
          status: after.status,
          distressedSinceIxTime: after.distressedSinceIxTime,
          unpaid: false,
          capital: after.capital,
          creditDrawn: after.creditDrawn,
          creditLimit: creditLimitFor(after),
          nowMs: Date.now(),
        }) === "CURE";
      if (cured) {
        await tx.company.update({
          where: { id: company.id },
          data: { status: "ACTIVE", distressedSinceIxTime: null },
        });
      }
      return { alreadyApplied: false, creditDrawn: after.creditDrawn, cured };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { alreadyApplied: true, creditDrawn: 0, cured: false };
    throw error;
  }
}
