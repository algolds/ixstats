/**
 * Remove one copy from every player (an admin revoke, a voided trophy) without losing its trail: the copy's transfer
 * events are stamped with the card and serial (they outlive the copy, and `ownershipId` becomes null when it goes),
 * and one more event records the removal before the copy is deleted.
 *
 * Refused when the copy has ever been on the market, auctioned or listed, whatever became of it (the owner's rule: its
 * auctions and listings would stay, with their card and serial, but such a copy is never removed), sits in a pending
 * trade offer, or moved or was locked meanwhile.
 */
import type { CardFinish, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { lockCardSerialsTx } from "./serial-number";

export interface RemovableCopy {
  id: string;
  cardId: string;
  serialNumber: number;
  ownerId: string;
  finish: CardFinish;
}

const MARKET_HISTORY = "This copy has been on the market, so it can't be removed.";

async function assertNoMarketHistoryTx(
  tx: Prisma.TransactionClient,
  copyId: string
): Promise<void> {
  if (
    (await tx.cardAuction.count({ where: { cardInstanceId: copyId } })) > 0 ||
    (await tx.cardListing.count({ where: { ownershipId: copyId } })) > 0
  ) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: MARKET_HISTORY });
  }
  // A recipient's copies are not locked by an offer, so the offer itself is the only record
  const offers = await tx.tradeOffer.count({
    where: {
      status: "PENDING",
      OR: [
        { initiatorCardIds: { array_contains: [copyId] } },
        { recipientCardIds: { array_contains: [copyId] } },
      ],
    },
  });
  if (offers > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This copy is in a pending trade. Void the trade first.",
    });
  }
}

export async function removeCopyTx(
  tx: Prisma.TransactionClient,
  copy: RemovableCopy,
  action: "REVOKE" | "VOID"
): Promise<void> {
  // The card's serial lock first: a mint of this card waits until the removal commits, then finds the removed serial
  // in the trail, whatever order allocation reads in. Lock order: a caller that holds a contest-place lock (7332, a
  // trophy void) took it before this one (7331), as the trophy grant does, so the two never deadlock.
  await lockCardSerialsTx(tx, copy.cardId);
  await assertNoMarketHistoryTx(tx, copy.id);
  await tx.cardTransferEvent.updateMany({
    where: { ownershipId: copy.id, cardId: null },
    data: { cardId: copy.cardId, serialNumber: copy.serialNumber },
  });
  await tx.cardTransferEvent.create({
    data: {
      ownershipId: copy.id,
      cardId: copy.cardId,
      serialNumber: copy.serialNumber,
      finish: copy.finish,
      fromUserId: copy.ownerId,
      toUserId: null,
      action,
    },
  });
  const removed = await tx.cardOwnership.deleteMany({
    where: { id: copy.id, ownerId: copy.ownerId, isLocked: false },
  });
  if (removed.count !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This copy changed hands or was locked. Reload and try again.",
    });
  }
}
