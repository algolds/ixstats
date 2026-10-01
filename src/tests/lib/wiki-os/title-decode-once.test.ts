/** @jest-environment node */
/** Plan 403: titles reach the readers already decoded, so a "%" in one is never decoded again. */
import { getArticleSummaryFromShadow } from "~/lib/wiki-os/core/native-search-service";
import { fetchMediaWikiPageAuthorsAndRevisions } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";

const mockFindFirst = jest.fn();

jest.mock("~/server/db", () => ({
  db: { wikiArticle: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

describe("getArticleSummaryFromShadow", () => {
  beforeEach(() => mockFindFirst.mockReset());

  it("looks up a title containing '%' without throwing", async () => {
    mockFindFirst.mockResolvedValue({ title: "100% Pure", summary: "Pure.", wikitext: "x" });

    await expect(getArticleSummaryFromShadow("100% Pure")).resolves.toEqual({
      title: "100% Pure",
      intro: "Pure.",
      leadImageUrl: null,
    });

    const { where } = mockFindFirst.mock.calls[0]?.[0] ?? {};
    expect(where.OR[0]).toEqual({ slug: "100%_pure" });
    expect(where.OR[1]).toEqual({ title: { equals: "100% Pure", mode: "insensitive" } });
  });

  it("does not decode an escape that is part of the title", async () => {
    mockFindFirst.mockResolvedValue({ title: "100%25 Pure", summary: "s", wikitext: "x" });

    await getArticleSummaryFromShadow("100%25_Pure");

    expect(mockFindFirst.mock.calls[0]?.[0].where.OR[0]).toEqual({ slug: "100%25_pure" });
  });
});

describe("fetchMediaWikiPageAuthorsAndRevisions", () => {
  const realFetch = globalThis.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  it("asks MediaWiki for a title containing '%' exactly as given", async () => {
    await expect(fetchMediaWikiPageAuthorsAndRevisions("100% Pure")).resolves.toBeNull();

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("titles")).toBe("100% Pure");
  });

  it("does not decode an escape that is part of the title", async () => {
    await fetchMediaWikiPageAuthorsAndRevisions("100%25_Pure");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("titles")).toBe("100%25 Pure");
  });
});
