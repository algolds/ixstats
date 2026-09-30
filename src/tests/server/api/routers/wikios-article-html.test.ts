/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
/**
 * Plan 404: `wikios.getArticleHtml` for IxWiki pages serves the view bundle render-service built
 * once per revision. A fresh article costs one lookup and no MediaWiki call, sanitizer pass or
 * authorship lookup; a stale or never-rendered one awaits (bounded) its render; a missing one is
 * imported from MediaWiki at most once a minute.
 */
const mockBundleRow = { current: null as null | Record<string, unknown> };
const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
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
jest.mock("~/lib/utils/sanitize-html", () => ({
  __esModule: true,
  sanitizeWikiArticleHtml: jest.fn((html: string) => html),
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
  ixstatsTemplateProvider: {
    name: "never",
    canHandle: () => false,
    resolve: async () => new Map(),
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository as ViewRepository } from "~/lib/wiki-os/core/article-repository";
import { ArticleRepository as BarrelRepository } from "~/lib/wiki-os/core";
import { resolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleAuthors } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import { registerTemplateProvider } from "~/lib/wiki-os/templates/template-resolver";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";

const caller = () =>
  createCallerFactory(wikiosPageContentRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

const findArticleForView = ViewRepository.findArticleForView as jest.Mock;

/** The sanitizer is a spy, so the stored bundles below are built by the real transform only. */
const bundleOf = (html: string) => buildViewBundle(html);

const SYNCED = new Date("2026-09-30T10:00:00Z");
const EDITED = new Date("2026-09-29T08:00:00Z");

let ids = 0;
/** A head for a fresh article id: the service keeps per-id cache state for the life of the module. */
function head(overrides: Record<string, unknown> = {}) {
  ids++;
  return {
    id: `art-${ids}`,
    title: "Aurelia",
    htmlSyncedAt: SYNCED,
    lastModified: EDITED,
    categories: ["Countries", "Eurth"],
    ...overrides,
  };
}

/** The row `findUnique` answers with for the article's bundle and, after a render, its wikitext. */
function setRow(row: Record<string, unknown> | null) {
  mockBundleRow.current = row;
}

beforeEach(() => {
  jest.clearAllMocks();
  setRow(null);
  jest.mocked(resolveRedirect).mockImplementation(async (title: string) => ({
    title,
    fragment: null,
  }));
  mockFindUnique.mockImplementation(async () => mockBundleRow.current);
  mockUpdateMany.mockImplementation(async (args: { data: Record<string, unknown> }) => {
    mockBundleRow.current = { ...mockBundleRow.current, ...args.data };
    return { count: 1 };
  });
  jest.mocked(renderArticleViaMediaWiki).mockResolvedValue(null);
  jest.mocked(syncSinglePage).mockResolvedValue(false);
});

const freshBundleRow = (html: string, htmlSyncedAt: Date | null = SYNCED) => ({
  renderedView: bundleOf(html),
  htmlSyncedAt,
  title: "Aurelia",
  wikitext: "'''Aurelia''' is a country.",
  contentHtml: null,
});

describe("getArticleHtml (IxWiki) reads the stored view bundle", () => {
  it("serves a fresh article with no MediaWiki call, no sanitizer pass, no authorship lookup and one lookup", async () => {
    const found = head();
    findArticleForView.mockResolvedValue(found);
    setRow(freshBundleRow('<p>Aurelia is a <a href="/wiki/Eurth">world</a>.</p>'));
    jest.mocked(sanitizeWikiArticleHtml).mockClear(); // building the stored bundle above used it

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result).toMatchObject({
      contentHtml: '<p>Aurelia is a <a href="/wiki/Eurth">world</a>.</p>',
      infoboxHtml: null,
      noticesHtml: null,
      toc: [],
      title: "Aurelia",
      categories: ["Countries", "Eurth"],
      lastModified: EDITED.toISOString(),
      renderQuality: "rendered",
      isRedirect: false,
      redirectTarget: null,
      resolvedFrom: null,
      wikiSource: "ixwiki",
      authorInfo: null,
    });
    expect(findArticleForView).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledTimes(1); // the bundle column, read once
    expect(BarrelRepository.findBySlug).not.toHaveBeenCalled(); // no full-row lookup
    expect(renderArticleViaMediaWiki).not.toHaveBeenCalled();
    expect(sanitizeWikiArticleHtml).not.toHaveBeenCalled();
    expect(getArticleAuthors).not.toHaveBeenCalled();
    expect(resolveActiveCountryId).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("answers a repeat view from the cache: the lookup is the only database read", async () => {
    const found = head();
    findArticleForView.mockResolvedValue(found);
    setRow(freshBundleRow("<p>Cached.</p>"));

    await caller().getArticleHtml({ title: "Aurelia" });
    mockFindUnique.mockClear();
    const again = await caller().getArticleHtml({ title: "Aurelia" });

    expect(again.contentHtml).toBe("<p>Cached.</p>");
    expect(findArticleForView).toHaveBeenCalledTimes(2);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("misses the cache when the article was rendered again (a new htmlSyncedAt)", async () => {
    const found = head();
    findArticleForView.mockResolvedValue(found);
    setRow(freshBundleRow("<p>First.</p>"));
    await caller().getArticleHtml({ title: "Aurelia" });

    findArticleForView.mockResolvedValue({
      ...found,
      htmlSyncedAt: new Date("2026-09-30T11:00:00Z"),
    });
    setRow(freshBundleRow("<p>Second.</p>", new Date("2026-09-30T11:00:00Z")));
    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.contentHtml).toBe("<p>Second.</p>");
  });

  it("reports the page it followed a redirect from", async () => {
    jest.mocked(resolveRedirect).mockResolvedValue({ title: "Aurelia", fragment: null });
    findArticleForView.mockResolvedValue(head());
    setRow(freshBundleRow("<p>x</p>"));

    const result = await caller().getArticleHtml({ title: "Old name" });

    expect(findArticleForView).toHaveBeenCalledWith("Aurelia");
    expect(result.resolvedFrom).toBe("Old name");
  });

  it("has no last-modified time for an article with no revision rows", async () => {
    findArticleForView.mockResolvedValue(head({ lastModified: null }));
    setRow(freshBundleRow("<p>x</p>"));

    await expect(caller().getArticleHtml({ title: "Aurelia" })).resolves.toMatchObject({
      lastModified: null,
    });
  });
});

describe("getArticleHtml (IxWiki) renders a stale or never-rendered article once", () => {
  it("awaits the render of a stale article and answers with the new bundle", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null }));
    setRow({ ...freshBundleRow("<p>Old.</p>", null) });
    jest
      .mocked(renderArticleViaMediaWiki)
      .mockResolvedValue('<div class="mw-parser-output"><p>New.</p></div>');

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.contentHtml).toBe("<p>New.</p>");
    expect(result.renderQuality).toBe("rendered");
    expect(renderArticleViaMediaWiki).toHaveBeenCalledTimes(1);
    expect(renderArticleViaMediaWiki).toHaveBeenCalledWith(
      "'''Aurelia''' is a country.",
      "Aurelia"
    );
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany.mock.calls[0]?.[0].where.wikitext).toBe("'''Aurelia''' is a country.");
  });

  it("two concurrent readers of one stale article cause one MediaWiki call", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null }));
    setRow({ ...freshBundleRow("<p>Old.</p>", null) });
    jest
      .mocked(renderArticleViaMediaWiki)
      .mockResolvedValue('<div class="mw-parser-output"><p>New.</p></div>');

    const [first, second] = await Promise.all([
      caller().getArticleHtml({ title: "Aurelia" }),
      caller().getArticleHtml({ title: "Aurelia" }),
    ]);

    expect(first.contentHtml).toBe("<p>New.</p>");
    expect(second.contentHtml).toBe("<p>New.</p>");
    expect(renderArticleViaMediaWiki).toHaveBeenCalledTimes(1);
  });

  it("serves the stale bundle, and does not cache it, when the render fails", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null }));
    setRow({ ...freshBundleRow("<p>Old but fine.</p>", null) });

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.contentHtml).toBe("<p>Old but fine.</p>");
    expect(result.renderQuality).toBe("rendered");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("falls back to the locally compiled wikitext, marked and never persisted, when the first render fails", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null }));
    setRow({
      renderedView: null,
      htmlSyncedAt: null,
      title: "Aurelia",
      wikitext: "'''Aurelia''' is a country.",
      contentHtml: null,
    });

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.renderQuality).toBe("fallback");
    expect(result.contentHtml).toContain("Aurelia");
    expect(renderArticleViaMediaWiki).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("is not found for a stub row that has nothing to show", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null, title: "Stubbed stub" }));
    setRow({
      renderedView: null,
      htmlSyncedAt: null,
      title: "Stubbed stub",
      wikitext: "",
      contentHtml: null,
    });

    await expect(caller().getArticleHtml({ title: "Stubbed stub" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(syncSinglePage).toHaveBeenCalledTimes(1); // MediaWiki may hold the text
  });
});

