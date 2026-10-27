/** @jest-environment node */
/**
 * No whole copy row a player reads names the signer (the owner's Q1 ruling): the frozen name and the signer's id stay
 * on the server, and only the card sheet's vaultCards gate names a signer. The fake database honours `omit` as Prisma
 * does, so a read that stops omitting them ships them.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(async () => new Map()),
}));
jest.mock("~/lib/cards/copy-value", () => ({ loadCopyValues: jest.fn(async () => []) }));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/server/modules/identity/identity.privacy", () => ({
  loadVaultCardsShown: jest.fn(async (ids: readonly string[]) => new Set(ids)),
}));

import { INSCRIPTION_OMIT } from "~/lib/cards/inscription";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
import { tradingBuilderRouter } from "~/server/api/routers/trading/builder";
import { tradingOffersRouter } from "~/server/api/routers/trading/offers";
import { tradingQueriesRouter } from "~/server/api/routers/trading/queries";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

type MockDb = ReturnType<typeof createMockPrisma>;
type Omitted = Partial<Record<string, boolean>>;

const context = (db: MockDb) =>
  createMockRouterContext({
    db,
    user: { id: "me", clerkUserId: "clerk_me" },
    auth: { userId: "clerk_me" },
  }) as never;

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const CARD = {
  id: "c1",
  title: "Elm",
  rarity: "RARE",
  cardType: "LORE",
  artwork: "https://art/c1.png",
  artworkCredit: null,
  isRetired: false,
  isBound: false,
  marketValue: 10,
  collectorNumber: 1,
  season: 1,
  nsSeason: null,
  metadata: null,
  realm,
};
/** A copy someone else signed, every column as the table holds it. */
const SIGNED_COPY = {
  id: "o1",
  cardId: "c1",
  ownerId: "me",
  serialNumber: 3,
  level: 1,
  experience: 0,
  isLocked: true,
  finish: "STANDARD",
  inscription: "gg",
  inscribedAt: new Date("2026-11-01T00:00:00Z"),
  inscribedById: "u_signer",
  inscribedName: "@signer",
};

/** A pending trade the other player wrote, holding the signed copy, written after it was signed. */
const TRADE = {
  id: "t1",
  initiatorId: "them",
  recipientId: "me",
  proposerId: "them",
  revision: 0,
  initiatorCardIds: ["o1"],
  recipientCardIds: ["o1"],
  initiatorCredits: 0,
  recipientCredits: 0,
  status: "PENDING",
  isCrossRealm: false,
  expiresAt: new Date(Date.now() + 60_000),
  updatedAt: new Date("2026-11-02T00:00:00Z"),
  initiator: { id: "them", clerkUserId: "clerk_them", country: null },
  recipient: { id: "me", clerkUserId: "clerk_me", country: null },
};

/** Drops what an `omit` names, as Prisma does. */
function without<T extends object>(row: T, omit: Omitted | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !omit?.[key])) as Partial<T>;
}

/** A `select`: columns named `true`, relations by their own `select`. */
type Select = Partial<Record<string, boolean | object>>;

/** Keeps only the columns a `select` names, as Prisma does. */
function picked<T extends object>(row: T, select: Select): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => select[key] === true)
  ) as Partial<T>;
}

type CopyRead = { select?: Select; omit?: Omitted; where?: object };

/** Every copy read either selects columns that name no signer, or omits both signer columns. */
function readsNoSigner(db: MockDb): boolean {
  return db.cardOwnership.findMany.mock.calls.every(([args]: [CopyRead]) =>
    args.select
      ? !("inscribedById" in args.select) && !("inscribedName" in args.select)
      : args.omit?.inscribedById === true && args.omit.inscribedName === true
  );
}

