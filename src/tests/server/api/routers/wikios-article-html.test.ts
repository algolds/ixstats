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

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository as ViewRepository } from "~/lib/wiki-os/core/article-repository";
import { getArticleWikitext, resolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleAuthors } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";

/** A render of `html` that reports nothing about the page (what MediaWiki says about links and categories is plan 406's). */
const rendered = (html: string) => ({
  html,
  metadata: {
    links: null,
    templates: null,
    images: null,
    categories: null,
    displayTitle: null,
    properties: {},
  },
});
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import { registerTemplateProvider } from "~/lib/wiki-os/templates/template-resolver";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";
import { getArticleView } from "~/lib/wiki-os/services/article-view-service";

const syncSinglePageMockReset = () => jest.mocked(syncSinglePage).mockClear();
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
describe("getArticleHtml (IxWiki) renders a stale or never-rendered article once", () => {
  it("two concurrent readers of one stale article cause one MediaWiki call", async () => {
    findArticleForView.mockResolvedValue(head({ htmlSyncedAt: null }));
    setRow({ ...freshBundleRow("<p>Old.</p>", null) });
    jest
      .mocked(renderArticleViaMediaWiki)
      .mockResolvedValue(rendered('<div class="mw-parser-output"><p>New.</p></div>'));

    const [first, second] = await Promise.all([
      caller().getArticleHtml({ title: "Aurelia" }),
      caller().getArticleHtml({ title: "Aurelia" }),
    ]);

    expect(first.contentHtml).toBe("<p>New.</p>");
    expect(second.contentHtml).toBe("<p>New.</p>");
    expect(renderArticleViaMediaWiki).toHaveBeenCalledTimes(1);
  });
});
describe("getArticleHtml (IxWiki) for a title Postgres does not have", () => {
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

  it("does not look at MediaWiki for a title it would refuse", async () => {
    await expect(caller().getArticleHtml({ title: "a[b" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(findArticleForView).not.toHaveBeenCalled();
    expect(syncSinglePage).not.toHaveBeenCalled();
  });
});

describe("getArticleHtml (IxWiki) redirects (plan 412)", () => {
  // The import budget is module state that earlier tests in this file spent: a later minute has it full.
  let minutesLater = 0;
  let clock: jest.SpyInstance;
  beforeEach(() => {
    const realNow = Date.now.bind(Date);
    const offset = ++minutesLater * 600_000;
    clock = jest.spyOn(Date, "now").mockImplementation(() => realNow() + offset);
  });
  afterEach(() => clock.mockRestore());

  beforeEach(() => {
    findArticleForView.mockImplementation(async (title: string) => head({ title }));
    setRow(freshBundleRow("<p>The Republic.</p>"));
    jest
      .mocked(resolveRedirect)
      .mockImplementation(async (title: string) =>
        title === "Old name"
          ? { title: "New name", fragment: "History" }
          : { title, fragment: null }
      );
  });

  it("follows a redirect and says where it came from and which section it points to", async () => {
    const result = await caller().getArticleHtml({ title: "old_name" });

    expect(findArticleForView).toHaveBeenCalledWith("New name");
    expect(result).toMatchObject({
      title: "New name",
      resolvedFrom: "Old name",
      redirectFragment: "History",
    });
  });

  /** The real resolver's rule (ixwikiResolveRedirect): up to two hops, never revisiting a page. */
  function redirectGraph(links: Record<string, string>) {
    jest.mocked(resolveRedirect).mockImplementation(async (title: string) => {
      const visited = new Set([title]);
      let current = title;
      for (let hop = 0; hop < 2; hop++) {
        const target = links[current];
        if (!target || visited.has(target)) break;
        visited.add(target);
        current = target;
      }
      return { title: current, fragment: null };
    });
  }

  it.each([
    ["A to B and back", { A: "B", B: "A" }, ["A", "B"]],
    ["A to B to C to A", { A: "B", B: "C", C: "A" }, ["A", "B", "C"]],
    ["a four-page cycle", { A: "B", B: "C", C: "D", D: "A" }, ["A", "B", "C", "D"]],
    [
      "a seven-page cycle",
      { A: "B", B: "C", C: "D", D: "E", E: "F", F: "G", G: "A" },
      ["A", "D", "G"],
    ],
    ["a page that redirects to itself", { A: "A" }, ["A"]],
  ])(
    "%s: every page of the cycle shows itself, so no reader is sent round it",
    async (_name, links, starts) => {
      redirectGraph(links);
      findArticleForView.mockImplementation(async (title: string) => head({ title }));
      setRow(freshBundleRow("<p>#REDIRECT</p>"));

      for (const start of starts) {
        const result = await caller().getArticleHtml({ title: start });
        expect(result).toMatchObject({ title: start, resolvedFrom: null, redirectFragment: null });
      }
    }
  );
});

describe("MediaWiki imports by who asked (plan 412 review)", () => {
  // Imports are per-process budgets that earlier tests in this file spent: a later minute has them full.
  let minutesLater = 100;
  let clock: jest.SpyInstance;
  beforeEach(() => {
    const realNow = Date.now.bind(Date);
    const offset = ++minutesLater * 3_600_000;
    clock = jest.spyOn(Date, "now").mockImplementation(() => realNow() + offset);
    findArticleForView.mockResolvedValue(null);
  });
  afterEach(() => clock.mockRestore());

  const asHeaders = (headers: Record<string, string>) =>
    createCallerFactory(wikiosPageContentRouter)(
      createMockRouterContext({ auth: null, user: null, headers: new Headers(headers) }) as never
    );
  const BROWSER = { "x-trpc-source": "rsc", accept: "text/html,application/xhtml+xml,*/*;q=0.8" };

  it("a server render of a page request, which asks for HTML, imports a missing page", async () => {
    await expect(
      asHeaders(BROWSER).getArticleHtml({ title: "Ssr page one" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(syncSinglePage).toHaveBeenCalledWith("Ssr page one");
  });
  it("the reader's own call (not the server's) imports whatever it accepts", async () => {
    await expect(
      asHeaders({ accept: "application/json" }).getArticleHtml({ title: "Client page" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(syncSinglePage).toHaveBeenCalledWith("Client page");
  });

  it("server renders import at most 10 pages a minute, from a budget of their own", async () => {
    const codes: string[] = [];
    for (let i = 1; i <= 12; i++) {
      await asHeaders(BROWSER)
        .getArticleHtml({ title: `Flood ${i}` })
        .catch((error: { code: string }) => codes.push(error.code));
    }

    expect(codes.slice(0, 10)).toEqual(Array(10).fill("NOT_FOUND"));
    expect(codes.slice(10)).toEqual(["TOO_MANY_REQUESTS", "TOO_MANY_REQUESTS"]);
    expect(syncSinglePage).toHaveBeenCalledTimes(10);

    // The readers' budget is untouched by the flood.
    syncSinglePageMockReset();
    await expect(
      asHeaders({}).getArticleHtml({ title: "Reader after the flood" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(syncSinglePage).toHaveBeenCalledWith("Reader after the flood");
  });

  it("a title that is not in canonical form is never imported, whoever asks", async () => {
    for (const source of ["client", "ssr"] as const) {
      await expect(
        getArticleView("junk_title with  spaces", async () => null, undefined, source)
      ).resolves.toBeNull();
    }
    expect(syncSinglePage).not.toHaveBeenCalled();

    await expect(
      getArticleView("Junk title", async () => null, undefined, "ssr")
    ).resolves.toBeNull();
    expect(syncSinglePage).toHaveBeenCalledTimes(1); // a canonical one is
  });
});

describe("getArticleHtml (IxWiki) template chips stay per viewer", () => {
  const chipped =
    '<p>Pop: <a href="/wiki/Template:CountryData:Aurelia:population" title="x">pop</a></p>';
  const provider = (value: string) =>
    jest.fn(
      async (..._args: unknown[]) =>
        new Map([
          ["CountryData:Aurelia:population", { key: "CountryData:Aurelia:population", value }],
        ])
    );
  describe("the chip-filled view is kept per viewer country (plan 404 review)", () => {
    const setup = async (countryId: string | null) => {
      jest.mocked(resolveActiveCountryId).mockResolvedValue(countryId);
    };
    it("keeps one view per viewer country, so MyCountry chips never cross viewers", async () => {
      findArticleForView.mockResolvedValue(head());
      setRow(freshBundleRow('<p>Mine: <a href="/wiki/Template:MyCountry:gdp">g</a></p>'));
      const unregister = registerTemplateProvider({
        name: "test",
        canHandle: () => true,
        resolve: async (keys, opts) =>
          new Map(
            keys.map((k) => [
              k.key,
              { key: k.key, value: `gdp of ${opts?.activeCountryId ?? "nobody"}` },
            ])
          ),
      });

      await setup("country_1");
      const one = await caller().getArticleHtml({ title: "Aurelia" });
      await setup("country_2");
      const two = await caller().getArticleHtml({ title: "Aurelia" });
      await setup(null);
      const nobody = await caller().getArticleHtml({ title: "Aurelia" });
      await setup("country_1");
      const oneAgain = await caller().getArticleHtml({ title: "Aurelia" });
      unregister();

      expect(one.contentHtml).toContain("gdp of country_1");
      expect(two.contentHtml).toContain("gdp of country_2");
      expect(nobody.contentHtml).toContain("gdp of nobody");
      expect(oneAgain.contentHtml).toBe(one.contentHtml);
    });
    it("never keeps a view whose chips could not be resolved, nor a stale one", async () => {
      findArticleForView.mockResolvedValue(head());
      setRow(freshBundleRow(chipped));
      jest.mocked(resolveActiveCountryId).mockRejectedValueOnce(new Error("db down"));
      const resolve = provider("12,345");
      const unregister = registerTemplateProvider({ name: "test", canHandle: () => true, resolve });

      const failed = await caller().getArticleHtml({ title: "Aurelia" });
      await setup("country_1");
      const recovered = await caller().getArticleHtml({ title: "Aurelia" });
      unregister();

      expect(failed.contentHtml).toContain("wikios-stat-placeholder");
      expect(recovered.contentHtml).toContain("12,345");

      const pending = head({ htmlSyncedAt: null });
      findArticleForView.mockResolvedValue(pending);
      setRow({ ...freshBundleRow(chipped, null) });
      const resolveStale = provider("7");
      const again = registerTemplateProvider({
        name: "test2",
        canHandle: () => true,
        resolve: resolveStale,
      });
      await caller().getArticleHtml({ title: "Aurelia" });
      await caller().getArticleHtml({ title: "Aurelia" });
      again();

      expect(resolveStale).toHaveBeenCalledTimes(2);
    });
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
      async () =>
        new Response(JSON.stringify({ parse: { title: "Eurth", text: parsed } }), { status: 200 })
    ) as typeof fetch;
    jest.mocked(sanitizeWikiArticleHtml).mockImplementation((html: string) => `SANITIZED(${html})`);

    const result = await caller().getArticleHtml({ title: "Eurth", wikiSource: "iiwiki" });

    expect(result.contentHtml).toMatch(/^SANITIZED\(/);
    expect(result.infoboxHtml).toMatch(/^SANITIZED\(.*Box/);
    expect(result.noticesHtml).toMatch(/^SANITIZED\(.*Notice/);
    expect(sanitizeWikiArticleHtml).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ wikiSource: "iiwiki", stale: false, renderQuality: "rendered" });
  });

  it("shows the page a redirect names, says where the reader came from, and credits that page's authors", async () => {
    jest.mocked(getArticleWikitext).mockResolvedValue({
      title: "Bashan Protectorate",
      redirectedFrom: "Bashan",
      wikitext: "text",
      pageId: 41,
      length: 4,
      revId: 900,
    });
    jest.mocked(getArticleAuthors).mockResolvedValue({ creator: null } as never);
    globalThis.fetch = jest.fn(async () =>
      Response.json({ parse: { title: "Bashan Protectorate", text: "<p>Bashan</p>" } })
    ) as typeof fetch;

    const result = await caller().getArticleHtml({ title: "Bashan", wikiSource: "iiwiki" });

    expect(result).toMatchObject({ title: "Bashan Protectorate", resolvedFrom: "Bashan" });
    expect(getArticleAuthors).toHaveBeenCalledWith("Bashan Protectorate", "iiwiki");
  });
});
