/**
 * Market › Browse: live listings and auctions in one list. Featured items come first, then the chosen sort ("ending
 * soon" is a sort), then the id. Each source is read in that same order and merged, so a page is exact up to
 * MAX_BROWSE_OFFSET. A live item shows its art to everyone (spec §2.3 Discovery) and names no seller: it says only
 * whether it is the viewer's, so Browse offers no Buy or Bid on their own.
 */
import type { CardFinish, CardRarity, CardType, Prisma, PrismaClient } from "@prisma/client";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace } from "~/lib/cards/hub/faces";
import { likeLiteral } from "~/lib/utils/like-literal";

export const BROWSE_SORTS = ["newest", "ending_soon", "price_low", "price_high"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];
export const MAX_BROWSE_OFFSET = 500;

export interface BrowseFilters {
  realmId?: string;
  rarity?: CardRarity;
  finish?: CardFinish;
  cardType?: CardType;
  cardId?: string;
  search?: string;
}

export interface BrowseInput {
  kind: "all" | "listings" | "auctions";
  sort: BrowseSort;
  filters: BrowseFilters;
  limit: number;
  offset: number;
}

export interface BrowseItem {
  kind: "listing" | "auction";
  id: string;
  /** A listing's price, or an auction's current bid (its starting price until the first bid). */
  price: number;
  isFeatured: boolean;
  endsAt: Date;
  createdAt: Date;
  /** The viewer is the seller: Browse offers no Buy or Bid on it. */
  isMine: boolean;
  ownershipId: string;
  bidCount: number;
  buyoutPrice: number | null;
  /** The copy's face, with its art. */
  face: CardFaceData;
}

type BrowseDb = Pick<PrismaClient, "cardListing" | "cardAuction">;

function cardWhere(f: BrowseFilters): Prisma.CardWhereInput {
  return {
    ...(f.realmId ? { realmId: f.realmId } : {}),
    ...(f.rarity ? { rarity: f.rarity } : {}),
    ...(f.cardType ? { cardType: f.cardType } : {}),
    ...(f.cardId ? { id: f.cardId } : {}),
    ...(f.search ? { title: { contains: likeLiteral(f.search), mode: "insensitive" } } : {}),
  };
}

/** The row's own card, when a filter names one. */
function cardFilter(f: BrowseFilters): { card?: Prisma.CardWhereInput } {
  const cards = cardWhere(f);
  return Object.keys(cards).length > 0 ? { card: cards } : {};
}

const SORT_KEY: Record<BrowseSort, (a: BrowseItem, b: BrowseItem) => number> = {
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  ending_soon: (a, b) => a.endsAt.getTime() - b.endsAt.getTime(),
  price_low: (a, b) => a.price - b.price,
  price_high: (a, b) => b.price - a.price,
};

const byId = (a: BrowseItem, b: BrowseItem): number => {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
};

export function compareBrowse(sort: BrowseSort): (a: BrowseItem, b: BrowseItem) => number {
  return (a, b) =>
    Number(b.isFeatured) - Number(a.isFeatured) || SORT_KEY[sort](a, b) || byId(a, b);
}

const LISTING_ORDER: Record<BrowseSort, Prisma.CardListingOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  ending_soon: { expiresAt: "asc" },
  price_low: { price: "asc" },
  price_high: { price: "desc" },
};

const AUCTION_ORDER: Record<BrowseSort, Prisma.CardAuctionOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  ending_soon: { endTime: "asc" },
  price_low: { currentBid: "asc" },
  price_high: { currentBid: "desc" },
};

/** Only what a face shows from the copy: never a whole copy row, which would carry who signed it. */
const LISTING_SELECT = {
  id: true,
  price: true,
  isFeatured: true,
  expiresAt: true,
  createdAt: true,
  sellerId: true,
  card: { select: CARD_FACE_SELECT },
  ownership: { select: COPY_FACE_SELECT },
} satisfies Prisma.CardListingSelect;

const AUCTION_SELECT = {
  id: true,
  currentBid: true,
  buyoutPrice: true,
  isFeatured: true,
  endTime: true,
  createdAt: true,
  sellerId: true,
  bidCount: true,
  card: { select: CARD_FACE_SELECT },
  CardOwnership: { select: COPY_FACE_SELECT },
} satisfies Prisma.CardAuctionSelect;

interface BrowseRead {
  viewerId: string;
  input: BrowseInput;
  take: number;
  now: Date;
}

async function listingItems(
  db: BrowseDb,
  { viewerId, input, take, now }: BrowseRead
): Promise<BrowseItem[]> {
  const rows = await db.cardListing.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: now },
      // A live listing's copy is locked, so it is there; a row without one is left out
      ownershipId: { not: null },
      ...cardFilter(input.filters),
      // The listing stored its copy's finish
      ...(input.filters.finish ? { finish: input.filters.finish } : {}),
    },
    select: LISTING_SELECT,
    orderBy: [{ isFeatured: "desc" }, LISTING_ORDER[input.sort], { id: "asc" }],
    take,
  });
  return rows.flatMap(({ ownership: copy, ...l }) =>
    copy
      ? [
          {
            kind: "listing" as const,
            id: l.id,
            price: l.price,
            isFeatured: l.isFeatured,
            endsAt: l.expiresAt,
            createdAt: l.createdAt,
            isMine: l.sellerId === viewerId,
            ownershipId: copy.id,
            bidCount: 0,
            buyoutPrice: null,
            face: toCardFace(l.card, { revealArt: true, copy }),
          },
        ]
      : []
  );
}

async function auctionItems(
  db: BrowseDb,
  { viewerId, input, take, now }: BrowseRead
): Promise<BrowseItem[]> {
  const rows = await db.cardAuction.findMany({
    where: {
      status: "ACTIVE",
      endTime: { gt: now },
      cardInstanceId: { not: null },
      ...cardFilter(input.filters),
      ...(input.filters.finish ? { CardOwnership: { finish: input.filters.finish } } : {}),
    },
    select: AUCTION_SELECT,
    orderBy: [{ isFeatured: "desc" }, AUCTION_ORDER[input.sort], { id: "asc" }],
    take,
  });
  return rows.flatMap(({ CardOwnership: copy, ...a }) =>
    copy
      ? [
          {
            kind: "auction" as const,
            id: a.id,
            // An auction's current bid starts at its starting price
            price: a.currentBid,
            isFeatured: a.isFeatured,
            endsAt: a.endTime,
            createdAt: a.createdAt,
            isMine: a.sellerId === viewerId,
            ownershipId: copy.id,
            bidCount: a.bidCount,
            buyoutPrice: a.buyoutPrice,
            face: toCardFace(a.card, { revealArt: true, copy }),
          },
        ]
      : []
  );
}

export async function browseMarket(
  db: BrowseDb,
  viewerId: string,
  input: BrowseInput,
  now: Date = new Date()
): Promise<{ items: BrowseItem[]; hasMore: boolean }> {
  const offset = Math.min(input.offset, MAX_BROWSE_OFFSET);
  // Each source's first offset + limit + 1 in the merged order hold the page and whether more follow
  const read: BrowseRead = { viewerId, input, take: offset + input.limit + 1, now };
  const [listings, auctions] = await Promise.all([
    input.kind === "auctions" ? [] : listingItems(db, read),
    input.kind === "listings" ? [] : auctionItems(db, read),
  ]);
  const window = [...listings, ...auctions]
    .sort(compareBrowse(input.sort))
    .slice(offset, offset + input.limit + 1);
  return { items: window.slice(0, input.limit), hasMore: window.length > input.limit };
}
