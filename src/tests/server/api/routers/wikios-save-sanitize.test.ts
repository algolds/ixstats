/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
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
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), saveArticle: jest.fn() },
  MediaAssetService: { registerAsset: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  __esModule: true,
  PageManagementService: {
    restoreArticle: jest.fn(),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  wikitextToHtml: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/sync-worker", () => ({
  __esModule: true,
  MediaWikiExportWorker: { enqueue: jest.fn() },
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  __esModule: true,
  CloudflareGuardian: { verifyTurnstile: jest.fn(), purgeArticleEdgeCache: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/write-service", () => ({
  __esModule: true,
  executeMediaWikiWrite: jest.fn(),
}));
// Edit conflicts have their own suite (wikios-edit-conflict.test.ts); here no save ever conflicts.
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({
  __esModule: true,
  detectEditConflict: jest.fn().mockResolvedValue(null),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { MediaWikiExportWorker } from "~/lib/wiki-os/adapters/mediawiki/sync-worker";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { wikitextToHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";

const createCaller = createCallerFactory(wikiosEditingRouter);

const userCtx = (wikiUsername: string | null = null) =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", wikiUsername, role: { name: "user", level: 100 } },
  });

const protectedArticle = (protectionLevel: string) =>
  ({ protectionLevel, protectionExpiry: null }) as never;

describe("wikiosEditingRouter.saveWikitext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forbids saveWikitext on a SYSOP-protected page for a non-admin", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(protectedArticle("SYSOP"));
    const caller = createCaller(userCtx("Linked") as never);

    await expect(caller.saveWikitext({ title: "Locked", wikitext: "x" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });
});

describe("wikiosEditingRouter page management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(protectedArticle("ALL"));
  });

  it("forbids restoreArticle for a non-admin", async () => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.restoreArticle({ title: "Page" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(PageManagementService.restoreArticle).not.toHaveBeenCalled();
  });
});

const adminCtx = () =>
  createMockRouterContext({
    auth: { userId: "system_owner_id" },
    user: {
      id: "dbadmin",
      clerkUserId: "system_owner_id",
      wikiUsername: "Admin",
      role: { name: "admin", level: 0 },
    },
  });

describe("wikiosEditingRouter namespace allowlist (NEW-1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
      article: {} as never,
      revisionId: "rev-1" as never,
      extractedLinksCount: 0,
    });
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValue({ wikitext: "old", title: "X", timestamp: "", fromShadow: true });
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
        },
        {
          revid: "r1",
          user: "amy",
          timestamp: "",
          comment: "",
          size: 1,
          byteDelta: 0,
          minor: false,
        },
      ],
      hasMore: false,
      fromShadow: true,
    });
  });

  const forbidden = [
    "Template:Infobox",
    "Module:Foo",
    "MediaWiki:Common.js",
    "User:Someone/common.js",
  ];

  it.each(forbidden)("saveWikitext refuses %s for a non-admin", async (title) => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.saveWikitext({ title, wikitext: "x" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    expect(MediaWikiExportWorker.enqueue).not.toHaveBeenCalled();
  });

  it.each(forbidden)("revertToRevision refuses %s for a non-admin", async (title) => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.revertToRevision({ title, revid: "r1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it.each(forbidden)("rollback refuses %s for a non-admin", async (title) => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.rollback({ title })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it("allows an article, the user's own page, and passes the revision id to the export", async () => {
    const caller = createCaller(userCtx("Linked") as never);
    await caller.saveWikitext({ title: "Caphiria", wikitext: "x" });
    await caller.saveWikitext({ title: "User:Linked/Notes", wikitext: "x" });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(2);
    expect(MediaWikiExportWorker.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Caphiria", revisionId: "rev-1" })
    );
  });

  it("refuses another user's page and a user page without a linked account", async () => {
    await expect(
      createCaller(userCtx("Linked") as never).saveWikitext({ title: "User:Other", wikitext: "x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createCaller(userCtx(null) as never).saveWikitext({ title: "User:Linked", wikitext: "x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a wiki admin edit interface namespaces", async () => {
    const caller = createCaller(adminCtx() as never);
    await caller.saveWikitext({ title: "Template:Infobox", wikitext: "x" });
    await caller.revertToRevision({ title: "MediaWiki:Sidebar", revid: "r1" });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(2);
  });
});

describe("wikiosEditingRouter.previewWikitext (NEW-13)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(wikitextToHtml).mockResolvedValue("<p>hi</p>");
  });

  it("rejects an anonymous caller", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const caller = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    await expect(caller.previewWikitext({ wikitext: "hi", title: "T" })).rejects.toThrow(
      /Authentication required/
    );
    expect(wikitextToHtml).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("renders for a signed-in user", async () => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.previewWikitext({ wikitext: "hi", title: "T" })).resolves.toHaveProperty(
      "html"
    );
  });
});

describe("wikiosEditingRouter canonical titles (plan 403)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
      article: {} as never,
      revisionId: "rev-1" as never,
      extractedLinksCount: 0,
    });
  });

  it("saves, exports and reports the canonical title whatever spelling was sent", async () => {
    const caller = createCaller(userCtx("Linked") as never);

    const result = await caller.saveWikitext({ title: "foo_bar", wikitext: "x" });

    expect(result.title).toBe("Foo bar");
    expect(ArticleRepository.saveArticle).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "Foo bar", title: "Foo bar" }),
      expect.anything(),
      expect.anything()
    );
    expect(MediaWikiExportWorker.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Foo bar" })
    );
  });

  it("refuses a title MediaWiki would refuse before saving anything", async () => {
    const caller = createCaller(userCtx("Linked") as never);

    await expect(caller.saveWikitext({ title: "a[b", wikitext: "x" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });
});

describe("wikiosEditingRouter preview and restore canonical titles (plan 403)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(wikitextToHtml).mockResolvedValue("<p>hi</p>");
    jest
      .mocked(PageManagementService.restoreArticle)
      .mockResolvedValue({ success: true, articleId: "a1" });
  });

  it("previews against the canonical title", async () => {
    const caller = createCaller(userCtx("Linked") as never);

    await caller.previewWikitext({ wikitext: "hi", title: "user_talk:jane" });

    expect(wikitextToHtml).toHaveBeenCalledWith("hi", "User talk:Jane");
  });

  it("refuses to preview a title MediaWiki would refuse", async () => {
    const caller = createCaller(userCtx("Linked") as never);

    await expect(caller.previewWikitext({ wikitext: "hi", title: "a[b" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(wikitextToHtml).not.toHaveBeenCalled();
  });

  it("restores by the canonical title", async () => {
    const caller = createCaller(adminCtx() as never);

    await caller.restoreArticle({ title: "foo_bar" });

    expect(PageManagementService.restoreArticle).toHaveBeenCalledWith(
      "Foo bar",
      "system_owner_id",
      "ixwiki"
    );
  });

  it("checks the admin right before the title, and refuses an invalid title", async () => {
    await expect(
      createCaller(userCtx("Linked") as never).restoreArticle({ title: "a[b" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createCaller(adminCtx() as never).restoreArticle({ title: "a[b" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(PageManagementService.restoreArticle).not.toHaveBeenCalled();
  });
});
