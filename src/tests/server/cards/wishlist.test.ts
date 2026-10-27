/** @jest-environment node */
/** The wishlist (spec §2.3 Wishlist): the player's own wished cards, with what is on sale for each. */
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import {
  addToWishlist,
  WISHLIST_MAX,
} from "~/server/modules/cards/market/wishlist";

const NOW = new Date("2026-11-02T12:00:00Z");
const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const card = (id: string, title: string) => ({
  id,
  title,
  rarity: "RARE",
  cardType: "LORE",
  artwork: `https://art/${id}.png`,
  isRetired: false,
  collectorNumber: 1,
  season: 1,
  nsSeason: null,
  realm,
});
const wish = (cardId: string, title: string, createdAt = NOW) => ({
  cardId,
  createdAt,
  card: card(cardId, title),
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
