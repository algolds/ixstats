// src/lib/cards/hub/displayed.ts
import type { PrismaClient } from "@prisma/client";
import { topCopiesByValue, type ValueDb } from "~/lib/cards/copy-value";
import { DISPLAY_SIZE } from "~/lib/cards/face/showcase-limits";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, type CardFaceRow, type CopyFaceRow } from "./faces";

export interface DisplayedCopy {
  card: CardFaceRow;
  copy: CopyFaceRow;
}

const COPY_WITH_CARD = { ...COPY_FACE_SELECT, cards: { select: CARD_FACE_SELECT } } as const;

/**
 * What a player shows off (spec §2.3 Sets): their pinned showcase when it is public (the latest pin), or else their
 * most valuable live copies by the shared copy value, one per card. A private showcase is never shown to others, even
 * when pinned. Hidden (retired) cards are left out of both, as the wallet showcase always has.
 */
export async function displayedCopies(
  db: Pick<PrismaClient, "cardCollection"> & ValueDb,
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
  // ponytail: the ceiling is the player's live copies. Ranking by copy value values every live copy they own; if
  // players hold thousands of copies, keep a ranked value per copy instead.
  const top = await topCopiesByValue(db, userId, limit);
  if (top.length === 0) return { showcase: null, copies: [] };
  const rows = await db.cardOwnership.findMany({
    // A copy that moved or was retired since it was ranked is left out.
    where: {
      id: { in: top.map((t) => t.ownershipId) },
      ownerId: userId,
      cards: { isRetired: false },
    },
    select: COPY_WITH_CARD,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const copies = top.flatMap((t) => {
    const row = byId.get(t.ownershipId);
    if (!row) return [];
    const { cards, ...copy } = row;
    return [{ card: cards, copy }];
  });
  return { showcase: null, copies };
}
