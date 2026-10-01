/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A12): the lore-card generator reads IxWiki from Postgres (page text, revision ledger, render-derived
// links, categories and images, assets) and never asks MediaWiki. A sister wiki's pages are still read from that wiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn(), findMany: jest.fn() },
    wikiRevision: { findFirst: jest.fn(), groupBy: jest.fn() },
    wikiCategory: { findMany: jest.fn() },
    wikiCategoryMember: { findMany: jest.fn() },
    wikiImageLink: { findMany: jest.fn() },
    wikiLink: { count: jest.fn() },
    wikiAsset: { findMany: jest.fn() },
    card: { findFirst: jest.fn() },
    systemConfig: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
  isDatabaseReadOnly: true,
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiArticle: Record<"findFirst" | "findMany", jest.Mock>;
  wikiRevision: Record<"findFirst" | "groupBy", jest.Mock>;
  wikiCategory: { findMany: jest.Mock };
  wikiCategoryMember: { findMany: jest.Mock };
  wikiImageLink: { findMany: jest.Mock };
  wikiLink: { count: jest.Mock };
  wikiAsset: { findMany: jest.Mock };
  card: { findFirst: jest.Mock };
  systemConfig: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};

const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

const BODY = "Caphiria is a constitutional monarchy on the southern coast of the continent. ".repeat(12);
const WIKITEXT = `{{Infobox country\n|name = Caphiria\n|image = Caphiria map.png\n}}\n'''Caphiria''' ${BODY}<ref>One</ref><ref>Two</ref>\n`;

const asset = {
  filename: "Caphiria_map.png",
  slug: "caphiria_map.png",
  md5Hash: "abc",
  title: "Caphiria map.png",
  url: "https://ixwiki.com/images/c/c1/Caphiria_map.png",
  thumbnailUrl: null,
  mimeType: "image/png",
  width: 800,
  height: 600,
};

/** `$queryRaw` by the shape of the SQL: the earliest revisions, the previews, a list of titles. */
let early: Array<Record<string, unknown>>;
let heads: Array<Record<string, unknown>>;
let titles: Array<Record<string, unknown>>;

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  early = [];
  heads = [];
  titles = [];
  mocked.wikiArticle.findFirst.mockResolvedValue(null);
  mocked.wikiArticle.findMany.mockResolvedValue([]);
  mocked.wikiRevision.findFirst.mockResolvedValue(null);
  mocked.wikiRevision.groupBy.mockResolvedValue([]);
  mocked.wikiCategory.findMany.mockResolvedValue([]);
  mocked.wikiCategoryMember.findMany.mockResolvedValue([]);
  mocked.wikiImageLink.findMany.mockResolvedValue([]);
  mocked.wikiLink.count.mockResolvedValue(0);
  mocked.wikiAsset.findMany.mockResolvedValue([]);
  mocked.card.findFirst.mockResolvedValue(null);
  mocked.systemConfig.findMany.mockResolvedValue([]);
  mocked.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes("row_number()")) return early;
    if (sql.includes("octet_length")) return heads;
    return titles;
  });
});
afterEach(() => guard.restore());

