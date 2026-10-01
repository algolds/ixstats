/** @jest-environment node */
/** Plan 412: the domain services behind the route's list, info, category, file and sitemap views. */
const mockArticleFindMany = jest.fn();
const mockArticleFindUnique = jest.fn();
const mockArticleFindFirst = jest.fn();
const mockArticleCount = jest.fn();
const mockRevisionFindFirst = jest.fn();
const mockRevisionCount = jest.fn();
const mockMemberCount = jest.fn();
const mockQueryRaw = jest.fn();
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: {
      findMany: (...a: unknown[]) => mockArticleFindMany(...a),
      findUnique: (...a: unknown[]) => mockArticleFindUnique(...a),
      findFirst: (...a: unknown[]) => mockArticleFindFirst(...a),
      count: (...a: unknown[]) => mockArticleCount(...a),
    },
    wikiRevision: {
      findFirst: (...a: unknown[]) => mockRevisionFindFirst(...a),
      count: (...a: unknown[]) => mockRevisionCount(...a),
    },
    wikiCategoryMember: { count: (...a: unknown[]) => mockMemberCount(...a) },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

const mockFindAsset = jest.fn();
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  __esModule: true,
  MediaAssetService: { findAsset: (...a: unknown[]) => mockFindAsset(...a) },
}));
const mockArchived = jest.fn();
jest.mock("~/lib/wiki-os/core/archived-titles", () => ({
  __esModule: true,
  archivedTitlesAmong: (...a: unknown[]) => mockArchived(...a),
}));
const mockFindMissing = jest.fn();
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findMissingTitles: (...a: unknown[]) => mockFindMissing(...a) },
}));

import { listPages } from "~/lib/wiki-os/core/page-list-service";
import { getPageInfo } from "~/lib/wiki-os/core/page-info-service";
import { getFileInfo } from "~/lib/wiki-os/core/file-page-service";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import {
  countSitemapPages,
  listSitemapPage,
  SITEMAP_PAGE_SIZE,
} from "~/lib/wiki-os/core/sitemap-service";

beforeEach(() => {
  jest.clearAllMocks();
  mockArchived.mockResolvedValue(new Set());
});

describe("listPages (Special:AllPages, Special:PrefixIndex)", () => {
  const rows = (titles: string[]) =>
    titles.map((title) => ({ title, redirectTargetSlug: title.endsWith("*") ? "target" : null }));

  it("lists published pages of one namespace in title order from a cursor, and says where the next page starts", async () => {
    mockArticleFindMany.mockResolvedValue(rows(["Talk:Aa", "Talk:Bb", "Talk:Cc*"]));
    const listing = await listPages({ namespace: 1, prefix: "", from: "Aa", limit: 2 });

    expect(mockArticleFindMany).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        status: "PUBLISHED",
        namespace: 1,
        title: { gte: "Talk:Aa" },
      },
      orderBy: { title: "asc" },
      take: 3,
      select: { title: true, redirectTargetSlug: true },
    });
    expect(listing.pages).toEqual([
      { title: "Talk:Aa", isRedirect: false },
      { title: "Talk:Bb", isRedirect: false },
    ]);
    expect(listing.next).toBe("Cc*"); // a `from` value: the name without its namespace prefix
  });

  it("has no next page when the list ends, and filters by prefix in the stored form", async () => {
    mockArticleFindMany.mockResolvedValue(rows(["Aurelia", "Aurelian Sea*"]));
    const listing = await listPages({ namespace: 0, prefix: "Aur", from: "", limit: 200 });

    expect(mockArticleFindMany.mock.calls[0]?.[0].where.title).toEqual({ startsWith: "Aur" });
    expect(listing.next).toBeNull();
    expect(listing.pages[1]).toEqual({ title: "Aurelian Sea*", isRedirect: true });
  });
});

