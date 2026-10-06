/**
 * The IxCredits ⇄ Sovereign bridge: the only valve between the vault economy and the
 * Exchange. Spec: docs/specs/2026-10-06-exchange-economy-design.md §2.
 *
 *   CONVERT_IN   IxC → ₷   ₷ = IxC × rate × (1 − fee)
 *   CONVERT_OUT  ₷ → IxC   IxC = ₷ ÷ rate × (1 − fee), and never more ₷ than the user has
 *                           converted in, plus a share of verified contract revenue once it
 *                           has aged (phase 2), net of earlier conversions out. ₷ from the
 *                           wallet seed, MyClub, dividends or share sales can't become
 *                           IxCredits.
 *
 * One transaction does both sides: the IxC move goes through the vault ledger (kill
 * switches, conditional decrement), the ₷ move through the Exchange ledger, and a
 * ConversionLog row records the rate and fee applied. A per-user daily cap (both
 * directions summed, in ₷) applies. Retries with the same requestId are applied once.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { spendCreditsTx, earnCreditsTx } from "~/lib/vault/vault-ledger";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { IxTime } from "~/lib/ixtime";
import { assertExchangeOpen, lockWallet, round2, startOfUtcDay, type Db } from "./guards";
import { quoteConversion, type ConversionQuote, type ConvertDirection } from "./quote";

export { quoteConversion, type ConversionQuote, type ConvertDirection };

export interface ConvertInput {
  /** Database User.id. */
  userId: string;
  direction: ConvertDirection;
  /** IxCredits to convert in, or Sovereigns to convert out. */
  amount: number;
  /** Client-generated id; a retry with the same id is applied once. */
  requestId: string;
}

export interface ConvertResult extends ConversionQuote {
  alreadyApplied: boolean;
}

/** ₷ this user has moved through the bridge today (both directions). */
export async function convertedToday(db: Db, userId: string): Promise<number> {
  const agg = await db.conversionLog.aggregate({
    where: { userId, createdAt: { gte: startOfUtcDay() } },
    _sum: { sovereigns: true },
  });
  return agg._sum.sovereigns ?? 0;
}

const DAY_MS = 86_400_000;

/**
 * Verified contract revenue that has become convertible (spec §8, relaxed out allowance):
 * `revenueConvertibleShare` of what this user's companies were paid on contracts that
 * completed at least `revenueHoldDays` ago. "Verified" means the issuer confirmed delivery
 * or an admin paid the contractor in a dispute; a contractor never bids on their own
 * contracts. Dividends, share sales and fund sales never count.
 */
export async function convertibleContractRevenue(db: Db, userId: string): Promise<number> {
  const cfg = await getExchangeConfig(db);
  if (cfg.revenueConvertibleShare <= 0) return 0;
  const companies = await db.company.findMany({
    where: { founderId: userId },
    select: { id: true },
  });
  if (companies.length === 0) return 0;
  const cutoff =
    IxTime.getCurrentIxTime() - cfg.revenueHoldDays * DAY_MS * IxTime.getTimeMultiplier();
  const contracts = await db.contract.findMany({
    where: {
      status: "COMPLETED",
      winnerCompanyId: { in: companies.map((c) => c.id) },
      closedIxTime: { lte: cutoff },
    },
    select: { awardedBidId: true, issuerUserId: true },
  });
  const bidIds = contracts
    .filter((c) => c.awardedBidId && c.issuerUserId !== userId)
    .map((c) => c.awardedBidId!);
  if (bidIds.length === 0) return 0;
  const paid = await db.contractBid.aggregate({
    where: { id: { in: bidIds } },
    _sum: { amount: true },
  });
  return Math.floor((paid._sum.amount ?? 0) * cfg.revenueConvertibleShare * 100) / 100;
}

/**
 * ₷ this user may still convert out: lifetime ₷ converted in, plus convertible contract
 * revenue, minus ₷ converted out.
 */
export async function convertOutAllowance(db: Db, userId: string): Promise<number> {
  const [rows, revenue] = await Promise.all([
    db.conversionLog.groupBy({
      by: ["direction"],
      where: { userId },
      _sum: { sovereigns: true },
    }),
    convertibleContractRevenue(db, userId),
  ]);
  const sum = (d: ConvertDirection) => rows.find((r) => r.direction === d)?._sum.sovereigns ?? 0;
  return Math.max(0, round2(sum("CONVERT_IN") + revenue - sum("CONVERT_OUT")));
}

