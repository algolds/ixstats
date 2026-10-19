/**
 * Copies named in a pending trade offer. An offer locks the proposer's copies but not the ones it asks for, so the
 * workshop counts a named copy as locked (`judgedCopiesTx`), and the sheet and Mine gate on the same predicate.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { copyIdsOf } from "~/lib/cards/hub/art-visibility";

/** Pending offers that name any of these copies, on either side. */
export function pendingOffersNaming(ids: readonly string[]) {
  return {
    status: "PENDING",
    OR: ids.flatMap((id) => [
      { initiatorCardIds: { array_contains: [id] } },
      { recipientCardIds: { array_contains: [id] } },
    ]),
  } satisfies Prisma.TradeOfferWhereInput;
}

/** Which of these copies a pending offer names, in one read (none for no copies). */
export async function offeredCopyIds(
  db: Pick<PrismaClient, "tradeOffer">,
  ids: readonly string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const offers = await db.tradeOffer.findMany({
    where: pendingOffersNaming(ids),
    select: { initiatorCardIds: true, recipientCardIds: true },
  });
  const asked = new Set(ids);
  return new Set(
    offers
      .flatMap((o) => [...copyIdsOf(o.initiatorCardIds), ...copyIdsOf(o.recipientCardIds)])
      .filter((id) => asked.has(id))
  );
}
