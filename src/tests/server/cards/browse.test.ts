/** @jest-environment node */
/**
 * Market › Browse: live listings and auctions in one list, featured first, then the chosen sort. Each source is read in
 * the merged order, so a page is exact; a live item shows its art to everyone and says whether it is the viewer's.
 */
import type { CardFaceData } from "~/lib/cards/face/types";
import {
  BROWSE_SORTS,
  browseMarket,
  compareBrowse,
  MAX_BROWSE_OFFSET,
  type BrowseInput,
  type BrowseItem,
} from "~/server/modules/cards/market/browse";

const NOW = new Date("2026-11-02T12:00:00Z");
const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
/** A card row as `CARD_FACE_SELECT` reads it. */
const card = {
  id: "c",
  title: "Aurelia",
  rarity: "RARE",
  cardType: "LORE",
  artwork: "https://x/a.png",
  isRetired: false,
  collectorNumber: 4,
  season: 1,
  nsSeason: null,
  realm,
} as const;
const face = { cardId: "c", title: "Aurelia" } as CardFaceData;
const item = (over: Partial<BrowseItem>): BrowseItem => ({
  kind: "listing",
  id: "x",
  price: 100,
  isFeatured: false,
  endsAt: NOW,
  createdAt: NOW,
  isMine: false,
  ownershipId: "o",
  bidCount: 0,
  buyoutPrice: null,
  face,
  ...over,
});

const listingRow = (over: object = {}) => ({
  id: "l1",
  price: 120,
  isFeatured: false,
  expiresAt: NOW,
  createdAt: NOW,
  sellerId: "s",
  card,
  ownership: { id: "o1", finish: "FOIL", serialNumber: 3, level: 1 },
  ...over,
});
const auctionRow = (over: object = {}) => ({
  id: "a1",
  currentBid: 80,
  buyoutPrice: 300,
  isFeatured: false,
  endTime: NOW,
  createdAt: NOW,
  sellerId: "s",
  bidCount: 2,
  card,
  CardOwnership: { id: "o2", finish: "STANDARD", serialNumber: 9, level: 2 },
  ...over,
});

interface Read {
  where: object;
  orderBy: object[];
  take: number;
  select: object;
}

function makeDb(listings = [listingRow()], auctions = [auctionRow()]) {
  return {
    cardListing: { findMany: jest.fn(async (_read: Read) => listings) },
    cardAuction: { findMany: jest.fn(async (_read: Read) => auctions) },
  };
}

const input = (over: Partial<BrowseInput> = {}): BrowseInput => ({
  kind: "all",
  sort: "price_low",
  filters: {},
  limit: 24,
  offset: 0,
  ...over,
});

