/** @jest-environment node */
/**
 * Plan 410, 411: the Prisma-backed ApiStore against a mocked client: what never leaves the store (a parked revision,
 * a deleted file's page), the loud failures of rows a migration missed, and how rows become the plain rows modules use.
 * The SQL itself runs against PostgreSQL in store-realdb.test.ts.
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
      wikiAsset: model(),
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
  RightsAdminService: {
    listBlocks: jest.fn(),
    displayNames: jest.fn().mockResolvedValue(new Map()),
  },
}));

import { prismaApiStore as store } from "~/lib/wiki-os/api-compat/store";
import { syntheticUserId } from "~/lib/wiki-os/api-compat/auth-store";
import { db } from "~/server/db";
import { sha1HexToBase36 } from "~/lib/wiki-os/xml/sha1";
import { filesByName, listFiles } from "~/lib/wiki-os/api-compat/store-files";

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
  it("carries what the last render reported: page properties as text, and the display title", async () => {
    mdb.wikiArticle!.findMany!.mockResolvedValue([
      article({
        pageProps: { defaultsort: "Alpha, The", disambiguation: "", pagelength: 12 },
        displayTitle: "<i>alpha</i>",
      }),
      article({ id: "a2", pageId: 8, title: "Beta", pageProps: ["not", "an", "object"] }),
    ]);
    mdb.$queryRaw.mockResolvedValue([]);
    const [rendered, odd] = await store.pagesByTitle(["Alpha", "Beta"]);
    expect(rendered).toMatchObject({
      pageProps: { defaultsort: "Alpha, The", disambiguation: "", pagelength: "12" },
      displayTitle: "<i>alpha</i>",
    });
    expect(odd!.pageProps).toBeNull();
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
    for (const mock of [
      mdb.wikiRevision!.findMany!,
      mdb.wikiRevision!.findFirst!,
      mdb.wikiRevision!.count!,
    ]) {
      for (const [args] of mock.mock.calls) expect(args.where).toMatchObject({ parked: false });
    }
    // headRevisions and parentIds are raw SQL: the head is the newest revision that is not parked, and so is a parent
    const sqls = mdb.$queryRaw.mock.calls.map(([query]) => (query as { sql: string }).sql);
    expect(sqls.length).toBeGreaterThanOrEqual(2);
    expect(
      sqls
        .filter((sql) => sql.includes("wiki_revisions") && sql.includes("DISTINCT ON"))
        .every((sql) => sql.includes('"parked" = false'))
    ).toBe(true);
    expect(
      sqls
        .filter((sql) => sql.includes("SELECT p."))
        .every((sql) => sql.includes('p."parked" = false'))
    ).toBe(true);
    // site statistics and user counts
    await store.statistics();
    await store.userStats("u1", "Heku");
    for (const [args] of mdb.wikiRevision!.count!.mock.calls.slice(1))
      expect(args.where).toMatchObject({ parked: false });
    expect(mdb.wikiRevision!.groupBy!.mock.calls[0]![0].where).toMatchObject({ parked: false });
  });

  it("maps rows: parent, head flag, reference, size delta, hidden flags and the author's user id", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([
      revisionRecord(),
      revisionRecord({
        id: "old-row",
        mwRevId: 42,
        revId: 42,
        author: "Linked",
        authorId: null,
        textDeleted: true,
        wikitext: "secret",
      }),
    ]);
    mdb.$queryRaw
      .mockResolvedValueOnce([
        { revId: 1_000_000_001, parentId: 42 },
        { revId: 42, parentId: null },
      ])
      .mockResolvedValueOnce([
        { articleId: "a1", revId: 1_000_000_001, createdAt: new Date(), byteSize: 30 },
      ]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([{ username: "Linked", wikiUserId: 321 }]);
    const [newest, oldest] = await store.findRevisions({
      dir: "older",
      limit: 5,
      withContent: true,
    });
    expect(newest).toMatchObject({
      revId: 1_000_000_001,
      ref: "rev-row-1",
      parentId: 42,
      sizeDiff: 5,
      isHead: true,
      user: "Heku",
      userId: syntheticUserId("u1"),
      textHidden: false,
    });
    expect(oldest).toMatchObject({
      revId: 42,
      ref: "42",
      parentId: 0,
      isHead: false,
      userId: 321,
      textHidden: true,
      content: null,
    });
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
  it("fails loudly when a revision has no revId", async () => {
    mdb.wikiRevision!.findMany!.mockResolvedValue([revisionRecord({ revId: null })]);
    await expect(
      store.findRevisions({ dir: "older", limit: 1, withContent: false })
    ).rejects.toThrow(/wiki_revisions\.revId/);
  });
});

describe("links and categories", () => {
  it("lists categories as Category:Name with MediaWiki's hidden flag, and filters on it for show=hidden", async () => {
    mdb.wikiCategoryMember!.findMany!.mockResolvedValue([
      {
        sortKey: "zz",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        category: { name: "Cats", hidden: false },
        article: { pageId: 7 },
      },
      {
        sortKey: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        category: { name: "Dogs", hidden: true },
        article: { pageId: 7 },
      },
    ]);
    const result = await store.categoriesOf({
      articleIds: ["a1"],
      dir: "ascending",
      limit: 1,
      titles: ["Category:Cats"],
    });
    expect(result.rows).toEqual([
      {
        pageId: 7,
        title: "Category:Cats",
        sortKey: "zz",
        timestamp: new Date("2026-01-01T00:00:00Z"),
        hidden: false,
      },
    ]);
    expect(result.next).toEqual({ pageId: 7, key: "Dogs" });
    expect(mdb.wikiCategoryMember!.findMany!.mock.calls[0]![0].where.category).toEqual({
      name: { in: ["Cats"] },
    });
    const all = await store.categoriesOf({ articleIds: ["a1"], dir: "ascending", limit: 5 });
    expect(all.rows.map((row) => [row.title, row.hidden])).toEqual([
      ["Category:Cats", false],
      ["Category:Dogs", true],
    ]);
    mdb.wikiCategoryMember!.findMany!.mockClear();
    mdb.wikiCategoryMember!.findMany!.mockResolvedValue([]);
    await store.categoriesOf({ articleIds: ["a1"], dir: "ascending", limit: 5, hidden: true });
    await store.categoriesOf({
      articleIds: ["a1"],
      dir: "ascending",
      limit: 5,
      hidden: false,
      titles: ["Category:Cats"],
    });
    expect(mdb.wikiCategoryMember!.findMany!.mock.calls[0]![0].where.category).toEqual({
      hidden: true,
    });
    expect(mdb.wikiCategoryMember!.findMany!.mock.calls[1]![0].where.category).toEqual({
      name: { in: ["Cats"] },
      hidden: false,
    });
  });
});

describe("listings", () => {
  it("wikitextByArticle(maxChars) casts the bound length: Prisma binds a number as bigint and left(text, bigint) does not exist", async () => {
    mdb.$queryRaw.mockResolvedValue([{ id: "a1", wikitext: "xx" }]);
    expect(await store.wikitextByArticle(["a1"], 100)).toEqual(new Map([["a1", "xx"]]));
    const sql = mdb.$queryRaw.mock.calls[0]![0] as { sql: string; values: unknown[] };
    expect(sql.sql).toMatch(/left\("wikitext", [^)]+::int\)/);
    expect(sql.values).toContain(100);
  });
  it("allusers: verified links, group filter through explicit memberships, groups and edit counts", async () => {
    mdb
      .wikiUserGroup!.findMany!.mockResolvedValueOnce([
        { userId: "u1", wikiUsername: null, expiresAt: null },
        { userId: "u9", wikiUsername: null, expiresAt: new Date("2000-01-01") },
      ])
      .mockResolvedValueOnce([
        { userId: "u1", wikiUsername: null, group: "sysop", expiresAt: null },
      ]);
    mdb.wikiAccountLink!.findMany!.mockResolvedValue([
      {
        username: "Alice",
        userId: "u1",
        wikiUserId: 3,
        user: { createdAt: new Date("2020-01-01T00:00:00Z") },
      },
    ]);
    mdb.wikiRevision!.groupBy!.mockResolvedValue([{ author: "Alice", _count: { _all: 9 } }]);
    const rows = await store.listUsers({
      group: "sysop",
      dir: "ascending",
      limit: 5,
      withEditCount: true,
    });
    expect(mdb.wikiAccountLink!.findMany!.mock.calls[0]![0].where.AND).toEqual([
      { OR: [{ userId: { in: ["u1"] } }, { username: { in: [] } }] },
    ]);
    expect(rows).toEqual([
      {
        name: "Alice",
        userId: 3,
        registration: new Date("2020-01-01T00:00:00Z"),
        editCount: 9,
        groups: ["sysop"],
      },
    ]);
  });

  it("protected titles: create restrictions in force, without the titles that have a page", async () => {
    mdb.wikiRestriction!.findMany!.mockResolvedValue([
      {
        id: "p1",
        title: "Nope",
        level: "sysop",
        createdAt: new Date("2026-03-01T00:00:00Z"),
        reason: "salted",
        expiresAt: null,
        setById: null,
      },
      {
        id: "p2",
        title: "Exists",
        level: "sysop",
        createdAt: new Date("2026-03-02T00:00:00Z"),
        reason: null,
        expiresAt: null,
        setById: null,
      },
    ]);
    mdb.wikiArticle!.findMany!.mockResolvedValue([{ title: "Exists" }]);
    const rows = await store.listProtectedTitles({ dir: "older", limit: 5 });
    expect(rows.map((r) => r.title)).toEqual(["Nope"]);
    expect(mdb.wikiRestriction!.findMany!.mock.calls[0]![0].where).toMatchObject({
      source: "ixwiki",
      action: "create",
    });
  });
});

describe("the file queries", () => {
  type Mocked = Record<"wikiAsset" | "wikiArticle" | "wikiLog", { findMany: jest.Mock }>;
  const mdb = db as unknown as Mocked;

  const HEX = "0123456789abcdef0123456789abcdef01234567";
  const asset = (over: Record<string, unknown> = {}) => ({
    title: "Flag of Eurth.png",
    filename: "Flag_of_Eurth.png",
    url: "/api/wiki/file/Flag_of_Eurth.png",
    sizeBytes: 5000,
    width: 640,
    height: 480,
    mimeType: "image/png",
    sha1: sha1HexToBase36(HEX),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    ...over,
  });

  beforeEach(() => {
    for (const model of [mdb.wikiAsset, mdb.wikiArticle, mdb.wikiLog])
      model.findMany.mockReset().mockResolvedValue([]);
  });

  describe("filesByName", () => {
    it("finds assets by their underscored file names and describes them from the asset, the page and the newest upload", async () => {
      mdb.wikiAsset.findMany.mockResolvedValue([asset()]);
      mdb.wikiArticle.findMany.mockImplementation(
        async ({ where }: { where: { status: unknown } }) =>
          JSON.stringify(where.status).includes("ARCHIVED") &&
          !JSON.stringify(where.status).includes("not")
            ? []
            : [{ title: "File:Flag of Eurth.png", pageId: 77 }]
      );
      mdb.wikiLog.findMany.mockResolvedValue([
        {
          title: "File:Flag of Eurth.png",
          actorName: "Mod",
          comment: "newest",
          createdAt: new Date("2026-09-30T12:00:00Z"),
        },
        {
          title: "File:Flag of Eurth.png",
          actorName: "Heku",
          comment: "first",
          createdAt: new Date("2026-09-01T00:00:00Z"),
        },
      ]);

      const [row] = await filesByName(["Flag of Eurth.png"]);

      expect(mdb.wikiAsset.findMany).toHaveBeenCalledWith({
        where: { filename: { in: ["Flag_of_Eurth.png"] } },
      });
      expect(mdb.wikiLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { logType: "upload", title: { in: ["File:Flag of Eurth.png"] } },
          orderBy: { createdAt: "desc" },
        })
      );
      expect(row).toEqual({
        name: "Flag of Eurth.png",
        title: "File:Flag of Eurth.png",
        pageId: 77,
        url: "/api/wiki/file/Flag_of_Eurth.png",
        size: 5000,
        width: 640,
        height: 480,
        mime: "image/png",
        sha1: HEX,
        timestamp: new Date("2026-09-30T12:00:00Z"),
        user: "Mod",
        comment: "newest",
      });
    });
    it("leaves out a file whose File: page was deleted, and asks nothing for no names", async () => {
      mdb.wikiAsset.findMany.mockResolvedValue([
        asset(),
        asset({ title: "Gone.png", filename: "Gone.png" }),
      ]);
      mdb.wikiArticle.findMany.mockImplementation(
        async ({ where }: { where: { status: unknown; title: { in: string[] } } }) =>
          where.status === "ARCHIVED" ? [{ title: "File:Gone.png" }] : []
      );

      const rows = await filesByName(["Flag of Eurth.png", "Gone.png"]);

      expect(rows.map((row) => row.name)).toEqual(["Flag of Eurth.png"]);
      mdb.wikiAsset.findMany.mockClear();
      expect(await filesByName([])).toEqual([]);
      expect(mdb.wikiAsset.findMany).not.toHaveBeenCalled();
    });
  });

  describe("listFiles", () => {
    const query = { dir: "ascending" as const, limit: 2 };
    it("reads on past a deleted file until the page is full, continuing after the last name it read", async () => {
      const make = (name: string) => asset({ title: name, filename: name });
      mdb.wikiAsset.findMany
        .mockResolvedValueOnce([make("A.png"), make("B.png"), make("C.png")])
        .mockResolvedValueOnce([make("D.png"), make("E.png")]);
      mdb.wikiArticle.findMany.mockImplementation(
        async ({ where }: { where: { status: unknown } }) =>
          where.status === "ARCHIVED" ? [{ title: "File:A.png" }, { title: "File:B.png" }] : []
      );

      const rows = await listFiles(query);

      expect(rows.map((row) => row.name)).toEqual(["C.png", "D.png", "E.png"]);
      expect(mdb.wikiAsset.findMany.mock.calls[1]?.[0].where.filename).toEqual({ gt: "C.png" });
    });
  });
});
