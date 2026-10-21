/** @jest-environment node */
/** The wishlist (spec §2.3 Wishlist): the player's own wished cards, with what is on sale for each. */
jest.mock("~/lib/cards/hub/art-visibility", () => ({
  facesFor: jest.fn(
    async (_db: object, _viewer: string, sources: Array<{ card: { id: string; title: string } }>) =>
      sources.map((s) => ({
        cardId: s.card.id,
        title: s.card.title,
        artwork: null,
        silhouette: true,
      }))
  ),
}));

import { facesFor } from "~/lib/cards/hub/art-visibility";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import { CARD_FACE_SELECT } from "~/lib/cards/hub/faces";
import {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
  wishlistCardIds,
  WISHLIST_MAX,
} from "~/server/modules/cards/market/wishlist";

const NOW = new Date("2026-11-02T12:00:00Z");
const EARLIER = new Date("2026-11-01T12:00:00Z");

const wish = (cardId: string, title: string, createdAt = NOW) => ({
  cardId,
  createdAt,
  card: { id: cardId, title },
});

function makeDb(card: { isBound: boolean } | null = { isBound: false }, size = 0) {
  return {
    card: { findFirst: jest.fn().mockResolvedValue(card) },
    cardWatchlist: {
      count: jest.fn().mockResolvedValue(size),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([wish("c1", "Aurelia")]),
    },
    cardOwnership: { groupBy: jest.fn().mockResolvedValue([]) },
    cardListing: {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ cardId: "c1", _count: { _all: 2 }, _min: { price: 140 } }]),
    },
    cardAuction: { groupBy: jest.fn().mockResolvedValue([{ cardId: "c1", _count: { _all: 1 } }]) },
  };
}

beforeEach(() => jest.clearAllMocks());

describe("addToWishlist", () => {
  it("holds 200 cards", () => {
    expect(WISHLIST_MAX).toBe(200);
  });

  it("adds a card once", async () => {
    const db = makeDb();
    await addToWishlist(db as never, "u1", "c1");
    expect(db.cardWatchlist.upsert).toHaveBeenCalledWith({
      where: { userId_cardId: { userId: "u1", cardId: "c1" } },
      create: { userId: "u1", cardId: "c1" },
      update: {},
    });
  });

  it("finds only a card in the catalogue or one the player holds, so a hidden card leaks nothing", async () => {
    const db = makeDb(null);
    await expect(addToWishlist(db as never, "u1", "c1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.card.findFirst).toHaveBeenCalledWith({
      where: {
        id: "c1",
        OR: [CATALOGUE_WHERE, { CardOwnership: { some: { ownerId: "u1" } } }],
      },
      select: { isBound: true },
    });
    expect(db.cardWatchlist.upsert).not.toHaveBeenCalled();
  });

  it("refuses a bound card, which can't be traded", async () => {
    const db = makeDb({ isBound: true });
    await expect(addToWishlist(db as never, "u1", "c1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(db.cardWatchlist.upsert).not.toHaveBeenCalled();
  });

  it("refuses a new card on a full wishlist, counting the player's other wishes", async () => {
    const full = makeDb({ isBound: false }, WISHLIST_MAX);
    await expect(addToWishlist(full as never, "u1", "c1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Your wishlist holds 200 cards. Remove one first.",
    });
    expect(full.cardWatchlist.count).toHaveBeenCalledWith({
      where: { userId: "u1", cardId: { not: "c1" } },
    });
    expect(full.cardWatchlist.upsert).not.toHaveBeenCalled();

    // One short of the cap, or the cap with this card already on it (left out of the count), still adds.
    const roomForOne = makeDb({ isBound: false }, WISHLIST_MAX - 1);
    await addToWishlist(roomForOne as never, "u1", "c1");
    expect(roomForOne.cardWatchlist.upsert).toHaveBeenCalled();
  });
});

describe("removeFromWishlist", () => {
  it("removes the player's own wish only", async () => {
    const db = makeDb();
    await removeFromWishlist(db as never, "u1", "c1");
    expect(db.cardWatchlist.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", cardId: "c1" },
    });
  });
});

describe("wishlistCardIds", () => {
  it("is the set of the player's wished card ids", async () => {
    const db = makeDb();
    db.cardWatchlist.findMany.mockResolvedValue([{ cardId: "c1" }, { cardId: "c2" }]);
    expect(await wishlistCardIds(db as never, "u1")).toEqual(new Set(["c1", "c2"]));
    expect(db.cardWatchlist.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { cardId: true },
    });
  });
});

