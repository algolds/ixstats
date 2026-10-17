/** @jest-environment node */
/** A partner's tradeable cards, a trade's sides and past auctions never carry art the viewer may not see. */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
import { cardsInventoryRouter } from "~/server/api/routers/cards/inventory";
import { tradingQueriesRouter } from "~/server/api/routers/trading/queries";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type MockDb = ReturnType<typeof createMockPrisma>;
const contextFor = (db: MockDb, signedIn = true) =>
  createMockRouterContext(
    signedIn
      ? { db, user: { id: "me", clerkUserId: "clerk_me" }, auth: { userId: "clerk_me" } }
      : { db, user: null, auth: null }
  ) as never;
const market = (db: MockDb, signedIn = true) =>
  createCallerFactory(cardMarketRouter)(contextFor(db, signedIn));
const inventory = (db: MockDb, signedIn = true) =>
  createCallerFactory(cardsInventoryRouter)(contextFor(db, signedIn));
const trading = (db: MockDb, signedIn = true) =>
  createCallerFactory(tradingQueriesRouter)(contextFor(db, signedIn));

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const faceRow = (id: string, cardId: string, cardType = "LORE") => ({
  id,
  finish: "STANDARD",
  serialNumber: 1,
  level: 1,
  cards: {
    id: cardId,
    title: cardId,
    rarity: "RARE",
    cardType,
    artwork: `https://art/${cardId}.png`,
    isRetired: false,
    collectorNumber: 1,
    season: 1,
    nsSeason: null,
    realm,
  },
});
const rawCopy = (id: string, cardId: string, marketValue = 10, isRetired = false) => ({
  id,
  cards: {
    id: cardId,
    cardType: "LORE",
    marketValue,
    isRetired,
    artwork: `https://art/${cardId}.png`,
    artworkCredit: `${cardId}.png, via Commons`,
    metadata: { qualityScore: 80, descriptionUrl: `https://commons/File:${cardId}.png` },
  },
});
/** An auction row as the market's includes read it: the listed copy with its raw card. */
const listing = (id: string, cardInstanceId: string, cardId: string) => ({
  id,
  cardInstanceId,
  CardOwnership: { id: cardInstanceId, cards: rawCopy(cardInstanceId, cardId).cards },
});
type OwnershipArgs = {
  where: { id?: { in: string[] } };
  select?: { cardId?: true };
  include?: object;
};
/** The viewer holds `held` (card ids); every other ownership read is a face read over `faces`, or a raw side read. */
function ownership(
  db: MockDb,
  held: string[],
  faces: ReturnType<typeof faceRow>[],
  raw: ReturnType<typeof rawCopy>[] = []
) {
  db.cardOwnership.findMany.mockImplementation(async (args: OwnershipArgs) => {
    if (args.select?.cardId) return held.map((cardId) => ({ cardId }));
    const ids = args.where.id?.in;
    const asked = <T extends { id: string }>(rows: T[]) =>
      ids ? rows.filter((r) => ids.includes(r.id)) : rows;
    return args.include ? asked(raw) : asked(faces);
  });
}

describe("auctions", () => {
  it("reads no artwork for auction history and returns faces instead", async () => {
    const db = createMockPrisma();
    db.cardAuction.count.mockResolvedValue(1);
    db.cardAuction.findMany.mockResolvedValueOnce([
      {
        id: "a",
        status: "COMPLETED",
        winnerId: "x",
        sellerId: "y",
        cardInstanceId: "o1",
        CardOwnership: { id: "o1", cards: { id: "c1", title: "c1" } },
      },
    ]);
    ownership(db, [], [faceRow("o1", "c1")]);
    const result = await market(db).getMyAuctionParticipation({ limit: 5 });
    expect(JSON.stringify(db.cardAuction.findMany.mock.calls[0]![0])).not.toContain("artwork");
    expect(result.auctions[0]).toMatchObject({
      participation: "bid",
      face: { cardId: "c1", artwork: null, silhouette: true },
    });
  });

  it("filters live listings by realm and shows their art to every viewer", async () => {
    const db = createMockPrisma();
    db.cardAuction.count.mockResolvedValue(1);
    db.cardAuction.findMany.mockResolvedValue([listing("a", "o1", "c1")]);
    ownership(db, [], [faceRow("o1", "c1")]);
    const result = await market(db).getActiveAuctions({ realmId: "r1" });
    expect(db.cardAuction.count.mock.calls[0]![0].where).toMatchObject({
      status: "ACTIVE",
      CardOwnership: { cards: { realmId: "r1" } },
    });
    expect(result.auctions[0]!.face).toMatchObject({
      artwork: "https://art/c1.png",
      silhouette: false,
    });
    expect(result.auctions[0]!.CardOwnership.cards.artwork).toBe("https://art/c1.png");
    expect(db.cardAuction.findMany).toHaveBeenCalledTimes(1);
  });

  it("lists only bids on auctions still running, with their faces", async () => {
    const db = createMockPrisma();
    db.cardAuction.findMany.mockResolvedValue([listing("a", "o1", "c1")]);
    ownership(db, [], [faceRow("o1", "c1")]);
    const result = await market(db).getMyActiveBids();
    expect(db.cardAuction.findMany.mock.calls[0]![0].where).toEqual({
      currentBidderId: "me",
      status: "ACTIVE",
      endTime: { gt: expect.any(Date) },
    });
    expect(result.auctions[0]!.face).toMatchObject({ cardId: "c1", silhouette: false });
  });

  it("gives the seller their listings' faces under the rule, since an ended listing may await settlement", async () => {
    const db = createMockPrisma();
    db.cardAuction.findMany.mockResolvedValueOnce([listing("a", "o1", "c1")]);
    ownership(db, ["c1"], [faceRow("o1", "c1")]);
    const result = await market(db).getMyActiveAuctions();
    expect(result.auctions[0]!.face).toMatchObject({ cardId: "c1", silhouette: false });
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "me", cardId: { in: ["c1"] } } })
    );
  });
});

