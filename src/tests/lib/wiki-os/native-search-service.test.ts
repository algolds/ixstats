/** @jest-environment node */
/**
 * Plan 413 (item 2): the native search reads the stored searchVector and the title indexes, never
 * a tsvector computed per row; snippets are plain text with ranges; before the migration is
 * applied the old queries answer.
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { getArticleSummaryFromShadow } from "~/lib/wiki-os/core/native-search-service";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";

const mockQueryRaw = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindFirst = jest.fn();
const mockBridgeWikitext = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// The intro fallback's bridge (a sister wiki's own page).
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleWikitext: (...args: unknown[]) => mockBridgeWikitext(...args),
}));

type Service = typeof import("~/lib/wiki-os/core/native-search-service");

/** A fresh copy of the service: the missing-index state is per module instance. */
function loadService(): Service {
  let service!: Service;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require("~/lib/wiki-os/core/native-search-service") as Service;
  });
  return service;
}

const missingColumn = () =>
  new Error("Raw query failed. Code: `42703`. Message: `column a.searchVector does not exist`");

const fulltextRow = (overrides: Record<string, unknown> = {}) => ({
  id: "1",
  title: "Burgundie",
  slug: "Burgundie",
  summary: "A kingdom.",
  headline: "The «kingdom» of Burgundie",
  readingTime: 2,
  leadImageUrl: null,
  rank: 0.6,
  ...overrides,
});

let warn: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  jest.restoreAllMocks();
});

describe("fulltextSearch (indexed)", () => {
  it.each<[string, string, string | null]>([
    ["Pela", "", "Pela"],
    ["  pelaxia garrison ", "pelaxia ", "garrison"],
    ["Pela!", "", "Pela"],
    ["Café Pel", "Café ", "Pel"],
    ["x y z-", "x y ", "z"],
  ])(
    "matches the last word of a plainly typed query as a prefix: %j reads %j then %j:*",
    async (typed, text, prefix) => {
      mockQueryRaw.mockResolvedValue([]);
      const { NativeSearchService } = loadService();

      await NativeSearchService.fulltextSearch(typed);

      const [pageSql, ...pageParams] = mockQueryRaw.mock.calls[0] as [string, ...unknown[]];
      expect(pageSql).toContain("to_tsquery('english', $6::text || ':*')");
      expect(pageParams[0]).toBe(text);
      expect(pageParams[5]).toBe(prefix);
      // the count asks the same question
      const countParams = (mockQueryRaw.mock.calls[1] as unknown[]).slice(1);
      expect(countParams).toEqual([text, "ixwiki", 0, prefix]);
    }
  );

  it.each(['"famous garrison"', "garrison -town", "war or peace", "OR", "-x", "a-b -c"])(
    "reads %j as websearch syntax, with no prefix word",
    async (typed) => {
      mockQueryRaw.mockResolvedValue([]);
      const { NativeSearchService } = loadService();

      await NativeSearchService.fulltextSearch(typed);

      const params = (mockQueryRaw.mock.calls[0] as unknown[]).slice(1);
      expect(params[0]).toBe(typed);
      expect(params[5]).toBeNull();
    }
  );

  it("sends only letters and digits as the prefix word, so nothing a reader types is tsquery syntax", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.fulltextSearch("kingdom foo'&|:*()<>pela");
    await NativeSearchService.fulltextSearch("&|!():*");

    const prefixes = mockQueryRaw.mock.calls
      .filter((call) => !String((call as unknown[])[0]).includes("count(*)"))
      .map((call) => (call as unknown[])[6]);
    expect(prefixes).toEqual(["pela", null]);
    expect(String((mockQueryRaw.mock.calls[0] as unknown[])[1])).toBe("kingdom foo'&|:*()<>");
  });
  it("drops NUL characters from the query: Postgres text cannot hold one", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.fulltextSearch("a\u0000b kingd\u0000om");

    const [, ...pageParams] = mockQueryRaw.mock.calls[0] as [string, ...unknown[]];
    expect(JSON.stringify(pageParams)).not.toContain("\\u0000");
    expect(pageParams[0]).toBe("ab ");
    expect(pageParams[5]).toBe("kingdom");

    // only NULs: nothing left to search for, and the database is not asked
    mockQueryRaw.mockClear();
    await expect(NativeSearchService.fulltextSearch("\u0000\u0000")).resolves.toEqual({
      results: [],
      total: 0,
    });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("filters by namespace and published status in SQL", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.fulltextSearch("infobox", "ixwiki", 20, 0, 10);

    const [pageSql, , , namespace] = mockQueryRaw.mock.calls[0] as [string, ...unknown[]];
    expect(pageSql).toContain("a.namespace = $3");
    expect(pageSql).toContain("a.status = 'PUBLISHED'");
    expect(namespace).toBe(10);
  });
  it("keeps markup out of the snippet, and falls back to the summary when there is no headline", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        fulltextRow({ headline: "<script>alert(1)</script>«kingdom»" }),
        fulltextRow({
          id: "2",
          title: "Other",
          slug: "Other",
          headline: null,
          summary: "Summary text.",
        }),
      ])
      .mockResolvedValueOnce([{ total: 2 }]);
    const { NativeSearchService } = loadService();

    const { results } = await NativeSearchService.fulltextSearch("kingdom");

    expect(results[0]!.snippet).not.toMatch(/[<>]/);
    expect(results[1]).toMatchObject({ snippet: "Summary text.", snippetRanges: [] });
  });

  it("ignores a marker whose partner the wikitext cleaning removed", () => {
    const { toMarkedSnippet } = loadService();

    expect(toMarkedSnippet("a «b c")).toEqual({ text: "a b c", ranges: [[2, 5]] });
    expect(toMarkedSnippet("a b» c")).toEqual({ text: "a b c", ranges: [] });
    expect(toMarkedSnippet(null)).toEqual({ text: "", ranges: [] });
  });
});

