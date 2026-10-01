/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
//
// Plan 418 (A10, A11): IxWiki's category lists, counts, subcategories, autocomplete and file search are read from
// Postgres (wiki_categories, wiki_category_members, wiki_assets) and never fall back to MediaWiki. A sister
// wiki's still ask that wiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiCategory: { findMany: jest.fn() },
    wikiAsset: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
  isDatabaseReadOnly: true,
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosCategoriesRouter } from "~/server/api/routers/wikios/categories";
import { wikiosSearchRouter } from "~/server/api/routers/wikios/search";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiCategory: { findMany: jest.Mock };
  wikiAsset: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};

const ctx = () => createMockRouterContext({ auth: null, user: null }) as never;
const categories = () => createCallerFactory(wikiosCategoriesRouter)(ctx());
const search = () => createCallerFactory(wikiosSearchRouter)(ctx());

/** The raw queries by kind: the member counts (a `count(*)` grouping) and the member titles. */
let counts: Array<Record<string, unknown>>;
let titles: string[];
const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  counts = [];
  titles = [];
  mocked.wikiCategory.findMany.mockResolvedValue([]);
  mocked.wikiAsset.findMany.mockResolvedValue([]);
  mocked.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
    strings.join("?").includes("count(*)") ? counts : titles.map((title) => ({ title }))
  );
});
afterEach(() => guard.restore());

const countRow = (name: string, pages: number, subcats: number, files: number) => ({
  slug: name.toLowerCase().replace(/ /g, "_"),
  name,
  pages: BigInt(pages),
  subcats: BigInt(subcats),
  files: BigInt(files),
});

describe("searchCategories for IxWiki", () => {
  it("lists categories with their page, subcategory and file counts, never asking MediaWiki", async () => {
    mocked.wikiCategory.findMany.mockResolvedValue([{ name: "Countries" }, { name: "Maps" }]);
    counts = [countRow("Countries", 30, 4, 0), countRow("Maps", 1, 0, 12)];

    const result = await categories().searchCategories({ query: "C", wiki: "ixwiki" });

    expect(result).toEqual([
      { name: "Countries", title: "Category:Countries", size: 34, pages: 30, files: 0, subcats: 4 },
      { name: "Maps", title: "Category:Maps", size: 13, pages: 1, files: 12, subcats: 0 },
    ]);
    expect(guard.calls()).toEqual([]);
  });

  it("is empty when Postgres has no match: there is no MediaWiki fallback", async () => {
    expect(await categories().searchCategories({ query: "Zzz", wiki: "ixwiki" })).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });

  it("counts published members only", async () => {
    mocked.wikiCategory.findMany.mockResolvedValue([{ name: "Countries" }]);

    await categories().searchCategories({ query: "C", wiki: "ixwiki" });

    expect(sqlOf(mocked.$queryRaw.mock.calls[0]!)).toContain(`a."status" = 'PUBLISHED'`);
  });
});

describe("getCategoryTotalCounts for IxWiki", () => {
  it("answers each category's file count by the name it was asked under, 0 for one with none", async () => {
    counts = [countRow("Flag images", 0, 0, 7)];

    const result = await categories().getCategoryTotalCounts({
      categories: ["Flag_images", "Empty category"],
      wiki: "ixwiki",
    });

    expect(result).toEqual({ Flag_images: 7, "Empty category": 0 });
    expect(guard.calls()).toEqual([]);
  });
});

describe("getSubcategories for IxWiki", () => {
  it("lists the namespace-14 members of the category without the Category: prefix", async () => {
    titles = ["Category:Provinces", "Category:Cities"];

    const result = await categories().getSubcategories({ category: "Countries", wiki: "ixwiki" });

    expect(result).toEqual(["Provinces", "Cities"]);
    expect(JSON.stringify(mocked.$queryRaw.mock.calls[0])).toContain(`a.\\"namespace\\" = 14`);
    expect(guard.calls()).toEqual([]);
  });

  it("is empty for a category with no subcategory, without asking MediaWiki", async () => {
    expect(await categories().getSubcategories({ category: "Nothing", wiki: "ixwiki" })).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });
});

describe("autocompleteCategories for IxWiki", () => {
  it("completes a prefix from the categories that are not hidden, never asking MediaWiki", async () => {
    mocked.wikiCategory.findMany.mockResolvedValue([{ name: "Countries" }, { name: "Cities" }]);

    expect(await categories().autocompleteCategories({ prefix: "C_o", wiki: "ixwiki" })).toEqual([
      "Countries",
      "Cities",
    ]);
    expect(mocked.wikiCategory.findMany.mock.calls[0]?.[0].where).toEqual({
      hidden: false,
      name: { startsWith: "C o", mode: "insensitive" },
    });
    expect(guard.calls()).toEqual([]);
  });

  it("is empty when nothing matches", async () => {
    expect(await categories().autocompleteCategories({ prefix: "Zzz", wiki: "ixwiki" })).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });
});

