/** @jest-environment node */
/**
 * Plan 410: the Prisma-backed ApiStore against a mocked client: the queries it builds (filters,
 * ordering, cursors, page sizes) and how rows become the plain rows modules use. SQL itself is
 * checked by reading it; these tests catch wrong shapes and missing-column handling.
 */
jest.mock("~/server/db", () => {
  const model = () => ({
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  });
  return {
    __esModule: true,
    db: {
      wikiArticle: model(),
      wikiRevision: model(),
      wikiLink: model(),
      wikiTemplateLink: model(),
      wikiImageLink: model(),
      wikiCategory: model(),
      wikiCategoryMember: model(),
      wikiLog: model(),
      wikiRestriction: model(),
      wikiAccountLink: model(),
      wikiUserGroup: model(),
      user: model(),
      $queryRaw: jest.fn(),
    },
  };
});
jest.mock("~/lib/wiki-os/core/rights-admin-service", () => ({
  __esModule: true,
  LOG_TYPES: ["move", "delete", "protect", "upload", "rights", "block"],
  RightsAdminService: { listBlocks: jest.fn(), displayNames: jest.fn().mockResolvedValue(new Map()) },
}));

import { prismaApiStore as store } from "~/lib/wiki-os/api-compat/store";
import { syntheticUserId } from "~/lib/wiki-os/api-compat/auth-store";
import { db } from "~/server/db";

type Mocked = Record<string, Record<string, jest.Mock>> & { $queryRaw: jest.Mock };
const mdb = db as unknown as Mocked;

beforeEach(() => {
  for (const value of Object.values(mdb)) {
    if (typeof value === "function") (value as jest.Mock).mockReset();
    else for (const fn of Object.values(value)) fn.mockReset();
  }
});

const article = (overrides = {}) => ({
  id: "a1",
  pageId: 7,
  title: "Alpha",
  namespace: 0,
  redirectTargetSlug: null,
  redirectTargetFragment: null,
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  wordCount: 12,
  pageProps: null,
  displayTitle: null,
  ...overrides,
});

describe("pages", () => {
  it("finds live pages by canonical title and joins their newest revision", async () => {
    mdb.wikiArticle!.findMany!.mockResolvedValue([article(), article({ id: "a2", pageId: 8, title: "Gamma", redirectTargetSlug: "Alpha", redirectTargetFragment: "Top" })]);
    mdb.$queryRaw.mockResolvedValue([
      { articleId: "a1", revId: 103, createdAt: new Date("2026-03-01T00:00:00Z"), byteSize: 55 },
    ]);
    const rows = await store.pagesByTitle(["Alpha", "Gamma"]);
    expect(mdb.wikiArticle!.findMany!.mock.calls[0]![0].where).toEqual({
      source: "ixwiki",
      status: { not: "ARCHIVED" },
      title: { in: ["Alpha", "Gamma"] },
    });
    expect(rows).toEqual([
      { articleId: "a1", pageId: 7, title: "Alpha", namespace: 0, isRedirect: false, redirectTitle: null, redirectFragment: null, touched: new Date("2026-02-01T00:00:00Z"), wordCount: 12, headRevId: 103, headTimestamp: new Date("2026-03-01T00:00:00Z"), length: 55, pageProps: null, displayTitle: null },
      expect.objectContaining({ pageId: 8, isRedirect: true, redirectTitle: "Alpha", redirectFragment: "Top", headRevId: null, headTimestamp: null, length: 0 }),
    ]);
  });

  it("carries what the last render reported: page properties as text, and the display title", async () => {
    mdb.wikiArticle!.findMany!.mockResolvedValue([
      article({ pageProps: { defaultsort: "Alpha, The", disambiguation: "", pagelength: 12 }, displayTitle: "<i>alpha</i>" }),
      article({ id: "a2", pageId: 8, title: "Beta", pageProps: ["not", "an", "object"] }),
    ]);
    mdb.$queryRaw.mockResolvedValue([]);
    const [rendered, odd] = await store.pagesByTitle(["Alpha", "Beta"]);
    expect(rendered).toMatchObject({ pageProps: { defaultsort: "Alpha, The", disambiguation: "", pagelength: "12" }, displayTitle: "<i>alpha</i>" });
    expect(odd!.pageProps).toBeNull();
  });

  it("asks nothing for no titles, and by page id otherwise", async () => {
    expect(await store.pagesByTitle([])).toEqual([]);
    expect(await store.pagesById([])).toEqual([]);
    expect(mdb.wikiArticle!.findMany!).not.toHaveBeenCalled();
    mdb.wikiArticle!.findMany!.mockResolvedValue([]);
    await store.pagesById([7, 9]);
    expect(mdb.wikiArticle!.findMany!.mock.calls[0]![0].where.pageId).toEqual({ in: [7, 9] });
  });

  it("fails loudly, naming the migration, when a page has no pageId", async () => {
    mdb.wikiArticle!.findMany!.mockResolvedValue([article({ pageId: null })]);
    mdb.$queryRaw.mockResolvedValue([]);
    await expect(store.pagesByTitle(["Alpha"])).rejects.toThrow(/2026-09-30-wikios-api\.sql/);
  });
});

