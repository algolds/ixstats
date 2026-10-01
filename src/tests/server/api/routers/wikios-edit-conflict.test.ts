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
// The save makes the edit-conflict check itself (ArticleRepository.saveArticle, atomically: see
// article-repository.test.ts); here the repository is a model of a page with one head revision.
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), saveArticle: jest.fn() },
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
import { EditConflictError, headMatchesBase } from "~/lib/wiki-os/core/edit-conflict-error";
import { PageBusyError } from "~/lib/wiki-os/core/page-busy-error";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";

const createCaller = createCallerFactory(wikiosEditingRouter);

const caller = () =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", wikiUsername: "Linked", role: { name: "user", level: 100 } },
    }) as never
  );

/** The latest live revision of the page: a native WikiOS edit (no MediaWiki rev_id) or a synced one; null: none. */
const headRevision = (id: string, mwRevId: number | null = null) => ({ id, mwRevId });

/**
 * The repository's save as a page with this head and text does it: it makes the check the router hands it
 * (`expectedHeadRef`) with the real rule, and throws the real error.
 */
const pageNowHeadedBy = (head: ReturnType<typeof headRevision> | null, wikitext = "Current text") => {
  jest.mocked(ArticleRepository.saveArticle).mockImplementation((async (input: {
    expectedHeadRef?: string | null;
  }) => {
    if (input.expectedHeadRef !== undefined && !headMatchesBase(head, input.expectedHeadRef)) {
      throw new EditConflictError({
        currentWikitext: head ? wikitext : "",
        currentRevisionRef: head ? (head.mwRevId ? String(head.mwRevId) : head.id) : null,
      });
    }
    return { article: {} as never, revisionId: "rev-new" as never };
  }) as never);
};

describe("wikiosEditingRouter.saveWikitext edit conflicts (WK-2, F1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ protectionLevel: "ALL", wikitext: "Current text" } as never);
    pageNowHeadedBy(headRevision("rev-2"));
  });

  it("hands the base to the save, which checks it atomically: the revision the editor loaded, or null for a new page", async () => {
    await caller().saveWikitext({ title: "Vesperia", wikitext: "My text", baseRevisionRef: "rev-2" });
    await caller().saveWikitext({ title: "Vesperia", wikitext: "My text" });

    const inputs = jest.mocked(ArticleRepository.saveArticle).mock.calls.map(([input]) => input);
    expect(inputs.map((input) => input.expectedHeadRef)).toEqual(["rev-2", null]);
    expect(inputs[0]).toMatchObject({ title: "Vesperia", wikitext: "My text" });
  });

  it("returns an edit conflict, with the page as it is now, when the save finds the base is stale", async () => {
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
    expect(CloudflareGuardian.purgeArticleEdgeCache).not.toHaveBeenCalled();
  });

  it("saves when the base revision is the latest one, and purges the edge cache", async () => {
    const result = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "My text",
      baseRevisionRef: "rev-2",
    });

    expect(result).toMatchObject({ success: true, title: "Vesperia", revisionId: "rev-new" });
    expect(CloudflareGuardian.purgeArticleEdgeCache).toHaveBeenCalledWith("Vesperia");
  });

  it("compares a revision synced from MediaWiki by its rev_id", async () => {
    pageNowHeadedBy(headRevision("cuid-of-row", 4321));

    const saved = await caller().saveWikitext({ title: "Vesperia", wikitext: "x", baseRevisionRef: "4321" });
    expect(saved).toMatchObject({ success: true });

    const stale = await caller().saveWikitext({ title: "Vesperia", wikitext: "x", baseRevisionRef: "4320" });
    expect(stale).toMatchObject({ editConflict: true, currentRevisionRef: "4321" });
  });

  it("does not conflict with its own revision once the export worker has stamped its rev_id", async () => {
    // The editor was opened while the head was known by its row id; the worker stamps it meanwhile.
    pageNowHeadedBy(headRevision("cuid-of-row", 4321));

    const result = await caller().saveWikitext({ title: "Vesperia", wikitext: "x", baseRevisionRef: "cuid-of-row" });

    expect(result).toMatchObject({ success: true });
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
  });

  it("saves a really new page, with no base and no revision", async () => {
    pageNowHeadedBy(null);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);

    const result = await caller().saveWikitext({ title: "Brand New Page", wikitext: "Mine" });

    expect(result).toMatchObject({ success: true });
  });

  it("conflicts when the editor had a base but the page has no revision any more", async () => {
    pageNowHeadedBy(null);

    const result = await caller().saveWikitext({ title: "Vesperia", wikitext: "Mine", baseRevisionRef: "rev-1" });

    expect(result).toMatchObject({ editConflict: true, currentWikitext: "", currentRevisionRef: null });
  });

  it("saves on top of the current version when the editor resends the ref it was given ('Save anyway')", async () => {
    const first = await caller().saveWikitext({ title: "Vesperia", wikitext: "Mine", baseRevisionRef: "rev-1" });
    expect(first).toMatchObject({ editConflict: true });
    if (!("currentRevisionRef" in first) || first.currentRevisionRef === null) throw new Error("no ref");

    const second = await caller().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: first.currentRevisionRef,
    });
    expect(second).toMatchObject({ success: true });
  });

  it("saves under the canonical title", async () => {
    await caller().saveWikitext({ title: "vesperia_city", wikitext: "x", baseRevisionRef: "rev-2" });

    expect(jest.mocked(ArticleRepository.saveArticle).mock.calls[0]?.[0]).toMatchObject({ title: "Vesperia city" });
  });

  it("lets a save that could not get its turn through as a retryable PageBusyError (a 409 CONFLICT for tRPC), not an edit conflict and not a 500", async () => {
    jest.mocked(ArticleRepository.saveArticle).mockRejectedValue(new PageBusyError());

    const failure = await caller()
      .saveWikitext({ title: "Vesperia", wikitext: "x", baseRevisionRef: "rev-2" })
      .catch((error: unknown) => error);

    // tRPC wraps what a procedure throws; the error formatter reads the AppError cause (init.ts)
    expect((failure as { cause?: unknown }).cause).toBeInstanceOf(PageBusyError);
    expect((failure as { cause: PageBusyError }).cause).toMatchObject({ statusCode: 409, trpcCode: "CONFLICT" });
  });

  it("lets any other failure of the save through", async () => {
    jest.mocked(ArticleRepository.saveArticle).mockRejectedValue(new Error("database down"));

    await expect(
      caller().saveWikitext({ title: "Vesperia", wikitext: "x", baseRevisionRef: "rev-2" })
    ).rejects.toThrow("database down");
  });
});
