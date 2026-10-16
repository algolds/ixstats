import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/** Bound cards (trophies, achievement rewards; cards refresh §2.1) never change hands. */
export function boundCopyError(): TRPCError {
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Bound cards can't be traded, listed or transferred",
  });
}

/** Refuses when any of `ownershipIds` is a copy of a bound card: trade offers, counters and every transfer call it. */
export async function assertNoBoundCopies(
  db: { cardOwnership: Prisma.TransactionClient["cardOwnership"] },
  ownershipIds: readonly string[]
): Promise<void> {
  if (ownershipIds.length === 0) return;
  const bound = await db.cardOwnership.count({
    where: { id: { in: [...ownershipIds] }, cards: { isBound: true } },
  });
  if (bound > 0) throw boundCopyError();
}