/** Copy reads over one copy row: whole rows come back omitted, `select`s with the columns asked for. */
function copyReads(db: MockDb, row: typeof SIGNED_COPY) {
  db.cardOwnership.findMany.mockImplementation(async (args: CopyRead) => [
    { ...(args.select ? picked(row, args.select) : without(row, args.omit)), cards: CARD },
  ]);
}
/** How a read asks for a related copy: the whole row, an `omit`, or a `select` of some columns. */
type CopyArg = true | { omit?: Omitted; select?: Partial<Record<string, boolean>> };
type AuctionRead = {
  include?: { CardOwnership?: CopyArg };
  select?: { CardOwnership?: CopyArg };
};
type ListingRead = { include?: { ownership?: CopyArg }; select?: { ownership?: CopyArg } };

/** The signed copy as a read asks for it, as Prisma returns it. */
function copyAs(arg: CopyArg): Partial<typeof SIGNED_COPY> & { cards: typeof CARD } {
  if (arg === true) return { ...SIGNED_COPY, cards: CARD };
  const picked = arg.select
    ? Object.fromEntries(Object.entries(SIGNED_COPY).filter(([key]) => arg.select?.[key]))
    : without(SIGNED_COPY, arg.omit);
  return { ...picked, cards: CARD };
}

/** One database: the signed copy, on an auction, in a trade. */
function signedCopyDb() {
  const db = createMockPrisma();
  copyReads(db, SIGNED_COPY);
  db.cardAuction.count.mockResolvedValue(1);
  db.cardAuction.findMany.mockImplementation(async (args: AuctionRead) => {
    const copy = args.include?.CardOwnership ?? args.select?.CardOwnership;
    if (!copy) return [];
    return [
      {
        id: "a1",
        status: "ACTIVE",
        sellerId: "me",
        winnerId: null,
        currentBidderId: "me",
        currentBid: 80,
        buyoutPrice: null,
        bidCount: 1,
        isFeatured: false,
        createdAt: new Date(),
        endTime: new Date(Date.now() + 60_000),
        cardInstanceId: "o1",
        card: CARD,
        CardOwnership: copyAs(copy),
        AuctionBid: [],
        User: { id: "me", clerkUserId: "clerk_me" },
      },
    ];
  });
  // A fixed-price listing of the signed copy; the listing stores its own serial and finish
  db.cardListing.findMany.mockImplementation(async (args: ListingRead) => {
    const copy = args.include?.ownership ?? args.select?.ownership;
    return [
      {
        id: "l1",
        status: "ACTIVE",
        sellerId: "me",
        price: 120,
        isFeatured: false,
        listingFee: 5,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        soldAt: null,
        ownershipId: "o1",
        cardId: "c1",
        serialNumber: 3,
        finish: "STANDARD",
        card: CARD,
        ...(copy ? { ownership: copyAs(copy) } : {}),
      },
    ];
  });
  db.user.findUnique.mockResolvedValue({ id: "them", clerkUserId: "clerk_them" });
  db.tradeOffer.findUnique.mockResolvedValue(TRADE);
  return db;
}

/** Whether a response still carries the signer's id or frozen name anywhere. */
function namesTheSigner(result: object): boolean {
  const json = JSON.stringify(result);
  return ["inscribedById", "inscribedName", "u_signer", "@signer"].some((s) => json.includes(s));
}

