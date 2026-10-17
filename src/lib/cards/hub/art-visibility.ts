// src/lib/cards/hub/art-visibility.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import { toCardFace, type CardFaceRow, type CopyFaceRow } from "./faces";
import { displayedCopies } from "./displayed";

type ArtDb = Pick<PrismaClient, "cardOwnership" | "cardAuction">;
type ContextDb = Pick<PrismaClient, "cardOwnership" | "cardCollection" | "tradeOffer">;

/** Cards whose art this viewer may see in any list: those they hold a copy of, and those on a live listing. */
export async function cardsWithVisibleArt(
  db: ArtDb,
  viewerId: string | null,
  cardIds: readonly string[]
): Promise<Set<string>> {
  const ids = [...new Set(cardIds)];
  if (ids.length === 0) return new Set();
  const [owned, listed] = await Promise.all([
    viewerId
      ? db.cardOwnership.findMany({
          where: { ownerId: viewerId, cardId: { in: ids } },
          select: { cardId: true },
          distinct: ["cardId"],
        })
      : Promise.resolve([]),
    db.cardAuction.findMany({
      where: {
        status: "ACTIVE",
        endTime: { gt: new Date() },
        CardOwnership: { cardId: { in: ids } },
      },
      select: { CardOwnership: { select: { cardId: true } } },
    }),
  ]);
  return new Set([...owned.map((o) => o.cardId), ...listed.map((a) => a.CardOwnership.cardId)]);
}

export interface FaceSource {
  card: CardFaceRow;
  copy?: CopyFaceRow | null;
}

/** Faces for a list a viewer browses, with silhouettes for what they may not see. */
export async function facesFor(
  db: ArtDb,
  viewerId: string | null,
  sources: readonly FaceSource[]
): Promise<CardFaceData[]> {
  const visible = await cardsWithVisibleArt(
    db,
    viewerId,
    sources.map((s) => s.card.id)
  );
  return sources.map((s) =>
    toCardFace(s.card, { revealArt: visible.has(s.card.id), copy: s.copy ?? null })
  );
}

/** The router supplies the passport switch: a showcase or display is public only while its owner shows Vault cards. */
export interface ContextRules {
  vaultVisible: (userId: string) => Promise<boolean>;
}

/**
 * The holder context also needs the passport handle chain reversed: the user a passport handle names (a stored
 * handle, a wiki or forum name, a Clerk id), or null. The router supplies it, as lib code never imports server modules.
 */
export interface HolderRules extends ContextRules {
  holderOf: (handle: string) => Promise<string | null>;
}

/** A trade's card list (stored as JSON) as copy ids. */
export function copyIdsOf(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** An offer shows its cards' art only to its recipient, while it is pending and unexpired (spec §2.3 Discovery). */
export function liveOfferTo(viewerId: string) {
  return {
    recipientId: viewerId,
    status: "PENDING",
    expiresAt: { gt: new Date() },
  } satisfies Prisma.TradeOfferWhereInput;
}

async function offerShowsCard(
  db: ContextDb,
  viewerId: string | null,
  cardId: string,
  offerId: string
): Promise<boolean> {
  if (!viewerId) return false;
  const offer = await db.tradeOffer.findFirst({
    where: { id: offerId, ...liveOfferTo(viewerId) },
    select: { initiatorCardIds: true, recipientCardIds: true },
  });
  if (!offer) return false;
  const ids = [...copyIdsOf(offer.initiatorCardIds), ...copyIdsOf(offer.recipientCardIds)];
  if (ids.length === 0) return false;
  return (await db.cardOwnership.count({ where: { id: { in: ids }, cardId } })) > 0;
}

async function showcaseShowsCard(
  db: ContextDb,
  cardId: string,
  showcaseId: string,
  rules: ContextRules
): Promise<boolean> {
  const showcase = await db.cardCollection.findFirst({
    where: { id: showcaseId, isPublic: true, items: { some: { cardOwnership: { cardId } } } },
    select: { userId: true },
  });
  return showcase ? rules.vaultVisible(showcase.userId) : false;
}

/** A player's trophies and the copies they display are their showcase (spec §2.3 Sets). */
async function holderShowsCard(
  db: ContextDb,
  cardId: string,
  handle: string,
  rules: HolderRules
): Promise<boolean> {
  const holderId = await rules.holderOf(handle);
  if (!holderId || !(await rules.vaultVisible(holderId))) return false;
  const trophy = await db.cardOwnership.findFirst({
    where: { ownerId: holderId, cardId, cards: { cardType: "TROPHY" } },
    select: { id: true },
  });
  if (trophy) return true;
  const shown = await displayedCopies(db, holderId);
  return shown.copies.some((c) => c.card.id === cardId);
}

/** Whether the place a sheet was opened from shows this card's art: a showcase, a display, or an offer to the viewer. */
export async function contextRevealsArt(
  db: ContextDb,
  viewerId: string | null,
  cardId: string,
  from: SheetFrom,
  rules: HolderRules
): Promise<boolean> {
  if (from.kind === "offer") return offerShowsCard(db, viewerId, cardId, from.id);
  if (from.kind === "showcase") return showcaseShowsCard(db, cardId, from.id, rules);
  return holderShowsCard(db, cardId, from.handle, rules);
}
