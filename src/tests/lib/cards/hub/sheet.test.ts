/** @jest-environment node */
/** The one card sheet (spec §2.3): the card, the viewer's copies with their trails, the market and the provenance. */
jest.mock("~/lib/cards/copy-value", () => ({ copyValue: jest.fn(() => 120) }));

import { createMockPrisma } from "~/tests/helpers/mock-db";
import { copyValue } from "~/lib/cards/copy-value";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import { loadCardSheet } from "~/lib/cards/hub/sheet";

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
};
const SALE = { finalPrice: 140, endTime: new Date("2026-09-01T00:00:00Z") };
/** The passport chain reversed: "Takatta Loa", a wiki name with no stored handle, names the owner. */
const holderOf = jest.fn(async (handle: string) => (handle === "Takatta Loa" ? "owner" : null));
/** Everyone named on the sheet, by passport handle; each shows their Vault cards unless a test says otherwise. */
const PLAYERS = new Map([
  ["u-a", { handle: "ann", showsVault: true }],
  ["me", { handle: "max", showsVault: true }],
  ["u-signer", { handle: "sig", showsVault: true }],
]);
const playersOf = jest.fn(async (_ids: readonly string[]) => PLAYERS);
const rules = { vaultVisible: jest.fn(async () => true), holderOf, playersOf };
const hidden = { vaultVisible: jest.fn(async () => false), holderOf, playersOf };

function setup({
  card = CARD as object,
  copies = [COPY] as object[],
  listed = [] as object[],
  sold = [SALE] as object[],
  catalogued = 1,
} = {}) {
  const db = createMockPrisma();
  db.card.findUnique.mockResolvedValue(card);
  db.card.count.mockResolvedValue(catalogued);
  db.cardOwnership.findMany.mockResolvedValue(copies);
  db.cardAuction.findMany.mockImplementation(async (args: { where: { status: string } }) =>
    args.where.status === "ACTIVE" ? listed : sold
  );
  db.cardTransferEvent.findMany.mockResolvedValue([
    {
      id: "e1",
      ownershipId: "o1",
      action: "TRADE",
      fromUserId: "u-a",
      toUserId: "me",
      price: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
    },
  ]);
  db.cardWatchlist.count.mockResolvedValue(12);
  return db;
}

const LISTING = {
  id: "a1",
  currentBid: 50,
  buyoutPrice: null,
  endTime: new Date("2030-01-01T00:00:00Z"),
  bidCount: 2,
  sellerId: "u-a",
};

beforeEach(() => jest.clearAllMocks());