describe("generateCard for IxWiki", () => {
  beforeEach(() => {
    mocked.wikiArticle.findFirst.mockResolvedValue({
      id: "a1",
      title: "Caphiria",
      wikitext: WIKITEXT,
      updatedAt: day(20),
    });
    mocked.wikiCategoryMember.findMany.mockResolvedValue([
      { category: { name: "Countries" } },
      { category: { name: "Monarchies" } },
    ]);
    mocked.wikiImageLink.findMany.mockResolvedValue([{ fileName: "Caphiria map.png" }]);
    mocked.wikiLink.count.mockResolvedValue(4);
    mocked.wikiRevision.findFirst.mockResolvedValue({ createdAt: day(18) });
    early = [
      { articleId: "a1", author: "WikiBot", createdAt: day(1) },
      { articleId: "a1", author: "Kir", createdAt: day(2) },
    ];
    mocked.wikiRevision.groupBy.mockResolvedValue([
      { articleId: "a1", author: "Kir", _count: { _all: 3 } },
      { articleId: "a1", author: "Bea", _count: { _all: 5 } },
      { articleId: "a1", author: "WikiBot", _count: { _all: 2 } },
      { articleId: "a1", author: "203.0.113.9", _count: { _all: 9 } },
    ]);
    mocked.wikiAsset.findMany.mockResolvedValue([asset]);
  });

  it("builds the card from Postgres: image, credit and scores, never asking a wiki", async () => {
    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki", {
      requireImage: true,
    });

    expect(card).toMatchObject({
      title: "Caphiria",
      wikiSource: "ixwiki",
      wikiArticleTitle: "Caphiria",
      artwork: asset.url,
      // (two references * 10 + four inbound links * 5) / 2, and four inbound links * 10: the facts Postgres holds.
      loreStats: { historicalSignificance: 20, culturalImpact: 40 },
      authorInfo: {
        creator: "Kir",
        primaryContributor: "Bea",
        displayAuthor: "Kir (Created) • Bea (Top Editor)",
        isBotFiltered: true,
        contributorCount: 3,
      },
    });
    expect(card?.description).toContain("Caphiria is a constitutional monarchy");
    expect(guard.calls()).toEqual([]);
    // Only the published page is read.
    expect(mocked.wikiArticle.findFirst.mock.calls[0]?.[0].where).toEqual({
      source: "ixwiki",
      title: "Caphiria",
      status: "PUBLISHED",
    });
    // Backlinks come from published pages' links.
    expect(mocked.wikiLink.count.mock.calls[0]?.[0].where).toEqual({
      targetSlug: "caphiria",
      sourceArticle: { source: "ixwiki", status: "PUBLISHED" },
    });
  });

  it("falls back to the first illustration the page uses when its text names no lead picture", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue({
      id: "a1",
      title: "Caphiria",
      wikitext: `'''Caphiria''' ${BODY}`,
      updatedAt: day(20),
    });
    mocked.wikiImageLink.findMany.mockResolvedValue([
      { fileName: "Caphiria logo.png" },
      { fileName: "Caphiria map.png" },
    ]);

    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki");

    expect(card?.artwork).toBe(asset.url);
  });

  it("names the file's own URL when WikiOS holds no asset for it", async () => {
    mocked.wikiAsset.findMany.mockResolvedValue([]);

    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki");

    expect(card?.artwork).toMatch(/^https:\/\/ixwiki\.com\/images\/[0-9a-f]\/[0-9a-f]{2}\/Caphiria_map\.png$/);
  });

  it("refuses a page Postgres lacks or has deleted, without asking a wiki", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue(null);

    await expect(wikiLoreCardGenerator.generateCard("Nowhere", "ixwiki")).rejects.toThrow(
      "was not found"
    );
    expect(guard.calls()).toEqual([]);
  });
});