describe("fulltextSearch before the migration is applied", () => {
  it("answers from the old query, logging one warning, when the column does not exist", async () => {
    mockQueryRaw.mockRejectedValue(missingColumn());
    mockFindMany.mockResolvedValue([
      {
        id: "1",
        title: "Burgundie",
        wikitext: "kingdom text",
        summary: null,
        readingTime: 1,
        leadImageUrl: null,
      },
    ]);
    mockCount.mockResolvedValue(7);
    const { NativeSearchService } = loadService();

    const first = await NativeSearchService.fulltextSearch("kingdom");
    const second = await NativeSearchService.fulltextSearch("kingdom");

    expect(first.total).toBe(7);
    expect(first.results[0]!.title).toBe("Burgundie");
    expect(second.total).toBe(7);
    // the second call did not try the indexed query again, and nothing was logged twice
    expect(mockQueryRaw).toHaveBeenCalledTimes(2); // the page + count queries of the first call only
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("2026-09-30-wikios-search-indexes.sql");
  });
  it.each([
    'column "searchVector" does not exist',
    "function similarity(text, text) does not exist",
    "operator does not exist: text % text",
    'extension "pg_trgm" does not exist',
    'index "wiki_articles_title_lower_trgm_idx" does not exist',
  ])("treats %j as the missing migration", async (message) => {
    mockQueryRaw.mockRejectedValue(new Error(`Raw query failed. Message: \`${message}\``));
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const { NativeSearchService } = loadService();

    await expect(NativeSearchService.fulltextSearch("kingdom")).resolves.toEqual({
      results: [],
      total: 0,
    });
  });

  it.each([
    'relation "wiki_articles" does not exist',
    'column "title" does not exist',
    "function websearch_to_tsquery(unknown, text) does not exist",
    'Code: `42P01`. Message: `relation "wiki_articles" does not exist`',
  ])("does not hide %j: that is a real fault, not the missing migration", async (message) => {
    mockQueryRaw.mockRejectedValue(new Error(message));
    const { NativeSearchService } = loadService();

    await expect(NativeSearchService.fulltextSearch("kingdom")).rejects.toThrow(message);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("spotlightSearch (title typeahead)", () => {
  it("escapes LIKE wildcards in what the reader typed, and reads an underscore as a space", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.spotlightSearch("100%_off");

    const params = (mockQueryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(params[2]).toBe("100% off");
    expect(params[3]).toBe("100\\% off%");
  });
  it("drops NUL characters from what the reader typed, so a\\u0000b is not a 500", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.spotlightSearch("a\u0000b");

    const params = (mockQueryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(params).toEqual(["ixwiki", 0, "ab", "ab%", null, 10]);

    mockQueryRaw.mockClear();
    await expect(NativeSearchService.spotlightSearch("\u0000")).resolves.toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("is empty for a blank query without asking the database", async () => {
    const { NativeSearchService } = loadService();
    await expect(NativeSearchService.spotlightSearch("   ")).resolves.toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("falls back to a title-only Prisma query when pg_trgm is not installed", async () => {
    mockQueryRaw.mockRejectedValue(new Error("function similarity(text, text) does not exist"));
    mockFindMany.mockResolvedValue([
      { id: "1", title: "Urcea", summary: "A kingdom.", readingTime: 1, leadImageUrl: null },
    ]);
    const { NativeSearchService } = loadService();

    const results = await NativeSearchService.spotlightSearch("Urc");

    expect(results[0]).toMatchObject({ title: "Urcea", matchType: "title_fuzzy" });
    expect(mockFindMany.mock.calls[0]![0].select).toEqual({
      id: true,
      title: true,
      summary: true,
      readingTime: true,
      leadImageUrl: true,
    });
  });
});

describe("getArticleSummaryFromShadow: a sister page with no stored copy reads its own wiki", () => {
  let error: jest.SpyInstance;
  beforeEach(() => {
    mockFindFirst.mockResolvedValue(null);
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("gives the intro its wiki answers", async () => {
    mockBridgeWikitext.mockResolvedValue({
      title: "Gylias",
      pageId: 3,
      wikitext: "'''Gylias''' is a country in Eurth, on the northern coast of the continent.",
      length: 80,
    });

    await expect(getArticleSummaryFromShadow("Gylias", "iiwiki")).resolves.toMatchObject({
      title: "Gylias",
      intro: expect.stringContaining("Gylias is a country"),
    });
    expect(mockBridgeWikitext).toHaveBeenCalledWith("Gylias", "iiwiki");
  });

  it("throws WikiUnavailableError when that wiki cannot be reached, never an empty intro", async () => {
    mockBridgeWikitext.mockRejectedValue(new WikiUnavailableError("IIWiki", "unreachable"));

    await expect(getArticleSummaryFromShadow("Gylias", "iiwiki")).rejects.toBeInstanceOf(
      WikiUnavailableError
    );
  });

  it("logs and swallows any other error, as an empty intro", async () => {
    mockBridgeWikitext.mockRejectedValue(new Error("boom"));

    await expect(getArticleSummaryFromShadow("Gylias", "iiwiki")).resolves.toEqual({
      title: "Gylias",
      intro: "",
      leadImageUrl: null,
    });
    expect(error).toHaveBeenCalled();
  });
});
