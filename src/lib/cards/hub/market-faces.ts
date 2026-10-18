// src/lib/cards/hub/market-faces.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import type { CardFaceData } from "~/lib/cards/face/types";
import { cardsWithVisibleArt, copyIdsOf, liveOfferTo } from "./art-visibility";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace } from "./faces";

type FaceDb = Pick<PrismaClient, "cardOwnership" | "cardAuction">;
type TradeDb = Pick<PrismaClient, "cardOwnership" | "cardAuction" | "tradeOffer">;

/**
 * Faces for copies on a market screen, by copy id. `revealAll`: the place shows every copy's art (live listings, an
 * offer made to the viewer); otherwise the viewer sees the art of what they hold and of what is listed live.
 */
export async function copyFaces(
  db: FaceDb,
  viewerId: string,
  ownershipIds: readonly string[],
  revealAll: boolean
): Promise<Map<string, CardFaceData>> {
  const ids = [...new Set(ownershipIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.cardOwnership.findMany({
    where: { id: { in: ids } },
    select: { ...COPY_FACE_SELECT, cards: { select: CARD_FACE_SELECT } },
  });
  const visible = revealAll
    ? new Set<string>()
    : await cardsWithVisibleArt(
        db,
        viewerId,
        rows.map((r) => r.cards.id)
      );
  return new Map(
    rows.map((r) => [
      r.id,
      toCardFace(r.cards, { revealArt: revealAll || visible.has(r.cards.id), copy: r }),
    ])
  );
}

/** A raw card as the market's includes read it; auction history reads no art at all. */
type RawCard = { id: string; artwork?: string | null; artworkCredit?: string | null };
type RawCopyRow = { id: string; cards: RawCard };
/** The copy is null once it is gone: an ended auction outlives a copy broken down or fused. */
type AuctionRow = { cardInstanceId: string | null; CardOwnership: { cards: RawCard } | null };

/** The raw card without the fields that show or name its art. */
function withoutArt<C extends RawCard>(cards: C): C {
  return { ...cards, artwork: null, artworkCredit: null };
}

/**
 * Auction rows with their card's face; null when the copy no longer exists. `live`: every auction is running (active,
 * ending in the future), so its art shows to all. The raw card follows the face, so a retired card ships no art.
 */
export async function withAuctionFaces<T extends AuctionRow>(
  db: FaceDb,
  viewerId: string,
  auctions: readonly T[],
  live: boolean
): Promise<Array<T & { face: CardFaceData | null }>> {
  const rows: readonly AuctionRow[] = auctions;
  const faces = await copyFaces(
    db,
    viewerId,
    rows.flatMap((a) => (a.cardInstanceId === null ? [] : [a.cardInstanceId])),
    live
  );
  return auctions.map((a) => {
    const { cardInstanceId, CardOwnership: copy }: AuctionRow = a;
    const face = cardInstanceId === null ? null : (faces.get(cardInstanceId) ?? null);
    if (face?.artwork || copy === null) return { ...a, face };
    return { ...a, face, CardOwnership: { ...copy, cards: withoutArt(copy.cards) } };
  });
}

/**
 * A copy row's raw card (a partner's copies, a trade's sides) keeps its art only where the copy's face shows art
 * (toCardFace holds the rule).
 */
function keepFaceArt<T extends RawCopyRow>(
  rows: readonly T[],
  faces: ReadonlyMap<string, CardFaceData>
): T[] {
  return rows.map((row) =>
    faces.get(row.id)?.artwork ? row : { ...row, cards: withoutArt(row.cards) }
  );
}

/** Copy rows with a raw card: the art this viewer may not see is blanked. */
export async function blankUnseenArt<T extends RawCopyRow>(
  db: FaceDb,
  viewerId: string,
  rows: readonly T[]
): Promise<T[]> {
  const faces = await copyFaces(
    db,
    viewerId,
    rows.map((r) => r.id),
    false
  );
  return keepFaceArt(rows, faces);
}

interface TradeCopyLists {
  id: string;
  initiatorCardIds: Prisma.JsonValue;
  recipientCardIds: Prisma.JsonValue;
}

interface TradeView<I, R> {
  initiatorCardsData: I[];
  recipientCardsData: R[];
  initiatorFaces: CardFaceData[];
  recipientFaces: CardFaceData[];
}

/**
 * A trade's two sides for the viewer. A live offer made to them shows all its art, asked with the card sheet's own
 * offer rule (spec §2.3 Discovery); any other trade follows the silhouette rule. The faces keep the offer's order.
 */
export async function tradeView<I extends RawCopyRow, R extends RawCopyRow>(
  db: TradeDb,
  viewerId: string,
  trade: TradeCopyLists,
  initiatorCards: readonly I[],
  recipientCards: readonly R[]
): Promise<TradeView<I, R>> {
  const initiatorIds = copyIdsOf(trade.initiatorCardIds);
  const recipientIds = copyIdsOf(trade.recipientCardIds);
  const offeredToViewer =
    (await db.tradeOffer.count({ where: { id: trade.id, ...liveOfferTo(viewerId) } })) > 0;
  const faces = await copyFaces(db, viewerId, [...initiatorIds, ...recipientIds], offeredToViewer);
  const pick = (ids: readonly string[]) => ids.flatMap((id) => faces.get(id) ?? []);
  return {
    initiatorCardsData: keepFaceArt(initiatorCards, faces),
    recipientCardsData: keepFaceArt(recipientCards, faces),
    initiatorFaces: pick(initiatorIds),
    recipientFaces: pick(recipientIds),
  };
}
