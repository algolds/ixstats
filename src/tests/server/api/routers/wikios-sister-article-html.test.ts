/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
/**
 * Plan 415 (BUG-09): `wikios.getArticleHtml` for a page of another wiki fetches that wiki's wikitext and has
 * that wiki's own parser render it (the request host is asserted), so its templates resolve against its own
 * pages. IxWiki's MediaWiki is never asked, and the answer is sanitized.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findUnique: jest.fn(), updateMany: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findArticleForView: jest.fn(), findBySlug: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), findMissingTitles: jest.fn() },
  MediaAssetService: { findAsset: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  resolveRedirect: jest.fn(),
  getArticleWikitext: jest.fn(),
  getInfobox: jest.fn(),
  getImageMeta: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleAuthors: jest.fn(),
  getArticleWikitextShadow: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  renderArticleViaMediaWiki: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  __esModule: true,
  syncSinglePage: jest.fn(),
}));
jest.mock("~/lib/wiki-os/storage", () => ({
  __esModule: true,
  resolveActiveCountryId: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/native-search-service", () => ({
  __esModule: true,
  getArticleSummaryFromShadow: jest.fn(),
}));
jest.mock("~/server/shared/wiki-placeholders", () => ({
  __esModule: true,
  resolveWikiPlaceholdersInternal: jest.fn(),
}));
jest.mock("~/server/shared/ixstats-template-provider", () => ({
  __esModule: true,
  ixstatsTemplateProvider: { name: "never", canHandle: () => false, resolve: async () => new Map() },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleAuthors } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const caller = () =>
  createCallerFactory(wikiosPageContentRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

const authorInfo = { creator: { username: "Kir", timestamp: "2024-01-01T00:00:00Z" } };
let guard: FetchGuard;
let lastInit: RequestInit | undefined;
let counter = 0;

/** A sister page with a revision of its own, so the module-level render cache never links two tests. */
const sisterPage = () => {
  counter += 1;
  return {
    title: `Gallambria ${counter}`,
    pageId: counter,
    wikitext: "{{Infobox country|name=Gallambria}} '''Gallambria'''",
    length: 50,
    revId: 5000 + counter,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  lastInit = undefined;
  jest.mocked(getArticleAuthors).mockResolvedValue(authorInfo as never);
  guard = installFetchGuard((_url, init) => {
    lastInit = init;
    return {
      parse: {
        text: '<div class="mw-parser-output"><p>Rendered by its own wiki <a href="/wiki/Eurth">Eurth</a><script>alert(1)</script></p></div>',
      },
    };
  });
});

afterEach(() => guard.restore());

describe("wikios.getArticleHtml for another wiki's page", () => {
  it.each([
    ["iiwiki", "iiwiki.com"],
    ["althistory", "althistory.fandom.com"],
  ] as const)("renders a %s page on %s, and asks IxWiki's MediaWiki nothing", async (wikiSource, host) => {
    const page = sisterPage();
    jest.mocked(getArticleWikitext).mockResolvedValue(page as never);

    const out = await caller().getArticleHtml({ title: page.title, wikiSource });

    expect(guard.calls()).toHaveLength(1);
    expect(new URL(guard.calls()[0]!).host).toBe(host);
    expect(guard.ixwikiCalls()).toEqual([]);
    const form = new URLSearchParams(String(lastInit!.body));
    expect(form.get("action")).toBe("parse");
    expect(form.get("text")).toBe(page.wikitext);
    expect(form.get("title")).toBe(page.title);
    expect((lastInit!.headers as Record<string, string>)["User-Agent"]).toBe("IxStats-Builder");

    expect(out).toMatchObject({
      title: page.title,
      wikiSource,
      authorInfo,
      renderQuality: "rendered",
      stale: false,
      categories: [],
    });
    expect(out.contentHtml).toContain("Rendered by its own wiki");
    expect(out.contentHtml).toContain(`href="/wiki/Eurth?source=${wikiSource}"`);
    expect(out.contentHtml).not.toContain("<script");
  });

  it("renders a revision once for every reader", async () => {
    const page = sisterPage();
    jest.mocked(getArticleWikitext).mockResolvedValue(page as never);

    await caller().getArticleHtml({ title: page.title, wikiSource: "iiwiki" });
    await caller().getArticleHtml({ title: page.title, wikiSource: "iiwiki" });

    expect(guard.calls()).toHaveLength(1);
  });

  it("says the page does not exist on that wiki when the wiki has no such page", async () => {
    jest.mocked(getArticleWikitext).mockResolvedValue(null);

    await expect(caller().getArticleHtml({ title: "Nowhere", wikiSource: "iiwiki" })).rejects.toThrow(
      /not found on iiwiki/
    );
    expect(guard.calls()).toEqual([]);
  });

  it("answers a bad gateway when the wiki cannot render the page", async () => {
    const page = sisterPage();
    jest.mocked(getArticleWikitext).mockResolvedValue(page as never);
    guard.restore();
    guard = installFetchGuard(() => ({ error: { info: "Parser down" } }));

    await expect(caller().getArticleHtml({ title: page.title, wikiSource: "althistory" })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: expect.stringContaining("Parser down"),
    });
  });
});
