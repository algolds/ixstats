/** @jest-environment node */
// Plan 409: a deleted (archived) page never shows up in a list: search, categories, recent changes,
// contributions, backlinks, redirects, site stats and the feed read PUBLISHED pages only.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    wikiRevision: { findMany: jest.fn(), count: jest.fn() },
    wikiLink: { findMany: jest.fn() },
    wikiCategory: { findFirst: jest.fn() },
    wikiCategoryMember: { findMany: jest.fn() },
    wikiAsset: { count: jest.fn() },
    wikiTemplate: { findMany: jest.fn() },
    user: { count: jest.fn() },
    $queryRawUnsafe: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}));

import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import {
  ixwikiGetUserContribs,
  ixwikiGetUserCreatedPages,
  ixwikiRecentChanges,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";
import { ixwikiGetSiteStats } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-site";
import { ixwikiSearchTemplates } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-search";
import { ixwikiResolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-reader";

type Delegate = Record<string, jest.Mock>;
const mockDb = jest.requireMock<{
  db: Record<
    | "wikiArticle"
    | "wikiRevision"
    | "wikiLink"
    | "wikiCategory"
    | "wikiCategoryMember"
    | "wikiAsset"
    | "wikiTemplate"
    | "user",
    Delegate
  > & { $queryRawUnsafe: jest.Mock; $queryRaw: jest.Mock };
}>("~/server/db").db;

const published = { status: "PUBLISHED" };

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.wikiArticle.findMany.mockResolvedValue([]);
  mockDb.wikiArticle.findUnique.mockResolvedValue(null);
  mockDb.wikiArticle.count.mockResolvedValue(0);
  mockDb.wikiRevision.findMany.mockResolvedValue([]);
  mockDb.wikiRevision.count.mockResolvedValue(0);
  mockDb.wikiLink.findMany.mockResolvedValue([]);
  mockDb.wikiCategoryMember.findMany.mockResolvedValue([]);
  mockDb.wikiAsset.count.mockResolvedValue(0);
  mockDb.user.count.mockResolvedValue(0);
  mockDb.wikiTemplate.findMany.mockResolvedValue([]);
  mockDb.$queryRawUnsafe.mockResolvedValue([]);
});

describe("search", () => {
  it("spotlight search looks at published pages only", async () => {
    await NativeSearchService.spotlightSearch("Caph", "ixwiki", 5);
    expect(mockDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject(published);
  });

  it("full-text search filters the raw query and the fallback query", async () => {
    await NativeSearchService.fulltextSearch("kingdom of caphiria", "ixwiki", 10);

    const [sql] = mockDb.$queryRawUnsafe.mock.calls[0] as [string];
    expect(sql).toContain("status = 'PUBLISHED'");
    expect(mockDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject(published);
    expect(mockDb.wikiArticle.count.mock.calls[0]?.[0].where).toMatchObject(published);
  });

  it("template search over articles filters too", async () => {
    await ixwikiSearchTemplates("Infobox");
    expect(mockDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject({
      namespace: 10,
      ...published,
    });
  });
});

describe("categories", () => {
  it("lists only published members and counts only those", async () => {
    mockDb.wikiCategory.findFirst.mockResolvedValue({
      id: "c1",
      slug: "nations",
      name: "Nations",
      description: null,
      parent: null,
      children: [{ id: "c2", slug: "kingdoms", name: "Kingdoms", _count: { members: 0 } }],
      members: [],
    });

    await CategoryService.getCategoryDetails("Nations");

    const include = mockDb.wikiCategory.findFirst.mock.calls[0]?.[0].include;
    expect(include.members.where).toEqual({ article: published });
    expect(include.children.select._count.select.members.where).toEqual({ article: published });
    expect(mockDb.wikiCategoryMember.findMany.mock.calls.map((c) => c[0].where.article)).toEqual([
      published,
      published,
    ]);
  });
});

describe("activity and links", () => {
  it("recent changes skip revisions of deleted pages", async () => {
    await ixwikiRecentChanges(10);
    expect(mockDb.wikiRevision.findMany.mock.calls[0]?.[0].where.article).toMatchObject(published);
  });

  it("contributions and created pages skip deleted pages", async () => {
    await ixwikiGetUserContribs("Amy", 10, 0);
    await ixwikiGetUserCreatedPages("Amy", 10);
    expect(mockDb.wikiRevision.findMany.mock.calls[0]?.[0].where.article).toMatchObject(published);
    expect(mockDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject(published);
  });

  it("backlinks come from published pages, and a link to a deleted page is a red link", async () => {
    await LinkGraphService.getBacklinks("Caphiria");
    expect(mockDb.wikiLink.findMany.mock.calls[0]?.[0].where.sourceArticle).toMatchObject(
      published
    );

    // The render replaces an article's links; a target is resolved among published pages only.
    const tx = {
      ...mockDb,
      wikiLink: { ...mockDb.wikiLink, deleteMany: jest.fn(), createMany: jest.fn() },
    };
    await LinkGraphService.replaceLinks(tx as never, "a1", "ixwiki", [{ title: "Caphiria" }]);
    expect(mockDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject(published);
  });

  it("a redirect from a deleted page is not followed", async () => {
    await ixwikiResolveRedirect("Old name");
    // Both the exact-title and the slug-variant lookup are raw SQL that names the status.
    const queries = mockDb.$queryRaw.mock.calls.map(([strings]) => strings.join("$"));
    expect(queries).toHaveLength(2);
    for (const query of queries) expect(query).toContain(`"status" = 'PUBLISHED'`);
  });
});

describe("counts and usage", () => {
  it("site stats count published pages", async () => {
    await ixwikiGetSiteStats();
    expect(mockDb.wikiArticle.count.mock.calls.map((c) => c[0].where)).toEqual([
      expect.objectContaining(published),
      expect.objectContaining(published),
    ]);
  });

  it("media usage lists published pages only", async () => {
    await PageManagementService.getMediaUsage("Flag.png");
    expect(mockDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject(published);
  });
});