describe("listWishlist", () => {
  it("lists the wishlist with what is on sale now, and faces by the silhouette rule", async () => {
    const db = makeDb();
    expect(await listWishlist(db as never, "u1", NOW)).toEqual([
      {
        face: { cardId: "c1", title: "Aurelia", artwork: null, silhouette: true },
        addedAt: NOW,
        owned: 0,
        listings: 2,
        lowestPrice: 140,
        auctions: 1,
      },
    ]);
    expect(facesFor).toHaveBeenCalledWith(db, "u1", [{ card: { id: "c1", title: "Aurelia" } }]);
  });

  it("reads the player's own wishes, newest first, and only live listings and auctions", async () => {
    const db = makeDb();
    await listWishlist(db as never, "u1", NOW);
    expect(db.cardWatchlist.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { cardId: true, createdAt: true, card: { select: CARD_FACE_SELECT } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: WISHLIST_MAX,
    });
    expect(db.cardOwnership.groupBy).toHaveBeenCalledWith({
      by: ["cardId"],
      where: { ownerId: "u1", cardId: { in: ["c1"] } },
      _count: { _all: true },
    });
    expect(db.cardListing.groupBy).toHaveBeenCalledWith({
      by: ["cardId"],
      where: { cardId: { in: ["c1"] }, status: "ACTIVE", expiresAt: { gt: NOW } },
      _count: { _all: true },
      _min: { price: true },
    });
    // The auction's own card, which it keeps when an ended auction outlives its copy
    expect(db.cardAuction.groupBy).toHaveBeenCalledWith({
      by: ["cardId"],
      where: { cardId: { in: ["c1"] }, status: "ACTIVE", endTime: { gt: NOW } },
      _count: { _all: true },
    });
  });

  it("gives each wished card its own counts, and none for a card not on sale", async () => {
    const db = makeDb();
    db.cardWatchlist.findMany.mockResolvedValue([
      wish("c1", "Aurelia"),
      wish("c2", "Burgundie", EARLIER),
    ]);
    db.cardOwnership.groupBy.mockResolvedValue([{ cardId: "c2", _count: { _all: 3 } }]);
    expect(await listWishlist(db as never, "u1", NOW)).toEqual([
      expect.objectContaining({
        addedAt: NOW,
        owned: 0,
        listings: 2,
        lowestPrice: 140,
        auctions: 1,
      }),
      {
        face: { cardId: "c2", title: "Burgundie", artwork: null, silhouette: true },
        addedAt: EARLIER,
        owned: 3,
        listings: 0,
        lowestPrice: null,
        auctions: 0,
      },
    ]);
  });

  it("reads nothing more for an empty wishlist", async () => {
    const db = makeDb();
    db.cardWatchlist.findMany.mockResolvedValue([]);
    expect(await listWishlist(db as never, "u1", NOW)).toEqual([]);
    expect(facesFor).not.toHaveBeenCalled();
    expect(db.cardOwnership.groupBy).not.toHaveBeenCalled();
    expect(db.cardListing.groupBy).not.toHaveBeenCalled();
    expect(db.cardAuction.groupBy).not.toHaveBeenCalled();
  });

  it("reads live sales as of now by default", async () => {
    jest.useFakeTimers({ now: NOW });
    try {
      const db = makeDb();
      await listWishlist(db as never, "u1");
      expect(db.cardListing.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ expiresAt: { gt: NOW } }) })
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
