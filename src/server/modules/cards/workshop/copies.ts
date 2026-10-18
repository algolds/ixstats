/**
 * The copies the workshop breaks down or fuses: read as the player's own, judged with an offered copy counted as a
 * locked one, and burned with their trail and serials kept.
 */
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { WorkshopCopy } from "~/lib/cards/dust";
import { lockCardSerialsTx } from "~/lib/cards/serial-number";

/** The columns the workshop judges a copy by; the signer's id and frozen name are never read. */
export const WORKSHOP_COPY_SELECT = {
  id: true,
  cardId: true,
  serialNumber: true,
  finish: true,
  isLocked: true,
  inscription: true,
  importDiscounted: true,
  cards: { select: { rarity: true, realmId: true, isBound: true } },
} as const satisfies Prisma.CardOwnershipSelect;

export type WorkshopRow = Prisma.CardOwnershipGetPayload<{ select: typeof WORKSHOP_COPY_SELECT }>;

export const precondition = (message: string) =>
  new TRPCError({ code: "PRECONDITION_FAILED", message });

/** The copies, lowest serial first, refused unless every one is the player's. */
export async function readOwnCopiesTx(
  tx: Prisma.TransactionClient,
  userId: string,
  ids: string[]
): Promise<WorkshopRow[]> {
  const rows = await tx.cardOwnership.findMany({
    where: { id: { in: ids }, ownerId: userId },
    select: WORKSHOP_COPY_SELECT,
    orderBy: [{ serialNumber: "asc" }, { id: "asc" }],
  });
  if (rows.length !== ids.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Some of these copies are no longer yours.",
    });
  }
  return rows;
}

/**
 * The copies as `copyBlocker` and `fusionBlocker` judge them. A copy named in a pending trade offer counts as locked:
 * an offer locks the proposer's copies but not the ones it asks for.
 */
export async function judgedCopiesTx(
  tx: Prisma.TransactionClient,
  rows: WorkshopRow[]
): Promise<WorkshopCopy[]> {
  const offered = await tx.tradeOffer.count({
    where: {
      status: "PENDING",
      OR: rows.flatMap(({ id }) => [
        { initiatorCardIds: { array_contains: [id] } },
        { recipientCardIds: { array_contains: [id] } },
      ]),
    },
  });
  return rows.map((row) => ({
    cardId: row.cardId,
    rarity: row.cards.rarity,
    finish: row.finish,
    importDiscounted: row.importDiscounted,
    inscription: row.inscription,
    isLocked: row.isLocked || offered > 0,
    isBound: row.cards.isBound,
  }));
}

const CHANGED = {
  BREAKDOWN: "These copies changed while you were breaking them down.",
  FUSE: "These copies changed while you were fusing them.",
} as const;

/** A burn or an upgrade that lost a race: the copies are no longer as read. */
export const changedError = (action: keyof typeof CHANGED) =>
  new TRPCError({ code: "CONFLICT", message: CHANGED[action] });

/**
 * Burns copies without losing their trail. Under each card's serial lock (taken once per card, in card-id order, as
 * the pack draw takes them), each copy's older events are stamped with its card and serial, and a burn event records
 * the serial and finish leaving the player. Then one DELETE holds only while every copy is still the player's,
 * unlocked, unsigned and as read (its finish and import discount), so a copy listed, traded, signed or fused meanwhile
 * is never burned: CONFLICT, and the caller's transaction rolls back. A signed copy is refused before this, so an
 * inscription never goes with a burn.
 */
export async function burnCopiesTx(
  tx: Prisma.TransactionClient,
  userId: string,
  rows: WorkshopRow[],
  action: keyof typeof CHANGED
): Promise<void> {
  for (const cardId of [...new Set(rows.map((r) => r.cardId))].sort()) {
    await lockCardSerialsTx(tx, cardId);
  }
  for (const row of rows) {
    await tx.cardTransferEvent.updateMany({
      where: { ownershipId: row.id, cardId: null },
      data: { cardId: row.cardId, serialNumber: row.serialNumber },
    });
  }
  await tx.cardTransferEvent.createMany({
    data: rows.map((row) => ({
      ownershipId: row.id,
      cardId: row.cardId,
      serialNumber: row.serialNumber,
      finish: row.finish,
      fromUserId: userId,
      toUserId: null,
      action,
    })),
  });
  const removed = await tx.cardOwnership.deleteMany({
    where: {
      ownerId: userId,
      isLocked: false,
      inscription: null,
      OR: rows.map(({ id, finish, importDiscounted }) => ({ id, finish, importDiscounted })),
    },
  });
  if (removed.count !== rows.length) throw changedError(action);
}
