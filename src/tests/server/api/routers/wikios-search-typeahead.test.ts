/** @jest-environment node */
const mockSpotlight = jest.fn();
const mockFulltext = jest.fn();
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/core/native-search-service", () => ({
  __esModule: true,
  NativeSearchService: {
    spotlightSearch: (...a: unknown[]) => mockSpotlight(...a),
    fulltextSearch: (...a: unknown[]) => mockFulltext(...a),
  },
  searchShadowArticles: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  searchPages: jest.fn(),
  getRecentChanges: jest.fn(),
  getSiteStats: jest.fn(),
  getRandomPage: jest.fn(),
  fullTextSearch: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosSearchRouter } from "~/server/api/routers/wikios/search";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const caller = () =>
  createCallerFactory(wikiosSearchRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

beforeEach(() => jest.clearAllMocks());

describe("wikios.typeahead (plan 413)", () => {
  it("is the title typeahead: title, summary snippet and thumbnail, 10 at most", async () => {
    mockSpotlight.mockResolvedValue([
      { id: "1", title: "Urcea", snippet: "A kingdom.", leadImageUrl: "https://img/u.png" },
      { id: "2", title: "Urtea", snippet: "Another.", leadImageUrl: null },
    ]);

    const result = await caller().typeahead({ query: "Urc" });

    expect(mockSpotlight).toHaveBeenCalledWith("Urc", "ixwiki", 10);
    expect(result.results).toEqual([
      { title: "Urcea", snippet: "A kingdom.", thumbnail: "https://img/u.png" },
      { title: "Urtea", snippet: "Another.", thumbnail: null },
    ]);
    await expect(caller().typeahead({ query: "Urc", limit: 11 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("wikios.advancedSearch (plan 413)", () => {
  it("passes the namespace down, returns the match ranges, and has more while the total is ahead", async () => {
    mockFulltext.mockResolvedValue({
      results: [
        {
          id: "1",
          title: "Burgundie",
          snippet: "The kingdom",
          snippetRanges: [[4, 11]],
          readingTime: 1,
          leadImageUrl: null,
        },
      ],
      total: 41,
    });

    const result = await caller().advancedSearch({
      query: "kingdom",
      limit: 20,
      offset: 20,
      namespace: 10,
    });

    expect(mockFulltext).toHaveBeenCalledWith("kingdom", "ixwiki", 20, 20, 10);
    expect(result.results[0]).toMatchObject({ namespace: 10, snippetRanges: [[4, 11]] });
    expect(result.totalHits).toBe(41);
    expect(result.hasMore).toBe(true);
  });

  it("answers an empty result from the native search itself, not by asking a second engine", async () => {
    mockFulltext.mockResolvedValue({ results: [], total: 0 });

    const result = await caller().advancedSearch({ query: "zzzz" });

    expect(mockFulltext).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ results: [], totalHits: 0, hasMore: false });
  });
});