const revisionRecord = (overrides = {}) => ({
  id: "rev-row-1",
  mwRevId: null,
  revId: 1_000_000_001,
  createdAt: new Date("2026-03-01T10:00:00Z"),
  author: "Heku",
  authorId: "u1",
  summary: "edit",
  minor: false,
  byteSize: 30,
  byteDelta: 5,
  sha1: "abc",
  textDeleted: false,
  commentDeleted: false,
  userDeleted: false,
  article: { id: "a1", pageId: 7, title: "Alpha", namespace: 0 },
  ...overrides,
});

describe("revisions", () => {
  it("builds the listing query: filters, ordering and one extra row for the continuation", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([]);
    await store.findRevisions({
      articleId: "a1",
      users: ["Heku"],
      excludeUser: "Spam",
      minor: false,
      namespaces: [0, 2],
      dir: "older",
      from: { timestamp: new Date("2026-04-01T00:00:00Z") },
      to: { timestamp: new Date("2026-01-01T00:00:00Z"), revId: 5 },
      cursor: { timestamp: new Date("2026-03-01T00:00:00Z"), revId: 9 },
      limit: 50,
      withContent: true,
    });
    const args = mdb.wikiRevision!.findMany!.mock.calls[0]![0];
    expect(args.take).toBe(51);
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { revId: "desc" }]);
    expect(args.select.wikitext).toBe(true);
    expect(args.where).toMatchObject({
      source: "ixwiki",
      articleId: "a1",
      author: { in: ["Heku"] },
      minor: false,
      article: { status: { not: "ARCHIVED" }, namespace: { in: [0, 2] } },
    });
    // newest-first: `from` is an upper bound, `to` a lower one, the cursor an inclusive upper bound
    expect(args.where.AND).toEqual([
      { createdAt: { lte: new Date("2026-04-01T00:00:00Z") } },
      { OR: [{ createdAt: { gt: new Date("2026-01-01T00:00:00Z") } }, { createdAt: new Date("2026-01-01T00:00:00Z"), revId: { gte: 5 } }] },
      { OR: [{ createdAt: { lt: new Date("2026-03-01T00:00:00Z") } }, { createdAt: new Date("2026-03-01T00:00:00Z"), revId: { lte: 9 } }] },
      { OR: [{ author: null }, { author: { not: "Spam" } }] },
    ]);
  });

  it("orders ascending for rvdir=newer", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([]);
    await store.findRevisions({ dir: "newer", from: { timestamp: new Date("2026-01-01T00:00:00Z") }, limit: 1, withContent: false });
    const args = mdb.wikiRevision!.findMany!.mock.calls[0]![0];
    expect(args.orderBy).toEqual([{ createdAt: "asc" }, { revId: "asc" }]);
    expect(args.where.AND).toEqual([{ createdAt: { gte: new Date("2026-01-01T00:00:00Z") } }]);
    expect(args.select.wikitext).toBeUndefined();
  });

  it("never reads a parked revision: not in listings, by id, by row id, in counts, nor in the head and parent lookups", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([revisionRecord()]);
    mdb.wikiRevision!.findFirst!.mockResolvedValue(revisionRecord());
    mdb.wikiRevision!.count!.mockResolvedValue(1);
    mdb.wikiRevision!.groupBy!.mockResolvedValue([]);
    mdb.$queryRaw.mockResolvedValue([]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([]);
    await store.findRevisions({ dir: "older", limit: 5, withContent: false });
    await store.revisionsById([1], false);
    await store.revisionByRowId("row");
    await store.revisionCountOf("Alpha");
    for (const mock of [mdb.wikiRevision!.findMany!, mdb.wikiRevision!.findFirst!, mdb.wikiRevision!.count!]) {
      for (const [args] of mock.mock.calls) expect(args.where).toMatchObject({ parked: false });
    }
    // headRevisions and parentIds are raw SQL: the head is the newest revision that is not parked, and so is a parent
    const sqls = mdb.$queryRaw.mock.calls.map(([query]) => (query as { sql: string }).sql);
    expect(sqls.length).toBeGreaterThanOrEqual(2);
    expect(sqls.filter((sql) => sql.includes("wiki_revisions") && sql.includes("DISTINCT ON")).every((sql) => sql.includes('"parked" = false'))).toBe(true);
    expect(sqls.filter((sql) => sql.includes("SELECT p.")).every((sql) => sql.includes('p."parked" = false'))).toBe(true);
    // site statistics and user counts
    await store.statistics();
    await store.userStats("u1", "Heku");
    for (const [args] of mdb.wikiRevision!.count!.mock.calls.slice(1)) expect(args.where).toMatchObject({ parked: false });
    expect(mdb.wikiRevision!.groupBy!.mock.calls[0]![0].where).toMatchObject({ parked: false });
  });

  it("maps rows: parent, head flag, reference, size delta, hidden flags and the author's user id", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([
      revisionRecord(),
      revisionRecord({ id: "old-row", mwRevId: 42, revId: 42, author: "Linked", authorId: null, textDeleted: true, wikitext: "secret" }),
    ]);
    mdb.$queryRaw
      .mockResolvedValueOnce([{ revId: 1_000_000_001, parentId: 42 }, { revId: 42, parentId: null }])
      .mockResolvedValueOnce([{ articleId: "a1", revId: 1_000_000_001, createdAt: new Date(), byteSize: 30 }]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([{ username: "Linked", wikiUserId: 321 }]);
    const [newest, oldest] = await store.findRevisions({ dir: "older", limit: 5, withContent: true });
    expect(newest).toMatchObject({ revId: 1_000_000_001, ref: "rev-row-1", parentId: 42, sizeDiff: 5, isHead: true, user: "Heku", userId: syntheticUserId("u1"), textHidden: false });
    expect(oldest).toMatchObject({ revId: 42, ref: "42", parentId: 0, isHead: false, userId: 321, textHidden: true, content: null });
  });

  it("takes sha1 from the text for a legacy row without one, only when the text was read and is not deleted", async () => {
    mdb.$queryRaw.mockResolvedValue([]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([]);
    const blankHash = "phoiac9h4m842xq45sp7s6u21eteeq1"; // MediaWiki's rev_sha1 of the empty text
    mdb.wikiRevision!.findMany!.mockResolvedValue([
      revisionRecord({ revId: 1, id: "r1", sha1: null, wikitext: "" }),
      revisionRecord({ revId: 2, id: "r2", sha1: null }),
      revisionRecord({ revId: 3, id: "r3", sha1: null, wikitext: "secret", textDeleted: true }),
      revisionRecord({ revId: 4, id: "r4", sha1: "stored", wikitext: "other" }),
    ]);
    const rows = await store.revisionsById([1, 2, 3, 4], true);
    expect(rows.map((row) => row.sha1)).toEqual([blankHash, null, null, "stored"]);
  });

  it("revisionHashes: reads the text of just those live revisions and hashes it", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([{ revId: 5, wikitext: "" }, { revId: null, wikitext: "x" }]);
    const hashes = await store.revisionHashes([5, 6]);
    expect(hashes).toEqual(new Map([[5, "phoiac9h4m842xq45sp7s6u21eteeq1"]]));
    expect(mdb.wikiRevision!.findMany!.mock.calls[0]![0]).toEqual({
      where: { source: "ixwiki", parked: false, textDeleted: false, revId: { in: [5, 6] }, article: { status: { not: "ARCHIVED" } } },
      select: { revId: true, wikitext: true },
    });
    mdb.wikiRevision!.findMany!.mockClear();
    expect(await store.revisionHashes([])).toEqual(new Map());
    expect(mdb.wikiRevision!.findMany!).not.toHaveBeenCalled();
  });

  it("fails loudly when a revision has no revId", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([revisionRecord({ revId: null })]);
    await expect(store.findRevisions({ dir: "older", limit: 1, withContent: false })).rejects.toThrow(/wiki_revisions\.revId/);
  });

  it("answers revisions by id in the order asked, skipping deleted pages in the query", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([revisionRecord({ revId: 2, id: "r2" }), revisionRecord({ revId: 1, id: "r1" })]);
    mdb.$queryRaw.mockResolvedValue([]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([]);
    const rows = await store.revisionsById([1, 2], false);
    expect(rows.map((r) => r.revId)).toEqual([1, 2]);
    expect(mdb.wikiRevision!.findMany!.mock.calls[0]![0].where).toEqual({
      source: "ixwiki",
      parked: false,
      revId: { in: [1, 2] },
      article: { status: { not: "ARCHIVED" } },
    });
    expect(await store.revisionsById([], false)).toEqual([]);
  });

  it("reads a revision by its row id and counts a page's revisions", async () => {
    mdb.wikiRevision!.findFirst!.mockResolvedValue(revisionRecord());
    mdb.$queryRaw.mockResolvedValue([]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([]);
    expect((await store.revisionByRowId("rev-row-1"))?.revId).toBe(1_000_000_001);
    expect(mdb.wikiRevision!.findFirst!.mock.calls[0]![0].where).toEqual({ id: "rev-row-1", parked: false });
    mdb.wikiRevision!.findFirst!.mockResolvedValue(null);
    expect(await store.revisionByRowId("none")).toBeNull();
    mdb.wikiRevision!.count!.mockResolvedValue(4);
    expect(await store.revisionCountOf("Alpha")).toBe(4);
    expect(mdb.wikiRevision!.count!.mock.calls[0]![0]).toEqual({ where: { source: "ixwiki", parked: false, article: { title: "Alpha" } } });
  });
});

