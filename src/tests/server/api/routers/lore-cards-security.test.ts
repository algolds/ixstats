/** @jest-environment node */
/** Reading an article's author, on any wiki whose articles become cards, writes nothing. */
jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  __esModule: true,
  wikiLoreCardGenerator: {
    fetchArticleAuthorInfoBatch: jest
      .fn()
      .mockResolvedValue(new Map([["kiro", { creator: "Kir", displayAuthor: "Kir" }]])),
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

describe("lore wiki procedures", () => {
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

  it("asks the card's own article wiki, and no file host", async () => {
    const caller = createCallerFactory(loreCardsWikiRouter)(
      createMockRouterContext({ auth: null, user: null, db: createMockPrisma() }) as never
    );
    await caller.getCardAuthorInfo({ articleTitle: "Kiro", source: "althistory" });
    expect(wikiLoreCardGenerator.fetchArticleAuthorInfoBatch).toHaveBeenLastCalledWith(
      ["Kiro"],
      "althistory"
    );
    await expect(
      caller.getCardAuthorInfo({ articleTitle: "File:Kiro.png", source: "commons" as never })
    ).rejects.toThrow();
  });
});
