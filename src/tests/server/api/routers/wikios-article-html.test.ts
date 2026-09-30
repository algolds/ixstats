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
  wikiArticleSanitizerFingerprint: () => "test",
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
import { getArticleWikitext, resolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge";
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

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

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
      stale: false,
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

  it("serves the stale bundle, marked stale, when the render fails", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null }));
    setRow({ ...freshBundleRow("<p>Old but fine.</p>", null) });

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.contentHtml).toBe("<p>Old but fine.</p>");
    expect(result.renderQuality).toBe("rendered");
    expect(result.stale).toBe(true);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("reuses a pending view for the failure cool-down instead of reading and rendering again", async () => {
    const found = head({ htmlSyncedAt: null });
    findArticleForView.mockResolvedValue(found);
    setRow({ ...freshBundleRow("<p>Old but fine.</p>", null) });
    await caller().getArticleHtml({ title: "Aurelia" });
    jest.mocked(renderArticleViaMediaWiki).mockClear();
    mockFindUnique.mockClear();

    const again = await caller().getArticleHtml({ title: "Aurelia" });

    expect(again).toMatchObject({ contentHtml: "<p>Old but fine.</p>", stale: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(renderArticleViaMediaWiki).not.toHaveBeenCalled();
  });

  it("stops reusing it the moment the article is rendered (its htmlSyncedAt is set)", async () => {
    const found = head({ htmlSyncedAt: null });
    findArticleForView.mockResolvedValue(found);
    setRow({ ...freshBundleRow("<p>Old.</p>", null) });
    await caller().getArticleHtml({ title: "Aurelia" });

    findArticleForView.mockResolvedValue({
      ...found,
      htmlSyncedAt: new Date("2026-09-30T12:00:00Z"),
    });
    setRow(freshBundleRow("<p>Rendered.</p>", new Date("2026-09-30T12:00:00Z")));
    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result).toMatchObject({ contentHtml: "<p>Rendered.</p>", stale: false });
  });

  it("serves the HTML MediaWiki made for an earlier revision, not the regex compile, when the first render fails", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null }));
    setRow({
      renderedView: null,
      htmlSyncedAt: null,
      title: "Aurelia",
      wikitext: "Newer wikitext that the regex compiler would show.",
      contentHtml: "<p>Earlier MediaWiki render.</p>",
    });

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result).toMatchObject({
      contentHtml: "<p>Earlier MediaWiki render.</p>",
      renderQuality: "fallback",
      stale: true,
    });
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
    expect(result.stale).toBe(true);
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
    // Four were asked and are missing; two were not asked at all, which is "busy", not "missing".
    await expect(Promise.all(requests)).resolves.toEqual([
      "NOT_FOUND",
      "NOT_FOUND",
      "NOT_FOUND",
      "NOT_FOUND",
      "TOO_MANY_REQUESTS",
      "TOO_MANY_REQUESTS",
    ]);
    expect(syncSinglePage).toHaveBeenCalledTimes(4);

    // A refused title was not recorded: once a slot is free it is imported.
    jest.mocked(syncSinglePage).mockResolvedValue(false);
    await caller()
      .getArticleHtml({ title: "Fan 6" })
      .catch(() => undefined);
    expect(syncSinglePage).toHaveBeenCalledTimes(5);
  });

  it("lets concurrent first readers of one missing title share one import instead of turning one away", async () => {
    let imported = false;
    const found = head({ title: "Shared import" });
    findArticleForView.mockImplementation(async () => (imported ? found : null));
    setRow(freshBundleRow("<p>Imported.</p>"));
    const release = deferred<boolean>();
    jest.mocked(syncSinglePage).mockImplementation(() => release.promise);

    const first = caller().getArticleHtml({ title: "Shared import" });
    const second = caller().getArticleHtml({ title: "Shared import" });
    await new Promise((resolve) => setImmediate(resolve));
    imported = true;
    release.resolve(true);

    const [a, b] = await Promise.all([first, second]);
    expect(a.contentHtml).toBe("<p>Imported.</p>");
    expect(b.contentHtml).toBe("<p>Imported.</p>");
    expect(syncSinglePage).toHaveBeenCalledTimes(1);
  });

  it("holds imports to a steady rate per process: the 31st within a minute is refused as busy", async () => {
    findArticleForView.mockResolvedValue(null);
    jest.mocked(syncSinglePage).mockResolvedValue(false);
    const realNow = Date.now.bind(Date);
    let offset = 10 * 60 * 1000; // a fresh minute: the bucket is full again
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => realNow() + offset);

    const codes: string[] = [];
    for (let n = 1; n <= 31; n++) {
      await caller()
        .getArticleHtml({ title: `Rate ${n}` })
        .catch((error: { code: string }) => codes.push(error.code));
    }

    expect(codes.slice(0, 30)).toEqual(Array(30).fill("NOT_FOUND"));
    expect(codes[30]).toBe("TOO_MANY_REQUESTS");
    expect(syncSinglePage).toHaveBeenCalledTimes(30);

    offset += 60 * 1000; // a minute later the bucket has refilled
    await expect(caller().getArticleHtml({ title: "Rate 31" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(syncSinglePage).toHaveBeenCalledTimes(31);
    nowSpy.mockRestore();
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
  const chipMarker = '<span data-wikios-chip="CountryData:Aurelia:population"></span>';

  const provider = (value: string) =>
    jest.fn(
      async () =>
        new Map([
          ["CountryData:Aurelia:population", { key: "CountryData:Aurelia:population", value }],
        ])
    );

  it("stores a chip as an inert marker and fills in the viewer's chip, per request, without caching it", async () => {
    findArticleForView.mockResolvedValue(head());
    setRow(freshBundleRow(chipped));
    expect(mockBundleRow.current?.renderedView).toMatchObject({
      bodyHtml: `<p>Pop: ${chipMarker}</p>`,
    });
    jest.mocked(resolveActiveCountryId).mockResolvedValue("country_1");
    const resolve = provider("12,345");
    const unregister = registerTemplateProvider({ name: "test", canHandle: () => true, resolve });

    const first = await caller().getArticleHtml({ title: "Aurelia" });
    resolve.mockImplementation(provider("99"));
    const second = await caller().getArticleHtml({ title: "Aurelia" });
    unregister();

    expect(first.contentHtml).toContain("12,345");
    expect(first.contentHtml).toContain("wikios-stat-resolved");
    expect(first.contentHtml).not.toContain("data-wikios-chip");
    expect(second.contentHtml).toContain("99");
    expect(second.contentHtml).not.toContain("12,345");
    expect(resolveActiveCountryId).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith(
      [expect.objectContaining({ key: "CountryData:Aurelia:population" })],
      { activeCountryId: "country_1" }
    );
  });

  it("runs a part that changed through the sanitizer once more, and only that part", async () => {
    findArticleForView.mockResolvedValue(head());
    setRow(freshBundleRow(chipped));
    const unregister = registerTemplateProvider({
      name: "test",
      canHandle: () => true,
      resolve: provider("1"),
    });
    jest.mocked(sanitizeWikiArticleHtml).mockClear();

    await caller().getArticleHtml({ title: "Aurelia" });
    unregister();

    expect(sanitizeWikiArticleHtml).toHaveBeenCalledTimes(1);
    expect(jest.mocked(sanitizeWikiArticleHtml).mock.calls[0]?.[0]).toContain(
      "wikios-stat-resolved"
    );
  });

  it("leaves a placeholder for the client when resolving chips fails, never a bare marker", async () => {
    findArticleForView.mockResolvedValue(head());
    setRow(freshBundleRow(chipped));
    jest.mocked(resolveActiveCountryId).mockRejectedValue(new Error("db down"));

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.contentHtml).toBe(
      '<p>Pop: <span class="wikios-stat-placeholder" data-key="CountryData:Aurelia:population"></span></p>'
    );
    expect(result.contentHtml).not.toContain("data-wikios-chip");
  });

  it("leaves a placeholder for a key the provider does not know", async () => {
    findArticleForView.mockResolvedValue(head());
    setRow(freshBundleRow(chipped));
    jest.mocked(resolveActiveCountryId).mockResolvedValue(null);

    const result = await caller().getArticleHtml({ title: "Aurelia" });

    expect(result.contentHtml).toContain('class="wikios-stat-placeholder"');
  });
});

describe("getArticleHtml for another wiki's page is sanitized like any other (plan 404 review)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.mocked(sanitizeWikiArticleHtml).mockImplementation((html: string) => html);
  });

  it("passes the body, the infobox and the notices through the sanitizer before serving them", async () => {
    jest.mocked(getArticleWikitext).mockResolvedValue({
      title: "Eurth",
      wikitext: "text",
      pageId: 1,
      length: 4,
    } as never);
    jest.mocked(getArticleAuthors).mockResolvedValue({ creator: null } as never);
    const parsed =
      '<div class="mw-parser-output"><div class="hatnote">Notice <script>n()</script></div>' +
      '<table class="infobox"><tr><td>Box <script>i()</script></td></tr></table>' +
      "<p>Body <script>b()</script></p></div>";
    globalThis.fetch = jest.fn(
      async () => new Response(JSON.stringify({ parse: { text: parsed } }), { status: 200 })
    ) as typeof fetch;
    jest.mocked(sanitizeWikiArticleHtml).mockImplementation((html: string) => `SANITIZED(${html})`);

    const result = await caller().getArticleHtml({ title: "Eurth", wikiSource: "iiwiki" });

    expect(result.contentHtml).toMatch(/^SANITIZED\(/);
    expect(result.infoboxHtml).toMatch(/^SANITIZED\(.*Box/);
    expect(result.noticesHtml).toMatch(/^SANITIZED\(.*Notice/);
    expect(sanitizeWikiArticleHtml).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ wikiSource: "iiwiki", stale: false, renderQuality: "rendered" });
  });

  it("has no infobox or notices to sanitize when the page has none", async () => {
    jest.mocked(getArticleWikitext).mockResolvedValue({
      title: "Eurth",
      wikitext: "text",
      pageId: 1,
      length: 4,
    } as never);
    jest.mocked(getArticleAuthors).mockResolvedValue({ creator: null } as never);
    globalThis.fetch = jest.fn(
      async () => new Response(JSON.stringify({ parse: { text: "<p>Plain</p>" } }), { status: 200 })
    ) as typeof fetch;
    jest.mocked(sanitizeWikiArticleHtml).mockClear();

    const result = await caller().getArticleHtml({ title: "Eurth", wikiSource: "iiwiki" });

    expect(result).toMatchObject({ infoboxHtml: null, noticesHtml: null });
    expect(sanitizeWikiArticleHtml).toHaveBeenCalledTimes(1);
  });
});