describe("sitemap service", () => {
  it("counts published main-namespace pages that are not redirects", async () => {
    mockArticleCount.mockResolvedValue(120_001);
    await expect(countSitemapPages()).resolves.toBe(120_001);
    expect(mockArticleCount).toHaveBeenCalledWith({
      where: { source: "ixwiki", status: "PUBLISHED", namespace: 0, redirectTargetSlug: null },
    });
  });

  it("reads one file of at most 50,000 pages from the right offset", async () => {
    mockQueryRaw.mockResolvedValue([{ title: "Aurelia", lastModified: new Date(0) }]);
    const entries = await listSitemapPage(3);

    expect(entries).toEqual([{ title: "Aurelia", lastModified: new Date(0) }]);
    const [strings, ...values] = mockQueryRaw.mock.calls[0] as [string[], ...number[]];
    expect(values).toEqual([SITEMAP_PAGE_SIZE, 2 * SITEMAP_PAGE_SIZE]);
    const sql = strings.join("?");
    expect(sql).toContain('max(r."createdAt")'); // lastmod = the newest revision
    expect(sql).toContain("a.\"status\" = 'PUBLISHED'");
    expect(sql).toContain('a."redirectTargetSlug" IS NULL');
  });
});

describe("getPageInfo (?action=info)", () => {
  const article = {
    id: "a1",
    title: "Foo bar",
    namespace: 0,
    mwPageId: 42,
    wordCount: 900,
    protectionLevel: "SYSOP",
    protectionExpiry: null,
    redirectTargetSlug: null,
  };

  it("is null for a title MediaWiki refuses and for a page with no row", async () => {
    await expect(getPageInfo("a[b")).resolves.toBeNull();
    mockArticleFindUnique.mockResolvedValue(null);
    await expect(getPageInfo("Nowhere")).resolves.toBeNull();
    expect(mockArticleFindUnique.mock.calls[0]?.[0].where).toEqual({
      source_title: { source: "ixwiki", title: "Nowhere" },
    });
  });

  it("collects size, creation, last edit, revisions, redirects here, categories and protection", async () => {
    mockArticleFindUnique.mockResolvedValue(article);
    mockRevisionFindFirst.mockImplementation(async (args: { orderBy: { createdAt: string } }) =>
      args.orderBy.createdAt === "desc"
        ? { byteSize: 1234, createdAt: new Date("2026-09-01T00:00:00Z"), author: "Jane" }
        : { byteSize: 10, createdAt: new Date("2020-01-01T00:00:00Z"), author: "Old Hand" }
    );
    mockRevisionCount.mockResolvedValue(57);
    mockArticleCount.mockResolvedValue(3);
    mockMemberCount.mockResolvedValue(6);

    const info = await getPageInfo("foo_bar");

    // A deleted redirect to the page is not counted.
    expect(mockArticleCount).toHaveBeenCalledWith({
      where: { source: "ixwiki", redirectTargetSlug: "foo_bar", status: { not: "ARCHIVED" } },
    });
    expect(info).toEqual({
      title: "Foo bar",
      namespace: 0,
      pageId: 42,
      length: 1234,
      wordCount: 900,
      created: { at: new Date("2020-01-01T00:00:00Z"), by: "Old Hand" },
      lastEdited: { at: new Date("2026-09-01T00:00:00Z"), by: "Jane" },
      revisionCount: 57,
      redirectCount: 3,
      categoryCount: 6,
      protectionLevel: "SYSOP",
      protectionExpiry: null,
      redirectsTo: null,
    });
  });

  it("names the page a redirect points to by its real title", async () => {
    mockArticleFindUnique.mockResolvedValue({ ...article, redirectTargetSlug: "new_name" });
    mockArticleFindFirst.mockResolvedValue({ title: "New Name" });
    mockRevisionFindFirst.mockResolvedValue(null);
    mockRevisionCount.mockResolvedValue(0);
    mockArticleCount.mockResolvedValue(0);
    mockMemberCount.mockResolvedValue(0);

    const info = await getPageInfo("Foo bar");

    expect(info?.redirectsTo).toBe("New Name");
    expect(mockArticleFindFirst.mock.calls[0]?.[0].where).toEqual({
      source: "ixwiki",
      slug: "new_name",
      status: { not: "ARCHIVED" },
    });
    expect(info?.created).toBeNull();
    expect(info?.length).toBe(0);
  });
});

