/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see wikios-save-sanitize.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
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
  PageManagementService: { restoreArticle: jest.fn() },
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
import { MediaWikiExportWorker } from "~/lib/wiki-os/adapters/mediawiki/sync-worker";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { db } from "~/server/db";

const createCaller = createCallerFactory(wikiosEditingRouter);

const userCtx = () =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", wikiUsername: "Linked", role: { name: "user", level: 100 } },
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

/** The row a revert reads: `wikitext: null` is an import placeholder of unknown text. */
const revision = (wikitext: string | null, title = "Foo bar") => ({
  wikitext,
  title,
  timestamp: "2026-06-01T00:00:00.000Z",
  fromShadow: true as const,
});

/** The current article: protection fields for the edit policy plus its present text. */
const currentArticle = (wikitext: string) =>
  ({ protectionLevel: "ALL", protectionExpiry: null, wikitext }) as never;

const historyEntry = (revid: string, user: string) => ({
  revid,
  user,
  timestamp: "",
  comment: "",
  size: 1,
  byteDelta: 0,
  minor: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  (db as unknown as { wikiAccountLink: { findFirst: jest.Mock } }).wikiAccountLink.findFirst.mockResolvedValue(
    { username: "Linked" }
  );
  jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(currentArticle("current text"));
  jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
    article: {} as never,
    revisionId: "rev-new" as never,
    extractedLinksCount: 0,
  });
  jest.mocked(getArticleHistoryShadow).mockResolvedValue({
    revisions: [historyEntry("r2", "bob"), historyEntry("r1", "amy")],
    hasMore: false,
    fromShadow: true,
  });
});

const expectNothingSaved = () => {
  expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  expect(MediaWikiExportWorker.enqueue).not.toHaveBeenCalled();
  expect(CloudflareGuardian.purgeArticleEdgeCache).not.toHaveBeenCalled();
};

describe("wikiosEditingRouter.revertToRevision (plan 402)", () => {
  it("refuses a placeholder revision whose text was never imported", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(null));

    await expect(
      createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expectNothingSaved();
  });

  it("refuses a revision of another page", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision("other text", "Baz"));

    await expect(
      createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expectNothingSaved();
  });

  it("compares the revision's page with the canonical form of the title", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision("old text", "Foo bar"));

    await createCaller(userCtx() as never).revertToRevision({ title: "foo_bar", revid: "r1" });

    expect(ArticleRepository.saveArticle).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Foo bar", wikitext: "old text" }),
      expect.anything(),
      expect.anything()
    );
  });

  it("saves, exports and purges the edge cache once for a valid revert", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision("old text"));

    const result = await createCaller(userCtx() as never).revertToRevision({
      title: "Foo bar",
      revid: "r1",
    });

    expect(result).toMatchObject({ success: true, title: "Foo bar", revisionId: "rev-new" });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
    expect(MediaWikiExportWorker.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Foo bar", wikitext: "old text", revisionId: "rev-new" })
    );
    expect(CloudflareGuardian.purgeArticleEdgeCache).toHaveBeenCalledTimes(1);
    expect(CloudflareGuardian.purgeArticleEdgeCache).toHaveBeenCalledWith("Foo bar");
  });

  it("refuses to blank a page that has text, unless the caller is a wiki admin", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(""));

    await expect(
      createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expectNothingSaved();

    await createCaller(adminCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledWith(
      expect.objectContaining({ wikitext: "" }),
      expect.anything(),
      expect.anything()
    );
  });

  it("lets anyone restore an empty revision over a page that is already empty", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(""));
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(currentArticle(""));

    await createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" });

    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });
});

describe("wikiosEditingRouter.rollback (plan 402)", () => {
  it("refuses a placeholder target revision", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(null));

    await expect(
      createCaller(userCtx() as never).rollback({ title: "Foo bar" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expectNothingSaved();
  });

  it("refuses a target revision of another page", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision("other text", "Baz"));

    await expect(
      createCaller(userCtx() as never).rollback({ title: "Foo bar" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expectNothingSaved();
  });

  it("refuses to blank a page that has text, unless the caller is a wiki admin", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(""));

    await expect(
      createCaller(userCtx() as never).rollback({ title: "Foo bar" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expectNothingSaved();

    await createCaller(adminCtx() as never).rollback({ title: "Foo bar" });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });

  it("rolls back to the last other editor's revision and purges the edge cache once", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision("amy's text"));

    await createCaller(userCtx() as never).rollback({ title: "Foo bar" });

    expect(getRevisionWikitextShadow).toHaveBeenCalledWith("r1");
    expect(ArticleRepository.saveArticle).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Foo bar", wikitext: "amy's text" }),
      expect.anything(),
      expect.anything()
    );
    expect(MediaWikiExportWorker.enqueue).toHaveBeenCalledTimes(1);
    expect(CloudflareGuardian.purgeArticleEdgeCache).toHaveBeenCalledTimes(1);
    expect(CloudflareGuardian.purgeArticleEdgeCache).toHaveBeenCalledWith("Foo bar");
  });
});