describe("whole copy rows a player reads", () => {
  it("omit the signer's id and frozen name, and keep the inscription itself", () => {
    expect(INSCRIPTION_OMIT).toEqual({ inscribedById: true, inscribedName: true });
  });

  it.each([
    [
      "the seller's listings",
      (db: MockDb) => createCallerFactory(cardMarketRouter)(context(db)).getMyActiveAuctions(),
    ],
    [
      "the bidder's auctions",
      (db: MockDb) => createCallerFactory(cardMarketRouter)(context(db)).getMyActiveBids(),
    ],
    [
      "auction history",
      (db: MockDb) =>
        createCallerFactory(cardMarketRouter)(context(db)).getMyAuctionParticipation({ limit: 5 }),
    ],
    [
      "both sides of a trade",
      (db: MockDb) =>
        createCallerFactory(tradingQueriesRouter)(context(db)).getTradeById({ tradeId: "t1" }),
    ],
  ])("%s", async (_, read) => {
    const db = signedCopyDb();
    const result = await read(db);
    expect(namesTheSigner(result)).toBe(false);
    expect(readsNoSigner(db)).toBe(true);
    // The text travels with the copy: only who signed it is held back
    expect(JSON.stringify(result)).toContain('"inscription":"gg"');
  });

  it("Browse, which reads only the copy columns a face shows", async () => {
    const db = signedCopyDb();
    const page = await createCallerFactory(cardMarketRouter)(context(db)).browse({});
    expect(page.items.map((i) => i.kind).sort()).toEqual(["auction", "listing"]);
    expect(namesTheSigner(page)).toBe(false);
    // A face carries no inscription, and neither source reads a whole copy row
    expect(JSON.stringify(page)).not.toContain("inscri");
    expect(db.cardListing.findMany.mock.calls[0]![0].select.ownership).toEqual({
      select: { id: true, finish: true, serialNumber: true, level: true },
    });
    expect(db.cardAuction.findMany.mock.calls[0]![0].select.CardOwnership).toEqual({
      select: { id: true, finish: true, serialNumber: true, level: true },
    });
  });

  it("the seller's fixed-price listings, which read no copy at all", async () => {
    const db = signedCopyDb();
    const listings = await createCallerFactory(cardMarketRouter)(context(db)).getMyListings();
    expect(listings).toHaveLength(1);
    expect(namesTheSigner(listings)).toBe(false);
    expect(JSON.stringify(listings)).not.toContain("inscri");
    expect(db.cardListing.findMany.mock.calls[0]![0].select.ownership).toBeUndefined();
  });

  it("each side of the trade builder, which reads the inscription and never the signer", async () => {
    for (const side of ["mine", "theirs"] as const) {
      const db = signedCopyDb();
      db.user.findUnique.mockResolvedValue({
        id: "them",
        clerkUserId: "clerk_them",
        isActive: true,
        country: null,
      });
      const builder = createCallerFactory(tradingBuilderRouter)(context(db));
      const page = await builder.getTradeables({ partnerId: "them", side });
      expect(page.items).toHaveLength(1);
      expect(namesTheSigner(page)).toBe(false);
      expect(readsNoSigner(db)).toBe(true);
      expect(JSON.stringify(page)).toContain('"inscription":"gg"');
    }
  });

  it("a trade offer, a counter-offer and an accept, which read copies by the columns they check", async () => {
    const offers = (db: MockDb) => createCallerFactory(tradingOffersRouter)(context(db));
    // The player's own copy, signed by someone else and free to trade
    const tradeable = () => {
      const db = signedCopyDb();
      copyReads(db, { ...SIGNED_COPY, isLocked: false });
      db.cardOwnership.updateMany.mockResolvedValue({ count: 1 });
      db.tradeOffer.create.mockImplementation(async ({ data }: { data: object }) => ({
        id: "t2",
        ...data,
      }));
      db.tradeOffer.updateMany.mockResolvedValue({ count: 1 });
      db.tradeOffer.findUniqueOrThrow.mockResolvedValue(TRADE);
      db.tradeOffer.update.mockResolvedValue({ ...TRADE, status: "ACCEPTED" });
      return db;
    };
    const table = { initiatorCardIds: [], recipientCardIds: ["o1"] };
    const runs: Array<(db: MockDb) => Promise<object>> = [
      (db) => offers(db).createtradeOffer({ partnerId: "them", initiatorCardIds: ["o1"] }),
      (db) => offers(db).counterTrade({ tradeId: "t1", revision: 0, ...table }),
      (db) => offers(db).respondToTrade({ tradeId: "t1", action: "ACCEPT", revision: 0 }),
    ];
    for (const run of runs) {
      const db = tradeable();
      const result = await run(db);
      expect(namesTheSigner(result)).toBe(false);
      expect(db.cardOwnership.findMany).toHaveBeenCalled();
      expect(readsNoSigner(db)).toBe(true);
    }
  });
});