describe("links and categories", () => {
  const link = (overrides = {}) => ({
    targetSlug: "beta",
    anchorText: "Beta",
    sourceArticle: { pageId: 7 },
    targetArticle: { title: "Beta", namespace: 0 },
    ...overrides,
  });

  it("titles a link by its page, by the text it was written as, or by its slug", async () => {
    mdb.wikiLink!.findMany!.mockResolvedValue([
      link(),
      link({ targetSlug: "eta_page", anchorText: "Eta page", targetArticle: null }),
      link({ targetSlug: "zeta_page", anchorText: "label", targetArticle: null }),
      link({ targetSlug: "template:foo", anchorText: null, targetArticle: null }),
      link({ targetSlug: "beta", anchorText: "again", sourceArticle: { pageId: 7 } }),
    ]);
    const { rows, next } = await store.linksFrom({ articleIds: ["a1"], dir: "ascending", limit: 10 });
    expect(rows.map((r) => [r.title, r.namespace])).toEqual([["Beta", 0], ["Eta page", 0], ["Zeta page", 0], ["Template:Foo", 10]]);
    expect(next).toBeNull();
  });

  it("builds the cursor condition and the next position", async () => {
    mdb.wikiLink!.findMany!.mockResolvedValue([link({ targetSlug: "a" }), link({ targetSlug: "b" })]);
    const { rows, next } = await store.linksFrom({ articleIds: ["a1"], dir: "descending", limit: 1, cursor: { pageId: 7, key: "z" }, titles: ["Beta"], namespaces: [0] });
    expect(rows).toHaveLength(1);
    expect(next).toEqual({ pageId: 7, key: "b" });
    const args = mdb.wikiLink!.findMany!.mock.calls[0]![0];
    expect(args.take).toBe(2);
    expect(args.where).toMatchObject({
      sourceArticleId: { in: ["a1"] },
      isExternal: false,
      targetSlug: { in: ["beta"] },
      OR: [{ sourceArticle: { pageId: { lt: 7 } } }, { sourceArticle: { pageId: 7 }, targetSlug: { lte: "z" } }],
    });
    expect(args.orderBy).toEqual([{ sourceArticle: { pageId: "desc" } }, { targetSlug: "desc" }]);
  });

  it("filters links by namespace after slicing the page", async () => {
    mdb.wikiLink!.findMany!.mockResolvedValue([link(), link({ targetSlug: "template:foo", targetArticle: { title: "Template:Foo", namespace: 10 } })]);
    const { rows } = await store.linksFrom({ articleIds: ["a1"], dir: "ascending", limit: 5, namespaces: [10] });
    expect(rows.map((r) => r.title)).toEqual(["Template:Foo"]);
  });

  it("lists categories as Category:Name with MediaWiki's hidden flag, and filters on it for show=hidden", async () => {
    mdb.wikiCategoryMember!.findMany!.mockResolvedValue([
      { sortKey: "zz", createdAt: new Date("2026-01-01T00:00:00Z"), category: { name: "Cats", hidden: false }, article: { pageId: 7 } },
      { sortKey: null, createdAt: new Date("2026-01-02T00:00:00Z"), category: { name: "Dogs", hidden: true }, article: { pageId: 7 } },
    ]);
    const result = await store.categoriesOf({ articleIds: ["a1"], dir: "ascending", limit: 1, titles: ["Category:Cats"] });
    expect(result.rows).toEqual([{ pageId: 7, title: "Category:Cats", sortKey: "zz", timestamp: new Date("2026-01-01T00:00:00Z"), hidden: false }]);
    expect(result.next).toEqual({ pageId: 7, key: "Dogs" });
    expect(mdb.wikiCategoryMember!.findMany!.mock.calls[0]![0].where.category).toEqual({ name: { in: ["Cats"] } });
    const all = await store.categoriesOf({ articleIds: ["a1"], dir: "ascending", limit: 5 });
    expect(all.rows.map((row) => [row.title, row.hidden])).toEqual([["Category:Cats", false], ["Category:Dogs", true]]);
    mdb.wikiCategoryMember!.findMany!.mockClear();
    mdb.wikiCategoryMember!.findMany!.mockResolvedValue([]);
    await store.categoriesOf({ articleIds: ["a1"], dir: "ascending", limit: 5, hidden: true });
    await store.categoriesOf({ articleIds: ["a1"], dir: "ascending", limit: 5, hidden: false, titles: ["Category:Cats"] });
    expect(mdb.wikiCategoryMember!.findMany!.mock.calls[0]![0].where.category).toEqual({ hidden: true });
    expect(mdb.wikiCategoryMember!.findMany!.mock.calls[1]![0].where.category).toEqual({ name: { in: ["Cats"] }, hidden: false });
  });

  it("reads which of some category names are hidden", async () => {
    mdb.wikiCategory!.findMany!.mockResolvedValue([{ name: "Maintenance" }]);
    expect(await store.hiddenCategoryNames(["Cats", "Maintenance"])).toEqual(new Set(["Maintenance"]));
    expect(mdb.wikiCategory!.findMany!.mock.calls[0]![0].where).toEqual({ name: { in: ["Cats", "Maintenance"] }, hidden: true });
    expect(await store.hiddenCategoryNames([])).toEqual(new Set());
  });
});

