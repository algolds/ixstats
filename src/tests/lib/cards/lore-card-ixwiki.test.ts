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
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import type { Pace } from "~/lib/realms/sources/wiki-discovery-client";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

/** The generator's private readers these tests call directly. */
const generatorInternals = wikiLoreCardGenerator as unknown as {
  getImageUrl(filename: string, wikiSource: string, pace: Pace): Promise<string | null>;
  fetchArticleData(title: string, wikiSource: string): Promise<unknown>;
};
/** Reads at once, as a caller outside an import run does. */
const unpaced: Pace = (read) => read();

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

const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");
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

  it("builds the card from Postgres: image, credit and scores, never asking a wiki", async () => {
    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki", {
      requireImage: true,
    });

    expect(card).toMatchObject({
      title: "Caphiria",
      wikiSource: "ixwiki",
      wikiArticleTitle: "Caphiria",
      artwork: asset.url,
      imageFile: "Caphiria map.png",
      signals: { inboundLinks: 4, referenceCount: 2, categoryCount: 2, hasInfobox: true },
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
    });
    mocked.wikiImageLink.findMany.mockResolvedValue([
      { fileName: "Caphiria logo.png" },
      { fileName: "Caphiria map.png" },
    ]);

    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki");

    expect(card?.artwork).toBe(asset.url);
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

  it("reads no artwork when every picture of the page was deleted", async () => {
    archiveFilePages("Caphiria map.png");

    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki");

    expect(card.artwork).toBeNull();
    expect(card.imageFile).toBeNull();
  });

  it("names the file's own URL when WikiOS holds no asset for it", async () => {
    mocked.wikiAsset.findMany.mockResolvedValue([]);

    const card = await wikiLoreCardGenerator.generateCard("Caphiria", "ixwiki");

    expect(card?.artwork).toMatch(
      /^https:\/\/ixwiki\.com\/images\/[0-9a-f]\/[0-9a-f]{2}\/Caphiria_map\.png$/
    );
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
    categoryRows = [{ articleId: "a1", name: "Countries" }];
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
    const sql = sqlOf(
      mocked.$queryRaw.mock.calls.find((call) => sqlOf(call).includes("octet_length"))!
    );
    expect(sql).toContain('left(a."wikitext"');
    expect(sql).toContain(`a."status" = 'PUBLISHED'`);
  });

  it("shows no lead picture whose file page WikiOS deleted", async () => {
    heads = [
      {
        id: "a1",
        title: "Caphiria",
        length: 5000,
        head: "{{Infobox country|image = Caphiria map.png}}\nCaphiria is a country.",
      },
    ];
    mocked.wikiAsset.findMany.mockResolvedValue([asset]);
    mocked.wikiArticle.findMany.mockImplementation(async (args: { where: { status?: string } }) =>
      args.where.status === "ARCHIVED" ? [{ title: "File:Caphiria map.png" }] : []
    );

    const [preview] = await wikiLoreCardGenerator.fetchArticleMetadataBatch(["Caphiria"], "ixwiki");

    expect(preview).toMatchObject({ title: "Caphiria", hasImage: false });
    expect(preview?.imageUrl).toBeFalsy();
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

  it("list at most 50 categories of a page, alphabetically, in the query that ranks them", async () => {
    heads = [{ id: "a1", title: "Big", length: 3000, head: "Big." }];
    categoryRows = Array.from({ length: 50 }, (_, k) => ({ articleId: "a1", name: `C${k}` }));

    const [preview] = await wikiLoreCardGenerator.fetchArticleMetadataBatch(["Big"], "ixwiki");

    expect(preview?.categoryCount).toBe(50);
    const call = mocked.$queryRaw.mock.calls.find((c) =>
      sqlOf(c).includes("wiki_category_members")
    )!;
    expect(sqlOf(call)).toContain('PARTITION BY m."articleId" ORDER BY c."name"');
    expect(call).toContain(50);
  });

  it("name the authors of the pages asked with an explicit take (a take-less findMany is cut to 1000)", async () => {
    mocked.wikiArticle.findMany.mockResolvedValue([]);

    await wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(["A", "B", "C"], "ixwiki");

    expect(mocked.wikiArticle.findMany.mock.calls[0]?.[0].take).toBe(3);
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

/** A list's reach: as far as `limit`, a minute to read, each request at once. */
const reach = (limit: number) => ({ limit, deadline: Date.now() + 60_000, pace: unpaced });

describe("lists for IxWiki", () => {
  it("lists a category's articles (the main namespace) from its members, never asking a wiki", async () => {
    titles = [{ title: "Caphiria" }, { title: "Urcea" }];

    expect(
      await loreCardDiscovery.fetchCategoryMembers("Category:Nations", "ixwiki", reach(100))
    ).toEqual({ titles: ["Caphiria", "Urcea"], truncated: false });
    const call = mocked.$queryRaw.mock.calls[0]!;
    expect(sqlOf(call)).toContain(`a."status" = 'PUBLISHED'`);
    const kinds = JSON.stringify(call);
    expect(kinds).toContain(`a.\\"namespace\\" = 0`);
    expect(kinds).not.toContain("NOT IN (6, 14)");
    // One row past the limit is asked for, so a cut list says so.
    expect(call).toContain(101);
    expect(guard.calls()).toEqual([]);
  });

  it("says when a category has more articles than the limit", async () => {
    titles = [{ title: "A" }, { title: "B" }, { title: "C" }];
    expect(await loreCardDiscovery.fetchCategoryMembers("Nations", "ixwiki", reach(2))).toEqual({
      titles: ["A", "B"],
      truncated: true,
    });
  });

  it("lists the main namespace's pages that are not redirects, by title", async () => {
    titles = [{ title: "Alpha" }, { title: "Beta" }];

    expect(await loreCardDiscovery.fetchAllMainNamespacePages("ixwiki", reach(500))).toEqual({
      titles: ["Alpha", "Beta"],
      truncated: false,
    });
    const sql = sqlOf(mocked.$queryRaw.mock.calls[0]!);
    expect(sql).toContain(`a."namespace" = 0`);
    expect(sql).toContain(`"redirectTargetSlug" IS NULL`);
    expect(sql).toContain(`ORDER BY a."title"`);
    expect(guard.calls()).toEqual([]);
  });

  it("picks random pages in the database, only those whose text names a lead picture", async () => {
    titles = [
      { title: "No picture", head: "Just text." },
      { title: "Has picture", head: "[[File:Pic.png|thumb]] text" },
    ];

    expect(await loreCardDiscovery.fetchRandomArticlesWithImages(5, "ixwiki")).toEqual([
      "Has picture",
    ]);
    expect(sqlOf(mocked.$queryRaw.mock.calls[0]!)).toContain('random() AS "r"');
    // Image pages are looked for among a few times as many random candidates.
    expect(mocked.$queryRaw.mock.calls[0]).toContain(15);
    expect(guard.calls()).toEqual([]);
  });

  it("picks the random pages on ids alone and reads the start of the text of the picked ones only", async () => {
    titles = [{ title: "Has picture", head: "[[File:Pic.png|thumb]] text" }];

    await loreCardDiscovery.fetchRandomArticlesWithImages(5, "ixwiki");

    // The query with its embedded fragments (`Prisma.sql`) written out.
    const [strings, ...values] = mocked.$queryRaw.mock.calls[0]! as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.reduce((text, part, i) => {
      const value = values[i - 1] as { sql?: string } | undefined;
      return text + (typeof value?.sql === "string" ? value.sql : "?") + part;
    });
    const picking = sql.slice(sql.indexOf("FROM ("), sql.indexOf(") picked"));
    const outer = sql.replace(picking, "");

    // The random order and the limit are inside a sub-select over ids, which never touches the text...
    expect(picking).toContain('random() AS "r"');
    expect(picking).toContain('ORDER BY "r"');
    expect(picking).toContain("LIMIT");
    expect(picking).not.toContain("wikitext");
    expect(picking).not.toContain("left(");
    // ...and `left()` is in the outer query, which joins the picked ids back and keeps their random order.
    expect(outer).toContain('left(a."wikitext"');
    expect(outer).toContain('JOIN wiki_articles a ON a."id" = picked."id"');
    expect(outer.trimEnd().endsWith('ORDER BY picked."r"')).toBe(true);
  });

  it("searches categories by prefix and counts their members, never asking a wiki", async () => {
    mocked.wikiCategory.findMany.mockResolvedValue([{ name: "Countries" }]);

    expect(await loreCardDiscovery.searchCategories("Count", "ixwiki", 10)).toEqual(["Countries"]);
    expect(mocked.wikiCategory.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { hidden: false, name: { startsWith: "Count", mode: "insensitive" } },
      take: 10,
    });

    titles = [];
    mocked.$queryRaw.mockResolvedValueOnce([
      { slug: "countries", name: "Countries", pages: 30n, subcats: 4n, files: 2n },
    ]);
    expect(await loreCardDiscovery.getCategoriesInfo(["Category:Countries"], "ixwiki")).toEqual({
      Countries: { size: 36, pages: 30, files: 2, subcats: 4 },
      "Category:Countries": { size: 36, pages: 30, files: 2, subcats: 4 },
    });
    expect(guard.calls()).toEqual([]);
  });

  it("gives the URL of a file from the asset WikiOS holds", async () => {
    mocked.wikiAsset.findMany.mockResolvedValue([asset]);

    expect(await generatorInternals.getImageUrl("File:Caphiria map.png", "ixwiki", unpaced)).toBe(
      asset.url
    );
    expect(guard.calls()).toEqual([]);
  });
});

describe("a sister wiki's pages (iiwiki) are still read from that wiki", () => {
  /** An iiwiki that answers every query with nothing: what matters is where the request went. */
  const emptyWiki = () => ({
    query: {
      pages: {},
      random: [],
      categorymembers: [],
      allcategories: [],
      allpages: [],
      backlinks: [],
    },
  });

  const calls: Array<[string, () => Promise<unknown>]> = [
    ["fetchArticleData", () => generatorInternals.fetchArticleData("Elm", "iiwiki")],
    [
      "fetchArticleMetadataBatch",
      () => wikiLoreCardGenerator.fetchArticleMetadataBatch(["Elm"], "iiwiki"),
    ],
    [
      "fetchArticleAuthorInfoBatch",
      () => wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(["Elm"], "iiwiki"),
    ],
    [
      "fetchCategoryMembers",
      () => loreCardDiscovery.fetchCategoryMembers("Elms", "iiwiki", reach(10)),
    ],
    ["searchCategories", () => loreCardDiscovery.searchCategories("El", "iiwiki")],
    ["getCategoriesInfo", () => loreCardDiscovery.getCategoriesInfo(["Elms"], "iiwiki")],
    [
      "fetchAllMainNamespacePages",
      () => loreCardDiscovery.fetchAllMainNamespacePages("iiwiki", reach(10)),
    ],
    ["getImageUrl", () => generatorInternals.getImageUrl("Elm.png", "iiwiki", unpaced)],
    [
      "fetchRandomArticlesWithImages",
      () => loreCardDiscovery.fetchRandomArticlesWithImages(3, "iiwiki"),
    ],
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
