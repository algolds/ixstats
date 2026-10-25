/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// WikiOS's read surfaces say a sister wiki is unavailable, never "not found" or an empty list (plan 2026-10-25 sister
// wikis, C3c). A read of IIWiki or AltHistory that cannot reach it reaches the client as SERVICE_UNAVAILABLE ("IIWiki
// could not be reached just now."), through the tRPC formatter: a page, its wikitext, intro, section, images and
// infobox, a search of that one wiki, its categories.
// A search across all wikis is best effort: a sister that cannot be reached adds nothing (and one warning naming it),
// so IxWiki's results still come back.
//
// The sister reads are real (bridge, http-reader, upstream guard); only `fetch` is spied, answering by host. IxWiki's
// own search is stubbed, and so is `resolveRedirect` (IxWiki's redirects, which live in Postgres).
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
    },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => {
  const actual = jest.requireActual<typeof import("~/lib/wiki-os/adapters/mediawiki/bridge")>(
    "~/lib/wiki-os/adapters/mediawiki/bridge"
  );
  return {
    ...actual,
    resolveRedirect: jest.fn(async (title: string) => ({ title, fragment: null })),
    searchPages: jest.fn(actual.searchPages),
  };
});
jest.mock("~/server/shared/ixstats-template-provider", () => ({
  __esModule: true,
  ixstatsTemplateProvider: {
    name: "never",
    canHandle: () => false,
    resolve: async () => new Map(),
  },
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { getCategoryMembers, searchPages } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import type { WikiSearchResult, WikiSource } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { wikiosSearchRouter } from "~/server/api/routers/wikios/search";
import { wikiosCategoriesRouter } from "~/server/api/routers/wikios/categories";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { clientErrorOf } from "~/tests/helpers/trpc-client-error";

type Sister = "iiwiki" | "althistory";

const actualSearchPages = jest.requireActual<
  typeof import("~/lib/wiki-os/adapters/mediawiki/bridge")
>("~/lib/wiki-os/adapters/mediawiki/bridge").searchPages;

const visitor = () => createMockRouterContext({ auth: null, user: null }) as never;
const search = () => createCallerFactory(wikiosSearchRouter)(visitor());

const IXWIKI_RESULTS: WikiSearchResult[] = [{ title: "Aurelia", pageId: 1, length: 10 }];

/** A gateway error page: the guard reads it as a wiki that could not be reached. */
const down = () =>
  new Response("<html>502 Bad Gateway</html>", {
    status: 502,
    headers: { "content-type": "text/html" },
  });

/** Each sister wiki's answer to any call, by the host it is fetched from. */
let answers: Record<Sister, () => Response>;
let fetchSpy: jest.SpiedFunction<typeof fetch>;
let warnSpy: jest.SpiedFunction<typeof console.warn>;
let dateSpy: jest.SpiedFunction<typeof Date.now>;
/**
 * The clock moves an hour on per test, past any cooldown: a circuit an earlier test opened on a wiki's host lets
 * the next test's first call through as its probe (the guard's state lasts as long as the module).
 */
let now = 1_000_000;

function sisterOf(url: URL): Sister {
  if (url.hostname.endsWith("iiwiki.com")) return "iiwiki";
  if (url.hostname.endsWith("althistory.fandom.com")) return "althistory";
  throw new Error(`unexpected fetch of ${url.href}`);
}

/** An opensearch answer listing `titles`. */
const opensearch = (titles: string[]) => () => Response.json(["query", titles, [], []]);

/** The warnings the search itself logged (the guard logs its own when a circuit opens or closes). */
const searchWarnings = () =>
  warnSpy.mock.calls.map((call) => String(call[0])).filter((m) => m.startsWith("[wikios.search]"));

beforeEach(() => {
  now += 3_600_000;
  dateSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
  answers = { iiwiki: down, althistory: down };
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (input) => answers[sisterOf(new URL(String(input)))]());
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest
    .mocked(searchPages)
    .mockImplementation(async (query: string, limit?: number, wiki?: WikiSource) =>
      wiki === "ixwiki" ? IXWIKI_RESULTS : actualSearchPages(query, limit, wiki)
    );
});

afterEach(() => {
  fetchSpy.mockRestore();
  warnSpy.mockRestore();
  dateSpy.mockRestore();
});

describe("a sister wiki that cannot be reached is unavailable to the client", () => {
  it("getIntro of an unreachable wiki is SERVICE_UNAVAILABLE", async () => {
    const error = await clientErrorOf(
      wikiosPageContentRouter,
      "getIntro",
      { title: "Bashan intro", wiki: "iiwiki" },
      visitor()
    );

    expect(error).toEqual({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "IIWiki could not be reached just now.",
    });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it.each([
    ["getArticleHtml", { title: "Bashan html", wikiSource: "iiwiki" }],
    ["getWikitext", { title: "Bashan source", wikiSource: "iiwiki" }],
    ["getSectionContent", { title: "Bashan section", section: "History", source: "althistory" }],
    ["getPageImages", { title: "Bashan images", wiki: "iiwiki" }],
    ["getInfobox", { title: "Bashan infobox", wiki: "althistory" }],
  ] as const)("%s of an unreachable wiki is SERVICE_UNAVAILABLE", async (path, input) => {
    const error = await clientErrorOf(wikiosPageContentRouter, path, input, visitor());

    expect(error).toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
    expect(error.message).toMatch(/^(IIWiki|AltHistory Wiki) could not be reached just now\.$/);
  });

  it("getIntro of a page the wiki does not have is an empty intro, not an error", async () => {
    answers.iiwiki = () => Response.json({ query: { pages: { "-1": { missing: "" } } } });

    const caller = createCallerFactory(wikiosPageContentRouter)(visitor());
    const intro = await caller.getIntro({ title: "No such page", wiki: "iiwiki" });

    expect(intro).toMatchObject({ intro: "", source: "iiwiki" });
  });

  it.each([
    ["search", { query: "Bashan single", wikiSource: "iiwiki" }],
    ["searchPages", { query: "Bashan titles", wiki: "iiwiki" }],
    ["searchArticles", { query: "Bashan articles", wiki: "althistory" }],
  ] as const)(
    "a single-wiki %s of an unreachable wiki throws, never an empty list",
    async (path, input) => {
      const error = await clientErrorOf(wikiosSearchRouter, path, input, visitor());

      expect(error.status).toBe(503);
      expect(error.code).toBe("SERVICE_UNAVAILABLE");
      expect(error.message).toMatch(/^(IIWiki|AltHistory Wiki) could not be reached just now\.$/);
    }
  );

  it("sister category members of an unreachable wiki throw, never an empty list", async () => {
    await expect(getCategoryMembers("Bashan members", 20, undefined, "iiwiki")).rejects.toThrow(
      WikiUnavailableError
    );
  });

  it.each([
    ["getSubcategories", { category: "Bashan subcats", wiki: "iiwiki" }],
    ["searchCategories", { query: "Bashan cats", wiki: "iiwiki" }],
    ["autocompleteCategories", { prefix: "Bashan auto", wiki: "iiwiki" }],
    ["getCategories", { wiki: "althistory", limit: 7 }],
    ["getCategoryTotalCounts", { categories: ["Bashan counts"], wiki: "iiwiki" }],
  ] as const)("%s of an unreachable wiki is SERVICE_UNAVAILABLE", async (path, input) => {
    const error = await clientErrorOf(wikiosCategoriesRouter, path, input, visitor());

    expect(error).toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
  });
});

describe("a search across all wikis is best effort", () => {
  it("a single-wiki search of an unreachable wiki throws; search all still returns IxWiki's results", async () => {
    answers.althistory = opensearch(["Bashan (alt)"]);

    await expect(
      search().search({ query: "Bashan everywhere", wikiSource: "iiwiki" })
    ).rejects.toMatchObject({ cause: expect.any(WikiUnavailableError) });

    const results = await search().search({ query: "Bashan everywhere", wikiSource: "all" });

    expect(results).toEqual([
      expect.objectContaining({ title: "Aurelia", source: "ixwiki" }),
      expect.objectContaining({ title: "Bashan (alt)", source: "althistory" }),
    ]);
  });

  it("an unreachable sister adds nothing and one warning naming it", async () => {
    answers.iiwiki = opensearch(["Bashan"]);

    const results = await search().search({ query: "Bashan warn", wikiSource: "all" });

    expect(results.map((r) => [r.title, r.source])).toEqual([
      ["Aurelia", "ixwiki"],
      ["Bashan", "iiwiki"],
    ]);
    expect(searchWarnings()).toEqual([expect.stringContaining("AltHistory Wiki")]);
  });

  it("with both sisters down, IxWiki's results still come back", async () => {
    const results = await search().search({ query: "Bashan both", wikiSource: "all" });

    expect(results).toEqual([expect.objectContaining({ title: "Aurelia", source: "ixwiki" })]);
    expect(searchWarnings()).toHaveLength(2);
    expect(searchWarnings().join(" ")).toMatch(/IIWiki.*AltHistory Wiki/);
  });

  it("with every wiki answering, nothing is warned", async () => {
    answers = { iiwiki: opensearch(["Bashan"]), althistory: opensearch(["Bashan (alt)"]) };

    const results = await search().search({ query: "Bashan all up", wikiSource: "all" });

    expect(results.map((r) => r.source)).toEqual(["ixwiki", "iiwiki", "althistory"]);
    expect(searchWarnings()).toEqual([]);
  });

  it("an error that is not an outage still fails the search", async () => {
    jest
      .mocked(searchPages)
      .mockImplementation(async (query: string, limit?: number, wiki?: WikiSource) => {
        if (wiki === "iiwiki") throw new Error("a bug, not an outage");
        return wiki === "ixwiki" ? IXWIKI_RESULTS : actualSearchPages(query, limit, wiki);
      });
    answers.althistory = opensearch([]);

    await expect(search().search({ query: "Bashan bug", wikiSource: "all" })).rejects.toThrow(
      "a bug, not an outage"
    );
  });

  it("IxWiki's own failure still fails the search", async () => {
    answers = { iiwiki: opensearch([]), althistory: opensearch([]) };
    jest
      .mocked(searchPages)
      .mockImplementation(async (query: string, limit?: number, wiki?: WikiSource) => {
        if (wiki === "ixwiki") throw new WikiUnavailableError("IxWiki", "unreachable");
        return actualSearchPages(query, limit, wiki);
      });

    await expect(
      search().search({ query: "Bashan ix down", wikiSource: "all" })
    ).rejects.toMatchObject({ cause: expect.any(WikiUnavailableError) });
  });
});
