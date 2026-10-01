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
import { intelligentLoreCache } from "~/lib/wiki-os/core/intelligent-lore-cache";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";

const scanOf = (...titles: string[]) => ({
  pagesScanned: titles.length,
  foundVariants: [],
  categoryUsed: null,
  extractedData: {} as never,
  pages: titles.map((title) => ({ title, content: `text of ${title}` })),
});

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
      "pageimages:Foo bar",
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

describe("the country profile cache", () => {
  it("drops the profile and the parsed infobox of the page, and no other page's", async () => {
    await wikiCacheService.setCustomCache("ixwiki:Caphiria", "profile", { name: "c" }, 60_000);
    await wikiCacheService.setCustomCache(
      "parsed-infobox:ixwiki:caphiria",
      "x",
      { name: "c" },
      60_000
    );
    await wikiCacheService.setCustomCache(
      "parsed-infobox:ixwiki:other",
      "x",
      { name: "o" },
      60_000
    );
    await wikiCacheService.setCustomCache("iiwiki:Caphiria", "profile", { name: "ii" }, 60_000);

    await evictWikiTitleCaches("Caphiria", "ixwiki");

    expect(await wikiCacheService.getCustomCache("ixwiki:Caphiria")).toBeNull();
    expect(await wikiCacheService.getCustomCache("parsed-infobox:ixwiki:caphiria")).toBeNull();
    expect(await wikiCacheService.getCustomCache("parsed-infobox:ixwiki:other")).not.toBeNull();
    expect(await wikiCacheService.getCustomCache("iiwiki:Caphiria")).not.toBeNull();
  });
});

describe("the lore scan caches", () => {
  it("drops the scan for the country the page is and any scan that read the page", async () => {
    await intelligentLoreCache.setDeepScan(
      "ixwiki",
      "Caphiria",
      scanOf("Caphiria", "History of Caphiria")
    );
    await intelligentLoreCache.setDeepScan("ixwiki", "Neighbour", scanOf("Neighbour", "Caphiria"));
    await intelligentLoreCache.setDeepScan("ixwiki", "Elsewhere", scanOf("Elsewhere"));

    await evictWikiTitleCaches("Caphiria", "ixwiki");

    expect(await intelligentLoreCache.getDeepScan("ixwiki", "Caphiria")).toBeNull();
    expect(await intelligentLoreCache.getDeepScan("ixwiki", "Neighbour")).toBeNull();
    expect(await intelligentLoreCache.getDeepScan("ixwiki", "Elsewhere")).not.toBeNull();
  });

  it("drops category lists naming the page, and the 'no such page' mark a deleted page left", async () => {
    await intelligentLoreCache.setCategoryMembers("ixwiki", "Nations", [
      { title: "Caphiria" },
      { title: "Other" },
    ]);
    await intelligentLoreCache.setCategoryMembers("ixwiki", "Cities", [{ title: "Capital" }]);
    intelligentLoreCache.markMissingPage("ixwiki", "caphiria");

    await evictWikiTitleCaches("Caphiria", "ixwiki");

    expect(intelligentLoreCache.isKnownMissingPage("ixwiki", "caphiria")).toBe(false);
    expect(await intelligentLoreCache.getCategoryMembers("ixwiki", "Nations")).toBeNull();
    expect(await intelligentLoreCache.getCategoryMembers("ixwiki", "Cities")).not.toBeNull();
  });

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

  it("clears no article view when it is not told the article", async () => {
    await evictWikiTitleCaches("Foo bar", "ixwiki");
    expect(evictArticleView).not.toHaveBeenCalled();
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
