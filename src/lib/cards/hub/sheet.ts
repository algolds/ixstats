// src/lib/cards/hub/sheet.ts
import type { LoreCategory, Prisma, PrismaClient } from "@prisma/client";
import { copyValue } from "~/lib/cards/copy-value";
import { artCreditOf, type ArtCredit } from "~/lib/cards/face/art-credit";
import { nsProvenanceOf, type NsProvenance } from "~/lib/cards/face/ns-provenance";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { TrailEvent } from "~/lib/cards/face/trail";
import type { CardFaceData, CardRarity, CardType } from "~/lib/cards/face/types";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { contextRevealsArt, type ContextRules } from "./art-visibility";
import { CATALOGUE_WHERE } from "./catalogue";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace } from "./faces";

type SheetDb = Pick<
  PrismaClient,
  | "card"
  | "cardOwnership"
  | "cardAuction"
  | "cardTransferEvent"
  | "cardWatchlist"
  | "cardCollection"
  | "tradeOffer"
  | "user"
>;

const SHEET_CARD_SELECT = {
  ...CARD_FACE_SELECT,
  nsCardId: true,
  isBound: true,
  category: true,
  description: true,
  wikiSource: true,
  wikiArticleTitle: true,
  wikiExcerpt: true,
  artworkCredit: true,
  artLicence: {
    select: {
      fileTitle: true,
      licence: true,
      artist: true,
      attribution: true,
      descriptionUrl: true,
    },
  },
  // NS facts, the older cards' excerpt, the article's author and the legacy Commons file page; never sent as is.
  metadata: true,
  marketValue: true,
} satisfies Prisma.CardSelect;
type SheetCardRow = Prisma.CardGetPayload<{ select: typeof SHEET_CARD_SELECT }>;

const SHEET_COPY_SELECT = {
  ...COPY_FACE_SELECT,
  experience: true,
  acquiredAt: true,
  isLocked: true,
  inscription: true,
  inscribedAt: true,
  inscribedById: true,
} satisfies Prisma.CardOwnershipSelect;
type SheetCopyRow = Prisma.CardOwnershipGetPayload<{ select: typeof SHEET_COPY_SELECT }>;

export interface SheetCopy {
  face: CardFaceData;
  experience: number;
  acquiredAt: Date;
  isLocked: boolean;
  inscription: { text: string; signerHandle: string | null; signedAt: Date | null } | null;
  trail: TrailEvent[];
}

export interface SheetListing {
  auctionId: string;
  currentBid: number;
  buyoutPrice: number | null;
  endTime: Date;
  bidCount: number;
  sellerHandle: string | null;
  isMine: boolean;
}

export interface CardSheetData {
  /** The big card: art by the silhouette rule, with the viewer's first copy when they hold one. */
  face: CardFaceData;
  card: {
    id: string;
    title: string;
    cardType: CardType;
    rarity: CardRarity;
    isBound: boolean;
    isRetired: boolean;
    category: LoreCategory | null;
    description: string | null;
    wikiSource: string | null;
    wikiArticleTitle: string | null;
    excerpt: string | null;
    /** The article's author as the importer stored it. */
    author: string | null;
    /** A legacy Commons card's file page, for the wiki link. */
    descriptionUrl: string | null;
    artCredit: ArtCredit | null;
    ns: NsProvenance | null;
    /** What one copy is worth; a retired (hidden) card is worth nothing. */
    value: number;
  };
  copies: SheetCopy[];
  market: {
    listings: SheetListing[];
    recentSales: Array<{ price: number; at: Date }>;
    wantedBy: number;
  };
}

const MAX_COPIES = 50;
const MAX_TRAIL = 200;
const MAX_LISTINGS = 10;
const RECENT_SALES = 5;

const textOf = (value: Prisma.JsonValue | undefined): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/** The stored excerpt: the column the importer writes, else `metadata.fullExcerpt`, where older cards keep it. */
function storedExcerpt(card: Pick<SheetCardRow, "wikiExcerpt" | "metadata">): string | null {
  return (
    card.wikiExcerpt ?? (isJsonObject(card.metadata) ? textOf(card.metadata.fullExcerpt) : null)
  );
}

/** The article's author as the importer stored it (`metadata.authorInfo.displayAuthor`, else `metadata.author`). */
function storedAuthor(metadata: Prisma.JsonValue | null): string | null {
  if (!isJsonObject(metadata)) return null;
  const info = metadata.authorInfo;
  return (isJsonObject(info) ? textOf(info.displayAuthor) : null) ?? textOf(metadata.author);
}

async function loadListings(
  db: SheetDb,
  viewerId: string,
  cardId: string
): Promise<SheetListing[]> {
  const rows = await db.cardAuction.findMany({
    where: { status: "ACTIVE", endTime: { gt: new Date() }, CardOwnership: { cardId } },
    orderBy: [{ endTime: "asc" }, { id: "asc" }],
    take: MAX_LISTINGS,
    select: {
      id: true,
      currentBid: true,
      buyoutPrice: true,
      endTime: true,
      bidCount: true,
      sellerId: true,
      User: { select: { handle: true } },
    },
  });
  return rows.map((r) => ({
    auctionId: r.id,
    currentBid: r.currentBid,
    buyoutPrice: r.buyoutPrice,
    endTime: r.endTime,
    bidCount: r.bidCount,
    sellerHandle: r.User.handle,
    isMine: r.sellerId === viewerId,
  }));
}

