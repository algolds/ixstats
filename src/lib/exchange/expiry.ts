/**
 * Expire lapsed contracts (cron job `exchange-contract-expiry`, src/server/cron/jobs.ts).
 * Spec: docs/specs/2026-10-06-exchange-economy-design.md §8.
 *
 * An OPEN contract whose bidding window closed more than AWARD_GRACE_DAYS ago and that was
 * never awarded is cancelled: escrow goes back to whoever funded it, every bid is marked
 * lost, and the issuer and bidders are told. The grace gives the issuer time to pick from
 * the bids after bidding closes.
 *
 * Idempotent: each contract moves OPEN → CANCELLED with a conditional update in its own
 * transaction, and the refund is keyed per contract, so a re-run, an overlapping run or a
 * racing award/cancel by the issuer refunds escrow at most once (the loser skips).
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { DAY_MS, refundIssuer, transition } from "./contracts";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { formatSovereigns } from "./quote";

/** Real days an issuer has to award after bidding closes, before the contract expires. */
export const AWARD_GRACE_DAYS = 3;
const BATCH = 200;

export interface ExpiryResult {
  expired: number;
  skipped: number;
  refunded: number;
}

/** Cancel and refund every lapsed OPEN contract. Safe to run as often as you like. */
export async function expireLapsedContracts(
  db: PrismaClient,
  nowIx: number = IxTime.getCurrentIxTime()
): Promise<ExpiryResult> {
  const cutoff = nowIx - AWARD_GRACE_DAYS * DAY_MS * IxTime.getTimeMultiplier();
  const lapsed = await db.contract.findMany({
    where: { status: "OPEN", endIxTime: { lt: cutoff } },
    select: { id: true },
    orderBy: { endIxTime: "asc" },
    take: BATCH,
  });

  const result: ExpiryResult = { expired: 0, skipped: 0, refunded: 0 };
  for (const { id } of lapsed) {
    const notices: ExchangeNotice[] = [];
    try {
      const refunded = await db.$transaction(async (tx) => {
        const before = await transition(tx, id, "OPEN", "CANCELLED", {
          escrow: 0,
          closedIxTime: nowIx,
          resolutionNote: "Expired: not awarded in time",
        });
        const bids = await tx.contractBid.findMany({
          where: { contractId: id },
          include: { company: { select: { founderId: true } } },
        });
        await tx.contractBid.updateMany({ where: { contractId: id }, data: { outcome: "LOST" } });
        await refundIssuer(tx, before, before.escrow, "close");

        if (before.issuerUserId) {
          notices.push({
            userId: before.issuerUserId,
            title: `${before.title} expired`,
            message: `It was never awarded, so ${formatSovereigns(before.escrow)} of escrow came back to you.`,
          });
        }
        const bidders = new Set(
          bids.map((b) => b.company?.founderId).filter((u): u is string => !!u)
        );
        for (const userId of bidders) {
          notices.push({
            userId,
            title: `${before.title} expired`,
            message: "The issuer never awarded it, so your bid lapsed.",
            priority: "low",
          });
        }
        return before.escrow;
      });
      result.expired++;
      result.refunded += refunded;
      notifyExchange(notices);
    } catch (error) {
      // Someone (an award, a cancel, another run) moved it first: nothing to refund here.
      if (error instanceof ExchangeError && error.code === "CONFLICT") {
        result.skipped++;
        continue;
      }
      console.error(`[Exchange] expiring contract ${id} failed:`, error);
      result.skipped++;
    }
  }
  result.refunded = Math.round(result.refunded * 100) / 100;
  return result;
}
