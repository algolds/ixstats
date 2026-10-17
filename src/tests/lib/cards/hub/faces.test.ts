/** @jest-environment node */
/** toCardFace applies the silhouette rule (spec §2.3 Discovery); ownedFaces serves cards the viewer just received. */
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { ownedFaces, toCardFace, type CardFaceRow } from "~/lib/cards/hub/faces";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: " ", isSystem: false };
const row = (overrides: Partial<CardFaceRow> = {}): CardFaceRow => ({
  id: "c1",
  title: "Caphiria",
  rarity: "EPIC",
  cardType: "LORE",
  artwork: "https://ixwiki.com/images/a.png",
  isRetired: false,
  collectorNumber: 42,
  season: 2,
  nsSeason: null,
  realm,
  ...overrides,
});
const copy = { id: "o1", finish: "FOIL" as const, serialNumber: 3, level: 2 };

describe("toCardFace", () => {
  it("shows the art it may reveal, with the copy's facts", () => {
    expect(toCardFace(row(), { revealArt: true, copy })).toEqual({
      cardId: "c1",
      title: "Caphiria",
      rarity: "EPIC",
      cardType: "LORE",
      realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
      artwork: "https://ixwiki.com/images/a.png",
      silhouette: false,
      number: 42,
      season: null,
      isRetired: false,
      copy: { ownershipId: "o1", finish: "FOIL", serialNumber: 3, level: 2 },
    });
  });

  it("strips the art of a card the viewer may not see", () => {
    const face = toCardFace(row(), { revealArt: false });
    expect(face).toMatchObject({ artwork: null, silhouette: true, copy: null, number: 42 });
    expect(JSON.stringify(face)).not.toContain("ixwiki.com/images");
  });

  it("never hides NationStates flags, and gives NS and Nation cards their season", () => {
    expect(toCardFace(row({ cardType: "NS", nsSeason: 3 }), { revealArt: false })).toMatchObject({
      artwork: "https://ixwiki.com/images/a.png",
      silhouette: false,
      season: 3,
    });
    expect(toCardFace(row({ cardType: "NS" }), { revealArt: true }).season).toBe(2);
    expect(toCardFace(row({ cardType: "NATION", season: 5 }), { revealArt: true }).season).toBe(5);
  });

  it("treats a stored placeholder as no art", () => {
    expect(
      toCardFace(row({ artwork: "/images/placeholder-flag.svg" }), { revealArt: true })
    ).toMatchObject({
      artwork: null,
      silhouette: false,
    });
  });
});

describe("ownedFaces", () => {
  it("reads the copies once and keeps the order asked for, skipping ids that do not exist", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([
      { ...copy, id: "o2", cards: row({ id: "c2" }) },
      { ...copy, id: "o1", cards: row() },
    ]);
    const faces = await ownedFaces(db as never, ["o1", "missing", "o2"]);
    expect(faces.map((f) => f.copy?.ownershipId)).toEqual(["o1", "o2"]);
    expect(faces.every((f) => f.artwork !== null)).toBe(true);
    expect(db.cardOwnership.findMany).toHaveBeenCalledTimes(1);
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({
      where: { id: { in: ["o1", "missing", "o2"] } },
    });
  });

  it("asks nothing for no ids", async () => {
    const db = createMockPrisma();
    await expect(ownedFaces(db as never, [])).resolves.toEqual([]);
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