async function loadSales(db: SheetDb, cardId: string): Promise<Array<{ price: number; at: Date }>> {
  const rows = await db.cardAuction.findMany({
    where: { status: "COMPLETED", finalPrice: { not: null }, CardOwnership: { cardId } },
    orderBy: [{ endTime: "desc" }, { id: "desc" }],
    take: RECENT_SALES,
    select: { finalPrice: true, endTime: true },
  });
  return rows.flatMap((r) =>
    r.finalPrice === null ? [] : [{ price: r.finalPrice, at: r.endTime }]
  );
}

/** Every copy's trail, newest first, and the handles of everyone named in it (never internal ids). */
async function loadTrails(db: SheetDb, copies: readonly SheetCopyRow[]) {
  const ids = copies.map((c) => c.id);
  const events = ids.length
    ? await db.cardTransferEvent.findMany({
        where: { ownershipId: { in: ids } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MAX_TRAIL,
        select: {
          id: true,
          ownershipId: true,
          action: true,
          fromUserId: true,
          toUserId: true,
          price: true,
          createdAt: true,
        },
      })
    : [];
  // A mint has no sender and a copy leaving every player no recipient (`toUserId` is nullable since Phase 2).
  const named = [
    ...events.flatMap((e) => [e.fromUserId, e.toUserId]),
    ...copies.map((c) => c.inscribedById),
  ];
  const userIds = [...new Set(named.filter((id): id is string => id !== null))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, handle: true } })
    : [];
  // Keyed by a nullable id, so a missing sender or recipient reads as nobody.
  const handles = new Map<string | null, string | null>(users.map((u) => [u.id, u.handle]));
  const handleOf = (id: string | null) => handles.get(id) ?? null;
  const trailOf = (copyId: string): TrailEvent[] =>
    events
      .filter((e) => e.ownershipId === copyId)
      .map((e) => ({
        id: e.id,
        action: e.action,
        fromHandle: handleOf(e.fromUserId),
        toHandle: handleOf(e.toUserId),
        price: e.price,
        at: e.createdAt,
      }));
  return { trailOf, handleOf };
}

function toSheetCopy(
  card: SheetCardRow,
  copy: SheetCopyRow,
  trailOf: (copyId: string) => TrailEvent[],
  handleOf: (id: string | null) => string | null
): SheetCopy {
  return {
    face: toCardFace(card, { revealArt: true, copy }),
    experience: copy.experience,
    acquiredAt: copy.acquiredAt,
    isLocked: copy.isLocked,
    inscription: copy.inscription
      ? {
          text: copy.inscription,
          signerHandle: handleOf(copy.inscribedById),
          signedAt: copy.inscribedAt,
        }
      : null,
    trail: trailOf(copy.id),
  };
}

/** The sheet's facts about the card itself: about, provenance and value (spec §2.3 Detail sheet). */
function toSheetCard(card: SheetCardRow): CardSheetData["card"] {
  return {
    id: card.id,
    title: card.title,
    cardType: card.cardType,
    rarity: card.rarity,
    isBound: card.isBound,
    isRetired: card.isRetired,
    category: card.category,
    description: card.description,
    wikiSource: card.wikiSource,
    wikiArticleTitle: card.wikiArticleTitle,
    excerpt: storedExcerpt(card),
    author: storedAuthor(card.metadata),
    descriptionUrl: isJsonObject(card.metadata) ? textOf(card.metadata.descriptionUrl) : null,
    artCredit: artCreditOf(card),
    ns: card.cardType === "NS" ? nsProvenanceOf(card) : null,
    // A hidden (retired) card is worth nothing, as in Mine, the Wallet's figures and the dividend.
    value: card.isRetired ? 0 : copyValue({ cards: card }),
  };
}

/**
 * The sheet a `?card=` link opens. Art shows to a holder, while the card is on a live listing, or when the sheet was
 * opened from another player's showcase or an offer made to the viewer (spec §2.3 Discovery). Null for a card that
 * does not exist, or one outside the catalogue (in review, hidden) that the viewer does not hold.
 */
export async function loadCardSheet(
  db: SheetDb,
  viewerId: string,
  cardId: string,
  options: { from: SheetFrom | null; rules: ContextRules }
): Promise<CardSheetData | null> {
  const [card, copies, listings, catalogued] = await Promise.all([
    db.card.findUnique({ where: { id: cardId }, select: SHEET_CARD_SELECT }),
    db.cardOwnership.findMany({
      where: { cardId, ownerId: viewerId },
      select: SHEET_COPY_SELECT,
      orderBy: { serialNumber: "asc" },
      take: MAX_COPIES,
    }),
    loadListings(db, viewerId, cardId),
    db.card.count({ where: { id: cardId, ...CATALOGUE_WHERE } }),
  ]);
  if (!card || (catalogued === 0 && copies.length === 0)) return null;

  const revealArt =
    copies.length > 0 ||
    listings.length > 0 ||
    (options.from !== null &&
      (await contextRevealsArt(db, viewerId, cardId, options.from, options.rules)));
  const [{ trailOf, handleOf }, recentSales, wantedBy] = await Promise.all([
    loadTrails(db, copies),
    loadSales(db, cardId),
    db.cardWatchlist.count({ where: { cardId } }),
  ]);
  return {
    face: toCardFace(card, { revealArt, copy: copies[0] ?? null }),
    card: toSheetCard(card),
    copies: copies.map((copy) => toSheetCopy(card, copy, trailOf, handleOf)),
    market: { listings, recentSales, wantedBy },
  };
}
