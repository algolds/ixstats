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

import { INSCRIPTION_OMIT } from "~/lib/cards/inscription";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
import { cardsInventoryRouter } from "~/server/api/routers/cards/inventory";
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

/** Drops what an `omit` names, as Prisma does. */
function without<T extends object>(row: T, omit: Omitted | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !omit?.[key])) as Partial<T>;
}

type CopyRead = { select?: object; omit?: Omitted; where?: object };
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

/** One database: the signed copy, on an auction, in a trade. Face reads `select`; whole-row reads come back omitted. */
function signedCopyDb() {
  const db = createMockPrisma();
  db.cardOwnership.findMany.mockImplementation(async (args: CopyRead) =>
    args.select
      ? [{ id: "o1", cardId: "c1", finish: "STANDARD", serialNumber: 3, level: 1, cards: CARD }]
      : [{ ...without(SIGNED_COPY, args.omit), cards: CARD }]
  );
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
  db.tradeOffer.findUnique.mockResolvedValue({
    id: "t1",
    initiatorId: "them",
    recipientId: "me",
    initiatorCardIds: ["o1"],
    recipientCardIds: ["o1"],
    initiatorCredits: 0,
    recipientCredits: 0,
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    initiator: { id: "them", clerkUserId: "clerk_them", country: null },
    recipient: { id: "me", clerkUserId: "clerk_me", country: null },
  });
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
      "the live market",
      (db: MockDb) => createCallerFactory(cardMarketRouter)(context(db)).getActiveAuctions({}),
    ],
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
      "the player's own copies",
      (db: MockDb) => createCallerFactory(cardsInventoryRouter)(context(db)).getMyCards({}),
    ],
    [
      "a partner's tradeable copies",
      (db: MockDb) =>
        createCallerFactory(cardsInventoryRouter)(context(db)).getUserCards({ userId: "them" }),
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
});