describe("previews and credits for IxWiki", () => {
  it("previews the published pages from the start of their text, never asking a wiki", async () => {
    heads = [
      {
        id: "a1",
        title: "Caphiria",
        length: 5000,
        head: `{{Infobox country|image = Caphiria map.png}}\n'''Caphiria''' is a country.`,
      },
    ];
    mocked.wikiCategoryMember.findMany.mockResolvedValue([
      { articleId: "a1", category: { name: "Countries" } },
    ]);
    mocked.wikiAsset.findMany.mockResolvedValue([asset]);
    mocked.wikiArticle.findMany.mockResolvedValue([{ id: "a1", title: "Caphiria" }]);
    early = [{ articleId: "a1", author: "Kir", createdAt: day(2) }];

    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
      ["Caphiria", "Nowhere"],
      "ixwiki"
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      title: "Caphiria",
      hasImage: true,
      imageUrl: asset.url,
      length: 5000,
      categoryCount: 1,
      authorInfo: { creator: "Kir" },
    });
    expect(previews[0]?.extract).toContain("Caphiria is a country");
    expect(guard.calls()).toEqual([]);
    // The query reads the start of each text and the published pages only.
    const sql = sqlOf(mocked.$queryRaw.mock.calls.find((call) => sqlOf(call).includes("octet_length"))!);
    expect(sql).toContain("left(a.\"wikitext\"");
    expect(sql).toContain(`a."status" = 'PUBLISHED'`);
  });

  it("credits the creator and the top other contributor of each page, under every spelling asked", async () => {
    mocked.wikiArticle.findMany.mockResolvedValue([{ id: "a1", title: "Caphiria national" }]);
    early = [{ articleId: "a1", author: "Kir", createdAt: day(2) }];
    mocked.wikiRevision.groupBy.mockResolvedValue([
      { articleId: "a1", author: "Kir", _count: { _all: 3 } },
      { articleId: "a1", author: "Bea", _count: { _all: 5 } },
    ]);

    const authors = await wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(
      ["Caphiria_national"],
      "ixwiki"
    );

    for (const key of ["Caphiria_national", "caphiria national", "Caphiria national"]) {
      expect(authors.get(key)).toMatchObject({
        creator: "Kir",
        primaryContributor: "Bea",
        contributorCount: 2,
      });
    }
    expect(mocked.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject({
      source: "ixwiki",
      status: "PUBLISHED",
      title: { in: ["Caphiria national"] },
    });
    expect(guard.calls()).toEqual([]);
  });
});

describe("lists for IxWiki", () => {
  it("lists a category's pages and files from its members, never asking a wiki", async () => {
    titles = [{ title: "Caphiria" }, { title: "File:Map.png" }];

    expect(await wikiLoreCardGenerator.fetchCategoryMembers("Category:Nations", "ixwiki", 100)).toEqual([
      "Caphiria",
      "File:Map.png",
    ]);
    const call = mocked.$queryRaw.mock.calls[0]!;
    expect(sqlOf(call)).toContain(`a."status" = 'PUBLISHED'`);
    const kinds = JSON.stringify(call);
    expect(kinds).toContain(`a.\\"namespace\\" NOT IN (6, 14)`);
    expect(kinds).toContain(`a.\\"namespace\\" = 6`);
    expect(guard.calls()).toEqual([]);
  });

  it("lists only a category's files, or only its pages, when asked", async () => {
    await wikiLoreCardGenerator.fetchCategoryMembers("Nations", "ixwiki", 100, "file");
    await wikiLoreCardGenerator.fetchCategoryMembers("Nations", "ixwiki", 100, "page");

    const [files, pages] = mocked.$queryRaw.mock.calls.map((call) => JSON.stringify(call));
    expect(files).toContain(`a.\\"namespace\\" = 6`);
    expect(files).not.toContain("NOT IN (6, 14)");
    expect(pages).toContain("NOT IN (6, 14)");
    expect(pages).not.toContain(`a.\\"namespace\\" = 6`);
  });

  it("lists the main namespace's pages that are not redirects, by title", async () => {
    titles = [{ title: "Alpha" }, { title: "Beta" }];

    expect(await wikiLoreCardGenerator.fetchAllMainNamespacePages("ixwiki", 500)).toEqual([
      "Alpha",
      "Beta",
    ]);
    const sql = sqlOf(mocked.$queryRaw.mock.calls[0]!);
    expect(sql).toContain(`a."namespace" = 0`);
    expect(sql).toContain(`"redirectTargetSlug" IS NULL`);
    expect(sql).toContain(`ORDER BY a."title"`);
    expect(guard.calls()).toEqual([]);
  });

  it("picks random pages in the database, and with images only those whose text names a lead picture", async () => {
    titles = [
      { title: "No picture", head: "Just text." },
      { title: "Has picture", head: "[[File:Pic.png|thumb]] text" },
    ];

    expect(await wikiLoreCardGenerator.fetchRandomArticles(5, "ixwiki")).toEqual([
      "No picture",
      "Has picture",
    ]);
    expect(await wikiLoreCardGenerator.fetchRandomArticlesWithImages(5, "ixwiki")).toEqual([
      "Has picture",
    ]);
    expect(sqlOf(mocked.$queryRaw.mock.calls[0]!)).toContain("ORDER BY random()");
    // Image pages are looked for among a few times as many random candidates.
    expect(mocked.$queryRaw.mock.calls[1]).toContain(15);
    expect(guard.calls()).toEqual([]);
  });

  it("searches categories by prefix and counts their members, never asking a wiki", async () => {
    mocked.wikiCategory.findMany.mockResolvedValue([{ name: "Countries" }]);

    expect(await wikiLoreCardGenerator.searchCategories("Count", "ixwiki", 10)).toEqual(["Countries"]);
    expect(mocked.wikiCategory.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { hidden: false, name: { startsWith: "Count", mode: "insensitive" } },
      take: 10,
    });

    titles = [];
    mocked.$queryRaw.mockResolvedValueOnce([
      { slug: "countries", name: "Countries", pages: 30n, subcats: 4n, files: 2n },
    ]);
    expect(await wikiLoreCardGenerator.getCategoriesInfo(["Category:Countries"], "ixwiki")).toEqual({
      Countries: { size: 36, pages: 30, files: 2, subcats: 4 },
      "Category:Countries": { size: 36, pages: 30, files: 2, subcats: 4 },
    });
    expect(guard.calls()).toEqual([]);
  });

  it("gives the URL of a file from the asset WikiOS holds", async () => {
    mocked.wikiAsset.findMany.mockResolvedValue([asset]);

    expect(await wikiLoreCardGenerator.getImageUrl("File:Caphiria map.png", "ixwiki")).toBe(asset.url);
    expect(guard.calls()).toEqual([]);
  });
});

