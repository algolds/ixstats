/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409 (security review): a deleted (archived) page's text must not come back from ANY reader of
// page text, for a signed-out or ordinary caller: the wiki routers, the lore-card, country, map and
// cache readers, and the repository/bridge/shadow functions underneath. The archived page holds a marker
// string; every read is asked for it, and live MediaWiki (whose own copy may still exist) is never asked.
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

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { wikiosHistoryDiffRouter } from "~/server/api/routers/wikios/history-diff";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { wikiProcedures } from "~/server/api/routers/countries/wiki";
import { geoWikiRouter } from "~/server/api/routers/geo/wiki";
import { wikiCacheRouter } from "~/server/api/routers/wikiCache";
import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { cardsCollectionsRouter } from "~/server/api/routers/cards/collections";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import {
  getArticleIntro,
  getArticleWikitext,
  getInfobox,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleSummaryFromShadow } from "~/lib/wiki-os/core/native-search-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;
const HIDDEN = "ARCHIVED-MARKER-7f3a9";
const SHOWN = "PUBLISHED-MARKER-51c2e";
const TEXT = (marker: string) => `{{Infobox country|name=${marker}}}\n${marker} is a kingdom.\n`;

const ctxOf = (role: string | null) =>
  createMockRouterContext({
    ...(role
      ? {
          auth: { userId: "user_1" },
          user: { id: "db1", clerkUserId: "user_1", role: { name: role, level: 100 } },
        }
      : { auth: null, user: null }),
    db: { ...fakeWikiDb.db, card: { findMany: async () => [] } },
  }) as never;

const call = <T extends Parameters<typeof createCallerFactory>[0]>(
  router: T,
  role: string | null
) => createCallerFactory(router)(ctxOf(role));
const fetchMock = jest.fn();
const realFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
  fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  global.fetch = fetchMock as never;
  tables.wikiArticle.seed(
    {
      source: "ixwiki",
      title: "Hidden land",
      slug: "hidden_land",
      namespace: 0,
      status: "ARCHIVED",
      wikitext: TEXT(HIDDEN),
      contentHtml: `<p>${HIDDEN}</p>`,
      summary: HIDDEN,
      // The fake ignores `select`: the relations the article view reads are plain fields here.
      revisions: [],
      categories: [],
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    },
    {
      source: "ixwiki",
      title: "Shown land",
      slug: "shown_land",
      namespace: 0,
      status: "PUBLISHED",
      wikitext: TEXT(SHOWN),
      contentHtml: `<p>${SHOWN}</p>`,
      summary: SHOWN,
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    }
  );
});

afterEach(() => {
  global.fetch = realFetch;
});

const leaks = (value: unknown) => JSON.stringify(value ?? null).includes(HIDDEN);

/** Every reader of page text, asked for `title` by a caller of `role`; rejections count as "no text". */
const READERS: Array<[string, (role: string | null, title: string) => Promise<unknown>]> = [
  ["ArticleRepository.findBySlug", async (_r, t) => ArticleRepository.findBySlug(t)],
  ["ArticleRepository.getArticleBySlug", async (_r, t) => ArticleRepository.getArticleBySlug(t)],
  ["getArticleWikitextShadow", async (_r, t) => getArticleWikitextShadow(t, "ixwiki")],
  ["bridge.getArticleWikitext", async (_r, t) => getArticleWikitext(t, "ixwiki")],
  ["bridge.getArticleIntro", async (_r, t) => getArticleIntro(t, "ixwiki")],
  ["bridge.getInfobox", async (_r, t) => getInfobox(t, "ixwiki")],
  ["getArticleSummaryFromShadow", async (_r, t) => getArticleSummaryFromShadow(t, "ixwiki")],
  ["wikios.getWikitext", (r, t) => call(wikiosPageContentRouter, r).getWikitext({ title: t })],
  ["wikios.getIntro", (r, t) => call(wikiosPageContentRouter, r).getIntro({ title: t })],
  ["wikios.getInfobox", (r, t) => call(wikiosPageContentRouter, r).getInfobox({ title: t })],
  [
    "wikios.getSectionContent",
    (r, t) => call(wikiosPageContentRouter, r).getSectionContent({ title: t, section: "x" }),
  ],
  [
    "wikios.getArticleHtml",
    (r, t) => call(wikiosPageContentRouter, r).getArticleHtml({ title: t }),
  ],
  ["wikios.getHistory", (r, t) => call(wikiosHistoryDiffRouter, r).getHistory({ title: t })],
  ["wikios.getBacklinks", (r, t) => call(wikiosUserTalkRouter, r).getBacklinks({ title: t })],
  [
    "countries.getWikiIntro",
    (r, t) => call(createTRPCRouter(wikiProcedures), r).getWikiIntro({ countryName: t }),
  ],
  [
    "countries.parseInfobox",
    (r, t) =>
      call(createTRPCRouter(wikiProcedures), r).parseInfobox({ pageName: t, site: "ixwiki" }),
  ],
  [
    "geo.getFeatureWikiIntro",
    (r, t) => call(geoWikiRouter, r).getFeatureWikiIntro({ wikiPageTitle: t }),
  ],
  [
    "wikiCache.getCountryProfile",
    (r, t) => call(wikiCacheRouter, r).getCountryProfile({ countryName: t }),
  ],
  [
    "cards.getWikiArticleExcerpt",
    (r, t) =>
      call(cardsCollectionsRouter, r).getWikiArticleExcerpt({
        articleTitle: t,
        wikiSource: "ixwiki",
      }),
  ],
  [
    "loreCards.fetchLoreMetadata",
    (r, t) => call(loreCardsWikiRouter, r).fetchLoreMetadata({ source: "ixwiki", pageTitle: t }),
  ],
  [
    "loreCards.searchLoreArchive",
    (r) => call(loreCardsWikiRouter, r).searchLoreArchive({ source: "wikios", query: "land" }),
  ],
];

