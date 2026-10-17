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

/**
 * Auction rows with their card's face; null when the copy no longer exists. `live`: every auction is running (active,
 * ending in the future), so its art shows to all.
 */
export async function withAuctionFaces<T extends { cardInstanceId: string }>(
  db: FaceDb,
  viewerId: string,
  auctions: readonly T[],
  live: boolean
): Promise<Array<T & { face: CardFaceData | null }>> {
  const faces = await copyFaces(
    db,
    viewerId,
    auctions.map((a) => a.cardInstanceId),
    live
  );
  return auctions.map((a) => ({ ...a, face: faces.get(a.cardInstanceId) ?? null }));
}

/** A copy row that still carries its raw card (a partner's copies, a trade's sides). */
type RawCopyRow = { id: string; cards: { artwork: string | null } };

/** The raw card keeps its art only where the copy's face shows art (toCardFace holds the rule). */
function keepFaceArt<T extends RawCopyRow>(
  rows: readonly T[],
  faces: ReadonlyMap<string, CardFaceData>
): T[] {
  return rows.map((row) =>
    faces.get(row.id)?.artwork ? row : { ...row, cards: { ...row.cards, artwork: null } }
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

export interface TradeView<I, R> {
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
