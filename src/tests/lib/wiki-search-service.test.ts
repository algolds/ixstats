import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import {
  NativeSearchService,
  searchWiki,
  searchShadowArticles,
} from "~/lib/wiki-os/core/native-search-service";

describe("NativeSearchService & searchWiki contract", () => {
  let findManySpy: any;
  let queryRawSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    if (findManySpy) findManySpy.mockRestore();
    if (queryRawSpy) queryRawSpy.mockRestore();
    findManySpy = jest.spyOn(db.wikiArticle, "findMany").mockResolvedValue([]);
    // The typeahead is one indexed query over titles and summaries (plan 413 item 2): it never reads wikitext
    queryRawSpy = jest.spyOn(db, "$queryRawUnsafe").mockResolvedValue([] as never);
  });

  it("performs spotlight search across articles using title prefix and slug", async () => {
    const mockArticles = [
      {
        id: "art-1",
        title: "Caphiria",
        summary: "Caphiria is a sovereign constitutional monarchy.",
        readingTime: 1,
        leadImageUrl: null,
        tier: 0,
        similarity: 1,
      },
      {
        id: "art-2",
        title: "Caphirian Navy",
        summary: "The naval forces of Caphiria.",
        readingTime: 1,
        leadImageUrl: null,
        tier: 1,
        similarity: 0.5,
      },
    ] as any;

    queryRawSpy.mockResolvedValue(mockArticles);

    const results = await NativeSearchService.spotlightSearch("Caphiria", "ixwiki", 10);

    expect(results).toHaveLength(2);
    expect(results[0]?.title).toBe("Caphiria");
    expect(results[0]?.slug).toBe("caphiria");
    expect(results[0]?.snippet).toContain("Caphiria is a sovereign constitutional monarchy");
    expect(queryRawSpy).toHaveBeenCalledTimes(1);
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace or empty query", async () => {
    const results = await NativeSearchService.spotlightSearch("   ");
    expect(results).toEqual([]);
    expect(queryRawSpy).not.toHaveBeenCalled();
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("formats top-level searchWiki and searchShadowArticles output accurately", async () => {
    queryRawSpy.mockResolvedValue([
      {
        id: "art-1",
        title: "Valora",
        summary: "Valora is a member state.",
        readingTime: 1,
        leadImageUrl: null,
        tier: 0,
        similarity: 1,
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
