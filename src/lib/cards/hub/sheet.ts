// src/lib/cards/hub/sheet.ts
import type { LoreCategory, Prisma, PrismaClient } from "@prisma/client";
import { copyValue } from "~/lib/cards/copy-value";
import { artCreditOf, type ArtCredit } from "~/lib/cards/face/art-credit";
import { nsProvenanceOf, type NsProvenance } from "~/lib/cards/face/ns-provenance";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { TrailEvent } from "~/lib/cards/face/trail";
import type { CardFaceData, CardRarity, CardType } from "~/lib/cards/face/types";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { renderFileLinks } from "~/lib/wiki-os/transformers/wikitext-files";
import { contextRevealsArt, type HolderRules } from "./art-visibility";
import { CATALOGUE_WHERE } from "./catalogue";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace } from "./faces";
import type { HubPlayer, PlayerRules } from "./players";

type SheetDb = Pick<
  PrismaClient,
  | "card"
  | "cardOwnership"
  | "cardAuction"
  | "cardTransferEvent"
  | "cardWatchlist"
  | "cardCollection"
  | "tradeOffer"
>;

/** The router's rules: the places that show a card's art, and the players the sheet names. */
export type SheetRules = HolderRules & PlayerRules;

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
  /** The signer's name (`HubPlayer.name`); null names them "a player". */
  inscription: { text: string; signerName: string | null; signedAt: Date | null } | null;
  trail: TrailEvent[];
}

export interface SheetListing {
  auctionId: string;
  currentBid: number;
  buyoutPrice: number | null;
  endTime: Date;
  bidCount: number;
  /** The seller's name (`HubPlayer.name`); null ("A player") while their passport hides Vault cards, or with no name. */
  sellerName: string | null;
  isMine: boolean;
}

