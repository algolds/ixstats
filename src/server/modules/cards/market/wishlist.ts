/**
 * The wishlist (spec §2.3 Wishlist): `CardWatchlist` rows, one per player and card. A trade partner sees it while
 * building a trade with the player; everyone else sees only anonymous totals (the sheet's "wanted by", Explore's
 * most-wanted shelves). Nothing is sent when a wished card goes on sale.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { CardFaceData } from "~/lib/cards/face/types";
import { facesFor } from "~/lib/cards/hub/art-visibility";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import { CARD_FACE_SELECT } from "~/lib/cards/hub/faces";

export const WISHLIST_MAX = 200;

type WatchlistDb = Pick<PrismaClient, "cardWatchlist">;
type ListDb = Pick<PrismaClient, "cardWatchlist" | "cardOwnership" | "cardListing" | "cardAuction">;

/** Wish for a card in the catalogue, or one the player holds; any other card answers as missing, so it leaks nothing. */
export async function addToWishlist(
  db: Pick<PrismaClient, "card" | "cardWatchlist">,
  userId: string,
  cardId: string
): Promise<void> {
  const card = await db.card.findFirst({
    where: { id: cardId, OR: [CATALOGUE_WHERE, { CardOwnership: { some: { ownerId: userId } } }] },
    select: { isBound: true },
  });
  if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
  if (card.isBound) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Bound cards can't be traded, so they can't be wished for.",
    });
  }
  // This card is left out of the count, so wishing again for one already on a full wishlist is a no-op.
  const others = await db.cardWatchlist.count({ where: { userId, cardId: { not: cardId } } });
  if (others >= WISHLIST_MAX) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Your wishlist holds ${WISHLIST_MAX} cards. Remove one first.`,
    });
  }
  await db.cardWatchlist.upsert({
    where: { userId_cardId: { userId, cardId } },
    create: { userId, cardId },
    update: {},
  });
}

export async function removeFromWishlist(
  db: WatchlistDb,
  userId: string,
  cardId: string
): Promise<void> {
  await db.cardWatchlist.deleteMany({ where: { userId, cardId } });
}

export async function wishlistCardIds(db: WatchlistDb, userId: string): Promise<Set<string>> {
  const rows = await db.cardWatchlist.findMany({ where: { userId }, select: { cardId: true } });
  return new Set(rows.map((r) => r.cardId));
}

export interface WishlistEntry {
  /** Art only for cards the player holds or that are on sale (the silhouette rule). */
  face: CardFaceData;
  addedAt: Date;
  /** Copies the player already holds. */
  owned: number;
  /** Live fixed-price listings, and the cheapest of them. */
  listings: number;
  lowestPrice: number | null;
  /** Live auctions. */
  auctions: number;
}

export async function listWishlist(
  db: ListDb,
  userId: string,
  now: Date = new Date()
): Promise<WishlistEntry[]> {
  const rows = await db.cardWatchlist.findMany({
    where: { userId },
    select: { cardId: true, createdAt: true, card: { select: CARD_FACE_SELECT } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: WISHLIST_MAX,
  });
  if (rows.length === 0) return [];
  const cardIds = rows.map((r) => r.cardId);
  const [faces, owned, listings, auctions] = await Promise.all([
    facesFor(
      db,
      userId,
      rows.map((r) => ({ card: r.card }))
    ),
    db.cardOwnership.groupBy({
      by: ["cardId"],
      where: { ownerId: userId, cardId: { in: cardIds } },
      _count: { _all: true },
    }),
    db.cardListing.groupBy({
      by: ["cardId"],
      where: { cardId: { in: cardIds }, status: "ACTIVE", expiresAt: { gt: now } },
      _count: { _all: true },
      _min: { price: true },
    }),
    // The auction's own card, which it keeps when an ended auction outlives its copy
    db.cardAuction.groupBy({
      by: ["cardId"],
      where: { cardId: { in: cardIds }, status: "ACTIVE", endTime: { gt: now } },
      _count: { _all: true },
    }),
  ]);
  const ownedBy = new Map(owned.map((o) => [o.cardId, o._count._all]));
  const listingBy = new Map(listings.map((l) => [l.cardId, l]));
  const auctionsBy = new Map(auctions.map((a) => [a.cardId, a._count._all]));
  // `facesFor` keeps the order and length of its sources.
  return rows.map((r, i) => ({
    face: faces[i],
    addedAt: r.createdAt,
    owned: ownedBy.get(r.cardId) ?? 0,
    listings: listingBy.get(r.cardId)?._count._all ?? 0,
    lowestPrice: listingBy.get(r.cardId)?._min.price ?? null,
    auctions: auctionsBy.get(r.cardId) ?? 0,
  }));
}
