/** @jest-environment node */
/** The one card sheet (spec §2.3): the card, the viewer's copies with their trails, the market and the provenance. */
jest.mock("~/lib/cards/copy-value", () => ({
  loadCopyValues: jest.fn(),
  topCopiesByValue: jest.fn(),
}));

import { createMockPrisma } from "~/tests/helpers/mock-db";
import { loadCopyValues, topCopiesByValue, type CopyValueFilter } from "~/lib/cards/copy-value";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import { loadCardSheet } from "~/lib/cards/hub/sheet";
import type { HubPlayer } from "~/lib/cards/hub/players";

/** A sheet the test expects, never the signed-out "sign in" answer (that has its own cases). */
async function sheetFor(...args: Parameters<typeof loadCardSheet>) {
  const result = await loadCardSheet(...args);
  if (result && "signIn" in result) throw new Error("expected a sheet, got the sign-in answer");
  return result;
}

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const CARD = {
  id: "c1",
  title: "Caphiria",
  rarity: "EPIC",
  cardType: "LORE",
  artwork: "https://art/c1.png",
  isRetired: false,
  collectorNumber: 9,
  season: 1,
  nsSeason: null,
  nsCardId: null,
  realm,
  isBound: false,
  category: "HISTORY",
  description: "An empire.",
  wikiSource: "ixwiki",
  wikiArticleTitle: "Caphiria",
  wikiExcerpt: "Caphiria is...",
  artworkCredit: "Map by Ann",
  artLicence: null,
  metadata: null,
  marketValue: 100,
};
const COPY = {
  id: "o1",
  finish: "FOIL",
  serialNumber: 3,
  level: 2,
  experience: 2400,
  acquiredAt: new Date("2026-10-01T00:00:00Z"),
  isLocked: false,
  inscription: "For the archive",
  inscribedAt: new Date("2026-10-02T00:00:00Z"),
  inscribedById: "u-signer",
  /** The signer's name, frozen when they signed. */
  inscribedName: "@sig",
};
/** A sale in the sales record (`card_transfer_events`, priced). */
const SALE = { price: 140, finish: "FOIL", createdAt: new Date("2026-09-01T00:00:00Z") };
/** A move of the viewer's copy. */
const TRADE = {
  id: "e1",
  ownershipId: "o1",
  action: "TRADE",
  fromUserId: "u-a",
  toUserId: "me",
  price: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};
/** The passport chain reversed: "Takatta Loa", a wiki name with no stored handle, names the owner. */
const holderOf = jest.fn(async (handle: string) => (handle === "Takatta Loa" ? "owner" : null));
/** Everyone named on the sheet, as the identity rule names them; each shows their Vault cards unless a test says otherwise. */
const PLAYERS = new Map<string, HubPlayer>([
  ["u-a", { name: "@ann", showsVault: true }],
  ["me", { name: "@max", showsVault: true }],
  ["u-signer", { name: "@sig", showsVault: true }],
]);
const playersOf = jest.fn(async (_ids: readonly string[]) => PLAYERS);
/** Another player's public showcase that holds a copy of the card that is not retired. */
const SHOWCASE = { userId: "owner", items: [{ id: "i1" }] };
/** The same showcase when the card is retired: getShowcase lists its copy to the owner only. */
const RETIRED_SHOWCASE = { userId: "owner", items: [] };
const rules = { vaultVisible: jest.fn(async () => true), holderOf, playersOf };
const hidden = { vaultVisible: jest.fn(async () => false), holderOf, playersOf };

function setup({
  card = CARD as object,
  copies = [COPY] as object[],
  auctions = [] as object[],
  fixed = [] as object[],
  sold = [SALE] as object[],
  trail = [TRADE] as object[],
  catalogued = 1,
} = {}) {
  const db = createMockPrisma();
  db.card.findUnique.mockResolvedValue(card);
  db.card.count.mockResolvedValue(catalogued);
  db.cardOwnership.findMany.mockResolvedValue(copies);
  db.cardAuction.findMany.mockResolvedValue(auctions);
  db.cardListing.findMany.mockResolvedValue(fixed);
  // The copies' trail reads by copy; the sales record by card
  db.cardTransferEvent.findMany.mockImplementation(
    async (args: { where: { ownershipId?: object } }) => (args.where.ownershipId ? trail : sold)
  );
  db.cardWatchlist.count.mockResolvedValue(12);
  return db;
}

type EventRead = { where: { ownershipId?: object; cardId?: string } };
const eventReads = (db: ReturnType<typeof setup>) =>
  db.cardTransferEvent.findMany.mock.calls.map((c: [EventRead]) => c[0]);
/** The reads of the viewer's copies' trails. */
const trailReads = (db: ReturnType<typeof setup>) =>
  eventReads(db).filter((args: EventRead) => args.where.ownershipId !== undefined);
/** The reads of the card's sales record. */
const salesReads = (db: ReturnType<typeof setup>) =>
  eventReads(db).filter((args: EventRead) => args.where.cardId !== undefined);

