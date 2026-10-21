/** @jest-environment node */
/** Market screens: every copy shows its art, marked when the viewer holds no copy of its card; a retired card shows none. */
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
/** Ownership reads: the collected check asks for card ids the viewer holds, the face read for copies. */
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
  it("shows every auction's art, marking it by the viewer's own copies", async () => {
    const db = createMockPrisma();
    ownership(db, [], [copyRow("o1", "c1")]);
    const rows = await withAuctionFaces(db as never, "me", [
      auctionRow("a1", "o1", "c1"),
      auctionRow("a2", "gone", "c9"),
    ]);
    expect(rows[0]).toMatchObject({ id: "a1", face: { cardId: "c1", uncollected: true } });
    expect(rows[0]!.CardOwnership.cards).toEqual(rawCard("c1"));
    expect(rows[0]!.face).toMatchObject({
      artwork: "https://art/c1.png",
      copy: { ownershipId: "o1" },
    });
    expect(rows[1]).toMatchObject({ id: "a2", face: null });
    expect(rows[1]!.CardOwnership.cards).toMatchObject({ artwork: null, artworkCredit: null });
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({
      id: { in: ["o1", "gone"] },
    });
    expect(heldReads(db)[0]![0].where).toEqual({ ownerId: "me", cardId: { in: ["c1"] } });
    expect(db.cardAuction.findMany).not.toHaveBeenCalled();
  });

  it("keeps an ended auction whose copy is gone (broken down or fused), with no face and no copy read", async () => {
    const db = createMockPrisma();
    ownership(db, [], [copyRow("o1", "c1")]);
    const burned = { id: "a2", cardInstanceId: null, CardOwnership: null };
    const rows = await withAuctionFaces(db as never, "me", [auctionRow("a1", "o1", "c1"), burned]);
    expect(rows[1]).toEqual({ ...burned, face: null });
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({ id: { in: ["o1"] } });
  });

  it("marks a copy by the viewer's collection, not its holder's, whether or not it is listed", async () => {
    const db = createMockPrisma();
    ownership(db, ["c1"], [copyRow("o1", "c1"), copyRow("o2", "c2")]);
    db.cardAuction.findMany.mockResolvedValue([{ cardId: "c2" }]);
    db.cardListing.findMany.mockResolvedValue([{ cardId: "c2" }]);
    const faces = await copyFaces(db as never, "me", ["o1", "o2"]);
    expect(faces.get("o1")).toMatchObject({ artwork: "https://art/c1.png", uncollected: false });
    expect(faces.get("o2")).toMatchObject({ artwork: "https://art/c2.png", uncollected: true });
    expect(heldReads(db)[0]![0].where).toEqual({ ownerId: "me", cardId: { in: ["c1", "c2"] } });
  });

  it("never shows a retired card's art, in the face or the raw card", async () => {
    const db = createMockPrisma();
    ownership(db, ["c1"], [copyRow("o1", "c1", { isRetired: true })]);
    const faces = await copyFaces(db as never, "me", ["o1"]);
    expect(faces.get("o1")).toMatchObject({ artwork: null, isRetired: true, uncollected: false });
    const [auction] = await withAuctionFaces(db as never, "me", [auctionRow("a1", "o1", "c1")]);
    expect(auction!.face).toMatchObject({ artwork: null, isRetired: true });
    expect(auction!.CardOwnership).toEqual({
      id: "o1",
      cards: { ...rawCard("c1"), artwork: null, artworkCredit: null },
    });
  });

  it("reads each copy once, and nothing for an empty list", async () => {
    const db = createMockPrisma();
    await expect(copyFaces(db as never, "me", [])).resolves.toEqual(new Map());
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    await copyFaces(db as never, "me", ["o1", "o1"]);
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({ id: { in: ["o1"] } });
  });
});
