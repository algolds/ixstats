/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A12): the lore-card generator reads IxWiki from Postgres (page text, revision ledger, render-derived
// links, categories and images, assets) and never asks MediaWiki. A sister wiki's pages are still read from that wiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn(), findMany: jest.fn() },
    wikiRevision: { groupBy: jest.fn() },
    wikiCategory: { findMany: jest.fn() },
    wikiCategoryMember: { findMany: jest.fn() },
    wikiImageLink: { findMany: jest.fn() },
    wikiLink: { count: jest.fn() },
    wikiAsset: { findMany: jest.fn() },
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
  wikiRevision: { groupBy: jest.Mock };
  wikiCategory: { findMany: jest.Mock };
  wikiCategoryMember: { findMany: jest.Mock };
  wikiImageLink: { findMany: jest.Mock };
  wikiLink: { count: jest.Mock };
  wikiAsset: { findMany: jest.Mock };
  systemConfig: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

const BODY =
  "Caphiria is a constitutional monarchy on the southern coast of the continent. ".repeat(12);
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
let categoryRows: Array<Record<string, unknown>>;
let heads: Array<Record<string, unknown>>;
let titles: Array<Record<string, unknown>>;

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  early = [];
  categoryRows = [];
  heads = [];
  titles = [];
  mocked.wikiArticle.findFirst.mockResolvedValue(null);
  mocked.wikiArticle.findMany.mockResolvedValue([]);
  mocked.wikiRevision.groupBy.mockResolvedValue([]);
  mocked.wikiCategory.findMany.mockResolvedValue([]);
  mocked.wikiCategoryMember.findMany.mockResolvedValue([]);
  mocked.wikiImageLink.findMany.mockResolvedValue([]);
  mocked.wikiLink.count.mockResolvedValue(0);
  mocked.wikiAsset.findMany.mockResolvedValue([]);
  mocked.systemConfig.findMany.mockResolvedValue([]);
  mocked.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes("row_number()"))
      return sql.includes("wiki_category_members") ? categoryRows : early;
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
    });
    mocked.wikiCategoryMember.findMany.mockResolvedValue([
      { category: { name: "Countries" } },
      { category: { name: "Monarchies" } },
    ]);
    mocked.wikiImageLink.findMany.mockResolvedValue([{ fileName: "Caphiria map.png" }]);
    mocked.wikiLink.count.mockResolvedValue(4);
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

  it("classifies from the article's raw wikitext and its categories", async () => {
    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki");
    expect(card.classification).toMatchObject({ category: "NATION", subcategory: "nation" });
    expect(card.classification.confidence).toBeGreaterThanOrEqual(0.5);
  });
  /** WikiOS deleted these `File:` pages (names as `wiki_image_links` holds them, no prefix). */
  const archiveFilePages = (...names: string[]) =>
    mocked.wikiArticle.findMany.mockImplementation(async (args: { where: { status?: string } }) =>
      args.where.status === "ARCHIVED" ? names.map((name) => ({ title: `File:${name}` })) : []
    );

  it("does not pick as artwork a file whose page WikiOS deleted: not the lead picture, not an illustration", async () => {
    mocked.wikiImageLink.findMany.mockResolvedValue([
      { fileName: "Caphiria flag.png" },
      { fileName: "Caphiria coast.jpg" },
      { fileName: "Caphiria map.png" },
      { fileName: "Caphiria skyline.jpg" },
    ]);
    archiveFilePages("Caphiria map.png", "Caphiria coast.jpg");
    mocked.wikiAsset.findMany.mockResolvedValue([
      {
        ...asset,
        filename: "Caphiria_skyline.jpg",
        slug: "caphiria_skyline.jpg",
        md5Hash: "def",
        url: "https://ixwiki.com/images/s/s1/Caphiria_skyline.jpg",
      },
    ]);

    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki");

    // the text names "Caphiria map.png" (deleted): the first illustration left is the skyline
    expect(card?.artwork).toBe("https://ixwiki.com/images/s/s1/Caphiria_skyline.jpg");
    expect(
      mocked.wikiArticle.findMany.mock.calls.some(([args]) => args.where.status === "ARCHIVED")
    ).toBe(true);
  });
  it("refuses a page Postgres lacks or has deleted, without asking a wiki", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue(null);

    await expect(wikiLoreCardGenerator.generateCard("Nowhere", "ixwiki")).rejects.toMatchObject({
      name: "ArticleRejected",
      kind: "missing",
      message: '"Nowhere" was not found on IxWiki.',
    });
    expect(guard.calls()).toEqual([]);
  });
});
describe("previews of many pages", () => {
  /** The real client cuts a `findMany` with no `take` to 1000 rows (src/server/db.ts); so does this one. */
  const CLIENT_CAP = 1000;

  it("keep every page's categories when the members of all of them are more than 1000 rows", async () => {
    const PAGES = 231;
    const PER_PAGE = 8; // 1,848 category members, as many as the cap hides when it bites
    const pageTitles = Array.from({ length: PAGES }, (_, n) => `Page ${n}`);
    heads = pageTitles.map((title, n) => ({
      id: `a${n}`,
      title,
      length: 3000,
      head: `${title} is a page.`,
    }));
    const members = heads.flatMap((head) =>
      Array.from({ length: PER_PAGE }, (_, k) => ({
        articleId: head.id,
        name: `Category ${k}`,
        category: { name: `Category ${k}` },
      }))
    );
    categoryRows = members.map(({ articleId, name }) => ({ articleId, name }));
    mocked.wikiCategoryMember.findMany.mockImplementation(async (args: { take?: number }) =>
      members.slice(0, args.take ?? CLIENT_CAP)
    );
    mocked.wikiArticle.findMany.mockResolvedValue(
      heads.map((head) => ({ id: head.id, title: head.title }))
    );

    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(pageTitles, "ixwiki");

    expect(previews).toHaveLength(PAGES);
    expect(previews.map((preview) => preview.categoryCount)).toEqual(Array(PAGES).fill(PER_PAGE));
    expect(guard.calls()).toEqual([]);
  });
});

