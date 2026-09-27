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

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";
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

  it("forbids restoreArticle for a non-admin", async () => {
    const caller = createCaller(userCtx("Linked") as never);
    await expect(caller.restoreArticle({ title: "Page" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(PageManagementService.restoreArticle).not.toHaveBeenCalled();
  });
});