/** A live auction of another player's copy, two bids in. */
const LISTING = {
  id: "a1",
  currentBid: 50,
  startingPrice: 20,
  buyoutPrice: null,
  endTime: new Date("2030-01-01T00:00:00Z"),
  bidCount: 2,
  sellerId: "u-a",
  serialNumber: 5,
  CardOwnership: {
    id: "o5",
    finish: "STANDARD",
    inscription: null,
    inscribedById: null,
    inscribedName: null,
  },
};
/** A live fixed-price listing of another player's signed copy; the serial and finish are the listing's own. */
const FIXED = {
  id: "l1",
  price: 140,
  expiresAt: new Date("2030-02-01T00:00:00Z"),
  sellerId: "u-a",
  serialNumber: 7,
  finish: "FOIL",
  ownership: { id: "o7", inscription: "gg", inscribedById: "u-signer", inscribedName: "@sig" },
};

/** The shared copy value: each copy asked for is worth `worth[id]`, else 120. */
function copyValues(worth: Record<string, number> = {}) {
  jest.mocked(loadCopyValues).mockImplementation(async (_db, filter: CopyValueFilter) =>
    (filter.ownershipIds ?? []).map((ownershipId) => ({
      ownershipId,
      ownerId: "me",
      cardId: "c1",
      cardType: "LORE" as const,
      finish: "FOIL" as const,
      value: worth[ownershipId] ?? 120,
    }))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  copyValues();
  jest.mocked(topCopiesByValue).mockResolvedValue([]);
});

