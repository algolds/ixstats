/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: a page that was deleted, restored or moved is forgotten by every cache that holds it, under every
// spelling it was cached as, and one cache failing does not stop the others.
const mockDeleteMany = jest.fn();
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    ...jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
    externalApiCache: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/cache/trpc-cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache/trpc-cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/services/article-view-service", () => ({
  __esModule: true,
  evictArticleView: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { evictWikiTitleCaches } from "~/lib/wiki-os/services/title-cache-eviction";
import { evictArticleView } from "~/lib/wiki-os/services/article-view-service";
import { invalidateCache } from "~/lib/cache/trpc-cache";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
beforeEach(() => {
  jest.clearAllMocks();
  wikiBridgeCache.clear();
  wikiCacheService.clearCache();
  mockDeleteMany.mockResolvedValue({ count: 0 });
});

describe("the bridge cache", () => {
  it("drops the intro, wikitext and page images of the page under every spelling, and nothing else", async () => {
    for (const key of [
      "intro:ixwiki:foo_bar",
      "intro:ixwiki:Foo bar",
      "wikitext:ixwiki:foo bar",
      "pageimages:ixwiki:Foo bar",
      "intro:ixwiki:Foo baz",
      "intro:iiwiki:Foo bar",
      "wikitext:ixwiki:talk:foo bar",
    ]) {
      wikiBridgeCache.set(key, "cached");
    }

    await evictWikiTitleCaches("Foo bar", "ixwiki");

    expect([...wikiBridgeCache.keys()].sort()).toEqual([
      "intro:iiwiki:Foo bar",
      "intro:ixwiki:Foo baz",
      "wikitext:ixwiki:talk:foo bar",
    ]);
  });
});
describe("the lore scan caches", () => {
  it("deletes the persisted rows: the page's own scan and any scan or category list that names it", async () => {
    await evictWikiTitleCaches("Foo bar", "ixwiki");

    const { where } = mockDeleteMany.mock.calls[0]?.[0];
    expect(where.service).toBe("ixwiki");
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { key: { in: ["lore:ixwiki:foo bar", "lore:ixwiki:foo_bar"] } },
        { key: { startsWith: "lore:" }, data: { contains: '"Foo bar"' } },
        { key: { startsWith: "cat:" }, data: { contains: '"Foo_bar"' } },
      ])
    );
  });
});

describe("the other caches", () => {
  it("clears the geo and countries wiki readers' tRPC cache and the article's views", async () => {
    await evictWikiTitleCaches("Foo bar", "ixwiki", "art-1");

    const cleared = jest.mocked(invalidateCache).mock.calls[0]?.[0] ?? [];
    expect(cleared).toEqual(
      expect.arrayContaining([
        "getFeatureWikiIntro:",
        "parseWikiInfobox:",
        "getWikiIntro:",
        "getWikiRichIntro:",
      ])
    );
    expect(evictArticleView).toHaveBeenCalledWith("art-1");
  });
  it("still clears the rest when one cache cannot be reached, and does not throw", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockDeleteMany.mockRejectedValue(new Error("db down"));
    wikiBridgeCache.set("intro:ixwiki:Foo bar", "cached");

    await expect(evictWikiTitleCaches("Foo bar", "ixwiki", "art-1")).resolves.toBeUndefined();

    expect(wikiBridgeCache.has("intro:ixwiki:Foo bar")).toBe(false);
    expect(evictArticleView).toHaveBeenCalledWith("art-1");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("lore scan"), expect.any(Error));
    warn.mockRestore();
  });
});
