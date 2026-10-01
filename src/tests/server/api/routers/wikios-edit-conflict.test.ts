/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see wikios-save-sanitize.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiUserGroup: { findMany: jest.fn().mockResolvedValue([]) },
    wikiBlock: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRestriction: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRevision: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
}));
// The edit-conflict module reads the repository directly, the router through the core barrel:
// both see the same three functions.
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), saveArticle: jest.fn(), getHistory: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: jest.requireMock("~/lib/wiki-os/core/article-repository").ArticleRepository,
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  __esModule: true,
  PageManagementService: { restoreArticle: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  wikitextToHtml: jest.fn(),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  __esModule: true,
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";

const createCaller = createCallerFactory(wikiosEditingRouter);

const caller = () =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", wikiUsername: "Linked", role: { name: "user", level: 100 } },
    }) as never
  );

/** The latest revision row of the page: a native WikiOS edit (no MediaWiki rev_id) or a synced one. */
const headRevision = (id: string, mwRevId: number | null = null) =>
  [{ id, mwRevId }] as never;

const currentArticle = (wikitext: string) => ({ protectionLevel: "ALL", wikitext }) as never;

const pageNowHeadedBy = (revisions: ReturnType<typeof headRevision>, wikitext = "Current text") => {
  jest.mocked(ArticleRepository.getHistory).mockResolvedValue(revisions);
  jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(currentArticle(wikitext));
};

describe("wikiosEditingRouter.saveWikitext edit conflicts (WK-2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
      article: {} as never,
      revisionId: "rev-new" as never,
      extractedLinksCount: 0,
    });
  });

  it("returns an edit conflict and saves nothing when the base revision is stale", async () => {
    pageNowHeadedBy(headRevision("rev-2"), "Somebody else's text");

    const result = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "My text",
      baseRevisionRef: "rev-1",
    });

    expect(result).toEqual({
      success: false,
      editConflict: true,
      currentWikitext: "Somebody else's text",
      currentRevisionRef: "rev-2",
    });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it("saves when the base revision is the latest one", async () => {
    pageNowHeadedBy(headRevision("rev-2"));

    const result = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "My text",
      baseRevisionRef: "rev-2",
    });

    expect(result).toMatchObject({ success: true, revisionId: "rev-new" });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });

  it("compares a revision synced from MediaWiki by its rev_id", async () => {
    pageNowHeadedBy(headRevision("cuid-of-row", 4321));

    const saved = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "x",
      baseRevisionRef: "4321",
    });
    expect(saved).toMatchObject({ success: true });

    const stale = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "x",
      baseRevisionRef: "4320",
    });
    expect(stale).toMatchObject({ editConflict: true, currentRevisionRef: "4321" });
  });

  it("does not conflict with its own revision once the export worker has stamped its rev_id", async () => {
    // The editor was opened while the head was known by its row id; the worker stamps it meanwhile.
    pageNowHeadedBy(headRevision("cuid-of-row", 4321));

    const result = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "x",
      baseRevisionRef: "cuid-of-row",
    });

    expect(result).toMatchObject({ success: true });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });

  it("conflicts when a page the editor believed new was created in the meantime", async () => {
    pageNowHeadedBy(headRevision("rev-1"), "Created by somebody else");

    const result = await caller().saveWikitext({ title: "Brand New Page", wikitext: "Mine" });

    expect(result).toMatchObject({
      success: false,
      editConflict: true,
      currentWikitext: "Created by somebody else",
      currentRevisionRef: "rev-1",
    });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it("saves a really new page, with no base and no revision", async () => {
    jest.mocked(ArticleRepository.getHistory).mockResolvedValue([]);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);

    const result = await caller().saveWikitext({ title: "Brand New Page", wikitext: "Mine" });

    expect(result).toMatchObject({ success: true });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });

  it("conflicts when the editor had a base but the page has no revision any more", async () => {
    jest.mocked(ArticleRepository.getHistory).mockResolvedValue([]);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);

    const result = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: "rev-1",
    });

    expect(result).toMatchObject({ editConflict: true, currentWikitext: "", currentRevisionRef: null });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it("saves on top of the current version when the editor resends the ref it was given ('Save anyway')", async () => {
    pageNowHeadedBy(headRevision("rev-2"));
    const first = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: "rev-1",
    });
    expect(first).toMatchObject({ editConflict: true });
    if (!("currentRevisionRef" in first) || first.currentRevisionRef === null) throw new Error("no ref");

    const second = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: first.currentRevisionRef,
    });
    expect(second).toMatchObject({ success: true });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });

  it("checks the conflict for the canonical title", async () => {
    pageNowHeadedBy(headRevision("rev-2"));
    await caller().saveWikitext({ title: "vesperia_city", wikitext: "x", baseRevisionRef: "rev-2" });
    expect(ArticleRepository.getHistory).toHaveBeenCalledWith("Vesperia city", "ixwiki", 1);
  });
});