describe("loadCardSheet", () => {
  it("shows the art to a holder, with each copy's trail and signer by passport handle", async () => {
    const db = setup();
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face).toMatchObject({
      artwork: "https://art/c1.png",
      silhouette: false,
      copy: { ownershipId: "o1" },
    });
    expect(sheet!.copies).toEqual([
      {
        face: expect.objectContaining({
          artwork: "https://art/c1.png",
          copy: { ownershipId: "o1", finish: "FOIL", serialNumber: 3, level: 2 },
        }),
        experience: 2400,
        acquiredAt: COPY.acquiredAt,
        isLocked: false,
        inscription: { text: "For the archive", signerName: "@sig", signedAt: COPY.inscribedAt },
        trail: [
          {
            id: "e1",
            action: "TRADE",
            from: { name: "@ann" },
            to: { name: "@max" },
            price: null,
            at: new Date("2026-10-01T00:00:00Z"),
          },
        ],
      },
    ]);
    expect(sheet!.signedIn).toBe(true);
    expect(sheet!.card).toEqual({
      id: "c1",
      title: "Caphiria",
      cardType: "LORE",
      rarity: "EPIC",
      isBound: false,
      isRetired: false,
      category: "HISTORY",
      description: "An empire.",
      wikiSource: "ixwiki",
      wikiArticleTitle: "Caphiria",
      excerpt: "Caphiria is...",
      author: null,
      descriptionUrl: null,
      artCredit: { line: "Map by Ann", licence: null, sourceUrl: null },
      ns: null,
      value: 120,
    });
    expect(jest.mocked(loadCopyValues)).toHaveBeenCalledWith(db, { ownershipIds: ["o1"] });
    expect(sheet!.market).toEqual({
      listings: [],
      recentSales: [{ price: 140, finish: "FOIL", at: SALE.createdAt }],
      wantedBy: 12,
    });
  });

  it("reads the viewer's own copies, the approved catalogue, the card's sales and its watchers", async () => {
    const db = setup();
    await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(db.card.findUnique.mock.calls[0]![0]).toMatchObject({ where: { id: "c1" } });
    expect(db.card.count).toHaveBeenCalledWith({ where: { id: "c1", ...CATALOGUE_WHERE } });
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({
      where: { cardId: "c1", ownerId: "me" },
      orderBy: { serialNumber: "asc" },
      take: 50,
    });
    expect(db.cardAuction.findMany).toHaveBeenCalledTimes(1);
    expect(db.cardAuction.findMany.mock.calls[0]![0]).toMatchObject({
      where: {
        status: "ACTIVE",
        endTime: { gt: expect.any(Date) },
        CardOwnership: { cardId: "c1" },
      },
      orderBy: [{ endTime: "asc" }, { id: "asc" }],
      take: 10,
    });
    // The sales record keeps the card's sales, a burned copy's included
    expect(salesReads(db)).toEqual([
      expect.objectContaining({
        where: {
          cardId: "c1",
          action: { in: ["AUCTION_END", "AUCTION_BUYOUT", "LISTING_SALE"] },
          price: { not: null },
        },
        take: 5,
      }),
    ]);
    expect(trailReads(db)[0]).toMatchObject({
      where: { ownershipId: { in: ["o1"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
    });
    // Everyone named, in one batch: the trail's players, then the signer.
    expect(playersOf).toHaveBeenCalledTimes(1);
    expect(playersOf).toHaveBeenCalledWith(["u-a", "me", "u-signer"]);
    expect(db.cardWatchlist.count).toHaveBeenCalledWith({ where: { cardId: "c1" } });
  });

  it("is a silhouette for a card the viewer does not hold and nobody lists, and asks for no trail", async () => {
    const db = setup({ copies: [] });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face).toMatchObject({ artwork: null, silhouette: true, copy: null });
    expect(sheet!.copies).toEqual([]);
    expect(trailReads(db)).toEqual([]);
    expect(playersOf).not.toHaveBeenCalled();
  });

  it("shows the art while the card is at auction, with each seller by passport handle", async () => {
    const mine = { ...LISTING, id: "a2", sellerId: "me", buyoutPrice: 300 };
    const db = setup({ copies: [], auctions: [LISTING, mine] });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face.silhouette).toBe(false);
    expect(sheet!.face.artwork).toBe("https://art/c1.png");
    const auction = {
      kind: "auction",
      id: "a1",
      ownershipId: "o5",
      price: 50,
      buyoutPrice: null,
      endsAt: LISTING.endTime,
      bidCount: 2,
      sellerName: "@ann",
      isMine: false,
      finish: "STANDARD",
      serialNumber: 5,
      inscription: null,
    };
    expect(sheet!.market.listings).toEqual([
      auction,
      { ...auction, id: "a2", buyoutPrice: 300, sellerName: "@max", isMine: true },
    ]);
    expect(playersOf).toHaveBeenCalledWith(["u-a", "me"]);
  });

  it("shows the art while the card is on a live fixed-price listing, to a visitor too", async () => {
    const db = setup({ copies: [], fixed: [FIXED] });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face).toMatchObject({ artwork: "https://art/c1.png", silhouette: false });
    const visitor = await sheetFor(setup({ copies: [], fixed: [FIXED] }) as never, null, "c1", {
      from: null,
      rules,
    });
    expect(visitor).toMatchObject({ face: { silhouette: false }, signedIn: false });
    expect(visitor!.market.listings[0]).toMatchObject({ id: "l1", isMine: false });
  });

  it("lists fixed-price listings first, cheapest first, then auctions, with each copy's inscription", async () => {
    const cheaper = {
      ...FIXED,
      id: "l0",
      price: 90,
      sellerId: "me",
      ownership: { ...FIXED.ownership, id: "o8", inscription: null },
    };
    const db = setup({ copies: [], fixed: [cheaper, FIXED], auctions: [LISTING] });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.market.listings).toEqual([
      expect.objectContaining({
        kind: "listing",
        id: "l0",
        ownershipId: "o8",
        price: 90,
        sellerName: "@max",
        isMine: true,
        inscription: null,
      }),
      {
        kind: "listing",
        id: "l1",
        ownershipId: "o7",
        price: 140,
        buyoutPrice: null,
        endsAt: FIXED.expiresAt,
        bidCount: 0,
        sellerName: "@ann",
        isMine: false,
        finish: "FOIL",
        serialNumber: 7,
        inscription: { text: "gg", signerName: "@sig" },
      },
      expect.objectContaining({ kind: "auction", id: "a1" }),
    ]);
    // Everyone named, in one batch: the sellers, then the listed copies' signers
    expect(playersOf).toHaveBeenCalledTimes(1);
    expect(playersOf).toHaveBeenCalledWith(["me", "u-a", "u-a", "u-signer", "u-signer"]);
  });

  it("reads live fixed-price listings cheapest first, with only the copy fields the signature rule needs", async () => {
    const db = setup({ copies: [] });
    await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(db.cardListing.findMany).toHaveBeenCalledTimes(1);
    expect(db.cardListing.findMany).toHaveBeenCalledWith({
      where: { cardId: "c1", status: "ACTIVE", expiresAt: { gt: expect.any(Date) } },
      orderBy: [{ price: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: 10,
      select: {
        id: true,
        price: true,
        expiresAt: true,
        sellerId: true,
        serialNumber: true,
        finish: true,
        ownership: {
          select: { id: true, inscription: true, inscribedById: true, inscribedName: true },
        },
      },
    });
    expect(db.cardAuction.findMany.mock.calls[0]![0].select).toEqual({
      id: true,
      currentBid: true,
      startingPrice: true,
      buyoutPrice: true,
      endTime: true,
      bidCount: true,
      sellerId: true,
      serialNumber: true,
      CardOwnership: {
        select: {
          id: true,
          finish: true,
          inscription: true,
          inscribedById: true,
          inscribedName: true,
        },
      },
    });
  });

  it("prices an auction with no bids yet at its starting price", async () => {
    const db = setup({ copies: [], auctions: [{ ...LISTING, bidCount: 0, currentBid: 0 }] });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.market.listings[0]).toMatchObject({ price: 20, bidCount: 0 });
  });

  it("signs a listed copy as it signs any copy: the frozen name, hidden with its signer", async () => {
    const auctioned = {
      ...LISTING,
      CardOwnership: { ...LISTING.CardOwnership, inscription: "old", inscribedById: "u-a" },
    };
    const db = setup({ copies: [], fixed: [FIXED], auctions: [auctioned] });
    playersOf.mockResolvedValueOnce(
      new Map([
        ["u-a", { name: "@ann", showsVault: true }],
        ["u-signer", { name: "@renamed", showsVault: false }],
      ])
    );
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    // A hidden signer is a player, though a name was frozen; an older signature reads its signer's name now
    expect(sheet!.market.listings.map((l) => l.inscription)).toEqual([
      { text: "gg", signerName: null },
      { text: "old", signerName: "@ann" },
    ]);
  });

  it("leaves out a listing whose copy is gone", async () => {
    const db = setup({
      copies: [],
      fixed: [{ ...FIXED, ownership: null }],
      auctions: [{ ...LISTING, CardOwnership: null }],
    });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.market.listings).toEqual([]);
  });

  it("shows the art inside an offer waiting on the viewer", async () => {
    const db = setup({ copies: [] });
    db.tradeOffer.findFirst.mockResolvedValue({ initiatorCardIds: ["o9"], recipientCardIds: [] });
    db.cardOwnership.count.mockResolvedValue(1);
    const sheet = await sheetFor(db as never, "me", "c1", {
      from: { kind: "offer", id: "t1" },
      rules,
    });
    expect(sheet!.face.silhouette).toBe(false);
    expect(db.tradeOffer.findFirst.mock.calls[0]![0]).toMatchObject({
      where: {
        id: "t1",
        status: "PENDING",
        proposerId: { not: "me" },
        OR: [{ initiatorId: "me" }, { recipientId: "me" }],
      },
    });
  });

  it("shows a holder's trophy opened through the passport handle they show", async () => {
    const db = setup({ copies: [] });
    db.cardOwnership.findFirst.mockResolvedValue({ id: "trophy-copy" });
    const sheet = await sheetFor(db as never, "me", "c1", {
      from: { kind: "holder", handle: "Takatta Loa" },
      rules,
    });
    expect(holderOf).toHaveBeenCalledWith("Takatta Loa");
    expect(rules.vaultVisible).toHaveBeenCalledWith("owner");
    expect(sheet!.face.silhouette).toBe(false);
  });

  it("keeps the silhouette when the place it was opened from does not show the card", async () => {
    const db = setup({ copies: [] });
    db.cardCollection.findFirst.mockResolvedValue(SHOWCASE);
    const sheet = await sheetFor(db as never, "me", "c1", {
      from: { kind: "showcase", id: "s1" },
      rules: hidden,
    });
    expect(hidden.vaultVisible).toHaveBeenCalledWith("owner");
    expect(sheet!.face).toMatchObject({ artwork: null, silhouette: true });
  });

  it("asks the opening place alongside the market reads, not before them", async () => {
    const db = setup({ copies: [] });
    let watchersRead!: () => void;
    const read = new Promise<void>((resolve) => (watchersRead = resolve));
    db.cardWatchlist.count.mockImplementation(async () => {
      watchersRead();
      return 12;
    });
    // Resolves only once the watcher count has been asked for, so a sequential read would never finish.
    db.tradeOffer.findFirst.mockImplementation(async () => {
      await read;
      return null;
    });
    const sheet = await sheetFor(db as never, "me", "c1", {
      from: { kind: "offer", id: "t1" },
      rules,
    });
    expect(sheet!.face.silhouette).toBe(true);
  });

  it("does not ask the opening place when the viewer already holds the card", async () => {
    const db = setup();
    await loadCardSheet(db as never, "me", "c1", { from: { kind: "offer", id: "t1" }, rules });
    expect(db.tradeOffer.findFirst).not.toHaveBeenCalled();
  });

  it("gives NationStates cards their provenance line", async () => {
    const db = setup({
      copies: [],
      card: {
        ...CARD,
        cardType: "NS",
        nsCardId: 42,
        nsSeason: 3,
        category: null,
        metadata: { nsData: { name: "Testlandia", region: "The Pacific" } },
      },
    });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card.ns).toMatchObject({
      nation: "Testlandia",
      season: 3,
      region: "The Pacific",
    });
    expect(sheet!.face.silhouette).toBe(false);
  });

  it("reads the recorded art licence, and the excerpt, author and file page older cards keep in metadata", async () => {
    const db = setup({
      card: {
        ...CARD,
        wikiExcerpt: null,
        artLicence: {
          fileTitle: "File:Map.png",
          licence: "CC BY-SA 4.0",
          artist: "Ann",
          attribution: null,
          descriptionUrl: "https://ixwiki.com/wiki/File:Map.png",
        },
        metadata: {
          fullExcerpt: "Older excerpt.",
          authorInfo: { displayAuthor: "Ann (Created)" },
          author: "ann",
          descriptionUrl: "https://commons.wikimedia.org/wiki/File:Map.png",
        },
      },
    });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card).toMatchObject({
      excerpt: "Older excerpt.",
      author: "Ann (Created)",
      descriptionUrl: "https://commons.wikimedia.org/wiki/File:Map.png",
      artCredit: {
        line: "Map.png by Ann, CC BY-SA 4.0",
        licence: "CC BY-SA 4.0",
        sourceUrl: "https://ixwiki.com/wiki/File:Map.png",
      },
    });
  });

  it.each([
    [{ author: "ann" }, "ann"],
    [{ authorInfo: { displayAuthor: " " }, author: "ann" }, "ann"],
    [{ authorInfo: "Ann", author: "ann" }, "ann"],
    [{ authorInfo: null, author: "ann" }, "ann"],
    [{ authorInfo: { displayAuthor: 7 } }, null],
    [["not", "an", "object"], null],
  ])("reads the author from %j as %p", async (metadata, author) => {
    const db = setup({ card: { ...CARD, metadata } });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card.author).toBe(author);
  });

  it("counts a blank excerpt column as missing and reads the older excerpt", async () => {
    const db = setup({ card: { ...CARD, wikiExcerpt: "  ", metadata: { fullExcerpt: "Older." } } });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card.excerpt).toBe("Older.");
  });

  it("points nowhere near the art on a silhouette, but keeps the article", async () => {
    const db = setup({
      copies: [],
      card: {
        ...CARD,
        artLicence: {
          fileTitle: "File:Map.png",
          licence: "CC BY-SA 4.0",
          artist: "Ann",
          attribution: null,
          descriptionUrl: "https://ixwiki.com/wiki/File:Map.png",
        },
        metadata: { descriptionUrl: "https://commons.wikimedia.org/wiki/File:Map.png" },
      },
    });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face.silhouette).toBe(true);
    expect(sheet!.card).toMatchObject({
      artCredit: null,
      descriptionUrl: null,
      wikiSource: "ixwiki",
      wikiArticleTitle: "Caphiria",
      excerpt: "Caphiria is...",
    });
  });

  it.each([[{ fullExcerpt: "  ", descriptionUrl: 3 }], [null]])(
    "has no excerpt or file page when neither the column nor the metadata %j holds one",
    async (metadata) => {
      const db = setup({ card: { ...CARD, wikiExcerpt: null, metadata } });
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card).toMatchObject({ excerpt: null, descriptionUrl: null });
    }
  );

  it("gives a retired card's holder no link to its art", async () => {
    const db = setup({
      catalogued: 0,
      card: {
        ...CARD,
        isRetired: true,
        artLicence: {
          fileTitle: "File:Map.png",
          licence: "CC BY-SA 4.0",
          artist: "Ann",
          attribution: null,
          descriptionUrl: "https://ixwiki.com/wiki/File:Map.png",
        },
        metadata: { descriptionUrl: "https://commons.wikimedia.org/wiki/File:Map.png" },
      },
    });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face).toMatchObject({ silhouette: false, artwork: null });
    expect(sheet!.card).toMatchObject({
      artCredit: null,
      descriptionUrl: null,
      wikiArticleTitle: "Caphiria",
    });
  });

  it("values a retired card at nothing and shows its placeholder face to its holder", async () => {
    const db = setup({ card: { ...CARD, isRetired: true }, catalogued: 0 });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card).toMatchObject({ isRetired: true, value: 0 });
    expect(sheet!.face).toMatchObject({
      artwork: null,
      isRetired: true,
      copy: { ownershipId: "o1" },
    });
    expect(sheet!.copies[0]!.face.artwork).toBeNull();
  });

  it("values the card at the viewer's best copy", async () => {
    copyValues({ o1: 120, o2: 300 });
    const db = setup({ copies: [COPY, { ...COPY, id: "o2", finish: "HOLO", serialNumber: 4 }] });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card.value).toBe(300);
    expect(jest.mocked(loadCopyValues)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(loadCopyValues)).toHaveBeenCalledWith(db, { ownershipIds: ["o1", "o2"] });
  });

  it("values a card the viewer holds no copy of at its own value", async () => {
    const db = setup({ copies: [], auctions: [LISTING] });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card.value).toBe(100);
  });

  it("keeps a removed copy's rows and a copy leaving every player out of the handle lookup", async () => {
    const db = setup({
      copies: [{ ...COPY, inscription: null, inscribedById: null }],
      trail: [
        {
          id: "e2",
          ownershipId: "o1",
          action: "PACK_OPEN",
          fromUserId: null,
          toUserId: "me",
          price: null,
          createdAt: new Date("2026-09-01T00:00:00Z"),
        },
        {
          id: "e3",
          ownershipId: null,
          action: "REVOKE",
          fromUserId: "u-a",
          toUserId: null,
          price: null,
          createdAt: new Date("2026-09-02T00:00:00Z"),
        },
        {
          id: "e4",
          ownershipId: "o1",
          action: "TRADE",
          fromUserId: "u-gone",
          toUserId: null,
          price: 5,
          createdAt: new Date("2026-09-03T00:00:00Z"),
        },
      ],
    });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(playersOf).toHaveBeenCalledWith(["me", "u-a", "u-gone"]);
    // A player who no longer exists is still a player; a side with nobody stays empty.
    expect(sheet!.copies[0]).toMatchObject({
      inscription: null,
      trail: [
        { id: "e2", from: null, to: { name: "@max" } },
        { id: "e4", from: { name: null }, to: null, price: 5 },
      ],
    });
  });

  it("gives each copy its own trail, and its own face", async () => {
    const second = { ...COPY, id: "o2", serialNumber: 7, finish: "STANDARD", inscription: null };
    const db = setup({
      copies: [COPY, second],
      trail: [
        {
          id: "e5",
          ownershipId: "o2",
          action: "DAILY_CLAIM",
          fromUserId: null,
          toUserId: "me",
          price: null,
          createdAt: new Date("2026-10-03T00:00:00Z"),
        },
        {
          id: "e1",
          ownershipId: "o1",
          action: "TRADE",
          fromUserId: "u-a",
          toUserId: "me",
          price: null,
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
      ],
    });
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(trailReads(db)[0]).toMatchObject({
      where: { ownershipId: { in: ["o1", "o2"] } },
    });
    expect(sheet!.face.copy).toMatchObject({ ownershipId: "o1" });
    expect(sheet!.copies.map((c) => [c.face.copy!.ownershipId, c.trail.map((e) => e.id)])).toEqual([
      ["o1", ["e1"]],
      ["o2", ["e5"]],
    ]);
  });

  it("leaves a signer it cannot find unnamed, and sales without a price out", async () => {
    const db = setup({ sold: [{ ...SALE, price: null }, SALE] });
    playersOf.mockResolvedValueOnce(new Map());
    const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.copies[0]!.inscription).toMatchObject({ signerName: null });
    expect(sheet!.market.recentSales).toEqual([{ price: 140, finish: "FOIL", at: SALE.createdAt }]);
  });

  describe("a card outside the catalogue", () => {
    const RETIRED = { ...CARD, isRetired: true };

    it("opens with no art from a pending offer to the viewer that holds a retired copy", async () => {
      const db = setup({ card: RETIRED, copies: [], catalogued: 0 });
      db.tradeOffer.findFirst.mockResolvedValue({ initiatorCardIds: ["o9"], recipientCardIds: [] });
      db.cardOwnership.count.mockResolvedValue(1);
      const sheet = await sheetFor(db as never, "me", "c1", {
        from: { kind: "offer", id: "t1" },
        rules,
      });
      expect(sheet!.face).toMatchObject({ artwork: null, isRetired: true, copy: null });
      expect(sheet!.card).toMatchObject({ isRetired: true, value: 0 });
    });

    it("opens with no art while a retired card is on a live listing", async () => {
      const db = setup({ card: RETIRED, copies: [], auctions: [LISTING], catalogued: 0 });
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.face).toMatchObject({ artwork: null, isRetired: true });
      expect(sheet!.market.listings).toMatchObject([{ kind: "auction", id: "a1" }]);
    });

    it("is null for a retired copy opened from another player's showcase, which lists it to its owner only", async () => {
      const db = setup({ card: RETIRED, copies: [], catalogued: 0 });
      db.cardCollection.findFirst.mockResolvedValue(RETIRED_SHOWCASE);
      await expect(
        loadCardSheet(db as never, "me", "c1", { from: { kind: "showcase", id: "s1" }, rules })
      ).resolves.toBeNull();
      expect(rules.vaultVisible).not.toHaveBeenCalled();
    });

    it("opens a retired copy's placeholder face, with no art, from the viewer's own showcase", async () => {
      const db = setup({ card: RETIRED, copies: [], catalogued: 0 });
      db.cardCollection.findFirst.mockResolvedValue(RETIRED_SHOWCASE);
      const sheet = await sheetFor(db as never, "owner", "c1", {
        from: { kind: "showcase", id: "s1" },
        rules,
      });
      expect(rules.vaultVisible).toHaveBeenCalledWith("owner");
      expect(sheet!.face).toMatchObject({ artwork: null, isRetired: true });
    });

    it("is null when the place it was opened from does not show it", async () => {
      // A card in review: outside the catalogue without being retired.
      const db = setup({ copies: [], catalogued: 0 });
      db.cardCollection.findFirst.mockResolvedValue(SHOWCASE);
      await expect(
        loadCardSheet(db as never, "me", "c1", {
          from: { kind: "showcase", id: "s1" },
          rules: hidden,
        })
      ).resolves.toBeNull();
    });
  });

  describe("naming players", () => {
    it("calls a player whose Passport hides Vault cards a player, in the trail, the signature and the listings", async () => {
      const db = setup({ auctions: [LISTING] });
      playersOf.mockResolvedValueOnce(
        new Map([
          ["u-a", { name: "@ann", showsVault: false }],
          ["me", { name: "@max", showsVault: true }],
          ["u-signer", { name: "@sig", showsVault: false }],
        ])
      );
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.copies[0]!.trail[0]).toMatchObject({
        from: { name: null },
        to: { name: "@max" },
      });
      expect(sheet!.copies[0]!.inscription).toMatchObject({ signerName: null });
      expect(sheet!.market.listings[0]).toMatchObject({ sellerName: null, isMine: false });
    });

    it("names each player as the identity rule does: a nation for a player with no handle, or nobody", async () => {
      // An older signature, with no name frozen, names its signer as they are named now
      const db = setup({ auctions: [LISTING], copies: [{ ...COPY, inscribedName: null }] });
      playersOf.mockResolvedValueOnce(
        new Map([
          ["u-a", { name: "Caphiria", showsVault: true }],
          ["me", { name: "@max", showsVault: true }],
          ["u-signer", { name: null, showsVault: true }],
        ])
      );
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.copies[0]!.trail[0]).toMatchObject({
        from: { name: "Caphiria" },
        to: { name: "@max" },
      });
      expect(sheet!.copies[0]!.inscription).toMatchObject({ signerName: null });
      expect(sheet!.market.listings[0]).toMatchObject({ sellerName: "Caphiria" });
    });

    it("always names the viewer to themselves", async () => {
      const db = setup({ auctions: [{ ...LISTING, sellerId: "me" }] });
      playersOf.mockResolvedValueOnce(
        new Map([
          ["u-a", { name: "@ann", showsVault: true }],
          ["me", { name: "@max", showsVault: false }],
        ])
      );
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.copies[0]!.trail[0]!.to).toEqual({ name: "@max" });
      expect(sheet!.market.listings[0]).toMatchObject({ sellerName: "@max", isMine: true });
    });
  });

  describe("the signature", () => {
    const signedBy = (signer: string | null, inscribedName: string | null) =>
      setup({ copies: [{ ...COPY, inscribedById: signer, inscribedName }] });
    const signerOf = async (db: ReturnType<typeof setup>, players: Map<string, HubPlayer>) => {
      playersOf.mockResolvedValueOnce(players);
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      return sheet!.copies[0]!.inscription!.signerName;
    };

    it("prints the name frozen at signing, though the signer is named otherwise now", async () => {
      const db = signedBy("u-signer", "@sig");
      await expect(
        signerOf(db, new Map([["u-signer", { name: "@newname", showsVault: true }]]))
      ).resolves.toBe("@sig");
      expect(db.cardOwnership.findMany.mock.calls[0]![0].select).toMatchObject({
        inscription: true,
        inscribedAt: true,
        inscribedById: true,
        inscribedName: true,
      });
      // The frozen name prints even when the signer has no name at all now
      await expect(
        signerOf(db, new Map([["u-signer", { name: null, showsVault: true }]]))
      ).resolves.toBe("@sig");
    });

    it("names an older signature, with no name frozen, by the signer's name now", async () => {
      await expect(
        signerOf(
          signedBy("u-signer", null),
          new Map([["u-signer", { name: "@now", showsVault: true }]])
        )
      ).resolves.toBe("@now");
    });

    it("hides the frozen name while the signer's Passport hides Vault cards, or once they are gone", async () => {
      const db = signedBy("u-signer", "@sig");
      await expect(
        signerOf(db, new Map([["u-signer", { name: "@sig", showsVault: false }]]))
      ).resolves.toBeNull();
      // The viewer showing their Vault cards does not show someone else's name
      await expect(
        signerOf(
          db,
          new Map([
            ["me", { name: "@max", showsVault: true }],
            ["u-signer", { name: "@sig", showsVault: false }],
          ])
        )
      ).resolves.toBeNull();
      await expect(signerOf(db, new Map())).resolves.toBeNull();
    });

    it("names no signer for a signature with none recorded, frozen name or not", async () => {
      await expect(
        signerOf(signedBy(null, "@sig"), new Map([["me", { name: "@max", showsVault: true }]]))
      ).resolves.toBeNull();
    });

    it("always shows the viewer their own signature", async () => {
      await expect(
        signerOf(signedBy("me", "@max"), new Map([["me", { name: "@renamed", showsVault: false }]]))
      ).resolves.toBe("@max");
    });
  });

  describe("a signed-out visitor", () => {
    /** Every copy read is the holder's, never a viewer's. */
    const copyReads = (db: ReturnType<typeof setup>) =>
      db.cardOwnership.findMany.mock.calls.map((call: [{ where: object }]) => call[0].where);

    it("sees a card on a live listing with its art, and no copies of their own", async () => {
      const db = setup({ copies: [], auctions: [LISTING] });
      const sheet = await sheetFor(db as never, null, "c1", { from: null, rules });
      expect(sheet).toMatchObject({
        face: { artwork: "https://art/c1.png", silhouette: false, copy: null },
        signedIn: false,
        copies: [],
        market: { listings: [{ kind: "auction", id: "a1", sellerName: "@ann", isMine: false }] },
      });
      expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
      expect(trailReads(db)).toEqual([]);
      expect(playersOf).toHaveBeenCalledWith(["u-a"]);
    });

    it("sees a card a holder displays, opened from their passport", async () => {
      const shownCopy = { id: "h1", finish: "STANDARD", serialNumber: 2, level: 1, cards: CARD };
      const db = setup({ copies: [shownCopy] });
      jest.mocked(topCopiesByValue).mockResolvedValue([
        {
          ownershipId: "h1",
          ownerId: "owner",
          cardId: "c1",
          cardType: "LORE",
          finish: "STANDARD",
          value: 100,
        },
      ]);
      const sheet = await sheetFor(db as never, null, "c1", {
        from: { kind: "holder", handle: "Takatta Loa" },
        rules,
      });
      expect(rules.vaultVisible).toHaveBeenCalledWith("owner");
      expect(sheet).toMatchObject({ face: { silhouette: false, copy: null }, copies: [] });
      expect(copyReads(db)).toEqual([expect.objectContaining({ ownerId: "owner" })]);
    });

    it("sees a public showcase's copy", async () => {
      const db = setup({ copies: [] });
      db.cardCollection.findFirst.mockResolvedValue(SHOWCASE);
      const sheet = await sheetFor(db as never, null, "c1", {
        from: { kind: "showcase", id: "s1" },
        rules,
      });
      expect(db.cardCollection.findFirst.mock.calls[0]![0]).toMatchObject({
        where: { id: "s1", isPublic: true },
      });
      expect(sheet).toMatchObject({ face: { silhouette: false }, signedIn: false });
    });

    it("is asked to sign in for a retired copy on a public showcase, which lists it to its owner only", async () => {
      const db = setup({ card: { ...CARD, isRetired: true }, copies: [], catalogued: 0 });
      db.cardCollection.findFirst.mockResolvedValue(RETIRED_SHOWCASE);
      await expect(
        loadCardSheet(db as never, null, "c1", { from: { kind: "showcase", id: "s1" }, rules })
      ).resolves.toEqual({ signIn: true });
      expect(rules.vaultVisible).not.toHaveBeenCalled();
    });

    it.each([
      ["a bare link", null],
      ["an offer", { kind: "offer" as const, id: "t1" }],
      ["a showcase its owner hides", { kind: "showcase" as const, id: "s1" }],
      ["a holder who does not show the card", { kind: "holder" as const, handle: "Nobody" }],
    ])("is asked to sign in for %s", async (_place, from) => {
      const db = setup({ copies: [] });
      db.cardCollection.findFirst.mockResolvedValue(SHOWCASE);
      db.tradeOffer.findFirst.mockResolvedValue({ initiatorCardIds: ["o9"], recipientCardIds: [] });
      db.cardOwnership.count.mockResolvedValue(1);
      await expect(
        loadCardSheet(db as never, null, "c1", { from, rules: hidden })
      ).resolves.toEqual({ signIn: true });
      expect(db.tradeOffer.findFirst).not.toHaveBeenCalled();
      expect(playersOf).not.toHaveBeenCalled();
    });

    it("is asked to sign in for a card that does not exist, which it cannot tell apart", async () => {
      const db = setup();
      db.card.findUnique.mockResolvedValue(null);
      await expect(
        loadCardSheet(db as never, null, "nope", { from: null, rules })
      ).resolves.toEqual({ signIn: true });
    });
  });

  describe("a silhouette names no art", () => {
    const WITH_FILES = {
      ...CARD,
      wikiExcerpt:
        "An empire. [[File:Caphiria.png|thumb|The flag]] See [[:File:Caphiria.png|the flag]].",
    };

    it("leaves the file links out of a silhouette's excerpt, as the client draws it", async () => {
      const db = setup({ card: WITH_FILES, copies: [] });
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card.excerpt).not.toMatch(/File:|Caphiria\.png/);
      expect(sheet!.card.excerpt).toMatch(/^An empire\. +See the flag\.$/);
    });

    it("leaves the file links out of a retired card's excerpt, even for its holder", async () => {
      const db = setup({ card: { ...WITH_FILES, isRetired: true }, catalogued: 0 });
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card.excerpt).not.toMatch(/File:/);
    });

    it("keeps a held card's excerpt as stored", async () => {
      const db = setup({ card: WITH_FILES });
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card.excerpt).toBe(WITH_FILES.wikiExcerpt);
    });

    it("gives a Commons silhouette no file title, and a held Commons card its title", async () => {
      const commons = {
        ...CARD,
        wikiSource: "commons",
        wikiArticleTitle: "File:Camilla Tuvalu Banner.png",
      };
      const silhouette = await sheetFor(setup({ card: commons, copies: [] }) as never, "me", "c1", {
        from: null,
        rules,
      });
      expect(silhouette!.card).toMatchObject({ wikiSource: "commons", wikiArticleTitle: null });
      const held = await sheetFor(setup({ card: commons }) as never, "me", "c1", {
        from: null,
        rules,
      });
      expect(held!.card.wikiArticleTitle).toBe("File:Camilla Tuvalu Banner.png");
    });
  });

  it("is null for an unknown card, and for one in review that the viewer does not hold", async () => {
    const missing = setup();
    missing.card.findUnique.mockResolvedValue(null);
    await expect(
      loadCardSheet(missing as never, "me", "nope", { from: null, rules })
    ).resolves.toBeNull();
    await expect(
      loadCardSheet(setup({ copies: [], catalogued: 0 }) as never, "me", "c1", {
        from: null,
        rules,
      })
    ).resolves.toBeNull();
    await expect(
      loadCardSheet(setup({ catalogued: 0 }) as never, "me", "c1", { from: null, rules })
    ).resolves.not.toBeNull();
  });
});
