// src/lib/cards/mint.ts
import type { CardFinish, CardOwnership, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { allocateSerialNumberTx } from "./serial-number";

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
] as const;
export type MintSource = (typeof MINT_SOURCES)[number];

export interface MintCopyInput {
  cardId: string;
  ownerId: string;
  finish: CardFinish;
  source: MintSource;
}

/**
 * The one way to create a copy (§5.4). Inside the caller's transaction it allocates the next serial under the
 * per-card advisory lock, creates the copy (the id is the database's), and writes the mint row of the copy's
 * provenance trail with its source. A Serialised copy of a card with a run size (`totalSupply`) is refused once the
 * run is minted out (§3: `totalSupply` binds Serialised runs only).
 */
export async function mintCopy(
  tx: Prisma.TransactionClient,
  input: MintCopyInput
): Promise<CardOwnership> {
  const serialNumber = await allocateSerialNumberTx(tx, input.cardId);
  if (input.finish === "SERIALISED") await assertRunOpen(tx, input.cardId, serialNumber);
  const copy = await tx.cardOwnership.create({
    data: {
      cardId: input.cardId,
      ownerId: input.ownerId,
      serialNumber,
      finish: input.finish,
    },
  });
  await tx.cardTransferEvent.create({
    data: { ownershipId: copy.id, toUserId: input.ownerId, action: input.source },
  });
  return copy;
}

/** Serials are never reused, so the next serial past the run size means the run is minted out. */
async function assertRunOpen(tx: Prisma.TransactionClient, cardId: string, serialNumber: number) {
  const card = await tx.card.findUnique({ where: { id: cardId }, select: { totalSupply: true } });
  if (card?.totalSupply != null && serialNumber > card.totalSupply) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Every copy of this card's run has been minted",
    });
  }
}
