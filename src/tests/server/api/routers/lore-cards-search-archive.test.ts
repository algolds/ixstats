/** @jest-environment node */
/** searchLoreArchive never fails the page: a stash lookup error falls back to an empty result. */
jest.mock("~/server/db", () => ({ db: {}, isDatabaseReadOnly: false }));

import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("loreCards.searchLoreArchive stash source", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it("returns empty items and stashes when the stash lookup rejects", async () => {
    const db = {
      stashItem: { findMany: jest.fn().mockRejectedValue(new Error("db down")) },
      stash: { findMany: jest.fn().mockRejectedValue(new Error("db down")) },
    };
    const ctx = createMockRouterContext({
      db,
      auth: { userId: "clerk_1" },
      user: { id: "u1", clerkUserId: "clerk_1" },
    });
    const caller = loreCardsWikiRouter.createCaller(ctx as never);

    await expect(caller.searchLoreArchive({ source: "stash", query: "" })).resolves.toEqual({
      items: [],
      stashes: [],
    });
  });
});
