/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see wikios-template-auth.test.ts):
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
    movePage: jest.fn(),
    archiveArticle: jest.fn(),
    restoreArticle: jest.fn(),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  htmlToWikitext: jest.fn(),
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
  cleanHtmlForParsoid: (html: string) => html,
  executeMediaWikiWrite: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { htmlToWikitext } from "~/lib/wiki-os/adapters/mediawiki/parsoid";

const createCaller = createCallerFactory(wikiosEditingRouter);

const userCtx = (wikiUsername: string | null = null) =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", wikiUsername, role: { name: "user", level: 100 } },
  });

const adminCtx = () =>
  createMockRouterContext({
    auth: { userId: "system_owner_id" },
    user: { id: "db_owner", clerkUserId: "system_owner_id", role: { name: "owner", level: 0 } },
  });

const protectedArticle = (protectionLevel: string) =>
  ({ protectionLevel, protectionExpiry: null }) as never;

describe("wikiosEditingRouter.saveArticle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
      revisionId: "rev1",
      extractedLinksCount: 0,
    } as never);
    jest.mocked(htmlToWikitext).mockResolvedValue({ wikitext: "ok" } as never);
  });

  it("stores sanitized HTML but gives Parsoid the original", async () => {
    const html = '<p>ok</p><img src=x onerror="alert(1)">';
    const caller = createCaller(userCtx() as never);

    await caller.saveArticle({ title: "Test_Page", html });

    expect(htmlToWikitext).toHaveBeenCalledWith(html, "Test_Page");
    const saved = jest.mocked(ArticleRepository.saveArticle).mock.calls[0]![0];
    expect(saved.contentHtml).toContain("<p>ok</p>");
    expect(saved.contentHtml).not.toContain("onerror");
  });

  it("forbids a non-admin from saving a SYSOP-protected page", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(protectedArticle("SYSOP"));
    const caller = createCaller(userCtx("Linked") as never);

    await expect(caller.saveArticle({ title: "Locked", html: "<p>x</p>" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it("forbids saveWikitext on a SYSOP-protected page for a non-admin", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(protectedArticle("SYSOP"));
    const caller = createCaller(userCtx("Linked") as never);

    await expect(
      caller.saveWikitext({ title: "Locked", wikitext: "x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });
});

describe("wikiosEditingRouter page management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(protectedArticle("ALL"));
  });

  it("forbids archiveArticle for a non-admin", async () => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.archiveArticle({ title: "Page" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(PageManagementService.archiveArticle).not.toHaveBeenCalled();
  });

  it("lets an admin archive", async () => {
    const caller = createCaller(adminCtx() as never);
    await caller.archiveArticle({ title: "Page" });
    expect(PageManagementService.archiveArticle).toHaveBeenCalled();
  });

  it("forbids restoreArticle for a non-admin", async () => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.restoreArticle({ title: "Page" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(PageManagementService.restoreArticle).not.toHaveBeenCalled();
  });

  it("forbids moving a SYSOP-protected page for a linked non-admin", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(protectedArticle("SYSOP"));
    const caller = createCaller(userCtx("Linked") as never);
    await expect(
      caller.movePage({ oldTitle: "Old", newTitle: "New" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(PageManagementService.movePage).not.toHaveBeenCalled();
  });

  it("forbids moving without a linked wiki account", async () => {
    const caller = createCaller(userCtx(null) as never);
    await expect(
      caller.movePage({ oldTitle: "Old", newTitle: "New" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(PageManagementService.movePage).not.toHaveBeenCalled();
  });

  it("lets a user with a linked wiki account move an unprotected page", async () => {
    const caller = createCaller(userCtx("Linked") as never);
    await caller.movePage({ oldTitle: "Old", newTitle: "New" });
    expect(PageManagementService.movePage).toHaveBeenCalledWith(
      "Old",
      "New",
      "Renamed via WikiOS",
      "user_1",
      "ixwiki"
    );
  });
});