export interface CardSheetData {
  /** The big card: art by the silhouette rule, with the viewer's first copy when they hold one. */
  face: CardFaceData;
  /** False for a signed-out visitor, who has no copies and no market history to ask for. */
  signedIn: boolean;
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

/** A signed-out visitor's answer for a card no public place shows: the sheet asks them to sign in. */
export interface SheetSignIn {
  signIn: true;
}

const SIGN_IN: SheetSignIn = { signIn: true };

const MAX_COPIES = 50;
const MAX_TRAIL = 200;
const MAX_LISTINGS = 10;
const RECENT_SALES = 5;

const textOf = (value: Prisma.JsonValue | undefined): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/** The stored excerpt: the column the importer writes, else `metadata.fullExcerpt`, where older cards keep it. */
function storedExcerpt(card: Pick<SheetCardRow, "wikiExcerpt" | "metadata">): string | null {
  return (
    textOf(card.wikiExcerpt) ??
    (isJsonObject(card.metadata) ? textOf(card.metadata.fullExcerpt) : null)
  );
}

/** A legacy Commons card's file page (`metadata.descriptionUrl`). */
function storedDescriptionUrl(metadata: Prisma.JsonValue | null): string | null {
  return isJsonObject(metadata) ? textOf(metadata.descriptionUrl) : null;
}

/** The article's author as the importer stored it (`metadata.authorInfo.displayAuthor`, else `metadata.author`). */
function storedAuthor(metadata: Prisma.JsonValue | null): string | null {
  if (!isJsonObject(metadata)) return null;
  const info = metadata.authorInfo;
  return (isJsonObject(info) ? textOf(info.displayAuthor) : null) ?? textOf(metadata.author);
}

const LISTING_SELECT = {
  id: true,
  currentBid: true,
  buyoutPrice: true,
  endTime: true,
  bidCount: true,
  sellerId: true,
} satisfies Prisma.CardAuctionSelect;
type ListingRow = Prisma.CardAuctionGetPayload<{ select: typeof LISTING_SELECT }>;

function loadListings(db: SheetDb, cardId: string): Promise<ListingRow[]> {
  return db.cardAuction.findMany({
    where: { status: "ACTIVE", endTime: { gt: new Date() }, CardOwnership: { cardId } },
    orderBy: [{ endTime: "asc" }, { id: "asc" }],
    take: MAX_LISTINGS,
    select: LISTING_SELECT,
  });
}

/** A signed-out viewer (null) owns no listing. */
function toSheetListing(
  row: ListingRow,
  viewerId: string | null,
  nameOf: (id: string) => string | null
): SheetListing {
  return {
    auctionId: row.id,
    currentBid: row.currentBid,
    buyoutPrice: row.buyoutPrice,
    endTime: row.endTime,
    bidCount: row.bidCount,
    sellerName: nameOf(row.sellerId),
    isMine: row.sellerId === viewerId,
  };
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

/** Every move of the viewer's copies, newest first. */
async function loadTrailEvents(db: SheetDb, copies: readonly SheetCopyRow[]) {
  const ids = copies.map((c) => c.id);
  if (ids.length === 0) return [];
  return db.cardTransferEvent.findMany({
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
  });
}
type TrailRow = Awaited<ReturnType<typeof loadTrailEvents>>[number];

/**
 * Everyone the sheet names, for one batched read: the sellers, both sides of each move (a mint has no sender and a copy
 * leaving every player no recipient: `toUserId` is nullable since Phase 2), and the signers.
 */
function namedPlayers(
  listings: readonly ListingRow[],
  events: readonly TrailRow[],
  copies: readonly SheetCopyRow[]
): string[] {
  return [
    ...listings.map((l) => l.sellerId),
    ...events.flatMap((e) => [e.fromUserId, e.toUserId]),
    ...copies.map((c) => c.inscribedById),
  ].filter((id): id is string => id !== null);
}

/**
 * A player's name on the sheet: their name by the identity rule, or null ("a player") while their passport hides Vault
 * cards, or when they no longer exist. The viewer always sees their own.
 */
function namer(players: ReadonlyMap<string, HubPlayer>, viewerId: string | null) {
  return (id: string): string | null => {
    const player = players.get(id);
    return player && (player.showsVault || id === viewerId) ? player.name : null;
  };
}

/** The named players in one read; with nobody to name, no read. */
function playersNamed(rules: PlayerRules, ids: string[]): Promise<ReadonlyMap<string, HubPlayer>> {
  return ids.length > 0 ? rules.playersOf(ids) : Promise.resolve(new Map<string, HubPlayer>());
}

function trailOf(events: readonly TrailRow[], nameOf: (id: string) => string | null) {
  const party = (id: string | null) => (id === null ? null : { name: nameOf(id) });
  return (copyId: string): TrailEvent[] =>
    events
      .filter((e) => e.ownershipId === copyId)
      .map((e) => ({
        id: e.id,
        action: e.action,
        from: party(e.fromUserId),
        to: party(e.toUserId),
        price: e.price,
        at: e.createdAt,
      }));
}

function toSheetCopy(
  card: SheetCardRow,
  copy: SheetCopyRow,
  trail: (copyId: string) => TrailEvent[],
  nameOf: (id: string) => string | null
): SheetCopy {
  return {
    face: toCardFace(card, { revealArt: true, copy }),
    experience: copy.experience,
    acquiredAt: copy.acquiredAt,
    isLocked: copy.isLocked,
    inscription: copy.inscription
      ? {
          text: copy.inscription,
          signerName: copy.inscribedById ? nameOf(copy.inscribedById) : null,
          signedAt: copy.inscribedAt,
        }
      : null,
    trail: trail(copy.id),
  };
}

/** The excerpt as the client draws it for hidden art (`images: false`): no file links, links to file pages as words. */
const withoutFileLinks = (excerpt: string) => renderFileLinks(excerpt, "ixwiki", false);

/**
 * The sheet's facts about the card itself: about, provenance and value (spec §2.3 Detail sheet). When the art is
 * hidden (a silhouette, or a retired card, often a takedown or a restricted licence) nothing may name or link the
 * image: the art credit and the file page go, the excerpt loses its file links, and a Commons card loses its title (the
 * file's). The article link stays.
 */
function toSheetCard(card: SheetCardRow, artHidden: boolean): CardSheetData["card"] {
  const excerpt = storedExcerpt(card);
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
    wikiArticleTitle: artHidden && card.wikiSource === "commons" ? null : card.wikiArticleTitle,
    excerpt: excerpt && artHidden ? withoutFileLinks(excerpt) : excerpt,
    author: storedAuthor(card.metadata),
    descriptionUrl: artHidden ? null : storedDescriptionUrl(card.metadata),
    artCredit: artHidden ? null : artCreditOf(card),
    ns: card.cardType === "NS" ? nsProvenanceOf(card) : null,
    // A hidden (retired) card is worth nothing, as in Mine, the Wallet's figures and the dividend.
    value: card.isRetired ? 0 : copyValue({ cards: card }),
  };
}

/**
 * The sheet a `?card=` link opens. Art shows to a holder, while the card is on a live listing, or when the sheet was
 * opened from another player's showcase or an offer made to the viewer (spec §2.3 Discovery). A card outside the
 * catalogue (in review, hidden, or in an unpublished realm) opens only in those same places, so a bare link to one is
 * null, as is a card that does not exist. A retired card still shows no art (`toCardFace`).
 *
 * A signed-out visitor (`viewerId` null) has no copies to read, and sees the sheet only where a player shows the card
 * publicly: a live listing, a public showcase, or a holder's passport display. Everywhere else, a card that does not
 * exist included, they are asked to sign in.
 */
export async function loadCardSheet(
  db: SheetDb,
  viewerId: string | null,
  cardId: string,
  options: { from: SheetFrom | null; rules: SheetRules }
): Promise<CardSheetData | SheetSignIn | null> {
  const [card, copies, listings, catalogued] = await Promise.all([
    db.card.findUnique({ where: { id: cardId }, select: SHEET_CARD_SELECT }),
    viewerId
      ? db.cardOwnership.findMany({
          where: { cardId, ownerId: viewerId },
          select: SHEET_COPY_SELECT,
          orderBy: { serialNumber: "asc" },
          take: MAX_COPIES,
        })
      : Promise.resolve([]),
    loadListings(db, cardId),
    db.card.count({ where: { id: cardId, ...CATALOGUE_WHERE } }),
  ]);
  if (!card) return viewerId ? null : SIGN_IN;

  // Held or listed already shows the art, so the opening place is asked only otherwise.
  const shown = copies.length > 0 || listings.length > 0;
  const [shownThere, events, recentSales, wantedBy] = await Promise.all([
    !shown && options.from !== null
      ? contextRevealsArt(db, viewerId, cardId, options.from, options.rules)
      : false,
    loadTrailEvents(db, copies),
    loadSales(db, cardId),
    db.cardWatchlist.count({ where: { cardId } }),
  ]);
  const revealArt = shown || shownThere;
  if (!revealArt && !viewerId) return SIGN_IN;
  if (!revealArt && catalogued === 0) return null;

  const players = await playersNamed(options.rules, namedPlayers(listings, events, copies));
  const nameOf = namer(players, viewerId);
  const face = toCardFace(card, { revealArt, copy: copies[0] ?? null });
  const trail = trailOf(events, nameOf);
  return {
    face,
    signedIn: viewerId !== null,
    card: toSheetCard(card, face.silhouette || card.isRetired),
    copies: copies.map((copy) => toSheetCopy(card, copy, trail, nameOf)),
    market: {
      listings: listings.map((row) => toSheetListing(row, viewerId, nameOf)),
      recentSales,
      wantedBy,
    },
  };
}
