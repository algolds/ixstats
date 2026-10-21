import {
  browseMarket,
  MAX_BROWSE_OFFSET,
  type BrowseInput,
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

/** `held`: the card ids the viewer holds a copy of. */
function makeDb(listings = [listingRow()], auctions = [auctionRow()], held: string[] = []) {
  return {
    cardListing: { findMany: jest.fn(async (_read: Read) => listings) },
    cardAuction: { findMany: jest.fn(async (_read: Read) => auctions) },
    cardOwnership: { findMany: jest.fn(async () => held.map((cardId) => ({ cardId }))) },
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
describe("browseMarket", () => {
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
});