describe("compareBrowse", () => {
  it("puts featured items first, then the chosen sort", () => {
    const items = [
      item({ id: "cheap", price: 50 }),
      item({ id: "featured", price: 900, isFeatured: true }),
      item({ id: "mid", price: 300, kind: "auction" }),
    ];
    expect(items.sort(compareBrowse("price_low")).map((i) => i.id)).toEqual([
      "featured",
      "cheap",
      "mid",
    ]);
    expect(items.sort(compareBrowse("price_high")).map((i) => i.id)).toEqual([
      "featured",
      "mid",
      "cheap",
    ]);
  });

  it("sorts ending soon by when the item ends, and newest by when it was listed", () => {
    const later = item({ id: "later", endsAt: new Date(NOW.getTime() + 9e6), createdAt: NOW });
    const soon = item({
      id: "soon",
      endsAt: new Date(NOW.getTime() + 1e6),
      createdAt: new Date(NOW.getTime() - 1),
    });
    expect([later, soon].sort(compareBrowse("ending_soon")).map((i) => i.id)).toEqual([
      "soon",
      "later",
    ]);
    expect([soon, later].sort(compareBrowse("newest")).map((i) => i.id)).toEqual(["later", "soon"]);
  });

  it("breaks a tie by id, as each source's read does", () => {
    const tied = [item({ id: "b" }), item({ id: "c", kind: "auction" }), item({ id: "a" })];
    expect(tied.sort(compareBrowse("price_low")).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("browseMarket", () => {
  it("merges listings and auctions into one page and says whether more follow", async () => {
    const db = makeDb();
    const page = await browseMarket(
      db as never,
      "s",
      input({ filters: { rarity: "RARE" }, limit: 1 }),
      NOW
    );
    expect(page.items.map((i) => [i.kind, i.id, i.price])).toEqual([["auction", "a1", 80]]);
    // A live item shows its art to every viewer (spec §2.3 Discovery)
    expect(page.items[0]!.face).toMatchObject({
      cardId: "c",
      silhouette: false,
      artwork: "https://x/a.png",
      copy: { ownershipId: "o2", serialNumber: 9, finish: "STANDARD", level: 2 },
    });
    expect(page.items[0]).toMatchObject({
      isMine: true,
      ownershipId: "o2",
      bidCount: 2,
      buyoutPrice: 300,
      endsAt: NOW,
      createdAt: NOW,
    });
    expect(page.hasMore).toBe(true);

    // offset 0 + limit 1 + 1 from each source
    const [listingRead] = db.cardListing.findMany.mock.calls[0]!;
    expect(listingRead.take).toBe(2);
    expect(listingRead.where).toEqual({
      status: "ACTIVE",
      expiresAt: { gt: NOW },
      ownershipId: { not: null },
      card: { rarity: "RARE" },
    });
    const [auctionRead] = db.cardAuction.findMany.mock.calls[0]!;
    expect(auctionRead.take).toBe(2);
    expect(auctionRead.where).toEqual({
      status: "ACTIVE",
      endTime: { gt: NOW },
      cardInstanceId: { not: null },
      card: { rarity: "RARE" },
    });
  });

  it("gives a listing's price, end and copy, with no bids or buyout", async () => {
    const page = await browseMarket(makeDb([listingRow()], []) as never, "viewer", input(), NOW);
    expect(page.items).toEqual([
      {
        kind: "listing",
        id: "l1",
        price: 120,
        isFeatured: false,
        endsAt: NOW,
        createdAt: NOW,
        isMine: false,
        ownershipId: "o1",
        bidCount: 0,
        buyoutPrice: null,
        face: expect.objectContaining({
          silhouette: false,
          copy: { ownershipId: "o1", finish: "FOIL", serialNumber: 3, level: 1 },
        }),
      },
    ]);
    expect(page.hasMore).toBe(false);
  });

  it("marks the viewer's own listing and auction, and no one else's", async () => {
    const db = makeDb(
      [listingRow({ id: "mine_l", sellerId: "me" }), listingRow({ id: "their_l" })],
      [auctionRow({ id: "mine_a", sellerId: "me" }), auctionRow({ id: "their_a" })]
    );
    const page = await browseMarket(db as never, "me", input(), NOW);
    const mine = Object.fromEntries(page.items.map((i) => [i.id, i.isMine]));
    expect(mine).toEqual({ mine_l: true, their_l: false, mine_a: true, their_a: false });
  });

  it("says nothing more follows a page that ends exactly at the limit", async () => {
    const db = makeDb([listingRow({ id: "l1" }), listingRow({ id: "l2" })], []);
    const page = await browseMarket(db as never, "v", input({ limit: 2 }), NOW);
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it("reads each source in the merged order: featured, the sort, then id", async () => {
    const db = makeDb();
    await browseMarket(db as never, "v", input({ sort: "ending_soon" }), NOW);
    expect(db.cardListing.findMany.mock.calls[0]![0].orderBy).toEqual([
      { isFeatured: "desc" },
      { expiresAt: "asc" },
      { id: "asc" },
    ]);
    expect(db.cardAuction.findMany.mock.calls[0]![0].orderBy).toEqual([
      { isFeatured: "desc" },
      { endTime: "asc" },
      { id: "asc" },
    ]);
    for (const sort of BROWSE_SORTS) {
      const each = makeDb();
      await browseMarket(each as never, "v", input({ sort }), NOW);
      const listingOrder = each.cardListing.findMany.mock.calls[0]![0].orderBy;
      const auctionOrder = each.cardAuction.findMany.mock.calls[0]![0].orderBy;
      expect(listingOrder).toHaveLength(3);
      expect(auctionOrder).toHaveLength(3);
    }
    const priced = makeDb();
    await browseMarket(priced as never, "v", input({ sort: "price_high" }), NOW);
    expect(priced.cardListing.findMany.mock.calls[0]![0].orderBy[1]).toEqual({ price: "desc" });
    expect(priced.cardAuction.findMany.mock.calls[0]![0].orderBy[1]).toEqual({
      currentBid: "desc",
    });
    const newest = makeDb();
    await browseMarket(newest as never, "v", input({ sort: "newest" }), NOW);
    expect(newest.cardListing.findMany.mock.calls[0]![0].orderBy[1]).toEqual({
      createdAt: "desc",
    });
    expect(newest.cardAuction.findMany.mock.calls[0]![0].orderBy[1]).toEqual({
      createdAt: "desc",
    });
  });

  it("filters both sources by card, finish and an escaped title search", async () => {
    const db = makeDb();
    await browseMarket(
      db as never,
      "v",
      input({
        filters: {
          realmId: "r1",
          cardType: "NS",
          cardId: "c9",
          finish: "HOLO",
          search: "50%_off",
        },
      }),
      NOW
    );
    const cards = {
      realmId: "r1",
      cardType: "NS",
      id: "c9",
      title: { contains: "50\\%\\_off", mode: "insensitive" },
    };
    expect(db.cardListing.findMany.mock.calls[0]![0].where).toEqual({
      status: "ACTIVE",
      expiresAt: { gt: NOW },
      ownershipId: { not: null },
      card: cards,
      // The listing stored its copy's finish
      finish: "HOLO",
    });
    expect(db.cardAuction.findMany.mock.calls[0]![0].where).toEqual({
      status: "ACTIVE",
      endTime: { gt: NOW },
      cardInstanceId: { not: null },
      card: cards,
      CardOwnership: { finish: "HOLO" },
    });
  });

  it("reads only the kind asked for", async () => {
    const listingsOnly = makeDb();
    await browseMarket(listingsOnly as never, "v", input({ kind: "listings" }), NOW);
    expect(listingsOnly.cardAuction.findMany).not.toHaveBeenCalled();
    expect(listingsOnly.cardListing.findMany).toHaveBeenCalledTimes(1);

    const auctionsOnly = makeDb();
    await browseMarket(auctionsOnly as never, "v", input({ kind: "auctions" }), NOW);
    expect(auctionsOnly.cardListing.findMany).not.toHaveBeenCalled();
    expect(auctionsOnly.cardAuction.findMany).toHaveBeenCalledTimes(1);
  });

  it("pages through the merged list, never past the offset cap", async () => {
    const listings = [10, 30, 50].map((price, i) => listingRow({ id: `l${i}`, price }));
    const auctions = [20, 40].map((currentBid, i) => auctionRow({ id: `a${i}`, currentBid }));
    const db = makeDb(listings, auctions);
    const page = await browseMarket(db as never, "v", input({ limit: 2, offset: 2 }), NOW);
    expect(page.items.map((i) => i.price)).toEqual([30, 40]);
    expect(page.hasMore).toBe(true);
    expect(db.cardListing.findMany.mock.calls[0]![0].take).toBe(5);

    const last = await browseMarket(
      makeDb(listings, auctions) as never,
      "v",
      input({ limit: 2, offset: 4 }),
      NOW
    );
    expect(last.items.map((i) => i.price)).toEqual([50]);
    expect(last.hasMore).toBe(false);

    const deep = makeDb([], []);
    await browseMarket(deep as never, "v", input({ limit: 10, offset: 9999 }), NOW);
    expect(deep.cardListing.findMany.mock.calls[0]![0].take).toBe(MAX_BROWSE_OFFSET + 10 + 1);
  });

  it("selects only what a face shows from the copy", async () => {
    const db = makeDb();
    await browseMarket(db as never, "v", input(), NOW);
    expect(db.cardListing.findMany.mock.calls[0]![0].select).toMatchObject({
      ownership: { select: { id: true, finish: true, serialNumber: true, level: true } },
    });
    expect(db.cardAuction.findMany.mock.calls[0]![0].select).toMatchObject({
      CardOwnership: { select: { id: true, finish: true, serialNumber: true, level: true } },
    });
  });

  it("leaves out a row whose copy is gone", async () => {
    const page = await browseMarket(
      makeDb([listingRow({ ownership: null })], [auctionRow({ CardOwnership: null })]) as never,
      "v",
      input(),
      NOW
    );
    expect(page.items).toEqual([]);
  });
});