describe("CategoryService.getMemberPage (Category: pages)", () => {
  it("reads 201 members in sort-key order from `from`, and counts every member", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { title: "Aurelia", namespace: 0, sortKey: "Aurelia" },
        { title: "Category:Islands", namespace: 14, sortKey: "Islands" },
        { title: "Borea", namespace: 0, sortKey: "Borea" },
      ])
      .mockResolvedValueOnce([{ total: BigInt(250) }]);

    const page = await CategoryService.getMemberPage("Category:Countries", {
      from: "Au",
      limit: 2,
    });

    expect(page).toEqual({
      members: [
        { title: "Aurelia", namespace: 0 },
        { title: "Category:Islands", namespace: 14 },
      ],
      total: 250,
      next: "Borea",
    });
    // The first query is ordered by the sort key (the title when there is none), limit + 1 rows.
    const [members] = mockQueryRaw.mock.calls[0] as [string[], ...unknown[]];
    expect(members.join("?")).toContain('upper(COALESCE(m."sortKey", a."title"))');
    // A deleted page is a member for no one, in the list and in the count.
    const [totals] = mockQueryRaw.mock.calls[1] as [string[], ...unknown[]];
    for (const sql of [members.join("?"), totals.join("?")]) {
      expect(sql).toContain(`a."status" = 'PUBLISHED'`);
    }
    expect(mockQueryRaw.mock.calls[0]).toContain(3);
  });

  it("has no next page at the end of the list", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ title: "Aurelia", namespace: 0, sortKey: "Aurelia" }])
      .mockResolvedValueOnce([{ total: BigInt(1) }]);
    const page = await CategoryService.getMemberPage("Countries", { from: "", limit: 200 });
    expect(page.next).toBeNull();
    expect(page.total).toBe(1);
  });
});

describe("getFileInfo (File: pages, Special:FilePath)", () => {
  it("is the asset WikiOS holds, when there is one", async () => {
    mockFindAsset.mockResolvedValue({
      url: "/images/uploads/Flag.svg",
      thumbnailUrl: "/images/uploads/thumb/Flag.svg",
      width: 300,
      height: 200,
      mimeType: "image/svg+xml",
      sizeBytes: 2048,
    });
    const info = await getFileInfo("File:Flag_of_Eurth.svg");

    expect(mockFindAsset).toHaveBeenCalledWith("Flag of Eurth.svg");
    expect(info).toEqual({
      name: "Flag of Eurth.svg",
      url: "/images/uploads/Flag.svg",
      thumbUrl: "/images/uploads/thumb/Flag.svg",
      width: 300,
      height: 200,
      mimeType: "image/svg+xml",
      sizeBytes: 2048,
    });
  });

  it("is MediaWiki's sharded images/ path (through the image proxy) for a file with a description page but no asset row", async () => {
    mockFindAsset.mockResolvedValue(null);
    mockFindMissing.mockResolvedValue([]);
    const info = await getFileInfo("Flag.svg");

    expect(mockFindMissing).toHaveBeenCalledWith(["File:Flag.svg"]);
    // The MD5 shard of the name, served through the site's own image proxy.
    expect(info?.url).toBe("/api/mediawiki/ixwiki/images/6/61/Flag.svg");
  });

  it("is null for a file whose description page was deleted, whatever asset row is left (plan 409)", async () => {
    mockArchived.mockResolvedValue(new Set(["File:Flag.svg"]));
    mockFindAsset.mockResolvedValue({ url: "/images/uploads/Flag.svg", mimeType: "image/svg+xml" });

    await expect(getFileInfo("Flag.svg")).resolves.toBeNull();
    expect(mockArchived).toHaveBeenCalledWith(["File:Flag.svg"]);
    expect(mockFindAsset).not.toHaveBeenCalled();
  });

  it("is null for a file WikiOS has neither an asset nor a description page for, and for a bad name", async () => {
    mockFindAsset.mockResolvedValue(null);
    mockFindMissing.mockResolvedValue(["File:Nope.svg"]);
    await expect(getFileInfo("Nope.svg")).resolves.toBeNull();
    await expect(getFileInfo("a[b.svg")).resolves.toBeNull();
  });
});