describe.each(READERS)("%s", (_name, read) => {
  it.each([[null], ["user"]])(
    "never returns a deleted page's text to a %p caller",
    async (role) => {
      const result = await read(role, "Hidden land").catch(() => null);
      expect(leaks(result)).toBe(false);
    }
  );

  it("never asks the live IxWiki about a deleted page", async () => {
    await read(null, "Hidden land").catch(() => null);
    const asked = fetchMock.mock.calls
      .map((call) => new URL(String(call[0])))
      .filter((url) => url.hostname.endsWith("ixwiki.com") && /hidden.land/i.test(url.search));
    expect(asked).toEqual([]);
  });
});

describe("the same readers still serve a published page", () => {
  it.each([
    ["ArticleRepository.findBySlug", async () => ArticleRepository.findBySlug("Shown land")],
    ["getArticleWikitextShadow", async () => getArticleWikitextShadow("Shown land", "ixwiki")],
    ["bridge.getArticleWikitext", async () => getArticleWikitext("Shown land", "ixwiki")],
    ["bridge.getArticleIntro", async () => getArticleIntro("Shown land", "ixwiki")],
    [
      "wikios.getWikitext",
      async () => call(wikiosPageContentRouter, null).getWikitext({ title: "Shown land" }),
    ],
  ])("%s", async (_name, read) => {
    expect(JSON.stringify(await read())).toContain(SHOWN);
  });
});

describe("searchLoreArchive", () => {
  it("lists published pages and leaves deleted ones out", async () => {
    const found = await call(loreCardsWikiRouter, null).searchLoreArchive({
      source: "wikios",
      query: "land",
    });
    expect(JSON.stringify(found)).toContain("Shown land");
    expect(JSON.stringify(found)).not.toContain("Hidden land");
  });
});

describe("getUserContribs: the PostgreSQL fallback", () => {
  it("lists contributions to published pages only", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const caller = createCallerFactory(wikiosUserTalkRouter)(
      createMockRouterContext({
        auth: null,
        user: null,
        db: { ...fakeWikiDb.db, wikiRevision: { findMany } },
      }) as never
    );

    await caller.getUserContribs({ user: "Amy" });

    expect(findMany.mock.calls[0]?.[0].where.article).toEqual({
      namespace: 0,
      status: "PUBLISHED",
    });
  });
});

describe("a caller with deletedhistory", () => {
  it("still reads a deleted page where the plan says so, and only there", async () => {
    const admin = "admin";
    await expect(
      call(wikiosPageContentRouter, admin).getWikitext({ title: "Hidden land" })
    ).resolves.toMatchObject({ wikitext: TEXT(HIDDEN) });
    await expect(
      call(wikiosPageContentRouter, admin).getArticleHtml({ title: "Hidden land" })
    ).resolves.toMatchObject({ title: "Hidden land" });
    await expect(
      call(wikiosPageContentRouter, admin).checkPageExists({ title: "Hidden land" })
    ).resolves.toMatchObject({ exists: true });
    // the repository hides it unless asked
    await expect(ArticleRepository.findBySlug("Hidden land")).resolves.toBeNull();
    await expect(
      ArticleRepository.findBySlug("Hidden land", "ixwiki", { includeArchived: true })
    ).resolves.toMatchObject({ status: "ARCHIVED" });
    await expect(
      getArticleWikitextShadow("Hidden land", "ixwiki", { includeArchived: true })
    ).resolves.toMatchObject({ wikitext: TEXT(HIDDEN) });
  });
});
