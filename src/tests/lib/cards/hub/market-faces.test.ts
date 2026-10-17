/** @jest-environment node */
/** Market screens: live listings show art to all; history, partners' cards and outgoing offers follow the silhouette rule. */
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { contextRevealsArt } from "~/lib/cards/hub/art-visibility";
import {
  blankUnseenArt,
  copyFaces,
  tradeView,
  withAuctionFaces,
} from "~/lib/cards/hub/market-faces";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const copyRow = (
  id: string,
  cardId: string,
  overrides: { cardType?: string; isRetired?: boolean } = {}
) => ({
  id,
  finish: "STANDARD",
  serialNumber: 1,
  level: 1,
  cards: {
    id: cardId,
    title: cardId,
    rarity: "RARE",
    cardType: overrides.cardType ?? "LORE",
    artwork: `https://art/${cardId}.png`,
    isRetired: overrides.isRetired ?? false,
    collectorNumber: 1,
    season: 1,
    nsSeason: null,
    realm,
  },
});
const rawCard = (cardId: string) => ({
  id: cardId,
  marketValue: 10,
  artwork: `https://art/${cardId}.png`,
  artworkCredit: `${cardId}.png, via Commons`,
});
const rawRow = (id: string, cardId: string) => ({ id, isLocked: false, cards: rawCard(cardId) });
/** An auction row as the market's includes read it: the listed copy with its raw card. */
const auctionRow = (id: string, cardInstanceId: string, cardId: string) => ({
  id,
  cardInstanceId,
  CardOwnership: { id: cardInstanceId, cards: rawCard(cardId) },
});
type OwnershipArgs = { select: { cardId?: true } };
/** Ownership reads: the visibility check asks for card ids the viewer holds, the face read for copies. */
const ownership = (
  db: ReturnType<typeof createMockPrisma>,
  held: string[],
  copies: ReturnType<typeof copyRow>[]
) =>
  db.cardOwnership.findMany.mockImplementation(async (args: OwnershipArgs) =>
    args.select.cardId ? held.map((cardId) => ({ cardId })) : copies
  );
const heldReads = (db: ReturnType<typeof createMockPrisma>) =>
  db.cardOwnership.findMany.mock.calls.filter(([args]: [OwnershipArgs]) => args.select.cardId);

describe("copyFaces and withAuctionFaces", () => {
  it("shows live listings to everyone without asking who owns them", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([copyRow("o1", "c1")]);
    const rows = await withAuctionFaces(
      db as never,
      "me",
      [auctionRow("a1", "o1", "c1"), auctionRow("a2", "gone", "c9")],
      true
    );
    expect(rows[0]).toMatchObject({ id: "a1", face: { cardId: "c1", silhouette: false } });
    expect(rows[0]!.CardOwnership.cards).toEqual(rawCard("c1"));
    expect(rows[0]!.face).toMatchObject({
      artwork: "https://art/c1.png",
      copy: { ownershipId: "o1" },
    });
    expect(rows[1]).toMatchObject({ id: "a2", face: null });
    expect(rows[1]!.CardOwnership.cards).toMatchObject({ artwork: null, artworkCredit: null });
    expect(db.cardOwnership.findMany).toHaveBeenCalledTimes(1);
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({
      id: { in: ["o1", "gone"] },
    });
    expect(db.cardAuction.findMany).not.toHaveBeenCalled();
  });

  it("strips the art of past auctions the viewer holds nothing of", async () => {
    const db = createMockPrisma();
    ownership(db, [], [copyRow("o1", "c1")]);
    const faces = await copyFaces(db as never, "me", ["o1"], false);
    expect(faces.get("o1")).toMatchObject({ artwork: null, silhouette: true });
    expect(heldReads(db)[0]![0].where).toEqual({ ownerId: "me", cardId: { in: ["c1"] } });
  });

  it("shows a past auction's art to a viewer who holds the card, or while it is listed again", async () => {
    const db = createMockPrisma();
    ownership(db, ["c1"], [copyRow("o1", "c1"), copyRow("o2", "c2")]);
    db.cardAuction.findMany.mockResolvedValue([{ CardOwnership: { cardId: "c2" } }]);
    const faces = await copyFaces(db as never, "me", ["o1", "o2"], false);
    expect(faces.get("o1")).toMatchObject({ artwork: "https://art/c1.png", silhouette: false });
    expect(faces.get("o2")).toMatchObject({ artwork: "https://art/c2.png", silhouette: false });
  });

  it("never shows a retired card's art, even on a live listing, in the face or the raw card", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([copyRow("o1", "c1", { isRetired: true })]);
    const faces = await copyFaces(db as never, "me", ["o1"], true);
    expect(faces.get("o1")).toMatchObject({ artwork: null, isRetired: true });
    const [auction] = await withAuctionFaces(
      db as never,
      "me",
      [auctionRow("a1", "o1", "c1")],
      true
    );
    expect(auction!.face).toMatchObject({ artwork: null, isRetired: true });
    expect(auction!.CardOwnership).toEqual({
      id: "o1",
      cards: { ...rawCard("c1"), artwork: null, artworkCredit: null },
    });
  });

  it("reads each copy once, and nothing for an empty list", async () => {
    const db = createMockPrisma();
    await expect(copyFaces(db as never, "me", [], false)).resolves.toEqual(new Map());
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    await copyFaces(db as never, "me", ["o1", "o1"], true);
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({ id: { in: ["o1"] } });
  });
});

