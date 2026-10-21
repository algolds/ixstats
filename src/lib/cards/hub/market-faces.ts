// src/lib/cards/hub/market-faces.ts
import type { CardFaceData } from "~/lib/cards/face/types";
import { cardsCollectedBy, type CollectionDb } from "./art-visibility";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace } from "./faces";

/**
 * Faces for copies on a market screen, by copy id, each marked by whether the viewer holds a copy of its card (theirs
 * or another player's copy alike).
 */
export async function copyFaces(
  db: CollectionDb,
  viewerId: string,
  ownershipIds: readonly string[]
): Promise<Map<string, CardFaceData>> {
  const ids = [...new Set(ownershipIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.cardOwnership.findMany({
    where: { id: { in: ids } },
    select: { ...COPY_FACE_SELECT, cards: { select: CARD_FACE_SELECT } },
  });
  const collected = await cardsCollectedBy(
    db,
    viewerId,
    rows.map((r) => r.cards.id)
  );
  return new Map(
    rows.map((r) => [r.id, toCardFace(r.cards, { collected: collected.has(r.cards.id), copy: r })])
  );
}

/** A raw card as the market's includes read it; auction history reads no art at all. */
type RawCard = { id: string; artwork?: string | null; artworkCredit?: string | null };
/** The copy is null once it is gone: an ended auction outlives a copy broken down or fused. */
type AuctionRow = { cardInstanceId: string | null; CardOwnership: { cards: RawCard } | null };

/** The raw card without the fields that show or name its art. */
function withoutArt<C extends RawCard>(cards: C): C {
  return { ...cards, artwork: null, artworkCredit: null };
}

/**
 * Auction rows with their card's face; null when the copy no longer exists. The raw card follows the face, so a retired
 * card, and a copy gone since, ships no art.
 */
export async function withAuctionFaces<T extends AuctionRow>(
  db: CollectionDb,
  viewerId: string,
  auctions: readonly T[]
): Promise<Array<T & { face: CardFaceData | null }>> {
  const rows: readonly AuctionRow[] = auctions;
  const faces = await copyFaces(
    db,
    viewerId,
    rows.flatMap((a) => (a.cardInstanceId === null ? [] : [a.cardInstanceId]))
  );
  return auctions.map((a) => {
    const { cardInstanceId, CardOwnership: copy }: AuctionRow = a;
    const face = cardInstanceId === null ? null : (faces.get(cardInstanceId) ?? null);
    if (face?.artwork || copy === null) return { ...a, face };
    return { ...a, face, CardOwnership: { ...copy, cards: withoutArt(copy.cards) } };
  });
}