describe("a partner's tradeable copies", () => {
  it("blank the art and its credit for cards the viewer holds nothing of, and never carry metadata", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "them", clerkUserId: "clerk_them" });
    ownership(
      db,
      ["shared"],
      [faceRow("o1", "shared"), faceRow("o2", "secret")],
      [rawCopy("o1", "shared"), rawCopy("o2", "secret")]
    );
    const rows = await inventory(db).getUserCards({ userId: "them" });
    expect(rows.map((r) => [r.id, r.cards.artwork, r.cards.artworkCredit])).toEqual([
      ["o1", "https://art/shared.png", "shared.png, via Commons"],
      ["o2", null, null],
    ]);
    expect(rows.map((r) => r.cards.metadata)).toEqual([null, null]);
  });

  it("refuses a signed-out caller", async () => {
    await expect(
      inventory(createMockPrisma(), false).getUserCards({ userId: "them" })
    ).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
  });
});

describe("trade details", () => {
  const pendingOffer = {
    id: "t1",
    initiatorId: "them",
    recipientId: "me",
    initiatorCardIds: ["o1", 3],
    recipientCardIds: ["o2"],
    initiatorCredits: 5,
    recipientCredits: 0,
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    initiator: { id: "them", clerkUserId: "clerk_them", handle: "ann", country: null },
    recipient: { id: "me", clerkUserId: "clerk_me", handle: "max", country: null },
  };
  const trade = (overrides: Partial<typeof pendingOffer> = {}) => ({
    ...pendingOffer,
    ...overrides,
  });
  const TRADE_CARD_SELECT = {
    id: true,
    title: true,
    rarity: true,
    cardType: true,
    artwork: true,
    marketValue: true,
    isRetired: true,
  };
  const sides = [rawCopy("o1", "c1", 30), rawCopy("o2", "c2", 12)];
  const faces = [faceRow("o1", "c1"), faceRow("o2", "c2")];

  it("shows a live offer made to the viewer in full, valued by the shared copy value", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findUnique.mockResolvedValue(trade());
    db.tradeOffer.count.mockResolvedValue(1);
    ownership(db, ["c2"], faces, sides);
    const result = await trading(db).getTradeById({ tradeId: "t1" });
    expect(db.tradeOffer.findUnique.mock.calls[0]![0].include.initiator.select).toMatchObject({
      handle: true,
    });
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["o1"] } },
      include: { cards: { select: TRADE_CARD_SELECT } },
    });
    const sideSelect = db.cardOwnership.findMany.mock.calls[0]![0].include.cards.select;
    expect(sideSelect).not.toHaveProperty("metadata");
    expect(sideSelect).not.toHaveProperty("artworkCredit");
    expect(result.initiatorCardsData[0]!.cards.artwork).toBe("https://art/c1.png");
    expect(result.initiatorFaces).toEqual([
      expect.objectContaining({ cardId: "c1", silhouette: false }),
    ]);
    expect(result.recipientFaces).toEqual([
      expect.objectContaining({ cardId: "c2", silhouette: false }),
    ]);
    expect(result).toMatchObject({
      initiatorValue: 35,
      recipientValue: 12,
      initiator: { handle: "ann" },
    });
  });

  it("blanks the partner's side of an offer the viewer sent", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findUnique.mockResolvedValue(trade({ initiatorId: "me", recipientId: "them" }));
    db.tradeOffer.count.mockResolvedValue(0);
    ownership(db, ["c1"], faces, sides);
    const result = await trading(db).getTradeById({ tradeId: "t1" });
    expect(result.recipientCardsData[0]!.cards.artwork).toBeNull();
    expect(result.recipientFaces[0]).toMatchObject({
      cardId: "c2",
      silhouette: true,
      artwork: null,
    });
    expect(result.initiatorCardsData[0]!.cards.artwork).toBe("https://art/c1.png");
  });

  it("values a hidden (retired) copy at 0, as Mine and the sheet do", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findUnique.mockResolvedValue(trade({ initiatorCardIds: ["o1", "o3"] }));
    ownership(db, [], [], [...sides, rawCopy("o3", "c3", 50, true)]);
    const result = await trading(db).getTradeById({ tradeId: "t1" });
    expect(result).toMatchObject({ initiatorValue: 35, recipientValue: 12 });
  });

  it("refuses a signed-out caller and a player outside the trade", async () => {
    const db = createMockPrisma();
    await expect(trading(db, false).getTradeById({ tradeId: "t1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    db.tradeOffer.findUnique.mockResolvedValue(trade({ initiatorId: "x", recipientId: "y" }));
    await expect(trading(db).getTradeById({ tradeId: "t1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