describe("a sister wiki's pages (iiwiki) are still read from that wiki", () => {
  /** An iiwiki that answers every query with nothing: what matters is where the request went. */
  const emptyWiki = () => ({
    query: { pages: {}, random: [], categorymembers: [], allcategories: [], allpages: [], backlinks: [] },
  });

  const calls: Array<[string, () => Promise<unknown>]> = [
    ["fetchArticleData", () => wikiLoreCardGenerator.fetchArticleData("Elm", "iiwiki")],
    ["fetchArticleMetadataBatch", () => wikiLoreCardGenerator.fetchArticleMetadataBatch(["Elm"], "iiwiki")],
    ["fetchArticleAuthorInfoBatch", () => wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(["Elm"], "iiwiki")],
    ["fetchCategoryMembers", () => wikiLoreCardGenerator.fetchCategoryMembers("Elms", "iiwiki")],
    ["searchCategories", () => wikiLoreCardGenerator.searchCategories("El", "iiwiki")],
    ["getCategoriesInfo", () => wikiLoreCardGenerator.getCategoriesInfo(["Elms"], "iiwiki")],
    ["fetchAllMainNamespacePages", () => wikiLoreCardGenerator.fetchAllMainNamespacePages("iiwiki")],
    ["getImageUrl", () => wikiLoreCardGenerator.getImageUrl("Elm.png", "iiwiki")],
    ["fetchRandomArticles", () => wikiLoreCardGenerator.fetchRandomArticles(3, "iiwiki")],
    ["fetchRandomArticlesWithImages", () => wikiLoreCardGenerator.fetchRandomArticlesWithImages(3, "iiwiki")],
  ];

  it.each(calls)("%s asks iiwiki and reads nothing of IxWiki's", async (_name, call) => {
    guard.restore();
    guard = installFetchGuard(() => emptyWiki());
    // Silence the generator's own failure logs: an empty wiki is a "not found" for some of them.
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await call();

    expect(guard.calls().length).toBeGreaterThan(0);
    expect(guard.calls().every((url) => new URL(url).hostname === "iiwiki.com")).toBe(true);
    expect(guard.ixwikiCalls()).toEqual([]);
    expect(mocked.$queryRaw).not.toHaveBeenCalled();
    expect(mocked.wikiArticle.findFirst).not.toHaveBeenCalled();
  });
});
