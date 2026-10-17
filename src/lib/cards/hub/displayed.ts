// src/lib/cards/hub/displayed.ts
import type { PrismaClient } from "@prisma/client";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, type CardFaceRow, type CopyFaceRow } from "./faces";

/** How many cards a player's showcase shows on the wallet and the Passport. */
export const DISPLAY_SIZE = 6;

export interface DisplayedCopy {
  card: CardFaceRow;
  copy: CopyFaceRow;
}

const COPY_WITH_CARD = { ...COPY_FACE_SELECT, cards: { select: CARD_FACE_SELECT } } as const;

/**
 * What a player shows off (spec §2.3 Sets): their pinned showcase (the latest pin), or else their most valuable live
 * copies, one per card. Hidden (retired) cards are left out of both, as the wallet showcase always has.
 */
export async function displayedCopies(
  db: Pick<PrismaClient, "cardCollection" | "cardOwnership">,
  userId: string,
  limit = DISPLAY_SIZE
): Promise<{ showcase: { id: string; name: string } | null; copies: DisplayedCopy[] }> {
  const pinned = await db.cardCollection.findFirst({
    where: { userId, pinnedAt: { not: null } },
    orderBy: { pinnedAt: "desc" },
    select: {
      id: true,
      name: true,
      items: {
        where: { cardOwnership: { cards: { isRetired: false } } },
        orderBy: { addedAt: "asc" },
        take: limit,
        select: { cardOwnership: { select: COPY_WITH_CARD } },
      },
    },
  });
  if (pinned && pinned.items.length > 0) {
    return {
      showcase: { id: pinned.id, name: pinned.name },
      copies: pinned.items.map(({ cardOwnership: { cards, ...copy } }) => ({ card: cards, copy })),
    };
  }
  const top = await db.cardOwnership.findMany({
    where: { ownerId: userId, cards: { isRetired: false } },
    orderBy: [{ cards: { marketValue: "desc" } }, { cardId: "asc" }],
    distinct: ["cardId"],
    take: limit,
    select: COPY_WITH_CARD,
  });
  return { showcase: null, copies: top.map(({ cards, ...copy }) => ({ card: cards, copy })) };
}