function keyFor(input: ConvertInput): string {
  return `exchange:convert:${input.userId}:${input.requestId}`;
}

async function findLogged(db: Db, key: string): Promise<ConvertResult | null> {
  const log = await db.conversionLog.findUnique({ where: { idempotencyKey: key } });
  if (!log) return null;
  return {
    direction: log.direction as ConvertDirection,
    ixCredits: log.ixCredits,
    sovereigns: log.sovereigns,
    fee: log.fee,
    rate: log.rate,
    alreadyApplied: true,
  };
}

async function convertTx(
  tx: Prisma.TransactionClient,
  input: ConvertInput,
  key: string
): Promise<ConvertResult> {
  await assertExchangeOpen(tx);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive");
  }

  const logged = await findLogged(tx, key);
  if (logged) return logged;

  // Serialise this user's conversions so the cap and allowance checks can't race.
  await lockWallet(tx, input.userId);

  const cfg = await getExchangeConfig(tx);
  const quote = quoteConversion(input.direction, input.amount, cfg);
  if (quote.sovereigns <= 0 || quote.ixCredits <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "That amount is too small to convert");
  }

  const used = await convertedToday(tx, input.userId);
  if (used + quote.sovereigns > cfg.convertDailyLimit) {
    const left = Math.max(0, round2(cfg.convertDailyLimit - used));
    throw new ExchangeError(
      "DAILY_CAP_REACHED",
      `Daily conversion limit reached: ₷${left.toLocaleString("en-US")} left today`
    );
  }

  const meta = { requestId: input.requestId, rate: quote.rate, fee: quote.fee };
  if (input.direction === "CONVERT_IN") {
    await spendCreditsTx(tx, {
      userId: input.userId,
      amount: quote.ixCredits,
      type: "SPEND_EXCHANGE",
      source: "EXCHANGE_CONVERT_IN",
      metadata: meta,
      idempotencyKey: `${key}:ixc`,
    });
    await earnSovereignsTx(tx, {
      userId: input.userId,
      amount: quote.sovereigns,
      type: "CONVERT_IN",
      source: "EXCHANGE_CONVERT_IN",
      metadata: meta,
      idempotencyKey: `${key}:sov`,
    });
  } else {
    const allowance = await convertOutAllowance(tx, input.userId);
    if (quote.sovereigns > allowance) {
      throw new ExchangeError(
        "LIMIT_REACHED",
        `You can convert out up to ₷${allowance.toLocaleString("en-US")}: the Sovereigns you converted in and your aged contract revenue, less what you have converted out`
      );
    }
    await spendSovereignsTx(tx, {
      userId: input.userId,
      amount: quote.sovereigns,
      type: "CONVERT_OUT",
      source: "EXCHANGE_CONVERT_OUT",
      metadata: meta,
      idempotencyKey: `${key}:sov`,
    });
    await earnCreditsTx(tx, {
      userId: input.userId,
      amount: quote.ixCredits,
      type: "EARN_EXCHANGE",
      source: "EXCHANGE_CONVERT_OUT",
      metadata: meta,
      idempotencyKey: `${key}:ixc`,
    });
  }

  await tx.conversionLog.create({
    data: {
      userId: input.userId,
      direction: input.direction,
      ixCredits: quote.ixCredits,
      sovereigns: quote.sovereigns,
      rate: quote.rate,
      fee: quote.fee,
      ixTime: IxTime.getCurrentIxTime(),
      idempotencyKey: key,
    },
  });

  return { ...quote, alreadyApplied: false };
}

/**
 * Convert in one transaction. Throws ExchangeError or LedgerError on a business failure.
 * A concurrent duplicate (same requestId) loses on the unique key, rolls back entirely,
 * and is answered with the conversion that won.
 */
export async function convert(db: PrismaClient, input: ConvertInput): Promise<ConvertResult> {
  const key = keyFor(input);
  try {
    return await db.$transaction((tx) => convertTx(tx, input, key));
  } catch (error) {
    if (isUniqueViolation(error)) {
      const logged = await findLogged(db, key);
      if (logged) return logged;
    }
    throw error;
  }
}