describe("blankUnseenArt", () => {
  it("blanks a partner's card art unless the viewer holds it, it is listed live or it is an NS flag", async () => {
    const db = createMockPrisma();
    ownership(
      db,
      ["shared", "hidden"],
      [
        copyRow("o1", "shared"),
        copyRow("o2", "secret"),
        copyRow("o3", "flag", { cardType: "NS" }),
        copyRow("o4", "listed"),
        copyRow("o5", "hidden", { isRetired: true }),
      ]
    );
    db.cardAuction.findMany.mockResolvedValue([{ CardOwnership: { cardId: "listed" } }]);
    const rows = [
      rawRow("o1", "shared"),
      rawRow("o2", "secret"),
      rawRow("o3", "flag"),
      rawRow("o4", "listed"),
      rawRow("o5", "hidden"),
    ];
    const blanked = await blankUnseenArt(db as never, "me", rows);
    expect(blanked.map((r) => r.cards.artwork)).toEqual([
      "https://art/shared.png",
      null,
      "https://art/flag.png",
      "https://art/listed.png",
      null,
    ]);
    expect(blanked[1]).toEqual({
      ...rows[1],
      cards: { ...rows[1]!.cards, artwork: null, artworkCredit: null },
    });
    expect(blanked[4]!.cards.artworkCredit).toBeNull();
    expect(blanked[0]).toBe(rows[0]);
  });

  it("blanks a copy it can no longer find", async () => {
    const db = createMockPrisma();
    const blanked = await blankUnseenArt(db as never, "me", [rawRow("o9", "c9")]);
    expect(blanked[0]!.cards.artwork).toBeNull();
  });
});

describe("tradeView", () => {
  const trade = { id: "t1", initiatorCardIds: ["o1", 7], recipientCardIds: ["o2"] };
  const initiator = [rawRow("o1", "c1")];
  const recipient = [rawRow("o2", "c2")];

  it("shows every card of a live offer made to the viewer", async () => {
    const db = createMockPrisma();
    db.tradeOffer.count.mockResolvedValue(1);
    ownership(db, [], [copyRow("o1", "c1"), copyRow("o2", "c2")]);
    const view = await tradeView(db as never, "me", trade, initiator, recipient);
    expect(db.tradeOffer.count).toHaveBeenCalledWith({
      where: {
        id: "t1",
        recipientId: "me",
        status: "PENDING",
        expiresAt: { gt: expect.any(Date) },
      },
    });
    expect(view.initiatorCardsData[0]!.cards.artwork).toBe("https://art/c1.png");
    expect(view.recipientCardsData[0]!.cards.artwork).toBe("https://art/c2.png");
    expect(view.initiatorFaces).toEqual([
      expect.objectContaining({ cardId: "c1", silhouette: false }),
    ]);
    expect(view.recipientFaces).toEqual([
      expect.objectContaining({ cardId: "c2", silhouette: false }),
    ]);
    expect(heldReads(db)).toHaveLength(0);
  });

  it("blanks the other side's art in an offer the viewer sent, or one no longer live", async () => {
    const db = createMockPrisma();
    db.tradeOffer.count.mockResolvedValue(0);
    ownership(db, ["c1"], [copyRow("o1", "c1"), copyRow("o2", "c2")]);
    const view = await tradeView(db as never, "me", trade, initiator, recipient);
    expect(view.recipientCardsData[0]!.cards.artwork).toBeNull();
    expect(view.recipientFaces[0]).toMatchObject({ cardId: "c2", silhouette: true, artwork: null });
    expect(view.initiatorCardsData[0]!.cards.artwork).toBe("https://art/c1.png");
    expect(view.initiatorFaces[0]).toMatchObject({ cardId: "c1", silhouette: false });
  });

  it("asks the same offer question as a sheet opened from the offer, expiry included", async () => {
    const db = createMockPrisma();
    await tradeView(db as never, "me", trade, [], []);
    await contextRevealsArt(
      db as never,
      "me",
      "c1",
      { kind: "offer", id: "t1" },
      { vaultVisible: jest.fn() }
    );
    const liveOffer = {
      id: "t1",
      recipientId: "me",
      status: "PENDING",
      expiresAt: { gt: expect.any(Date) },
    };
    expect(db.tradeOffer.count.mock.calls[0]![0].where).toEqual(liveOffer);
    expect(db.tradeOffer.findFirst.mock.calls[0]![0].where).toEqual(liveOffer);
  });

  it("keeps the offer's order in the faces and skips ids it cannot find", async () => {
    const db = createMockPrisma();
    db.tradeOffer.count.mockResolvedValue(1);
    db.cardOwnership.findMany.mockResolvedValue([copyRow("o2", "c2"), copyRow("o1", "c1")]);
    const view = await tradeView(
      db as never,
      "me",
      { id: "t1", initiatorCardIds: ["o1", "gone", "o2"], recipientCardIds: "o3" },
      [],
      []
    );
    expect(view.initiatorFaces.map((f) => f.cardId)).toEqual(["c1", "c2"]);
    expect(view.recipientFaces).toEqual([]);
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({
      id: { in: ["o1", "gone", "o2"] },
    });
  });
});
