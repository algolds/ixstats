/** @jest-environment node */
/** Plan 410: createApiDeps binds each api.php service to the function the tRPC routers call. */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/cache/rate-limiter", () => ({ rateLimiter: { check: jest.fn().mockResolvedValue({ success: true, resetAt: new Date(0) }) } }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({ __esModule: true, wikitextToHtml: jest.fn() }));
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({ __esModule: true, detectEditConflict: jest.fn() }));
jest.mock("~/lib/wiki-os/core/native-search-service", () => ({
  __esModule: true,
  NativeSearchService: { spotlightSearch: jest.fn(), fulltextSearch: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  __esModule: true,
  PageManagementService: { movePage: jest.fn(), archiveArticle: jest.fn(), restoreArticle: jest.fn() },
  talkTitleOf: jest.fn(),
  PageOperationError: class extends Error {},
}));
jest.mock("~/lib/wiki-os/core/rights-admin-service", () => ({
  __esModule: true,
  LOG_TYPES: [],
  RightsAdminService: { protect: jest.fn() },
}));
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  authorizeAction: jest.fn(),
  authorizeMove: jest.fn(),
  authorizeProtection: jest.fn(),
  requireRight: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/edit-service", () => ({
  __esModule: true,
  assertCanEditArticle: jest.fn(),
  commitWikitextSave: jest.fn(),
  requireRestorableWikitext: jest.fn(),
}));

import { createApiDeps } from "~/lib/wiki-os/api-compat/deps";
import { detectEditConflict } from "~/lib/wiki-os/core/edit-conflict";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { RightsAdminService } from "~/lib/wiki-os/core/rights-admin-service";
import { authorizeAction, requireRight } from "~/lib/wiki-os/permissions";
import { assertCanEditArticle, commitWikitextSave } from "~/lib/wiki-os/services/edit-service";

const ctx = { auth: { userId: "u" }, user: null };
const actor = { userId: "u1", name: "Heku" };
const deps = createApiDeps();

beforeEach(() => jest.clearAllMocks());

describe("createApiDeps", () => {
  it("uses the public origin without a trailing slash and the real clock", () => {
    expect(deps.siteUrl).toMatch(/^https?:\/\/[^/]+$/);
    expect(Math.abs(deps.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it("saves through the shared edit service and answers the new revision's row id", async () => {
    jest.mocked(commitWikitextSave).mockResolvedValue({ revisionId: "row-1" } as never);
    const save = { title: "Alpha", wikitext: "x", summary: "s", minor: false };
    expect(await deps.services.saveWikitext(ctx, save)).toEqual({ revisionRowId: "row-1" });
    expect(commitWikitextSave).toHaveBeenCalledWith(ctx, save);
    await deps.services.assertCanEdit(ctx, "Alpha");
    expect(assertCanEditArticle).toHaveBeenCalledWith(ctx, "Alpha");
  });

  it("authorizes through the permission functions", async () => {
    await deps.services.authorize(ctx, "delete", "Alpha");
    expect(authorizeAction).toHaveBeenCalledWith(ctx, "delete", "Alpha");
    await deps.services.requireRight(ctx, "suppressredirect");
    expect(requireRight).toHaveBeenCalledWith(ctx, "suppressredirect");
  });

  it("moves, deletes, restores and protects through the page services with the ixwiki realm", async () => {
    const options = { leaveRedirect: true, moveTalk: false, includeArchived: false };
    await deps.services.movePage("A", "B", "why", actor, options);
    expect(PageManagementService.movePage).toHaveBeenCalledWith("A", "B", "why", actor, "ixwiki", options);
    await deps.services.archivePage("A", "junk", actor);
    expect(PageManagementService.archiveArticle).toHaveBeenCalledWith("A", "junk", actor);
    await deps.services.restorePage("A", "back", actor);
    expect(PageManagementService.restoreArticle).toHaveBeenCalledWith("A", actor, "ixwiki", "back");
    await deps.services.restorePage("A", "", actor);
    expect(PageManagementService.restoreArticle).toHaveBeenLastCalledWith("A", actor, "ixwiki", undefined);
    const params = { title: "A", changes: [], reason: "r", actor };
    await deps.services.protectPage(params);
    expect(RightsAdminService.protect).toHaveBeenCalledWith(params);
  });

  it("asks for edit conflicts with the title and the base reference", async () => {
    await deps.services.detectEditConflict("Alpha", "101");
    expect(detectEditConflict).toHaveBeenCalledWith("Alpha", "101");
  });

  it("searches titles by prefix and text by full-text, with paging", async () => {
    jest.mocked(NativeSearchService.spotlightSearch).mockResolvedValue([
      { title: "A", snippet: "a" }, { title: "B", snippet: "b" }, { title: "C", snippet: "c" },
    ] as never);
    expect(await deps.search("x", "title", 2, 1)).toEqual({ hits: [{ title: "B", snippet: "b" }, { title: "C", snippet: "c" }], total: 3 });
    expect(NativeSearchService.spotlightSearch).toHaveBeenCalledWith("x", "ixwiki", 3);
    jest.mocked(NativeSearchService.fulltextSearch).mockResolvedValue({ results: [{ title: "D", snippet: "d" }], total: 9 } as never);
    expect(await deps.search("y", "text", 5, 10)).toEqual({ hits: [{ title: "D", snippet: "d" }], total: 9 });
    expect(NativeSearchService.fulltextSearch).toHaveBeenCalledWith("y", "ixwiki", 5, 10);
  });

  it("lends the shared rate limiter", async () => {
    expect(await deps.rateLimit("ip:1", "wiki_api", { maxRequests: 1, windowMs: 1 })).toMatchObject({ success: true });
  });
});
