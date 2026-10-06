/**
 * Dividends: the founder pays part of a company's capital to its shareholders, pro rata to
 * the shares each owns (listed shares included). Spec: docs/specs/2026-10-06-exchange-economy-design.md §8.
 *
 * Exactness: each payout is rounded down to a whole cent and the company's capital drops
 * by exactly the sum paid; the sub-cent remainder never leaves capital. No ₷ is created or
 * lost. The company row is locked for the whole payout, so no trade can move shares
 * between reading the holders and paying them, and a CompanyDividend row with a unique
 * idempotency key makes a retried declaration pay once.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { ExchangeError, earnSovereignsTx, isUniqueViolation } from "~/lib/vault/exchange-service";
import { refreshFairValue, requireOwnedCompany } from "./companies";
import { assertExchangeOpen, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { fromCents, holdersOf, lockCompany, splitProRata, toCents } from "./ownership";
import { formatSovereigns } from "./quote";

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
  return row ? { paid: row.amount, holderCount: row.holderCount, alreadyApplied: true } : null;
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
  try {
    const result = await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const declared = await findDeclared(tx, key);
      if (declared) return declared;

      const company = await requireOwnedCompany(tx, input.companyId, input.userId);
      if (input.amount > company.capital) {
        throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "The company doesn't hold that much");
      }
      const holders = await holdersOf(tx, company.id);
      const split = splitProRata(toCents(input.amount), holders);
      if (split.paidCents === 0) {
        throw new ExchangeError("INVALID_AMOUNT", "That amount is too small to split");
      }
      const paid = fromCents(split.paidCents);

      const { count } = await tx.company.updateMany({
        where: { id: company.id, status: "ACTIVE", capital: { gte: paid } },
        data: { capital: { decrement: paid } },
      });
      if (count !== 1) {
        throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "The company doesn't hold that much");
      }
      await tx.companyDividend.create({
        data: {
          companyId: company.id,
          declaredByUserId: input.userId,
          declared: input.amount,
          amount: paid,
          shareCount: holders.reduce((s, h) => s + h.shares, 0),
          holderCount: split.payouts.length,
          ixTime: IxTime.getCurrentIxTime(),
          idempotencyKey: key,
        },
      });
      // Pay in user-id order, the order trades lock wallets in, so the two can't deadlock.
      const payouts = [...split.payouts].sort((a, b) => (a.userId < b.userId ? -1 : 1));
      for (const p of payouts) {
        const amount = fromCents(p.cents);
        await earnSovereignsTx(tx, {
          userId: p.userId,
          amount,
          type: "DIVIDEND",
          source: `DIVIDEND:${company.id}`,
          metadata: { companyId: company.id, declared: input.amount },
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
      await refreshFairValue(tx, company.id);
      return { paid, holderCount: payouts.length, alreadyApplied: false };
    });
    notifyExchange(notices);
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
  return db.companyDividend.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, amount: true, shareCount: true, holderCount: true, createdAt: true },
  });
}
