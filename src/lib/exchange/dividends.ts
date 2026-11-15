/**
 * Dividends: the founder pays part of a company's capital to its shareholders, pro rata to
 * the shares each owns (listed shares included). Spec: docs/specs/2026-10-06-exchange-economy-design.md.
 *
 * Exactness: each payout is rounded down to a whole cent and the company's capital drops
 * by exactly the sum paid; the sub-cent remainder never leaves capital. No ₷ is created or
 * lost. The company row is locked for the whole payout, so no trade can move shares
 * between reading the holders and paying them, and a CompanyDividend row with a unique
 * idempotency key makes a retried declaration pay once.
 *
 * Withholding: each holder's dividend is reduced by half the HQ nation's capital gains rate and the
 * total is paid from capital into that nation's treasury. While credit is drawn, a dividend may not
 * exceed half of the capital above the credit.
 */

import type { PrismaClient } from "@prisma/client";
import { ExchangeError, earnSovereignsTx, isUniqueViolation } from "~/lib/vault/exchange-service";
import { assertNoOpenPrimaryIssue, refreshFairValue, requireOwnedCompany } from "./companies";
import { assertExchangeOpen, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { fromCents, holdersOf, lockCompany, splitProRata, toCents } from "./ownership";
import { centsOf, dbCents, formatSovereigns } from "./amounts";
import { capGainsRateOf, ratedCents } from "./fills";
import { transferToTreasuryTx } from "./treasury";
import { alertWatchers, publishNewsTx, type PublishedHeadline } from "./news";

const WITHHOLDING_SHARE = 0.5;
const CREDIT_CAP_SHARE = 0.5;

export interface DeclareDividendInput {
  userId: string;
  companyId: string;
  /** ₷ to distribute; at most the company's capital. */
  amount: number;
  requestId: string;
}

export interface DividendResult {
  paid: number;
  holderCount: number;
  alreadyApplied: boolean;
}

async function findDeclared(db: Db, key: string): Promise<DividendResult | null> {
  const row = await db.companyDividend.findUnique({ where: { idempotencyKey: key } });
  return row
    ? { paid: fromCents(centsOf(row.amount)), holderCount: row.holderCount, alreadyApplied: true }
    : null;
}

function assertWithinCreditCap(
  company: { capital: bigint; creditDrawn: bigint },
  amount: number
): void {
  if (company.creditDrawn <= 0n) return;
  const cap = Math.floor(
    Math.max(0, centsOf(company.capital) - centsOf(company.creditDrawn)) * CREDIT_CAP_SHARE
  );
  if (toCents(amount) > cap) {
    throw new ExchangeError(
      "CONFLICT",
      "While credit is drawn, a dividend can't exceed half the capital above it"
    );
  }
}

async function withholdingRateOf(tx: Db, hqCountryId: string | null): Promise<number> {
  if (!hqCountryId) return 0;
  return (await capGainsRateOf(tx, hqCountryId)) * WITHHOLDING_SHARE;
}

export async function declareDividend(
  db: PrismaClient,
  input: DeclareDividendInput
): Promise<DividendResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive");
  }
  const key = `exchange:dividend:${input.userId}:${input.requestId}`;
  const notices: ExchangeNotice[] = [];
  let headline: PublishedHeadline | null = null;
  try {
    const result = await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const declared = await findDeclared(tx, key);
      if (declared) return declared;

      const company = await requireOwnedCompany(tx, input.companyId, input.userId);
      if (toCents(input.amount) > centsOf(company.capital)) {
        throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "The company doesn't hold that much");
      }
      assertWithinCreditCap(company, input.amount);
      await assertNoOpenPrimaryIssue(tx, company.id);
      const holders = await holdersOf(tx, company.id);
      const split = splitProRata(toCents(input.amount), holders);
      if (split.paidCents === 0) {
        throw new ExchangeError("INVALID_AMOUNT", "That amount is too small to split");
      }

      const rate = await withholdingRateOf(tx, company.hqCountryId);
      const payouts = split.payouts.map((p) => ({
        userId: p.userId,
        gross: p.cents,
        tax: ratedCents(p.cents, rate),
      }));
      const withheldCents = payouts.reduce((s, p) => s + p.tax, 0);
      const paid = fromCents(split.paidCents);
      // Capital leaves in two steps: the holders' share here, the withheld share once they are paid.
      const netDebitCents = dbCents(split.paidCents - withheldCents);

      const { count } = await tx.company.updateMany({
        where: { id: company.id, status: "ACTIVE", capital: { gte: netDebitCents } },
        data: { capital: { decrement: netDebitCents } },
      });
      if (count !== 1) {
        throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "The company doesn't hold that much");
      }
      await tx.companyDividend.create({
        data: {
          companyId: company.id,
          declaredByUserId: input.userId,
          declared: dbCents(toCents(input.amount)),
          amount: dbCents(split.paidCents),
          shareCount: holders.reduce((s, h) => s + h.shares, 0),
          holderCount: payouts.length,
          ixTime: Date.now(),
          idempotencyKey: key,
        },
      });
      // Pay in user-id order, the order trades lock wallets in, so the two can't deadlock.
      const ordered = [...payouts].sort((a, b) => (a.userId < b.userId ? -1 : 1));
      for (const p of ordered) {
        const amount = fromCents(p.gross - p.tax);
        await earnSovereignsTx(tx, {
          userId: p.userId,
          amount,
          type: "DIVIDEND",
          source: `DIVIDEND:${company.id}`,
          metadata: { companyId: company.id, declared: input.amount, withheld: fromCents(p.tax) },
          idempotencyKey: `${key}:${p.userId}`,
        });
        if (p.userId !== input.userId) {
          notices.push({
            userId: p.userId,
            title: `Dividend from ${company.name}`,
            message: `${formatSovereigns(amount)} for your shares is in your wallet.`,
          });
        }
      }
      if (withheldCents > 0 && company.hqCountryId) {
        await transferToTreasuryTx(tx, {
          from: { kind: "COMPANY", companyId: company.id },
          countryId: company.hqCountryId,
          realmId: company.realmId,
          amount: fromCents(withheldCents),
          type: "TAX",
          source: `DIVIDEND:${company.id}`,
          key: `${key}:withholding`,
        });
      }
      await refreshFairValue(tx, company.id);
      headline = await publishNewsTx(tx, {
        realmId: company.realmId,
        kind: "dividend",
        prominence: "HEADLINE",
        sourceKind: "COMPANY",
        sourceId: company.id,
        headline: `${company.name} pays a ${formatSovereigns(paid)} dividend`,
        companyId: company.id,
        key: `news:dividend:${key}`,
      });
      return { paid, holderCount: payouts.length, alreadyApplied: false };
    });
    notifyExchange(notices);
    if (headline) await alertWatchers(db, [headline]);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const declared = await findDeclared(db, key);
      if (declared) return declared;
    }
    throw error;
  }
}

/** A company's recent dividends, newest first. */
export async function listDividends(db: Db, companyId: string) {
  const rows = await db.companyDividend.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, amount: true, shareCount: true, holderCount: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, amount: fromCents(centsOf(r.amount)) }));
}
