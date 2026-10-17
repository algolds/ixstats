/** @jest-environment node */
/**
 * getUserCards, the owner's own inventory (Mine): a retired card, hidden by a takedown or the Library, keeps its
 * copies in view with the placeholder face (cards refresh §3), so the read never filters on retirement.
 */
import { getUserCards } from "~/lib/cards/card-service";
import { ownedCardToInstance } from "~/lib/cards/ownership-card";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";
import { createMockPrisma } from "~/tests/helpers/mock-db";

describe("getUserCards", () => {
  it("lists every copy the owner holds, retired cards included, newest first", async () => {
    const db = createMockPrisma();
    await getUserCards(db as never, "db_me");
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { ownerId: "db_me" },
      include: { cards: true },
      orderBy: [{ acquiredAt: "desc" }],
    });
  });

  it("filters on rarity alone when asked, and sorts by rarity or value", async () => {
    const db = createMockPrisma();
    await getUserCards(db as never, "db_me", "rarity", "EPIC");
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({
      where: { ownerId: "db_me", cards: { rarity: "EPIC" } },
      orderBy: [{ cards: { rarity: "desc" } }, { cards: { marketValue: "desc" } }],
    });
    await getUserCards(db as never, "db_me", "value");
    expect(db.cardOwnership.findMany.mock.calls[1]![0]).toMatchObject({
      where: { ownerId: "db_me" },
      orderBy: [{ cards: { marketValue: "desc" } }],
    });
    expect(JSON.stringify(db.cardOwnership.findMany.mock.calls)).not.toMatch(/isRetired/);
  });

  it("draws a hidden card's copy with the placeholder face, still marked retired", async () => {
    const db = createMockPrisma();
    const hidden = {
      id: "own_1",
      cardId: "card_kehmet",
      cards: { id: "card_kehmet", title: "Kehmet", artwork: null, isRetired: true },
    };
    db.cardOwnership.findMany.mockResolvedValue([hidden]);
    const [copy] = await getUserCards(db as never, "db_me");
    expect(ownedCardToInstance(copy!)).toMatchObject({
      id: "card_kehmet",
      ownershipId: "own_1",
      artwork: CARD_ARTWORK_PLACEHOLDER,
      isRetired: true,
    });
  });

  it("refuses an empty user id", async () => {
    const db = createMockPrisma();
    await expect(getUserCards(db as never, " ")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
