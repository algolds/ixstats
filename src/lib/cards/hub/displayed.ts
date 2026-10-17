// src/lib/cards/hub/displayed.ts
import type { PrismaClient } from "@prisma/client";
import { DISPLAY_SIZE } from "~/lib/cards/face/showcase-limits";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, type CardFaceRow, type CopyFaceRow } from "./faces";

export interface DisplayedCopy {
  card: CardFaceRow;
  copy: CopyFaceRow;
}

const COPY_WITH_CARD = { ...COPY_FACE_SELECT, cards: { select: CARD_FACE_SELECT } } as const;

/**
 * What a player shows off (spec §2.3 Sets): their pinned showcase when it is public (the latest pin), or else their
 * most valuable live copies, one per card. A private showcase is never shown to others, even when pinned. Hidden
 * (retired) cards are left out of both, as the wallet showcase always has.
 */
export async function displayedCopies(
  db: Pick<PrismaClient, "cardCollection" | "cardOwnership">,
  userId: string,
  limit = DISPLAY_SIZE
): Promise<{ showcase: { id: string; name: string } | null; copies: DisplayedCopy[] }> {
  const pinned = await db.cardCollection.findFirst({
    where: { userId, isPublic: true, pinnedAt: { not: null } },
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
  // ponytail: the ceiling is the player's live copies. The relation-first orderBy keeps Prisma's distinct and take
  // in memory, so this reads every live copy they own; if players hold thousands of copies, read the cards first,
  // with the take in SQL, and one copy of each.
  const top = await db.cardOwnership.findMany({
    where: { ownerId: userId, cards: { isRetired: false } },
    orderBy: [{ cards: { marketValue: "desc" } }, { cardId: "asc" }, { id: "asc" }],
    distinct: ["cardId"],
    take: limit,
    select: COPY_WITH_CARD,
  });
  return { showcase: null, copies: top.map(({ cards, ...copy }) => ({ card: cards, copy })) };
}
