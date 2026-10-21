/** @jest-environment node */
/** Market screens: live listings show art to all; auction history follows the silhouette rule. */
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { copyFaces, withAuctionFaces } from "~/lib/cards/hub/market-faces";

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

  it("keeps an ended auction whose copy is gone (broken down or fused), with no face and no copy read", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([copyRow("o1", "c1")]);
    const burned = { id: "a2", cardInstanceId: null, CardOwnership: null };
    const rows = await withAuctionFaces(
      db as never,
      "me",
      [auctionRow("a1", "o1", "c1"), burned],
      false
    );
    expect(rows[1]).toEqual({ ...burned, face: null });
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({ id: { in: ["o1"] } });
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
    db.cardAuction.findMany.mockResolvedValue([{ cardId: "c2" }]);
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
