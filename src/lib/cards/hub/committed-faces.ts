// src/lib/cards/hub/committed-faces.ts
import type { PrismaClient } from "@prisma/client";
import type { CardFaceData } from "~/lib/cards/face/types";
import { ownedFaces } from "./faces";

/**
 * `ownedFaces` for copies a mutation has already committed (a pack opened, an NS import, the daily card). The copies
 * are minted and paid for, and a retry would only say so, so a failed read is logged and gives no faces instead of
 * failing the result. `what` names the mutation in the log.
 */
export async function facesAfterCommit(
  db: Pick<PrismaClient, "cardOwnership">,
  ownershipIds: readonly string[],
  what: string
): Promise<CardFaceData[]> {
  try {
    return await ownedFaces(db, ownershipIds);
  } catch (error) {
    console.error(`[Cards] ${what} committed, but its faces could not be read:`, error);
    return [];
  }
}
