/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: every read of a single page hides a deleted (archived) page from readers without
// `deletedhistory`; the list of deleted pages is for those who may browse them.
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
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), findMissingTitles: jest.fn() },
  MediaAssetService: {},
  LinkGraphService: { getBacklinks: jest.fn().mockResolvedValue([]) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  getArticleHtml: jest.fn(),
  renderArticleViaMediaWiki: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleWikitext: jest.fn(),
  resolveRedirect: jest.fn(async (title: string) => ({ title, fragment: null })),
  getInfobox: jest.fn().mockResolvedValue({ fields: {} }),
  getImageMeta: jest.fn(),
  getPageImages: jest.fn().mockResolvedValue(["Flag.png"]),
  batchFetchThumbnails: jest.fn().mockResolvedValue(new Map()),
  getParentCategories: jest.fn().mockResolvedValue(["Nations"]),
  getBacklinks: jest.fn().mockResolvedValue([]),
  getSiteStats: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
  saveArticleHtmlShadow: jest.fn(),
  getArticleHtmlShadow: jest.fn(),
  getArticleAuthors: jest.fn().mockResolvedValue(null),
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/native-search-service", () => ({
  __esModule: true,
  getArticleSummaryFromShadow: jest
    .fn()
    .mockResolvedValue({ title: "Caphiria", intro: "An intro" }),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { wikiosHistoryDiffRouter } from "~/server/api/routers/wikios/history-diff";
import { wikiosCategoriesRouter } from "~/server/api/routers/wikios/categories";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { wikiosDiscussionsRouter } from "~/server/api/routers/wikios/discussions";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import {
  getArticleHistoryShadow,
  getArticleWikitextShadow,
  getRevisionWikitextShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { batchFetchThumbnails } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const { tables } = fakeWikiDb;

const ctxOf = (role: string | null) =>
  createMockRouterContext(
    role
      ? {
          auth: { userId: "user_1" },
          user: { id: "db1", clerkUserId: "user_1", role: { name: role, level: 100 } },
        }
      : { auth: null, user: null }
  ) as never;

const content = (role: string | null) => createCallerFactory(wikiosPageContentRouter)(ctxOf(role));
const history = (role: string | null) => createCallerFactory(wikiosHistoryDiffRouter)(ctxOf(role));
const categories = (role: string | null) =>
  createCallerFactory(wikiosCategoriesRouter)(ctxOf(role));
const userTalk = (role: string | null) => createCallerFactory(wikiosUserTalkRouter)(ctxOf(role));
const discussions = (role: string | null) =>
  createCallerFactory(wikiosDiscussionsRouter)(ctxOf(role));
const utilities = (role: string | null) => createCallerFactory(wikiosUtilitiesRouter)(ctxOf(role));

const revision = {
  wikitext: "== Geography ==\nHills.",
  title: "Caphiria",
  source: "ixwiki",
  timestamp: "2026-06-01T00:00:00.000Z",
  fromShadow: true as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
  tables.wikiArticle.seed(
    { source: "ixwiki", title: "Caphiria", slug: "caphiria", status: "ARCHIVED" },
    { source: "ixwiki", title: "Urcea", slug: "urcea", status: "PUBLISHED" }
  );
  jest.mocked(getArticleWikitextShadow).mockResolvedValue({
    wikitext: "== Geography ==\nHills.",
    revid: 1,
    timestamp: "2026-06-01T00:00:00Z",
  } as never);
  jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision);
  jest.mocked(getArticleHistoryShadow).mockResolvedValue({
    revisions: [
      {
        revid: "r2",
        user: "bob",
        timestamp: "",
        comment: "",
        size: 1,
        byteDelta: 0,
        minor: false,
        sha1: null,
      },
      {
        revid: "r1",
        user: "amy",
        timestamp: "",
        comment: "",
        size: 1,
        byteDelta: 0,
        minor: false,
        sha1: null,
      },
    ],
    hasMore: false,
    fromShadow: true,
  });
});

