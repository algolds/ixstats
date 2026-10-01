/** @jest-environment node */
/**
 * Plan 413 (item 2): the native search reads the stored searchVector and the title indexes, never
 * a tsvector computed per row; snippets are plain text with ranges; before the migration is
 * applied the old queries answer.
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const mockQueryRaw = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRaw(...args),
  },
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
  it("reads the stored searchVector with websearch_to_tsquery and ranks with ts_rank_cd", async () => {
    mockQueryRaw.mockResolvedValueOnce([fulltextRow()]).mockResolvedValueOnce([{ total: 42 }]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.fulltextSearch("  kingdom -war  ", "ixwiki", 20, 40, 0);

    const [pageSql, ...pageParams] = mockQueryRaw.mock.calls[0] as [string, ...unknown[]];
    expect(pageSql).toContain('"searchVector" @@');
    expect(pageSql).toContain("websearch_to_tsquery('english'");
    expect(pageSql).toContain("ts_rank_cd(");
    expect(pageSql).toContain("ts_headline(");
    expect(pageSql).toContain("StartSel=«, StopSel=»");
    // never a tsvector built per row per query
    expect(pageSql).not.toMatch(/to_tsvector\('english', coalesce\(title/);
    expect(pageSql).not.toContain("ILIKE");
    // the query text, source, namespace, limit and offset travel as parameters
    expect(pageParams).toEqual(["kingdom -war", "ixwiki", 0, 20, 40]);
  });

  it("counts every match in a query of its own, so total is not the page size", async () => {
    mockQueryRaw.mockResolvedValueOnce([fulltextRow()]).mockResolvedValueOnce([{ total: 42 }]);
    const { NativeSearchService } = loadService();

    const { results, total } = await NativeSearchService.fulltextSearch("kingdom", "ixwiki", 1, 0);

    const [countSql, ...countParams] = mockQueryRaw.mock.calls[1] as [string, ...unknown[]];
    expect(countSql).toContain("count(*)");
    expect(countSql).toContain('"searchVector" @@');
    expect(countParams).toEqual(["kingdom", "ixwiki", 0]);
    expect(results).toHaveLength(1);
    expect(total).toBe(42);
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

  it("turns the ts_headline markers into character ranges of a plain-text snippet", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        fulltextRow({ headline: "The «kingdom» of Burgundie and its «second» city" }),
      ])
      .mockResolvedValueOnce([{ total: 1 }]);
    const { NativeSearchService } = loadService();

    const { results } = await NativeSearchService.fulltextSearch("kingdom second");

    const [item] = results;
    expect(item!.snippet).toBe("The kingdom of Burgundie and its second city");
    expect(item!.snippetRanges.map(([s, e]) => item!.snippet.slice(s, e))).toEqual([
      "kingdom",
      "second",
    ]);
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

  it("tries the indexed query again after a few minutes and uses it once it works", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    mockQueryRaw.mockRejectedValue(missingColumn());
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const { NativeSearchService } = loadService();
    await NativeSearchService.fulltextSearch("kingdom");
    mockQueryRaw.mockClear();

    now.mockReturnValue(1_000_000 + 5 * 60 * 1000 + 1);
    mockQueryRaw.mockReset();
    mockQueryRaw.mockResolvedValueOnce([fulltextRow()]).mockResolvedValueOnce([{ total: 1 }]);
    const { results } = await NativeSearchService.fulltextSearch("kingdom");

    expect(results[0]!.snippetRanges.length).toBeGreaterThan(0);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });

  it("does not hide any other database error behind the slow query", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection terminated"));
    const { NativeSearchService } = loadService();

    await expect(NativeSearchService.fulltextSearch("kingdom")).rejects.toThrow(
      "connection terminated"
    );
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("spotlightSearch (title typeahead)", () => {
  const typeaheadRow = (overrides: Record<string, unknown> = {}) => ({
    id: "1",
    title: "Urcea",
    summary: "A kingdom.",
    readingTime: 3,
    leadImageUrl: "https://img/urcea.png",
    tier: 1,
    similarity: 0.4,
    ...overrides,
  });

  it("asks for prefix, then contains, then trigram matches in one query that never touches wikitext", async () => {
    mockQueryRaw.mockResolvedValue([typeaheadRow()]);
    const { NativeSearchService } = loadService();

    const results = await NativeSearchService.spotlightSearch("Urc", "ixwiki", 10);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockQueryRaw.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toContain("lower(title) LIKE lower($4::text)");
    expect(sql).toContain("lower(title) % lower($3::text)");
    expect(sql).toContain("similarity(lower(title)");
    expect(sql).not.toContain("wikitext");
    expect(sql).toContain("LIMIT $6");
    expect(params).toEqual(["ixwiki", 0, "Urc", "Urc%", "%Urc%", 10]);
    expect(results[0]).toMatchObject({
      title: "Urcea",
      snippet: "A kingdom.",
      leadImageUrl: "https://img/urcea.png",
      matchType: "title_fuzzy",
    });
  });

  it("leaves the contains pattern out for a 2-character query", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.spotlightSearch("Ur");

    expect((mockQueryRaw.mock.calls[0] as unknown[]).slice(1)).toEqual([
      "ixwiki",
      0,
      "Ur",
      "Ur%",
      null,
      10,
    ]);
  });

  it("escapes LIKE wildcards in what the reader typed, and reads an underscore as a space", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.spotlightSearch("100%_off");

    const params = (mockQueryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(params[2]).toBe("100% off");
    expect(params[3]).toBe("100\\% off%");
  });

  it("looks in the namespace a Template:, Category: or User: query names", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { NativeSearchService } = loadService();

    await NativeSearchService.spotlightSearch("template:info");
    await NativeSearchService.spotlightSearch("Category:Urc");
    await NativeSearchService.spotlightSearch("user:ab");

    expect(mockQueryRaw.mock.calls.map((call) => (call as unknown[])[2])).toEqual([10, 14, 2]);
  });

  it("scores an exact title 1, a prefix 0.8, and a similar title by its similarity", async () => {
    mockQueryRaw.mockResolvedValue([
      typeaheadRow({ id: "a", title: "Urcea", tier: 0 }),
      typeaheadRow({ id: "b", title: "Urcean Navy", tier: 1 }),
      typeaheadRow({ id: "c", title: "Urtea", tier: 3, similarity: 0.45 }),
    ]);
    const { NativeSearchService } = loadService();

    const results = await NativeSearchService.spotlightSearch("Urcea");

    expect(results.map((r) => [r.matchType, r.similarityScore])).toEqual([
      ["title_exact", 1],
      ["title_fuzzy", 0.8],
      ["title_fuzzy", 0.45],
    ]);
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
