/**
 * Transaction-scoped P2P trade settlement helpers (plan 331).
 *
 * Every state transition here is a conditional `updateMany` whose `where`
 * carries the precondition, verified through `count`. Callers run them inside
 * one `$transaction`, so a failed precondition rolls back everything written
 * before it: no double-accept, no card taken from its new owner, no negative
 * balance.
 */

import { type Prisma, TradeStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { earnCreditsTx, LedgerError, spendCreditsTx } from "./vault-ledger";

type Tx = Prisma.TransactionClient;

/** Move a PENDING trade to `next` iff it is still PENDING (and, for ACCEPTED, not expired). */
export async function claimPendingTradeTx(
  tx: Tx,
  tradeId: string,
  next: TradeStatus,
  now: Date
): Promise<void> {
  const res = await tx.tradeOffer.updateMany({
    where: {
      id: tradeId,
      status: TradeStatus.PENDING,
      ...(next === TradeStatus.ACCEPTED ? { expiresAt: { gt: now } } : {}),
    },
    data: { status: next, respondedAt: now },
  });
  if (res.count !== 1) {
    throw new TRPCError({ code: "CONFLICT", message: "Trade is no longer pending" });
  }
}

/** Lock cards the owner holds unlocked. All-or-nothing. */
export async function lockCardsTx(tx: Tx, ids: string[], ownerId: string): Promise<void> {
  const res = await tx.cardOwnership.updateMany({
    where: { id: { in: ids }, ownerId, isLocked: false },
    data: { isLocked: true },
  });
  if (res.count !== ids.length) {
    throw new TRPCError({ code: "CONFLICT", message: "One or more cards are no longer available" });
  }
}

/** Unlock cards still held by `ownerId` (best-effort release; cards that moved are left alone). */
export async function unlockCardsTx(tx: Tx, ids: string[], ownerId: string): Promise<void> {
  await tx.cardOwnership.updateMany({
    where: { id: { in: ids }, ownerId },
    data: { isLocked: false },
  });
}

/** Transfer cards; fails if any card is not owned by `fromId` in the expected lock state. */
export async function transferCardsTx(
  tx: Tx,
  args: { ids: string[]; fromId: string; toId: string; expectLocked: boolean; now: Date }
): Promise<void> {
  const { ids, fromId, toId, expectLocked, now } = args;
  const res = await tx.cardOwnership.updateMany({
    where: { id: { in: ids }, ownerId: fromId, isLocked: expectLocked },
    data: { ownerId: toId, userId: toId, isLocked: false, acquiredAt: now, lastSaleDate: now },
  });
  if (res.count !== ids.length) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Cards in this trade changed hands; trade cannot complete",
    });
  }
}

/**
 * Guarded credit transfer + ledger rows for both sides. No-op when `amount <= 0`.
 * The debit is compare-and-swap guarded by the ledger; a ledger failure becomes a
 * BAD_REQUEST so the surrounding transaction rolls back with a client-safe error.
 */
export async function transferCreditsTx(
  tx: Tx,
  args: { fromUserId: string; toUserId: string; amount: number; tradeId: string }
): Promise<void> {
  const { fromUserId, toUserId, amount, tradeId } = args;
  if (amount <= 0) return;

  try {
    await spendCreditsTx(tx, {
      userId: fromUserId,
      amount,
      type: "SPEND_MARKET",
      source: "P2P_TRADE",
      metadata: { tradeId },
    });
    await earnCreditsTx(tx, {
      userId: toUserId,
      amount,
      type: "EARN_CARDS",
      source: "P2P_TRADE",
      metadata: { tradeId },
    });
  } catch (error) {
    if (error instanceof LedgerError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
    }
    throw error;
  }
}