describe("searchFiles for IxWiki", () => {
  const asset = {
    title: "Flag of Caphiria.png",
    filename: "Flag_of_Caphiria.png",
    url: "https://ixwiki.com/images/a/ab/Flag_of_Caphiria.png",
    sizeBytes: 1234,
    width: 300,
    height: 200,
    mimeType: "image/png",
  };

  it("lists the assets Postgres holds, never asking MediaWiki", async () => {
    mocked.wikiAsset.findMany.mockResolvedValue([asset]);

    const result = await search().searchFiles({ query: "flag", wiki: "ixwiki" });

    expect(result).toEqual([
      {
        name: "Flag_of_Caphiria.png",
        title: "File:Flag of Caphiria.png",
        url: asset.url,
        size: 1234,
        width: 300,
        height: 200,
        mime: "image/png",
      },
    ]);
    expect(guard.calls()).toEqual([]);
  });

  it("is empty when Postgres holds no asset: there is no MediaWiki fallback", async () => {
    expect(await search().searchFiles({ query: "zzz", wiki: "ixwiki" })).toEqual([]);
    expect(await search().searchFiles({ category: "Zzz", wiki: "ixwiki" })).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });

  it("limits the search to the files a category lists", async () => {
    titles = ["File:Flag of Caphiria.png", "File:Map.png"];
    mocked.wikiAsset.findMany.mockResolvedValue([asset]);

    await search().searchFiles({ category: "Flags", limit: 10, wiki: "ixwiki" });

    expect(JSON.stringify(mocked.$queryRaw.mock.calls[0])).toContain(`a.\\"namespace\\" = 6`);
    expect(mocked.wikiAsset.findMany.mock.calls[0]?.[0]).toMatchObject({
      take: 10,
      where: {
        AND: [
          {
            OR: [
              { title: { in: ["Flag of Caphiria.png", "Map.png"] } },
              { filename: { in: ["Flag_of_Caphiria.png", "Map.png"] } },
            ],
          },
        ],
      },
    });
  });
});

describe("a sister wiki's categories and files (iiwiki) are still read from that wiki", () => {
  const host = (url: URL) => expect(url.hostname).toBe("iiwiki.com");

  it("searchCategories", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      host(url);
      expect(url.searchParams.get("list")).toBe("allcategories");
      return { query: { allcategories: [{ "*": "Elmerian", size: 3, pages: 2, files: 1, subcats: 0 }] } };
    });

    expect(await categories().searchCategories({ query: "Elm", wiki: "iiwiki" })).toEqual([
      { name: "Elmerian", title: "Category:Elmerian", size: 3, pages: 2, files: 1, subcats: 0 },
    ]);
    expect(mocked.wikiCategory.findMany).not.toHaveBeenCalled();
  });

  it("getCategoryTotalCounts", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      host(url);
      return { query: { pages: { 1: { title: "Category:Elmerian", categoryinfo: { files: 9 } } } } };
    });

    expect(
      await categories().getCategoryTotalCounts({ categories: ["Elmerian"], wiki: "iiwiki" })
    ).toEqual({ Elmerian: 9 });
    expect(mocked.$queryRaw).not.toHaveBeenCalled();
  });

  it("getSubcategories", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      host(url);
      return { query: { categorymembers: [{ title: "Category:Hills" }] } };
    });

    expect(await categories().getSubcategories({ category: "Elmerian", wiki: "iiwiki" })).toEqual([
      "Hills",
    ]);
    expect(mocked.$queryRaw).not.toHaveBeenCalled();
  });

  it("autocompleteCategories", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      host(url);
      return { query: { allcategories: [{ "*": "Elmerian" }] } };
    });

    expect(await categories().autocompleteCategories({ prefix: "Elm", wiki: "iiwiki" })).toEqual([
      "Elmerian",
    ]);
    expect(mocked.wikiCategory.findMany).not.toHaveBeenCalled();
  });

  it("searchFiles", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      host(url);
      return {
        query: {
          allimages: [{ name: "Elm.png", url: "https://iiwiki.com/Elm.png", size: 5, width: 4, height: 3, mime: "image/png" }],
        },
      };
    });

    expect(await search().searchFiles({ query: "Elm", wiki: "iiwiki" })).toEqual([
      { name: "Elm.png", title: "File:Elm.png", url: "https://iiwiki.com/Elm.png", size: 5, width: 4, height: 3, mime: "image/png" },
    ]);
    expect(mocked.wikiAsset.findMany).not.toHaveBeenCalled();
  });
});