describe("loadCardSheet", () => {
  it("shows the art to a holder, with each copy's trail and signer by passport handle", async () => {
    const db = setup();
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
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
        inscription: { text: "For the archive", signerHandle: "sig", signedAt: COPY.inscribedAt },
        trail: [
          {
            id: "e1",
            action: "TRADE",
            from: { handle: "ann" },
            to: { handle: "max" },
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
    expect(copyValue).toHaveBeenCalledWith({ cards: CARD });
    expect(sheet!.market).toEqual({
      listings: [],
      recentSales: [{ price: 140, at: SALE.endTime }],
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
    const [listings, sales] = db.cardAuction.findMany.mock.calls.map((c: [object]) => c[0]);
    expect(listings).toMatchObject({
      where: {
        status: "ACTIVE",
        endTime: { gt: expect.any(Date) },
        CardOwnership: { cardId: "c1" },
      },
      orderBy: [{ endTime: "asc" }, { id: "asc" }],
      take: 10,
    });
    expect(sales).toMatchObject({
      where: { status: "COMPLETED", finalPrice: { not: null }, CardOwnership: { cardId: "c1" } },
      orderBy: [{ endTime: "desc" }, { id: "desc" }],
      take: 5,
    });
    expect(db.cardTransferEvent.findMany.mock.calls[0]![0]).toMatchObject({
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
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face).toMatchObject({ artwork: null, silhouette: true, copy: null });
    expect(sheet!.copies).toEqual([]);
    expect(db.cardTransferEvent.findMany).not.toHaveBeenCalled();
    expect(playersOf).not.toHaveBeenCalled();
  });

  it("shows the art while the card is on a live listing, with each seller by passport handle", async () => {
    const mine = { ...LISTING, id: "a2", sellerId: "me", buyoutPrice: 300 };
    const db = setup({ copies: [], listed: [LISTING, mine] });
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face.silhouette).toBe(false);
    expect(sheet!.face.artwork).toBe("https://art/c1.png");
    expect(sheet!.market.listings).toEqual([
      {
        auctionId: "a1",
        currentBid: 50,
        buyoutPrice: null,
        endTime: LISTING.endTime,
        bidCount: 2,
        sellerHandle: "ann",
        isMine: false,
      },
      {
        auctionId: "a2",
        currentBid: 50,
        buyoutPrice: 300,
        endTime: LISTING.endTime,
        bidCount: 2,
        sellerHandle: "max",
        isMine: true,
      },
    ]);
    expect(playersOf).toHaveBeenCalledWith(["u-a", "me"]);
  });

  it("shows the art inside an offer made to the viewer", async () => {
    const db = setup({ copies: [] });
    db.tradeOffer.findFirst.mockResolvedValue({ initiatorCardIds: ["o9"], recipientCardIds: [] });
    db.cardOwnership.count.mockResolvedValue(1);
    const sheet = await loadCardSheet(db as never, "me", "c1", {
      from: { kind: "offer", id: "t1" },
      rules,
    });
    expect(sheet!.face.silhouette).toBe(false);
    expect(db.tradeOffer.findFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: "t1", recipientId: "me", status: "PENDING" },
    });
  });

  it("shows a holder's trophy opened through the passport handle they show", async () => {
    const db = setup({ copies: [] });
    db.cardOwnership.findFirst.mockResolvedValue({ id: "trophy-copy" });
    const sheet = await loadCardSheet(db as never, "me", "c1", {
      from: { kind: "holder", handle: "Takatta Loa" },
      rules,
    });
    expect(holderOf).toHaveBeenCalledWith("Takatta Loa");
    expect(rules.vaultVisible).toHaveBeenCalledWith("owner");
    expect(sheet!.face.silhouette).toBe(false);
  });

  it("keeps the silhouette when the place it was opened from does not show the card", async () => {
    const db = setup({ copies: [] });
    db.cardCollection.findFirst.mockResolvedValue({ userId: "owner" });
    const sheet = await loadCardSheet(db as never, "me", "c1", {
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
    const sheet = await loadCardSheet(db as never, "me", "c1", {
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
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
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
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
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
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card.author).toBe(author);
  });

  it("counts a blank excerpt column as missing and reads the older excerpt", async () => {
    const db = setup({ card: { ...CARD, wikiExcerpt: "  ", metadata: { fullExcerpt: "Older." } } });
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
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
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
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
      const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
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
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.face).toMatchObject({ silhouette: false, artwork: null });
    expect(sheet!.card).toMatchObject({
      artCredit: null,
      descriptionUrl: null,
      wikiArticleTitle: "Caphiria",
    });
  });

  it("values a retired card at nothing and shows its placeholder face to its holder", async () => {
    const db = setup({ card: { ...CARD, isRetired: true }, catalogued: 0 });
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.card).toMatchObject({ isRetired: true, value: 0 });
    expect(sheet!.face).toMatchObject({
      artwork: null,
      isRetired: true,
      copy: { ownershipId: "o1" },
    });
    expect(sheet!.copies[0]!.face.artwork).toBeNull();
    expect(copyValue).not.toHaveBeenCalled();
  });

  it("keeps a removed copy's rows and a copy leaving every player out of the handle lookup", async () => {
    const db = setup({ copies: [{ ...COPY, inscription: null, inscribedById: null }] });
    db.cardTransferEvent.findMany.mockResolvedValue([
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
    ]);
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(playersOf).toHaveBeenCalledWith(["me", "u-a", "u-gone"]);
    // A player who no longer exists is still a player; a side with nobody stays empty.
    expect(sheet!.copies[0]).toMatchObject({
      inscription: null,
      trail: [
        { id: "e2", from: null, to: { handle: "max" } },
        { id: "e4", from: { handle: null }, to: null, price: 5 },
      ],
    });
  });

  it("gives each copy its own trail, and its own face", async () => {
    const second = { ...COPY, id: "o2", serialNumber: 7, finish: "STANDARD", inscription: null };
    const db = setup({ copies: [COPY, second] });
    db.cardTransferEvent.findMany.mockResolvedValue([
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
    ]);
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(db.cardTransferEvent.findMany.mock.calls[0]![0]).toMatchObject({
      where: { ownershipId: { in: ["o1", "o2"] } },
    });
    expect(sheet!.face.copy).toMatchObject({ ownershipId: "o1" });
    expect(sheet!.copies.map((c) => [c.face.copy!.ownershipId, c.trail.map((e) => e.id)])).toEqual([
      ["o1", ["e1"]],
      ["o2", ["e5"]],
    ]);
  });

  it("leaves a signer it cannot find unnamed, and sales without a price out", async () => {
    const db = setup({ sold: [{ finalPrice: null, endTime: SALE.endTime }, SALE] });
    playersOf.mockResolvedValueOnce(new Map());
    const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
    expect(sheet!.copies[0]!.inscription).toMatchObject({ signerHandle: null });
    expect(sheet!.market.recentSales).toEqual([{ price: 140, at: SALE.endTime }]);
  });

  describe("a card outside the catalogue", () => {
    const RETIRED = { ...CARD, isRetired: true };

    it("opens with no art from a pending offer to the viewer that holds a retired copy", async () => {
      const db = setup({ card: RETIRED, copies: [], catalogued: 0 });
      db.tradeOffer.findFirst.mockResolvedValue({ initiatorCardIds: ["o9"], recipientCardIds: [] });
      db.cardOwnership.count.mockResolvedValue(1);
      const sheet = await loadCardSheet(db as never, "me", "c1", {
        from: { kind: "offer", id: "t1" },
        rules,
      });
      expect(sheet!.face).toMatchObject({ artwork: null, isRetired: true, copy: null });
      expect(sheet!.card).toMatchObject({ isRetired: true, value: 0 });
    });

    it("opens with no art while a retired card is on a live listing", async () => {
      const db = setup({ card: RETIRED, copies: [], listed: [LISTING], catalogued: 0 });
      const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.face).toMatchObject({ artwork: null, isRetired: true });
      expect(sheet!.market.listings).toMatchObject([{ auctionId: "a1" }]);
    });

    it("opens a showcase's placeholder face with no art", async () => {
      const db = setup({ card: RETIRED, copies: [], catalogued: 0 });
      db.cardCollection.findFirst.mockResolvedValue({ userId: "owner" });
      const sheet = await loadCardSheet(db as never, "me", "c1", {
        from: { kind: "showcase", id: "s1" },
        rules,
      });
      expect(rules.vaultVisible).toHaveBeenCalledWith("owner");
      expect(sheet!.face).toMatchObject({ artwork: null, isRetired: true });
    });

    it("is null when the place it was opened from does not show it", async () => {
      const db = setup({ card: RETIRED, copies: [], catalogued: 0 });
      db.cardCollection.findFirst.mockResolvedValue({ userId: "owner" });
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
      const db = setup({ listed: [LISTING] });
      playersOf.mockResolvedValueOnce(
        new Map([
          ["u-a", { handle: "ann", showsVault: false }],
          ["me", { handle: "max", showsVault: true }],
          ["u-signer", { handle: "sig", showsVault: false }],
        ])
      );
      const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.copies[0]!.trail[0]).toMatchObject({
        from: { handle: null },
        to: { handle: "max" },
      });
      expect(sheet!.copies[0]!.inscription).toMatchObject({ signerHandle: null });
      expect(sheet!.market.listings[0]).toMatchObject({ sellerHandle: null, isMine: false });
    });

    it("always names the viewer to themselves", async () => {
      const db = setup({ listed: [{ ...LISTING, sellerId: "me" }] });
      playersOf.mockResolvedValueOnce(
        new Map([
          ["u-a", { handle: "ann", showsVault: true }],
          ["me", { handle: "max", showsVault: false }],
        ])
      );
      const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.copies[0]!.trail[0]!.to).toEqual({ handle: "max" });
      expect(sheet!.market.listings[0]).toMatchObject({ sellerHandle: "max", isMine: true });
    });
  });

  describe("a signed-out visitor", () => {
    /** Every copy read is the holder's, never a viewer's. */
    const copyReads = (db: ReturnType<typeof setup>) =>
      db.cardOwnership.findMany.mock.calls.map((call: [{ where: object }]) => call[0].where);

    it("sees a card on a live listing with its art, and no copies of their own", async () => {
      const db = setup({ copies: [], listed: [LISTING] });
      const sheet = await loadCardSheet(db as never, null, "c1", { from: null, rules });
      expect(sheet).toMatchObject({
        face: { artwork: "https://art/c1.png", silhouette: false, copy: null },
        signedIn: false,
        copies: [],
        market: { listings: [{ auctionId: "a1", sellerHandle: "ann", isMine: false }] },
      });
      expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
      expect(db.cardTransferEvent.findMany).not.toHaveBeenCalled();
      expect(playersOf).toHaveBeenCalledWith(["u-a"]);
    });

    it("sees a card a holder displays, opened from their passport", async () => {
      const shownCopy = { id: "h1", finish: "STANDARD", serialNumber: 2, level: 1, cards: CARD };
      const db = setup({ copies: [shownCopy] });
      const sheet = await loadCardSheet(db as never, null, "c1", {
        from: { kind: "holder", handle: "Takatta Loa" },
        rules,
      });
      expect(rules.vaultVisible).toHaveBeenCalledWith("owner");
      expect(sheet).toMatchObject({ face: { silhouette: false, copy: null }, copies: [] });
      expect(copyReads(db)).toEqual([expect.objectContaining({ ownerId: "owner" })]);
    });

    it("sees a public showcase's copy", async () => {
      const db = setup({ copies: [] });
      db.cardCollection.findFirst.mockResolvedValue({ userId: "owner" });
      const sheet = await loadCardSheet(db as never, null, "c1", {
        from: { kind: "showcase", id: "s1" },
        rules,
      });
      expect(db.cardCollection.findFirst.mock.calls[0]![0]).toMatchObject({
        where: { id: "s1", isPublic: true },
      });
      expect(sheet).toMatchObject({ face: { silhouette: false }, signedIn: false });
    });

    it("keeps a retired card's placeholder face on a public showcase", async () => {
      const db = setup({ card: { ...CARD, isRetired: true }, copies: [], catalogued: 0 });
      db.cardCollection.findFirst.mockResolvedValue({ userId: "owner" });
      const sheet = await loadCardSheet(db as never, null, "c1", {
        from: { kind: "showcase", id: "s1" },
        rules,
      });
      expect(sheet).toMatchObject({ face: { artwork: null, isRetired: true } });
    });

    it.each([
      ["a bare link", null],
      ["an offer", { kind: "offer" as const, id: "t1" }],
      ["a showcase its owner hides", { kind: "showcase" as const, id: "s1" }],
      ["a holder who does not show the card", { kind: "holder" as const, handle: "Nobody" }],
    ])("is asked to sign in for %s", async (_place, from) => {
      const db = setup({ copies: [] });
      db.cardCollection.findFirst.mockResolvedValue({ userId: "owner" });
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
      const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card.excerpt).not.toMatch(/File:|Caphiria\.png/);
      expect(sheet!.card.excerpt).toMatch(/^An empire\. +See the flag\.$/);
    });

    it("leaves the file links out of a retired card's excerpt, even for its holder", async () => {
      const db = setup({ card: { ...WITH_FILES, isRetired: true }, catalogued: 0 });
      const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card.excerpt).not.toMatch(/File:/);
    });

    it("keeps a held card's excerpt as stored", async () => {
      const db = setup({ card: WITH_FILES });
      const sheet = await loadCardSheet(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card.excerpt).toBe(WITH_FILES.wikiExcerpt);
    });

    it("gives a Commons silhouette no file title, and a held Commons card its title", async () => {
      const commons = {
        ...CARD,
        wikiSource: "commons",
        wikiArticleTitle: "File:Camilla Tuvalu Banner.png",
      };
      const silhouette = await loadCardSheet(
        setup({ card: commons, copies: [] }) as never,
        "me",
        "c1",
        { from: null, rules }
      );
      expect(silhouette!.card).toMatchObject({ wikiSource: "commons", wikiArticleTitle: null });
      const held = await loadCardSheet(setup({ card: commons }) as never, "me", "c1", {
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
