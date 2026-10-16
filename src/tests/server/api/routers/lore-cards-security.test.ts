/** @jest-environment node */
/** Cards refresh §3 security: wiki discovery is admin-only; reading an article's author writes nothing. */
jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  __esModule: true,
  wikiLoreCardGenerator: {
    fetchArticleAuthorInfoBatch: jest
      .fn()
      .mockResolvedValue(new Map([["kiro", { creator: "Kir", displayAuthor: "Kir" }]])),
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const player = (db: ReturnType<typeof createMockPrisma>) =>
  createCallerFactory(loreCardsWikiRouter)(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
      db,
    }) as never
  );

describe("lore wiki procedures", () => {
  it("refuses every wiki discovery read to a signed-in player", async () => {
    const caller = player(createMockPrisma());
    const refused = /Admin privileges required/;
    await expect(caller.searchLoreArchive({ source: "ixwiki", query: "x" })).rejects.toThrow(
      refused
    );
    await expect(caller.fetchLoreMetadata({ source: "ixwiki", pageTitle: "X" })).rejects.toThrow(
      refused
    );
    await expect(caller.searchWikiCategories({ source: "ixwiki" })).rejects.toThrow(refused);
    await expect(caller.getCategoryStats({ source: "ixwiki", categories: ["X"] })).rejects.toThrow(
      refused
    );
    await expect(
      caller.fetchWikiCategoryMembers({ source: "ixwiki", category: "X" })
    ).rejects.toThrow(refused);
    await expect(caller.fetchAllMainNamespacePages({ source: "ixwiki" })).rejects.toThrow(refused);
    await expect(
      caller.fetchArticlePreviewsBatch({ source: "ixwiki", titles: ["X"] })
    ).rejects.toThrow(refused);
  });

  it("answers an article's author without writing to any card", async () => {
    const db = createMockPrisma();
    const caller = createCallerFactory(loreCardsWikiRouter)(
      createMockRouterContext({ auth: null, user: null, db }) as never
    );
    await expect(
      caller.getCardAuthorInfo({ articleTitle: "Kiro", source: "ixwiki" })
    ).resolves.toMatchObject({
      authorInfo: { displayAuthor: "Kir" },
    });
    expect(db.card.update).not.toHaveBeenCalled();
    expect(db.card.findUnique).not.toHaveBeenCalled();
  });
});
