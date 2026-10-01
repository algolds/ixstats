/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: a page WikiOS deleted is left out of `loreCards.wiki.fetchArticlePreviewsBatch`. Plan 418: IxWiki's
// pages are previewed from Postgres, and no wiki is asked.
jest.mock("~/server/db", () => {
  const helpers = jest.requireActual("~/tests/helpers/fake-lore-card-db");
  return {
    __esModule: true,
    db: {
      ...jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
      systemConfig: { findMany: async () => [] },
      ...helpers.loreCardDbExtras(helpers.loreCardQueryRaw),
    },
    isDatabaseReadOnly: true,
  };
});
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  SYSTEM_OWNER_IDS: [],
  UserManagementService: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const fetchMock = jest.fn();
const realFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
  fetchMock.mockImplementation(async (url: string) => {
    const asked = (new URL(String(url)).searchParams.get("titles") ?? "")
      .split("|")
      .filter(Boolean);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        query: {
          pages: Object.fromEntries(asked.map((title, i) => [i, { title, extract: "text" }])),
        },
      }),
    };
  });
  global.fetch = fetchMock as never;
  fakeWikiDb.tables.wikiArticle.seed(
    { source: "ixwiki", title: "Hidden land", slug: "hidden_land", status: "ARCHIVED" },
    { source: "ixwiki", title: "Shown land", slug: "shown_land", status: "PUBLISHED" }
  );
});

afterAll(() => {
  global.fetch = realFetch;
});

describe("loreCards.wiki.fetchArticlePreviewsBatch", () => {
  it("leaves out a page WikiOS deleted, and never asks the wiki about it", async () => {
    const caller = createCallerFactory(loreCardsWikiRouter)(
      createMockRouterContext({ auth: null, user: null }) as never
    );

    const { previews } = await caller.fetchArticlePreviewsBatch({
      titles: ["Hidden_land", "Shown land"],
      source: "ixwiki",
    });

    expect(previews.map((preview) => preview.title)).toEqual(["Shown land"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
