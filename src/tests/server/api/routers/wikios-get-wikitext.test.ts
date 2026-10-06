/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
// No page is deleted: the visibility check finds no row.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({ __esModule: true, isSystemOwner: () => false, UserManagementService: jest.fn() }));
jest.mock("~/lib/auth/system-owner-constants", () => ({ __esModule: true, isSystemOwner: () => false }));
jest.mock("~/lib/wiki-os/storage", () => ({ __esModule: true, resolveActiveCountryId: jest.fn() }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  getArticleHtml: jest.fn(),
  renderArticleViaMediaWiki: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleWikitext: jest.fn(),
  resolveRedirect: jest.fn(),
  getInfobox: jest.fn(),
  getImageMeta: jest.fn(),
}));
jest.mock("~/lib/wiki-os/transformers/html-transformer", () => ({
  __esModule: true,
  transformArticleHtml: jest.fn(),
  stripConflictingStyles: jest.fn(),
}));
jest.mock("~/lib/wiki-os/transformers/wikitext-parser", () => ({
  __esModule: true,
  parseWikitextToHtml: jest.fn(),
  cleanExcerpt: jest.fn(),
}));
jest.mock("~/lib/wiki-os/templates/template-resolver", () => ({
  __esModule: true,
  extractTemplateKeys: jest.fn(),
  resolveTemplates: jest.fn(),
  registerTemplateProvider: jest.fn(),
}));
jest.mock("~/server/shared/ixstats-template-provider", () => ({ __esModule: true, ixstatsTemplateProvider: {} }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
  saveArticleHtmlShadow: jest.fn(),
  getArticleHtmlShadow: jest.fn(),
  getArticleAuthors: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/native-search-service", () => ({ __esModule: true, getArticleSummaryFromShadow: jest.fn() }));
jest.mock("~/server/shared/wiki-placeholders", () => ({ __esModule: true, resolveWikiPlaceholdersInternal: jest.fn() }));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), findMissingTitles: jest.fn() },
  MediaAssetService: {},
}));
jest.mock("~/lib/utils/sanitize-html", () => ({
  __esModule: true,
  sanitizeWikiArticleHtml: jest.fn(),
  wikiArticleSanitizerFingerprint: jest.fn(() => "test-fingerprint"),
}));
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({ __esModule: true, getHeadRevisionRefs: jest.fn() }));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";

const caller = () => createCallerFactory(wikiosPageContentRouter)(createMockRouterContext({ auth: null, user: null }) as never);

describe("wikiosPageContentRouter.getWikitext (WK-2)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the head revision ref and every alias of it with the text", async () => {
    jest.mocked(getHeadRevisionRefs).mockResolvedValue({ revisionRef: "4321", revisionRefs: ["cuid-1", "4321"] });
    jest.mocked(getArticleWikitextShadow).mockResolvedValue({
      wikitext: "Text",
      revid: null,
      timestamp: "2026-01-01T00:00:00.000Z",
      fromShadow: true,
      stale: false,
    });

    expect(await caller().getWikitext({ title: "Vesperia" })).toMatchObject({
      wikitext: "Text",
      revisionRef: "4321",
      revisionRefs: ["cuid-1", "4321"],
    });
  });

  it("reads the head revision before the text, so a save in between can only make the text newer than its ref", async () => {
    const order: string[] = [];
    jest.mocked(getHeadRevisionRefs).mockImplementation(async () => {
      order.push("head");
      return { revisionRef: "r1", revisionRefs: ["r1"] };
    });
    jest.mocked(getArticleWikitextShadow).mockImplementation(async () => {
      order.push("text");
      return null;
    });

    await caller().getWikitext({ title: "Vesperia" });

    expect(order).toEqual(["head", "text"]);
  });

  it("still returns the text, with no ref, when the head revision cannot be read", async () => {
    jest.mocked(getHeadRevisionRefs).mockRejectedValue(new Error("db down"));
    jest.mocked(getArticleWikitextShadow).mockResolvedValue({
      wikitext: "Text",
      revid: 7,
      timestamp: null,
      fromShadow: false,
      stale: false,
    });

    expect(await caller().getWikitext({ title: "Vesperia" })).toMatchObject({
      wikitext: "Text",
      revisionRef: null,
      revisionRefs: [],
    });
  });
});
