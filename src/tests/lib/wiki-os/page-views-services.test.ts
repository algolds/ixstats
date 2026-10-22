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
  listSitemapPage,
  SITEMAP_PAGE_SIZE,
} from "~/lib/wiki-os/core/sitemap-service";

interface SqlLike {
  strings: readonly string[];
  values: readonly unknown[];
}
const isSql = (value: unknown): value is SqlLike =>
  typeof value === "object" && value !== null && "strings" in value && "values" in value;

/** The SQL a `$queryRaw` tagged-template call sends, nested Prisma.sql fragments inlined, "?" for each value. */
function sqlOf(
  strings: readonly string[],
  values: readonly unknown[]
): { sql: string; values: unknown[] } {
  let sql = strings[0] ?? "";
  const flat: unknown[] = [];
  values.forEach((value, index) => {
    if (isSql(value)) {
      const inner = sqlOf(value.strings, value.values);
      sql += inner.sql;
      flat.push(...inner.values);
    } else {
      sql += "?";
      flat.push(value);
    }
    sql += strings[index + 1] ?? "";
  });
  return { sql: sql.replace(/\s+/g, " "), values: flat };
}
const call = (index: number) => {
  const [strings, ...values] = mockQueryRaw.mock.calls[index] as [string[], ...unknown[]];
  return sqlOf(strings, values);
};

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
});

describe("sitemap service", () => {
  it("reads one file of at most 50,000 pages from the right offset", async () => {
    mockQueryRaw.mockResolvedValue([{ title: "Aurelia", lastModified: new Date(0) }]);
    const entries = await listSitemapPage(3);

    expect(entries).toEqual([{ title: "Aurelia", lastModified: new Date(0) }]);
    const { sql, values } = call(0);
    expect(values).toEqual([SITEMAP_PAGE_SIZE, 2 * SITEMAP_PAGE_SIZE]);
    expect(sql).toContain('max(r."createdAt")'); // lastmod = the newest revision
    expect(sql).toContain(`a."status" = 'PUBLISHED'`);
    expect(sql).toContain(`NOT (left(a."wikitext", 64) ~* '^\\s*#redirect')`);
    expect(sql).not.toContain("redirectTargetSlug");
  });
});

describe("getPageInfo (?action=info)", () => {
  it("is null for a title MediaWiki refuses and for a page with no row", async () => {
    await expect(getPageInfo("a[b")).resolves.toBeNull();
    mockArticleFindUnique.mockResolvedValue(null);
    await expect(getPageInfo("Nowhere")).resolves.toBeNull();
    expect(mockArticleFindUnique.mock.calls[0]?.[0].where).toEqual({
      source_title: { source: "ixwiki", title: "Nowhere" },
    });
  });
});

describe("CategoryService.getMemberPage (Category: pages)", () => {
  it("a run of members with one sort key pages through by title: the cursor is the last shown, never the first of the next", async () => {
    const tied = ["Alpha", "Beta", "Gamma", "Delta"].map((title) => ({
      title,
      namespace: 0,
      sortKey: "SAME",
    }));
    mockQueryRaw
      .mockResolvedValueOnce(tied.slice(0, 3))
      .mockResolvedValueOnce([{ total: BigInt(4) }]);
    const page = await CategoryService.getMemberPage("Countries", {
      from: "",
      after: "",
      limit: 2,
    });

    expect(page.members.map((m) => m.title)).toEqual(["Alpha", "Beta"]);
    expect(page.next).toEqual({ sortKey: "SAME", title: "Beta" });
  });
});

describe("getFileInfo (File: pages, Special:FilePath)", () => {
  it("is null for a file whose description page was deleted, whatever asset row is left (plan 409)", async () => {
    mockArchived.mockResolvedValue(new Set(["File:Flag.svg"]));
    mockFindAsset.mockResolvedValue({ url: "/images/uploads/Flag.svg", mimeType: "image/svg+xml" });

    await expect(getFileInfo("Flag.svg")).resolves.toBeNull();
    expect(mockArchived).toHaveBeenCalledWith(["File:Flag.svg"]);
    expect(mockFindAsset).not.toHaveBeenCalled();
  });
});
