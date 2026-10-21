/** @jest-environment node */
/**
 * toCardFace shows every card's art (the owner's decision of 2026-10-21) and marks the ones the viewer has not
 * collected; ownedFaces serves cards the viewer just received.
 */
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
  it("shows a collected card's art, with the copy's facts", () => {
    expect(toCardFace(row(), { collected: true, copy })).toEqual({
      cardId: "c1",
      title: "Caphiria",
      rarity: "EPIC",
      cardType: "LORE",
      realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
      artwork: "https://ixwiki.com/images/a.png",
      uncollected: false,
      number: 42,
      season: null,
      isRetired: false,
      copy: { ownershipId: "o1", finish: "FOIL", serialNumber: 3, level: 2 },
    });
  });

  it("shows the art of a card the viewer has not collected, and marks it", () => {
    expect(toCardFace(row(), { collected: false })).toMatchObject({
      artwork: "https://ixwiki.com/images/a.png",
      uncollected: true,
      copy: null,
      number: 42,
    });
  });

  it("marks a NationStates card the viewer does not hold too, and gives NS and Nation cards their season", () => {
    expect(toCardFace(row({ cardType: "NS", nsSeason: 3 }), { collected: false })).toMatchObject({
      artwork: "https://ixwiki.com/images/a.png",
      uncollected: true,
      season: 3,
    });
    expect(toCardFace(row({ cardType: "NS" }), { collected: true }).season).toBe(2);
    expect(toCardFace(row({ cardType: "NATION", season: 5 }), { collected: true }).season).toBe(5);
  });

  it("gives a retired card the placeholder face, held or not", () => {
    expect(toCardFace(row({ isRetired: true }), { collected: true, copy })).toMatchObject({
      artwork: null,
      uncollected: false,
      isRetired: true,
      copy: { ownershipId: "o1" },
    });
    expect(
      toCardFace(row({ isRetired: true, cardType: "NS" }), { collected: false })
    ).toMatchObject({
      artwork: null,
      uncollected: true,
    });
    const face = toCardFace(row({ isRetired: true }), { collected: false });
    expect(face).toMatchObject({ artwork: null, uncollected: true });
    // A takedown, a restricted licence or a Library hide retires the card: nothing in the face names its file.
    expect(JSON.stringify(face)).not.toContain("ixwiki.com/images");
  });

  it("treats a stored placeholder as no art", () => {
    expect(
      toCardFace(row({ artwork: "/images/placeholder-flag.svg" }), { collected: false })
    ).toMatchObject({
      artwork: null,
      uncollected: true,
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
    expect(faces.map((f) => [f.artwork !== null, f.uncollected])).toEqual([
      [true, false],
      [true, false],
    ]);
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
