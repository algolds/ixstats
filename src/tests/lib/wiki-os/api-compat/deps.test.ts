/** @jest-environment node */
/** Plan 410: createApiDeps binds each api.php service to the function the tRPC routers call. */
jest.mock("~/server/db", () => ({ __esModule: true, db: { wikiArticle: { findMany: jest.fn() } } }));
jest.mock("~/lib/cache/rate-limiter", () => ({ rateLimiter: { check: jest.fn().mockResolvedValue({ success: true, resetAt: new Date(0) }) } }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({ __esModule: true, renderArticleViaMediaWiki: jest.fn(), wikitextToHtml: jest.fn() }));
jest.mock("~/lib/wiki-os/transformers/wikitext-parser", () => ({ __esModule: true, parseWikitextToHtml: jest.fn(() => "COMPILED") }));
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
import { renderArticleViaMediaWiki, wikitextToHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { authorizeAction, requireRight } from "~/lib/wiki-os/permissions";
const ctx = { auth: { userId: "u" }, user: null };
const deps = createApiDeps();

beforeEach(() => jest.clearAllMocks());

describe("createApiDeps", () => {
  it("renders text through the private renderer only: null when it fails, never the in-process compiler", async () => {
    jest
      .mocked(renderArticleViaMediaWiki)
      .mockResolvedValueOnce({ html: "<p>x</p>", metadata: { templates: [{ ns: 10, title: "Template:Foo" }], images: ["A_b.png"] } } as never)
      .mockResolvedValueOnce(null);
    expect(await deps.services.renderWikitext("x", "Alpha")).toEqual({ html: "<p>x</p>", templates: ["Template:Foo"], images: ["A_b.png"] });
    expect(await deps.services.renderWikitext("[[".repeat(10), "Alpha")).toBeNull();
    expect(renderArticleViaMediaWiki).toHaveBeenCalledWith("x", "Alpha");
    expect(wikitextToHtml).not.toHaveBeenCalled();
    expect(parseWikitextToHtml).not.toHaveBeenCalled();
  });

  it("authorizes through the permission functions", async () => {
    await deps.services.authorize(ctx, "delete", "Alpha");
    expect(authorizeAction).toHaveBeenCalledWith(ctx, "delete", "Alpha");
    await deps.services.requireRight(ctx, "suppressredirect");
    expect(requireRight).toHaveBeenCalledWith(ctx, "suppressredirect");
  });
});
