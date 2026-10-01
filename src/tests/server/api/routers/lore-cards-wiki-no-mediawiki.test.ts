/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
//
// Plan 418 (A13): the lore-archive search of IxWiki is the native search (`searchPages`); when it finds nothing
// there is no MediaWiki opensearch fallback. A sister wiki that found nothing still falls back to its own.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {},
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  searchPages: jest.fn(),
  getRecentChanges: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  __esModule: true,
  wikiLoreCardGenerator: { fetchArticleMetadataBatch: jest.fn().mockResolvedValue([]) },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { searchPages } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const caller = () =>
  createCallerFactory(loreCardsWikiRouter)(
    createMockRouterContext({
      auth: null,
      user: null,
      db: {
        card: { findMany: jest.fn().mockResolvedValue([]) },
        wikiArticle: { findMany: jest.fn().mockResolvedValue([]) },
      },
    }) as never
  );

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => guard.restore());

describe("lore archive search", () => {
  it("lists what the native search finds for IxWiki, and nothing else when it finds nothing", async () => {
    jest.mocked(searchPages).mockResolvedValue([]);

    const empty = await caller().searchLoreArchive({ source: "ixwiki", query: "zzz" });
    jest.mocked(searchPages).mockResolvedValue([{ title: "Caphiria", pageId: 1, length: 10 }]);
    const found = await caller().searchLoreArchive({ source: "ixwiki", query: "caph" });

    expect(empty.items).toEqual([]);
    expect(found.items.map((item) => item.title)).toEqual(["Caphiria"]);
    expect(searchPages).toHaveBeenCalledWith("zzz", 25, "ixwiki");
    expect(guard.calls()).toEqual([]);
  });

  it("falls back to iiwiki's own opensearch for a sister wiki that found nothing", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      expect(url.hostname).toBe("iiwiki.com");
      expect(url.searchParams.get("action")).toBe("opensearch");
      return ["elm", ["Elmeria"]];
    });
    jest.mocked(searchPages).mockResolvedValue([]);

    const result = await caller().searchLoreArchive({ source: "iiwiki", query: "elm" });

    expect(result.items.map((item) => item.title)).toEqual(["Elmeria"]);
    expect(guard.ixwikiCalls()).toEqual([]);
  });
});
