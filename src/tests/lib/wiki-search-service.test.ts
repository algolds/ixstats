import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NativeSearchService, searchWiki, searchShadowArticles } from "~/lib/wiki-os/core/native-search-service";
import { db } from "~/server/db";

jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers", () => ({
  __esModule: true,
  extractIntroFromWikitext: (txt: string) => txt,
}));

const mockFindMany = jest.spyOn(db.wikiArticle, "findMany");

describe("NativeSearchService & searchWiki contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([] as any);
  });

  it("performs spotlight search across articles using title prefix and slug", async () => {
    const mockArticles = [
      {
        id: "art-1",
        title: "Caphiria",
        wikitext: "== Overview ==\nCaphiria is a sovereign constitutional monarchy.",
      },
      {
        id: "art-2",
        title: "Caphirian Navy",
        wikitext: "== Military ==\nThe naval forces of Caphiria.",
      },
    ];

    mockFindMany.mockResolvedValue(mockArticles as any);

    const results = await NativeSearchService.spotlightSearch("Caphiria", "ixwiki", 10);

    expect(results).toHaveLength(2);
    expect(results[0]?.title).toBe("Caphiria");
    expect(results[0]?.slug).toBe("caphiria");
    expect(results[0]?.snippet).toContain("Caphiria is a sovereign constitutional monarchy");
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("returns empty array for whitespace or empty query", async () => {
    const results = await NativeSearchService.spotlightSearch("   ");
    expect(results).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("formats top-level searchWiki and searchShadowArticles output accurately", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "art-1",
        title: "Valora",
        wikitext: "Valora is a member state.",
      },
    ] as any);

    const shadowResults = await searchShadowArticles("Valora", 5, "ixwiki");
    expect(shadowResults).toHaveLength(1);
    expect(shadowResults[0]?.title).toBe("Valora");
    expect(shadowResults[0]?.snippet).toContain("Valora is a member state");

    const searchResults = await searchWiki("Valora", "ixwiki", 5);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.title).toBe("Valora");
  });
});
