/**
 * Transaction-scoped P2P trade settlement helpers (plan 331).
 *
 * Every state transition here is a conditional `updateMany` whose `where`
 * carries the precondition, verified through `count`. Callers run them inside
 * one `$transaction`, so a failed precondition rolls back everything written
 * before it: no double-accept, no card taken from its new owner. A trade's
 * credits move through its credit legs (`~/lib/cards/market/credit-leg`).
 */

import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { assertNoBoundCopies } from "~/lib/cards/bound";

type Tx = Prisma.TransactionClient;

/**
 * Moves a PENDING trade to `next` iff it is still PENDING (and, for ACCEPTED, unexpired; with a revision, unchanged:
 * no counter-offer has rewritten the table since it was read).
 */
export async function claimPendingTradeTx(
  tx: Tx,
  args: {
    tradeId: string;
    next: "ACCEPTED" | "REJECTED" | "CANCELLED";
    now: Date;
    revision?: number;
  }
): Promise<void> {
  const res = await tx.tradeOffer.updateMany({
    where: {
      id: args.tradeId,
      status: "PENDING",
      ...(args.revision !== undefined ? { revision: args.revision } : {}),
      ...(args.next === "ACCEPTED" ? { expiresAt: { gt: args.now } } : {}),
    },
    data: { status: args.next, respondedAt: args.now },
  });
  if (res.count !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This trade changed. Review the latest table.",
    });
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

/** Transfer cards; fails if any card is bound, or not owned by `fromId` in the expected lock state. */
export async function transferCardsTx(
  tx: Tx,
  args: { ids: string[]; fromId: string; toId: string; expectLocked: boolean; now: Date }
): Promise<void> {
  const { ids, fromId, toId, expectLocked, now } = args;
  await assertNoBoundCopies(tx, ids);
  const res = await tx.cardOwnership.updateMany({
    where: { id: { in: ids }, ownerId: fromId, isLocked: expectLocked },
    data: { ownerId: toId, isLocked: false, acquiredAt: now },
  });
  if (res.count !== ids.length) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Cards in this trade changed hands; trade cannot complete",
    });
  }
}

/**
 * The trade's row in each moved copy's provenance trail, stamped with the card, serial and finish so the row outlives
 * the copy, and logged as a GIFT when one side gave nothing. Call after `transferCardsTx` has moved the copies.
 */
export async function recordTradeTransfersTx(
  tx: Tx,
  args: { ids: string[]; fromId: string; toId: string; action: "TRADE" | "GIFT" }
): Promise<void> {
  if (args.ids.length === 0) return;
  const copies = await tx.cardOwnership.findMany({
    where: { id: { in: args.ids } },
    select: { id: true, cardId: true, serialNumber: true, finish: true },
  });
  await tx.cardTransferEvent.createMany({
    data: copies.map((copy) => ({
      ownershipId: copy.id,
      cardId: copy.cardId,
      serialNumber: copy.serialNumber,
      finish: copy.finish,
      fromUserId: args.fromId,
      toUserId: args.toId,
      action: args.action,
    })),
  });
}
