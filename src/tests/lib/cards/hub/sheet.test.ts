/** @jest-environment node */
/** The one card sheet (spec §2.3): the card, the viewer's copies with their trails, the market and the provenance. */
jest.mock("~/lib/cards/copy-value", () => ({
  loadCopyValues: jest.fn(),
  topCopiesByValue: jest.fn(),
}));

import { createMockPrisma } from "~/tests/helpers/mock-db";
import { loadCopyValues, topCopiesByValue, type CopyValueFilter } from "~/lib/cards/copy-value";
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
  realm,
  isBound: false,
  category: "HISTORY",
  subcategory: "event",
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
  it("opens a card outside the catalogue inside an offer waiting on the viewer, with its art", async () => {
    const db = setup({ copies: [], catalogued: 0 });
    db.tradeOffer.findFirst.mockResolvedValue({ initiatorCardIds: ["o9"], recipientCardIds: [] });
    db.cardOwnership.count.mockResolvedValue(1);
    const sheet = await sheetFor(db as never, "me", "c1", {
      from: { kind: "offer", id: "t1" },
      rules,
    });
    expect(sheet!.face).toMatchObject({ artwork: "https://art/c1.png", uncollected: true });
    expect(db.tradeOffer.findFirst.mock.calls[0]![0]).toMatchObject({
      where: {
        id: "t1",
        status: "PENDING",
        proposerId: { not: "me" },
        OR: [{ initiatorId: "me" }, { recipientId: "me" }],
      },
    });
  });
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
    expect(sheet!.face).toMatchObject({ uncollected: false, artwork: null });
    expect(sheet!.card).toMatchObject({
      artCredit: null,
      descriptionUrl: null,
      wikiArticleTitle: "Caphiria",
    });
  });
  describe("a card outside the catalogue", () => {
    const RETIRED = { ...CARD, isRetired: true };
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
  });

  describe("the signature", () => {
    const signedBy = (signer: string | null, inscribedName: string | null) =>
      setup({ copies: [{ ...COPY, inscribedById: signer, inscribedName }] });
    const signerOf = async (db: ReturnType<typeof setup>, players: Map<string, HubPlayer>) => {
      playersOf.mockResolvedValueOnce(players);
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      return sheet!.copies[0]!.inscription!.signerName;
    };
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
  });

  describe("a signed-out visitor", () => {
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
  });

  describe("only a retired card names no art", () => {
    const WITH_FILES = {
      ...CARD,
      wikiExcerpt:
        "An empire. [[File:Caphiria.png|thumb|The flag]] See [[:File:Caphiria.png|the flag]].",
    };

    it("leaves the file links out of a retired card's excerpt, as the client draws it, even for its holder", async () => {
      const db = setup({ card: { ...WITH_FILES, isRetired: true }, catalogued: 0 });
      const sheet = await sheetFor(db as never, "me", "c1", { from: null, rules });
      expect(sheet!.card.excerpt).not.toMatch(/File:|Caphiria\.png/);
      expect(sheet!.card.excerpt).toMatch(/^An empire\. +See the flag\.$/);
    });
  });

  it("returns the card's subcategory, and an NS card's pretitle from its stored facts", async () => {
    const db = setup();
    const lore = await sheetFor(db as never, "me", "c1", { from: null, rules });
    expect(db.card.findUnique.mock.calls[0]![0]).toMatchObject({
      select: { category: true, subcategory: true },
    });
    expect(lore!.card).toMatchObject({ category: "HISTORY", subcategory: "event", ns: null });

    const nsCard = {
      ...CARD,
      cardType: "NS",
      category: null,
      subcategory: null,
      nsSeason: 3,
      metadata: { nsData: { name: "Testlandia", region: "Lazarus", category: "Republic" } },
    };
    const nsSheet = await sheetFor(setup({ card: nsCard }) as never, "me", "c1", {
      from: null,
      rules,
    });
    expect(nsSheet!.card.ns).toEqual({
      nation: "Testlandia",
      season: 3,
      region: "Lazarus",
      pretitle: "Republic",
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
