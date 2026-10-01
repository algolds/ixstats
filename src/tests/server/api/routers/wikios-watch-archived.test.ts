/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 416: a deleted (archived) page does not exist to someone who may not browse deleted pages, so
// they cannot put it on their watchlist (which would also tell them it exists, and make them a
// recipient of its restore notice). A user with `deletedhistory` may.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  SYSTEM_OWNER_IDS: ["user_owner"],
  UserManagementService: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;

const watcher = (role: string) =>
  createCallerFactory(wikiosWatchlistAnnotationsRouter)(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db_1", clerkUserId: "user_1", role: { name: role, level: 100 } },
      db: fakeWikiDb.db,
    }) as never
  );

beforeEach(() => {
  fakeWikiDb.reset();
});

describe("watchPage", () => {
  it("watches a published page: the watch row and the Watchlist stash item", async () => {
    tables.wikiArticle.seed({ source: "ixwiki", title: "Caphiria", status: "PUBLISHED" });

    await expect(watcher("user").watchPage({ pageTitle: "Caphiria" })).resolves.toEqual({
      success: true,
    });

    expect(tables.wikiWatchlist.rows).toHaveLength(1);
    expect(tables.stashItem.rows).toHaveLength(1);
  });

  it.each([["user"], ["Legacy"]])(
    "answers NOT_FOUND for a deleted page and writes nothing (role %s)",
    async (role) => {
      tables.wikiArticle.seed({ source: "ixwiki", title: "Gone page", status: "ARCHIVED" });

      await expect(watcher(role).watchPage({ pageTitle: "Gone_page" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      expect(tables.wikiWatchlist.rows).toHaveLength(0);
      expect(tables.stash.rows).toHaveLength(0);
      expect(tables.stashItem.rows).toHaveLength(0);
    }
  );

  it("lets a sysop (deletedhistory) watch a deleted page", async () => {
    tables.wikiArticle.seed({ source: "ixwiki", title: "Gone page", status: "ARCHIVED" });

    await expect(watcher("admin").watchPage({ pageTitle: "Gone page" })).resolves.toEqual({
      success: true,
    });

    expect(tables.wikiWatchlist.rows).toHaveLength(1);
  });

  it("still watches a title with no article yet, as before (the stash keeps it)", async () => {
    await expect(watcher("user").watchPage({ pageTitle: "Not yet written" })).resolves.toEqual({
      success: true,
    });

    expect(tables.wikiWatchlist.rows).toHaveLength(0);
    expect(tables.stashItem.rows).toHaveLength(1);
  });
});
