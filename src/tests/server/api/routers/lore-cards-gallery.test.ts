/** @jest-environment node */
/**
 * Cards refresh §2.4: an import waits in review, so the public Lore gallery lists approved cards only; a hidden
 * (retired) card leaves it, as it leaves the NS half's library.
 */
import { createCallerFactory } from "~/server/api/trpc";
import { loreCardsGalleryRouter } from "~/server/api/routers/lore-cards/gallery";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

describe("getAllLoreCards", () => {
  it("lists only approved, unretired Lore cards, with the filters asked, and counts the same cards", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(0);
    const caller = createCallerFactory(loreCardsGalleryRouter)(
      createMockRouterContext({ auth: null, user: null, db }) as never
    );

    await caller.getAllLoreCards({ wikiSource: "iiwiki", rarity: "RARE", sortBy: "title" });

    const query = db.card.findMany.mock.calls[0]![0];
    expect(query.where).toEqual({
      cardType: "LORE",
      reviewState: "APPROVED",
      isRetired: false,
      wikiSource: "iiwiki",
      rarity: "RARE",
    });
    expect(query.orderBy).toEqual({ title: "asc" });
    expect(db.card.count).toHaveBeenCalledWith({ where: query.where });
  });
});
