// src/lib/cards/hub/art-visibility.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ValueDb } from "~/lib/cards/copy-value";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import { toCardFace, type CardFaceRow, type CopyFaceRow } from "./faces";
import { displayedCopies } from "./displayed";

/** What the collected mark reads: the viewer's copies. */
export type CollectionDb = Pick<PrismaClient, "cardOwnership">;
/** The holder context reads their display, which ranks their copies by the shared copy value. */
type ContextDb = Pick<PrismaClient, "cardOwnership" | "cardCollection" | "tradeOffer"> & ValueDb;

/** The cards among `cardIds` the viewer holds a copy of; none for a signed-out viewer, who holds nothing. */
export async function cardsCollectedBy(
  db: CollectionDb,
  viewerId: string | null,
  cardIds: readonly string[]
): Promise<Set<string>> {
  const ids = [...new Set(cardIds)];
  if (!viewerId || ids.length === 0) return new Set();
  const owned = await db.cardOwnership.findMany({
    where: { ownerId: viewerId, cardId: { in: ids } },
    select: { cardId: true },
    distinct: ["cardId"],
  });
  return new Set(owned.map((row) => row.cardId));
}

export interface FaceSource {
  card: CardFaceRow;
  copy?: CopyFaceRow | null;
}

/** Faces for a list a viewer browses, in the order given, each marked by whether the viewer holds a copy. */
export async function facesFor(
  db: CollectionDb,
  viewerId: string | null,
  sources: readonly FaceSource[]
): Promise<CardFaceData[]> {
  const collected = await cardsCollectedBy(
    db,
    viewerId,
    sources.map((s) => s.card.id)
  );
  return sources.map((s) =>
    toCardFace(s.card, { collected: collected.has(s.card.id), copy: s.copy ?? null })
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

/**
 * An offer shows its cards to the party it waits on (the one who did not write the current table, so either side after
 * a counter-offer), while it is pending and unexpired: the sheet opens one of them from there.
 */
function liveOfferTo(viewerId: string) {
  return {
    status: "PENDING",
    expiresAt: { gt: new Date() },
    proposerId: { not: viewerId },
    OR: [{ initiatorId: viewerId }, { recipientId: viewerId }],
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

/** A retired copy shows there to the showcase's owner only, as `getShowcase` leaves it out for everyone else. */
async function showcaseShowsCard(
  db: ContextDb,
  viewerId: string | null,
  cardId: string,
  showcaseId: string,
  rules: ContextRules
): Promise<boolean> {
  const showcase = await db.cardCollection.findFirst({
    where: { id: showcaseId, isPublic: true, items: { some: { cardOwnership: { cardId } } } },
    select: {
      userId: true,
      items: {
        where: { cardOwnership: { cardId, cards: { isRetired: false } } },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!showcase) return false;
  if (showcase.items.length === 0 && showcase.userId !== viewerId) return false;
  return rules.vaultVisible(showcase.userId);
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

/**
 * Whether the place a sheet was opened from shows this card: a showcase, a display, or an offer to the viewer. It opens
 * the sheet of a card outside the catalogue, and a signed-out visitor's sheet.
 */
export async function contextShowsCard(
  db: ContextDb,
  viewerId: string | null,
  cardId: string,
  from: SheetFrom,
  rules: HolderRules
): Promise<boolean> {
  if (from.kind === "offer") return offerShowsCard(db, viewerId, cardId, from.id);
  if (from.kind === "showcase") return showcaseShowsCard(db, viewerId, cardId, from.id, rules);
  return holderShowsCard(db, cardId, from.handle, rules);
}
