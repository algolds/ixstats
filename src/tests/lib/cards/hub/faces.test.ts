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
});