describe("listings", () => {
  const listed = (overrides = {}) => ({ pageId: 1, title: "Alpha", namespace: 0, redirectTargetSlug: null, ...overrides });

  it("allpages: namespace, prefix and bounds in the listing's direction, redirect filter, one extra row", async () => {
    mdb.wikiArticle!.findMany!.mockResolvedValue([listed(), listed({ pageId: 2, title: "Beta", redirectTargetSlug: "Alpha" })]);
    const rows = await store.listPages({ namespace: 0, start: "B", end: "Z", prefix: "B", filterRedirects: "nonredirects", dir: "descending", limit: 5 });
    const args = mdb.wikiArticle!.findMany!.mock.calls[0]![0];
    expect(args.where).toMatchObject({ namespace: 0, title: { startsWith: "B", gte: "Z", lte: "B" }, redirectTargetSlug: null });
    expect(args.orderBy).toEqual({ title: "desc" });
    expect(args.take).toBe(6);
    expect(rows).toEqual([
      { pageId: 1, title: "Alpha", namespace: 0, isRedirect: false },
      { pageId: 2, title: "Beta", namespace: 0, isRedirect: true },
    ]);
  });

  it("backlinks: pages with a link row to the slug, from the cursor", async () => {
    mdb.wikiArticle!.findMany!.mockResolvedValue([listed()]);
    await store.listBacklinks({ target: "alpha beta", filterRedirects: "redirects", limit: 2, cursor: 9, namespaces: [0] });
    const args = mdb.wikiArticle!.findMany!.mock.calls[0]![0];
    expect(args.where).toMatchObject({
      outgoingLinks: { some: { targetSlug: "alpha_beta", isExternal: false } },
      pageId: { gte: 9 },
      redirectTargetSlug: { not: null },
      namespace: { in: [0] },
    });
    expect(args.orderBy).toEqual({ pageId: "asc" });
    expect(await store.listBacklinks({ target: "Bad[title", filterRedirects: "all", limit: 1 })).toEqual([]);
  });

  it("wikitextByArticle(maxChars) casts the bound length: Prisma binds a number as bigint and left(text, bigint) does not exist", async () => {
    mdb.$queryRaw.mockResolvedValue([{ id: "a1", wikitext: "xx" }]);
    expect(await store.wikitextByArticle(["a1"], 100)).toEqual(new Map([["a1", "xx"]]));
    const sql = mdb.$queryRaw.mock.calls[0]![0] as { sql: string; values: unknown[] };
    expect(sql.sql).toMatch(/left\("wikitext", [^)]+::int\)/);
    expect(sql.values).toContain(100);
  });

  it("allcategories: one row per name, counting members that are not deleted pages", async () => {
    mdb.$queryRaw.mockResolvedValue([{ name: "Cats", members: BigInt(3), hidden: false }, { name: "Maint", members: BigInt(1), hidden: true }]);
    expect(await store.listCategories({ dir: "ascending", limit: 5, prefix: "C" })).toEqual([{ name: "Cats", members: 3, hidden: false }, { name: "Maint", members: 1, hidden: true }]);
    const sql = mdb.$queryRaw.mock.calls[0]![0] as { sql: string; values: unknown[] };
    expect(sql.sql).toContain('GROUP BY c."name"');
    expect(sql.sql).toContain(`a."status" <> 'ARCHIVED'`);
    expect(sql.sql).toContain("ORDER BY");
    expect(sql.values).toContain("C");
    expect(sql.values).toContain(6);
  });

  it("log events: the type, action, title and the time cursor, mapped to plain rows", async () => {
    mdb.wikiLog!.findMany!.mockResolvedValue([
      { logId: 4, logType: "move", action: "move", title: "Template:Foo", actorName: "Heku", comment: null, params: { to: "x" }, createdAt: new Date("2026-03-01T00:00:00Z"), article: { pageId: 7 } },
    ]);
    const rows = await store.findLogs({ type: "move", action: "move", title: "Template:Foo", user: "Heku", excludeUser: "Bot", titlePrefix: "Template:", dir: "older", cursor: { timestamp: new Date("2026-04-01T00:00:00Z"), logId: 9 }, limit: 3 });
    const args = mdb.wikiLog!.findMany!.mock.calls[0]![0];
    expect(args.take).toBe(4);
    expect(args.where).toMatchObject({ logId: { not: null }, logType: "move", action: "move", title: "Template:Foo", actorName: "Heku" });
    expect(args.where.AND).toContainEqual({ NOT: { actorName: "Bot" } });
    expect(rows).toEqual([{ logId: 4, type: "move", action: "move", title: "Template:Foo", namespace: 10, pageId: 7, actor: "Heku", comment: null, params: { to: "x" }, timestamp: new Date("2026-03-01T00:00:00Z") }]);
  });

  it("allusers: verified links, group filter through explicit memberships, groups and edit counts", async () => {
    mdb.wikiUserGroup!.findMany!
      .mockResolvedValueOnce([{ userId: "u1", wikiUsername: null, expiresAt: null }, { userId: "u9", wikiUsername: null, expiresAt: new Date("2000-01-01") }])
      .mockResolvedValueOnce([{ userId: "u1", wikiUsername: null, group: "sysop", expiresAt: null }]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([{ username: "Alice", userId: "u1", wikiUserId: 3, user: { createdAt: new Date("2020-01-01T00:00:00Z") } }]);
    mdb.wikiRevision!.groupBy!.mockResolvedValue([{ author: "Alice", _count: { _all: 9 } }]);
    const rows = await store.listUsers({ group: "sysop", dir: "ascending", limit: 5, withEditCount: true });
    expect(mdb.wikiAccountLink!.findMany!.mock.calls[0]![0].where.AND).toEqual([{ OR: [{ userId: { in: ["u1"] } }, { username: { in: [] } }] }]);
    expect(rows).toEqual([{ name: "Alice", userId: 3, registration: new Date("2020-01-01T00:00:00Z"), editCount: 9, groups: ["sysop"] }]);
  });

  it("protected titles: create restrictions in force, without the titles that have a page", async () => {
    mdb.wikiRestriction!.findMany!.mockResolvedValue([
      { id: "p1", title: "Nope", level: "sysop", createdAt: new Date("2026-03-01T00:00:00Z"), reason: "salted", expiresAt: null, setById: null },
      { id: "p2", title: "Exists", level: "sysop", createdAt: new Date("2026-03-02T00:00:00Z"), reason: null, expiresAt: null, setById: null },
    ]);
    mdb.wikiArticle!.findMany!.mockResolvedValue([{ title: "Exists" }]);
    const rows = await store.listProtectedTitles({ dir: "older", limit: 5 });
    expect(rows.map((r) => r.title)).toEqual(["Nope"]);
    expect(mdb.wikiRestriction!.findMany!.mock.calls[0]![0].where).toMatchObject({ source: "ixwiki", action: "create" });
  });
});