describe("credits skip a user whose revisions were hidden", () => {
  it("never name a hidden user as creator or as top contributor", async () => {
    mocked.wikiArticle.findMany.mockResolvedValue([{ id: "a1", title: "Caphiria" }]);
    early = [
      { articleId: "a1", author: "(deleted)", createdAt: day(1), userDeleted: true },
      { articleId: "a1", author: "Kir", createdAt: day(2), userDeleted: false },
    ];
    mocked.wikiRevision.groupBy.mockResolvedValue([
      { articleId: "a1", author: "(deleted)", userDeleted: true, _count: { _all: 40 } },
      { articleId: "a1", author: "Kir", userDeleted: false, _count: { _all: 3 } },
      { articleId: "a1", author: "Bea", userDeleted: false, _count: { _all: 5 } },
    ]);

    const authors = await wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(["Caphiria"], "ixwiki");

    expect(authors.get("Caphiria")).toMatchObject({
      creator: "Kir",
      primaryContributor: "Bea",
      contributorCount: 2,
    });
    expect(mocked.wikiRevision.groupBy.mock.calls[0]?.[0].by).toEqual([
      "articleId",
      "author",
      "userDeleted",
    ]);
  });
});
describe("a page outside the main namespace", () => {
  it("is refused on IxWiki by the namespace WikiOS stores", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue({
      id: "a1",
      title: "IxWiki:About",
      namespace: 4,
      wikitext: WIKITEXT,
    });
    await expect(
      wikiLoreCardGenerator.generateCard("IxWiki:About", "ixwiki")
    ).rejects.toMatchObject({
      name: "ArticleRejected",
      kind: "not-article",
      message: "Not an article",
    });
    expect(mocked.wikiArticle.findFirst.mock.calls[0]?.[0]).toMatchObject({
      select: { namespace: true },
    });
  });
});