describe("getArticleHtml (IxWiki) for a title Postgres does not have", () => {
  it("imports the page once, then is not found", async () => {
    findArticleForView.mockResolvedValue(null);

    await expect(caller().getArticleHtml({ title: "Nowhere land" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: 'The page "Nowhere land" does not exist on IxWiki.',
    });

    expect(syncSinglePage).toHaveBeenCalledTimes(1);
    expect(syncSinglePage).toHaveBeenCalledWith("Nowhere land");
    expect(findArticleForView).toHaveBeenCalledTimes(1); // nothing imported: no second look
  });

  it("does not ask MediaWiki again for the same title within a minute", async () => {
    findArticleForView.mockResolvedValue(null);

    await expect(caller().getArticleHtml({ title: "Missing twice" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller().getArticleHtml({ title: "Missing twice" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(syncSinglePage).toHaveBeenCalledTimes(1);
  });

  it("serves the page once the import made it exist", async () => {
    const imported = head({ htmlSyncedAt: SYNCED, title: "Imported page" });
    findArticleForView.mockResolvedValueOnce(null).mockResolvedValueOnce(imported);
    jest.mocked(syncSinglePage).mockResolvedValue(true);
    setRow(freshBundleRow("<p>From MediaWiki.</p>"));

    const result = await caller().getArticleHtml({ title: "Imported page" });

    expect(result).toMatchObject({ title: "Imported page", contentHtml: "<p>From MediaWiki.</p>" });
    expect(syncSinglePage).toHaveBeenCalledTimes(1);
    expect(findArticleForView).toHaveBeenCalledTimes(2);
  });

  it("never has more than a few imports in flight, so made-up titles cannot fan out to MediaWiki", async () => {
    findArticleForView.mockResolvedValue(null);
    const releases: Array<() => void> = [];
    jest
      .mocked(syncSinglePage)
      .mockImplementation(
        () => new Promise<boolean>((resolve) => releases.push(() => resolve(false)))
      );

    const requests = ["Fan 1", "Fan 2", "Fan 3", "Fan 4", "Fan 5", "Fan 6"].map((title) =>
      caller()
        .getArticleHtml({ title })
        .catch((error: { code: string }) => error.code)
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(syncSinglePage).toHaveBeenCalledTimes(4);
    releases.forEach((release) => release());
    await expect(Promise.all(requests)).resolves.toEqual(Array(6).fill("NOT_FOUND"));
    expect(syncSinglePage).toHaveBeenCalledTimes(4);

    // A refused title was not recorded: once a slot is free it is imported.
    jest.mocked(syncSinglePage).mockResolvedValue(false);
    await caller()
      .getArticleHtml({ title: "Fan 6" })
      .catch(() => undefined);
    expect(syncSinglePage).toHaveBeenCalledTimes(5);
  });

  it("does not look at MediaWiki for a system route or a title it would refuse", async () => {
    await expect(caller().getArticleHtml({ title: "Utilities" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller().getArticleHtml({ title: "a[b" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(findArticleForView).not.toHaveBeenCalled();
    expect(syncSinglePage).not.toHaveBeenCalled();
  });
});

describe("getArticleHtml (IxWiki) template chips stay per viewer", () => {
  const chipped =
    '<p>Pop: <a href="/wiki/Template:CountryData:Aurelia:population" title="x">pop</a></p>';

  it("resolves the viewer's country only for an article that has chips, and never caches the chips", async () => {
    findArticleForView.mockResolvedValue(head());
    setRow(freshBundleRow(chipped));
    jest.mocked(resolveActiveCountryId).mockResolvedValue("country_1");
    const resolve = jest.fn(
      async () =>
        new Map([
          [
            "CountryData:Aurelia:population",
            { key: "CountryData:Aurelia:population", value: "12,345" },
          ],
        ])
    );
    const unregister = registerTemplateProvider({ name: "test", canHandle: () => true, resolve });

    const first = await caller().getArticleHtml({ title: "Aurelia" });
    resolve.mockImplementation(
      async () =>
        new Map([
          [
            "CountryData:Aurelia:population",
            { key: "CountryData:Aurelia:population", value: "99" },
          ],
        ])
    );
    const second = await caller().getArticleHtml({ title: "Aurelia" });
    unregister();

    expect(first.contentHtml).toContain("12,345");
    expect(first.contentHtml).toContain("wikios-stat-resolved");
    expect(second.contentHtml).toContain("99");
    expect(second.contentHtml).not.toContain("12,345");
    expect(resolveActiveCountryId).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith(
      [expect.objectContaining({ key: "CountryData:Aurelia:population" })],
      { activeCountryId: "country_1" }
    );
  });

  it("serves the unresolved article when resolving chips fails", async () => {
    findArticleForView.mockResolvedValue(head());
    setRow(freshBundleRow(chipped));
    jest.mocked(resolveActiveCountryId).mockRejectedValue(new Error("db down"));

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.contentHtml).toContain("Template:CountryData:Aurelia:population");
  });
});