/** One read of the deleted page "Caphiria" (and of the published page "Urcea"), as a caller of a given role. */
const READS: Array<[string, (role: string | null, title: string) => Promise<unknown>]> = [
  ["getWikitext", (r, title) => content(r).getWikitext({ title })],
  ["getArticleAuthors", (r, title) => content(r).getArticleAuthors({ title })],
  ["getIntro", (r, title) => content(r).getIntro({ title })],
  ["getInfobox", (r, title) => content(r).getInfobox({ title })],
  [
    "getSectionContent",
    (r, title) => content(r).getSectionContent({ title, section: "Geography" }),
  ],
  ["getPageImages", (r, title) => content(r).getPageImages({ title })],
  ["getHistory", (r, title) => history(r).getHistory({ title })],
  ["getParentCategories", (r, title) => categories(r).getParentCategories({ title })],
  ["getBacklinks", (r, title) => userTalk(r).getBacklinks({ title })],
  [
    "getArticleMarginData",
    (r, title) => discussions(r).getArticleMarginData({ articleTitle: title }),
  ],
];

describe.each(READS)("%s", (_name, read) => {
  it.each([[null], ["user"]])(
    "is NOT_FOUND for a deleted page when the caller is %p",
    async (role) => {
      await expect(read(role, "Caphiria")).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  );

  it("is served to a sysop, who holds deletedhistory", async () => {
    await expect(read("admin", "Caphiria")).resolves.toBeDefined();
  });

  it("is served to everyone for a published page", async () => {
    await expect(read(null, "Urcea")).resolves.toBeDefined();
  });

  it("finds the deleted page whatever spelling the title comes in", async () => {
    await expect(read("user", "caphiria")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("revision reads of a deleted page", () => {
  it("getRevisionContent is NOT_FOUND for a reader without deletedhistory, served to a sysop", async () => {
    await expect(history("user").getRevisionContent({ revid: "r1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(history("admin").getRevisionContent({ revid: "r1" })).resolves.toMatchObject({
      title: "Caphiria",
    });
  });

  it("getDiff is NOT_FOUND when either revision belongs to a deleted page", async () => {
    await expect(history("user").getDiff({ torev: "r2" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // a revision of a published page diffed against one of the deleted page
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce({ ...revision, title: "Urcea" })
      .mockResolvedValueOnce(revision);
    await expect(history("user").getDiff({ torev: "r2", fromrev: "r1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getDiff works for a published page", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue({ ...revision, title: "Urcea" });
    await expect(history(null).getDiff({ torev: "r2" })).resolves.toHaveProperty("hunks");
  });
});

describe("checkPageExists", () => {
  it("says a deleted page does not exist for a reader who may not see it, and that it does for a sysop", async () => {
    await expect(content("user").checkPageExists({ title: "Caphiria" })).resolves.toEqual({
      exists: false,
      resolvedTitle: "Caphiria",
    });
    await expect(content("admin").checkPageExists({ title: "Caphiria" })).resolves.toMatchObject({
      exists: true,
    });
    await expect(content(null).checkPageExists({ title: "Urcea" })).resolves.toMatchObject({
      exists: true,
    });
  });
});

describe("getArticleThumbnails", () => {
  it("asks only for the pages the reader may see", async () => {
    await content("user").getArticleThumbnails({ titles: ["Caphiria", "urcea", "Elsewhere"] });
    expect(batchFetchThumbnails).toHaveBeenCalledWith(["urcea", "Elsewhere"]);
  });

  it("asks for every page when the reader holds deletedhistory", async () => {
    await content("admin").getArticleThumbnails({ titles: ["Caphiria", "Urcea"] });
    expect(batchFetchThumbnails).toHaveBeenCalledWith(["Caphiria", "Urcea"]);
  });
});

describe("getArchivedArticles", () => {
  it("lists deleted pages only for someone who may browse them, and never their editors' ids", async () => {
    tables.wikiArticle.rows[0]!.lastEditorId = "dbsecret";

    await expect(utilities(null).getArchivedArticles({})).resolves.toEqual([]);
    await expect(utilities("user").getArchivedArticles({})).resolves.toEqual([]);

    const listed = await utilities("admin").getArchivedArticles({});
    expect(listed.map((row) => row.title)).toEqual(["Caphiria"]);
  });
});