describe("statistics and user stats", () => {
  it("counts the pages a bot can see, and a user's edits by id or name", async () => {
    mdb.wikiArticle!.count!.mockResolvedValue(10);
    mdb.wikiRevision!.count!.mockResolvedValue(50);
    mdb.wikiAccountLink!.count!.mockResolvedValue(3);
    mdb.wikiUserGroup!.count!.mockResolvedValue(1);
    mdb.wikiRevision!.groupBy!.mockResolvedValue([{ author: "a" }, { author: "b" }]);
    expect(await store.statistics()).toEqual({ pages: 10, articles: 10, edits: 50, images: 10, users: 3, activeUsers: 2, admins: 1 });
    mdb.user!.findUnique!.mockResolvedValue({ createdAt: new Date("2020-01-02T00:00:00Z") });
    expect(await store.userStats("u1", "Heku")).toEqual({ editCount: 50, registration: new Date("2020-01-02T00:00:00Z") });
    expect(mdb.wikiRevision!.count!.mock.calls.at(-1)![0].where).toEqual({ source: "ixwiki", parked: false, OR: [{ authorId: "u1" }, { author: "Heku" }] });
    expect(await store.userStats(null, "Anon")).toEqual({ editCount: 50, registration: null });
  });
});

describe("render-derived tables: templates, images, embeddedin, imageusage", () => {
  it("templatesOf: the page's transclusions ordered by (page id, title), filtered by title and namespace, with a cursor", async () => {
    mdb.wikiTemplateLink!.findMany!.mockResolvedValue([
      { templateTitle: "Module:Foo", article: { pageId: 7 } },
      { templateTitle: "Template:Bar", article: { pageId: 7 } },
      { templateTitle: "Template:Baz", article: { pageId: 7 } },
    ]);
    const result = await store.templatesOf({ articleIds: ["a1"], dir: "ascending", limit: 2, namespaces: [10], titles: ["template:bar", "Template:Baz"], cursor: { pageId: 7, key: "Module:Foo" } });
    const args = mdb.wikiTemplateLink!.findMany!.mock.calls[0]![0];
    expect(args.where).toMatchObject({ articleId: { in: ["a1"] }, templateTitle: { in: ["Template:Bar", "Template:Baz"] } });
    expect(args.where.OR).toEqual([{ article: { pageId: { gt: 7 } } }, { article: { pageId: 7 }, templateTitle: { gte: "Module:Foo" } }]);
    expect(args.orderBy).toEqual([{ article: { pageId: "asc" } }, { templateTitle: "asc" }]);
    expect(args.take).toBe(3);
    // Module:Foo is namespace 828, not 10
    expect(result.rows).toEqual([{ pageId: 7, title: "Template:Bar", namespace: 10 }]);
    expect(result.next).toEqual({ pageId: 7, key: "Template:Baz" });
    expect(await store.templatesOf({ articleIds: [], dir: "ascending", limit: 5 })).toEqual({ rows: [], next: null });
  });

  it("imagesOf: File: titles from file names, filtered by File: titles, descending with a cursor", async () => {
    mdb.wikiImageLink!.findMany!.mockResolvedValue([{ fileName: "Cat photo.png", article: { pageId: 7 } }]);
    const result = await store.imagesOf({ articleIds: ["a1"], dir: "descending", limit: 5, titles: ["File:Cat_photo.png", "Template:Nope"], cursor: { pageId: 8, key: "Z.png" } });
    const args = mdb.wikiImageLink!.findMany!.mock.calls[0]![0];
    expect(args.where).toMatchObject({ articleId: { in: ["a1"] }, fileName: { in: ["Cat photo.png"] } });
    expect(args.where.OR).toEqual([{ article: { pageId: { lt: 8 } } }, { article: { pageId: 8 }, fileName: { lte: "Z.png" } }]);
    expect(args.orderBy).toEqual([{ article: { pageId: "desc" } }, { fileName: "desc" }]);
    expect(result).toEqual({ rows: [{ pageId: 7, title: "File:Cat photo.png", namespace: 6 }], next: null });
    // only File: is a namespace of images
    mdb.wikiImageLink!.findMany!.mockClear();
    expect(await store.imagesOf({ articleIds: ["a1"], dir: "ascending", limit: 5, namespaces: [0] })).toEqual({ rows: [], next: null });
    expect(mdb.wikiImageLink!.findMany!).not.toHaveBeenCalled();
  });

  it("listEmbeddedIn and listImageUsage: live pages related to the canonical target, in page id order", async () => {
    mdb.wikiArticle!.findMany!.mockResolvedValue([{ pageId: 1, title: "Alpha", namespace: 0, redirectTargetSlug: null }]);
    await store.listEmbeddedIn({ target: "template:foo", namespaces: [0], filterRedirects: "nonredirects", limit: 5, cursor: 3 });
    let args = mdb.wikiArticle!.findMany!.mock.calls[0]![0];
    expect(args.where).toMatchObject({
      source: "ixwiki",
      status: { not: "ARCHIVED" },
      templateLinks: { some: { templateTitle: "Template:Foo" } },
      namespace: { in: [0] },
      pageId: { gte: 3 },
      redirectTargetSlug: null,
    });
    expect(args.orderBy).toEqual({ pageId: "asc" });
    expect(args.take).toBe(6);
    await store.listImageUsage({ target: "File:Cat photo.png", filterRedirects: "all", limit: 1 });
    args = mdb.wikiArticle!.findMany!.mock.calls[1]![0];
    expect(args.where).toMatchObject({ imageLinks: { some: { fileName: "Cat photo.png" } } });
    // not a file title, not a title at all: nothing to ask
    mdb.wikiArticle!.findMany!.mockClear();
    expect(await store.listImageUsage({ target: "Template:Foo", filterRedirects: "all", limit: 1 })).toEqual([]);
    expect(await store.listEmbeddedIn({ target: "Bad[title", filterRedirects: "all", limit: 1 })).toEqual([]);
    expect(mdb.wikiArticle!.findMany!).not.toHaveBeenCalled();
  });
});
