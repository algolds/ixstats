// src/lib/cards/mint.ts
import type { CardFinish, CardOwnership, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { allocateSerialNumberTx, lockCardSerialsTx } from "./serial-number";

/**
 * Every way a new copy comes into being, written as the action of its mint row in the provenance trail
 * (`CardTransferEvent`), so Phase 4 can tell imported copies apart (cards refresh §5.4). The existing action names
 * PACK_OPEN and DAILY_CLAIM keep their meaning.
 */
export const MINT_SOURCES = [
  "PACK_OPEN",
  "DAILY_CLAIM",
  "NS_DECK_IMPORT",
  "ACHIEVEMENT",
  "TROPHY",
  "SPORTS",
  "ADMIN",
] as const;
export type MintSource = (typeof MINT_SOURCES)[number];

export interface MintCopyInput {
  cardId: string;
  ownerId: string;
  finish: CardFinish;
  source: MintSource;
  /**
   * Reissue this serial instead of taking the next: only for a bound one-of-one (`totalSupply` 1) with no live copy
   * whose trail holds the serial, as a trophy whose place changed hands is granted again (§2.4). The mint row's
   * action is then REISSUE. No other serial is ever issued twice.
   */
  serialNumber?: number;
}

/**
 * The one way to create a copy (§5.4). Inside the caller's transaction it allocates the next serial (or reissues a
 * one-of-one's, `serialNumber`) under the per-card advisory lock, creates the copy (the id is the database's), and
 * writes the mint row of the copy's provenance trail with its source. A Serialised copy of a card with a run size
 * (`totalSupply`) is refused once the run is minted out (§3: `totalSupply` binds Serialised runs only).
 */
export async function mintCopy(
  tx: Prisma.TransactionClient,
  input: MintCopyInput
): Promise<CardOwnership> {
  const serialNumber =
    input.serialNumber === undefined
      ? await allocateSerialNumberTx(tx, input.cardId)
      : await reissuedSerialTx(tx, input.cardId, input.serialNumber);
  if (input.finish === "SERIALISED") await assertRunOpen(tx, input.cardId, serialNumber);
  const copy = await tx.cardOwnership.create({
    data: {
      cardId: input.cardId,
      ownerId: input.ownerId,
      serialNumber,
      finish: input.finish,
    },
  });
  // The card and serial ride on the row so the trail, and the serial's high-water mark, outlive the copy
  await tx.cardTransferEvent.create({
    data: {
      ownershipId: copy.id,
      cardId: input.cardId,
      serialNumber,
      toUserId: input.ownerId,
      action: input.serialNumber === undefined ? input.source : "REISSUE",
    },
  });
  return copy;
}

/**
 * The serial a reissue mints under, read under the card's serial lock: refused unless the card is a bound one-of-one,
 * no copy of it is live, and its trail holds the serial (a void took it back).
 */
async function reissuedSerialTx(
  tx: Prisma.TransactionClient,
  cardId: string,
  serialNumber: number
): Promise<number> {
  await lockCardSerialsTx(tx, cardId);
  const [card, live, issued] = await Promise.all([
    tx.card.findUnique({ where: { id: cardId }, select: { isBound: true, totalSupply: true } }),
    tx.cardOwnership.count({ where: { cardId } }),
    tx.cardTransferEvent.count({ where: { cardId, serialNumber } }),
  ]);
  if (!card?.isBound || card.totalSupply !== 1 || live > 0 || issued === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Only a bound one-of-one with no live copy can have its serial reissued",
    });
  }
  return serialNumber;
}

/** A Serialised copy whose serial passes the card's run size (`totalSupply`) is refused; no run size, no limit. */
async function assertRunOpen(tx: Prisma.TransactionClient, cardId: string, serialNumber: number) {
  const card = await tx.card.findUnique({ where: { id: cardId }, select: { totalSupply: true } });
  // Lore cards store 0 for "unlimited", so only a positive totalSupply is a run size
  if (card?.totalSupply && serialNumber > card.totalSupply) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Every copy of this card's run has been minted",
    });
  }
}
