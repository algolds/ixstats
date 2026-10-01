/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see wikios-save-sanitize.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
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
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
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
const revision = (wikitext: string | null, title = "Foo bar", parked = false) => ({
  wikitext,
  title,
  source: "ixwiki",
  timestamp: "2026-06-01T00:00:00.000Z",
  parked,
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

/** Explicit group memberships of the signed-in user (plan 409: a rollback needs the rollback right). */
const mockGroups = (...groups: string[]) =>
  (db as unknown as { wikiUserGroup: { findMany: jest.Mock } }).wikiUserGroup.findMany.mockResolvedValue(
    groups.map((group) => ({ group, expiresAt: null }))
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGroups();
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

  it("refuses a parked revision (a conflicting MediaWiki edit that never went live): the head is unchanged", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision("parked text", "Foo bar", true));

    await expect(
      createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "9001" })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("never went live"),
    });
    // not saved, not exported to MediaWiki, no edge purge: the page's text is as it was
    expectNothingSaved();
    // and an admin, who may blank a page, may not restore it either
    await expect(
      createCaller(adminCtx() as never).revertToRevision({ title: "Foo bar", revid: "9001" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
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
    expect(ArticleRepository.saveArticle).toHaveBeenCalledWith(
      expect.objectContaining({ editSummary: "Reverted to revision r1 via WikiOS" }),
      expect.anything(),
      expect.anything()
    );
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

  it("treats whitespace-only text as blank: a revision of it cannot blank a page that has text", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(" \n\t  \n"));

    await expect(
      createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expectNothingSaved();
  });

  it("lets anyone restore a blank revision over a page that is only whitespace", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(""));
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(currentArticle("  \n "));

    await createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" });

    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });

  it("lets anyone restore an empty revision over a page that is already empty", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(""));
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(currentArticle(""));

    await createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r1" });

    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });
});

describe("wikiosEditingRouter.rollback (plan 402)", () => {
  beforeEach(() => {
    mockGroups("rollbacker");
  });

  it("refuses a placeholder target revision", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision(null));

    await expect(
      createCaller(userCtx() as never).rollback({ title: "Foo bar" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expectNothingSaved();
  });

  it("refuses a parked target revision, as a revert does (the history it reads leaves parked ones out; this is the second line)", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(revision("parked text", "Foo bar", true));

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

describe("wikiosEditingRouter.saveWikitext edit summary (plan 402)", () => {
  it("hands the summary to saveArticle as the edit summary, never as the article excerpt", async () => {
    await createCaller(userCtx() as never).saveWikitext({
      title: "Foo bar",
      wikitext: "Foo bar is a country.",
      summary: "fixed typo",
    });

    const [input] = jest.mocked(ArticleRepository.saveArticle).mock.calls[0] ?? [];
    expect(input).toMatchObject({ editSummary: "fixed typo" });
    expect(input).not.toHaveProperty("summary");
    expect(input).not.toHaveProperty("excerpt");
  });
});

describe("wikiosEditingRouter revert and rollback error codes (plan 402)", () => {
  beforeEach(() => {
    mockGroups("rollbacker");
  });

  it("revertToRevision answers NOT_FOUND for an unknown revision", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(null);

    await expect(
      createCaller(userCtx() as never).revertToRevision({ title: "Foo bar", revid: "r404" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Revision r404 not found." });
    expectNothingSaved();
  });

  it("rollback answers PRECONDITION_FAILED when there is nothing older to roll back to", async () => {
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [historyEntry("r1", "amy")],
      hasMore: false,
      fromShadow: true,
    });

    await expect(
      createCaller(userCtx() as never).rollback({ title: "Foo bar" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getRevisionWikitextShadow).not.toHaveBeenCalled();
    expectNothingSaved();
  });

  it("rollback answers PRECONDITION_FAILED when every revision is by the same user", async () => {
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [historyEntry("r2", "amy"), historyEntry("r1", "amy")],
      hasMore: false,
      fromShadow: true,
    });

    await expect(
      createCaller(userCtx() as never).rollback({ title: "Foo bar" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getRevisionWikitextShadow).not.toHaveBeenCalled();
    expectNothingSaved();
  });

  it("rollback answers NOT_FOUND when the target revision cannot be read", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(null);

    await expect(
      createCaller(userCtx() as never).rollback({ title: "Foo bar" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expectNothingSaved();
  });
});
