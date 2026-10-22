/** @jest-environment node */
/**
 * The PostgreSQL readers that replaced MediaWiki's (plan 418): an account's revisions, created pages and info come
 * from WikiOS's own rows (verified links included, names taken as typed); a parked revision is no recent change and is
 * flagged where it is listed; a deleted page's text and its files never come back; a page's images leave out icons,
 * non-images and files whose page was deleted, with the limit applied first; a sister wiki is still asked for its own;
 * the main page counts only edits that went live and reports a failed count as unknown, never a stand-in number; and no
 * list (search, category members, recent changes, contributions, backlinks, redirects, media usage) shows a deleted page.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    wikiRevision: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn(), findMany: jest.fn() },
    wikiAsset: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    wikiLink: { findMany: jest.fn() },
    wikiCategory: { findFirst: jest.fn() },
    wikiCategoryMember: { findMany: jest.fn() },
    wikiTemplate: { findMany: jest.fn() },
    user: { count: jest.fn() },
    lorewardUserStats: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
}));
jest.mock("~/lib/wiki-os/rights", () => ({
  __esModule: true,
  loadTargetPermissions: jest.fn(),
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { loadTargetPermissions } from "~/lib/wiki-os/rights";
import { ixwikiGetUserContribs, ixwikiGetUserCreatedPages, ixwikiGetUserInfo, ixwikiRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";
import { type FetchGuard, installFetchGuard } from "~/tests/helpers/fetch-guard";
import { ixwikiGetWikitext, ixwikiResolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-reader";
import { getArticleWikitext, getPageImages } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { ixwikiGetSiteStats } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-site";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";

// each folded suite sets what it reads; nothing one leaves on the shared database mock reaches the next
beforeEach(() => jest.resetAllMocks());

describe("user info", () => {
  const mocked = db as unknown as {
    wikiRevision: { count: jest.Mock; findFirst: jest.Mock };
    wikiAccountLink: { findFirst: jest.Mock };
    lorewardUserStats: { findFirst: jest.Mock };
  };
  const permissions = jest.mocked(loadTargetPermissions);

  const firstEdit = new Date("2024-03-01T10:00:00Z");

  let guard: FetchGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    guard = installFetchGuard();
    mocked.wikiRevision.count.mockResolvedValue(3);
    mocked.wikiRevision.findFirst.mockResolvedValue({ author: "Kir", createdAt: firstEdit });
    mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
    mocked.lorewardUserStats.findFirst.mockResolvedValue(null);
    permissions.mockResolvedValue({
      groups: ["*"],
      rights: new Set(),
      block: null,
      verifiedWikiUsername: null,
    });
  });
  afterEach(() => guard.restore());

  describe("ixwikiGetUserInfo", () => {
    it("counts the account's revisions and dates it from its first one, never asking MediaWiki", async () => {
      const info = await ixwikiGetUserInfo("kir");

      expect(info).toMatchObject({
        exists: true,
        username: "Kir",
        user_name: "Kir",
        editCount: 3,
        user_editcount: 3,
        registration: firstEdit.toISOString(),
        user_registration: firstEdit.toISOString(),
        // The id is MediaWiki's: unknown without a verified link, never made up.
        userId: 0,
        user_id: 0,
      });
      expect(guard.calls()).toEqual([]);
      expect(mocked.wikiRevision.count.mock.calls[0]?.[0].where).toEqual({
        author: { equals: "Kir", mode: "insensitive" },
      });
    });

    it("reports the groups of the rights engine, with the implicit user group of an account that exists", async () => {
      permissions.mockResolvedValue({
        groups: ["*", "sysop"],
        rights: new Set(),
        block: null,
        verifiedWikiUsername: null,
      });

      const info = await ixwikiGetUserInfo("Kir");

      expect(info?.groups).toEqual(["*", "sysop", "user"]);
      expect(permissions).toHaveBeenCalledWith({ userId: null, wikiUsername: "Kir" });
    });

    it("takes the user id and registration of a verified link, and counts edits saved under its owner's id", async () => {
      const registered = new Date("2023-01-05T00:00:00Z");
      mocked.wikiAccountLink.findFirst.mockResolvedValue({
        userId: "u1",
        username: "Kir",
        wikiUserId: 42,
        mwRegisteredAt: registered,
        user: { createdAt: new Date("2025-01-01T00:00:00Z") },
      });
      permissions.mockResolvedValue({
        groups: ["*", "user", "autoconfirmed"],
        rights: new Set(),
        block: null,
        verifiedWikiUsername: "Kir",
      });

      const info = await ixwikiGetUserInfo("Kir");

      expect(info).toMatchObject({
        userId: 42,
        registration: registered.toISOString(),
        groups: ["*", "user", "autoconfirmed"],
      });
      expect(mocked.wikiRevision.count.mock.calls[0]?.[0].where).toEqual({
        OR: [{ author: { equals: "Kir", mode: "insensitive" } }, { authorId: "u1" }],
      });
      expect(permissions).toHaveBeenCalledWith({ userId: "u1", wikiUsername: "Kir" });
    });
    it("reports an unknown name as not existing, without asking MediaWiki", async () => {
      mocked.wikiRevision.count.mockResolvedValue(0);
      mocked.wikiRevision.findFirst.mockResolvedValue(null);

      expect(await ixwikiGetUserInfo("Nobody")).toMatchObject({
        exists: false,
        userId: 0,
        editCount: 0,
        groups: [],
        username: "Nobody",
      });
      expect(guard.ixwikiCalls()).toEqual([]);
    });

    it("takes a name as typed: an @, underscores, a percent-escape, and one that is not valid escaping", async () => {
      await ixwikiGetUserInfo("@mr_x");
      await ixwikiGetUserInfo("Mr%20Y");
      await ixwikiGetUserInfo("100%");

      const names = mocked.wikiRevision.count.mock.calls.map(
        ([args]) => args.where.author.equals as string
      );
      expect(names).toEqual(["Mr x", "Mr Y", "100%"]);
      expect(await ixwikiGetUserInfo("   ")).toBeNull();
    });
  });
});

describe("parked revisions in the lists", () => {
  const findMany = db.wikiRevision.findMany as unknown as jest.Mock;

  const row = (over: Record<string, unknown> = {}) => ({
    id: "r1",
    mwRevId: 100,
    author: "carol",
    summary: "an edit",
    minor: false,
    parked: false,
    byteSize: 20,
    byteDelta: 5,
    wikitext: "Some text.",
    createdAt: new Date("2026-09-27T10:00:00Z"),
    article: {
      title: "Foo",
      namespace: 0,
      summary: null,
      leadImageUrl: null,
      wikitext: "Some text.",
    },
    ...over,
  });

  const realFetch = globalThis.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    (db.wikiAccountLink.findMany as unknown as jest.Mock).mockResolvedValue([]);
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("offline")) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  describe("recent changes", () => {
    it("leaves a parked revision out by default: it never went live, so it is no recent change of the wiki", async () => {
      findMany.mockResolvedValue([row({ id: "r2" })]);

      const changes = await ixwikiRecentChanges(10);

      expect(changes.map((c) => c.parked)).toEqual([false]);
      expect(findMany.mock.calls[0]?.[0].where).toMatchObject({ parked: false });
    });

    it("lists it, flagged, for the page that asks for it, and the others unflagged", async () => {
      findMany.mockResolvedValue([row({ parked: true, mwRevId: 101 }), row({ id: "r2" })]);

      const changes = await ixwikiRecentChanges(10, { includeParked: true });

      expect(changes.map((c) => c.parked)).toEqual([true, false]);
      // No `parked` filter: the row stays in the list.
      expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty("parked");
    });
  });

  describe("user contributions", () => {
    it("flags a PostgreSQL revision that is parked", async () => {
      findMany.mockResolvedValue([
        row({ parked: true, mwRevId: 101 }),
        row({ id: "r2", mwRevId: 99 }),
      ]);

      const contribs = await ixwikiGetUserContribs("carol", 10);

      expect(contribs.map((c) => [c.rev_id, c.parked]).sort()).toEqual([
        [101, true],
        [99, false],
      ]);
    });
  });
});

describe("an account's activity", () => {
  const mocked = db as unknown as {
    wikiRevision: { findMany: jest.Mock };
    wikiAccountLink: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  const revision = (over: Record<string, unknown> = {}) => ({
    id: "r1",
    mwRevId: 100,
    author: "Kir",
    summary: "an edit",
    minor: false,
    parked: false,
    byteSize: 20,
    byteDelta: 5,
    wikitext: "Some text.",
    createdAt: new Date("2026-09-27T10:00:00Z"),
    article: {
      title: "Foo",
      namespace: 0,
      summary: null,
      leadImageUrl: null,
      wikitext: "Some text.",
    },
    ...over,
  });

  let guard: FetchGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    guard = installFetchGuard();
    mocked.wikiRevision.findMany.mockResolvedValue([]);
    mocked.wikiAccountLink.findMany.mockResolvedValue([]);
    mocked.$queryRaw.mockResolvedValue([]);
  });
  afterEach(() => guard.restore());
  describe("user contributions", () => {
    it("lists the account's revisions by the name it edited under, never asking MediaWiki", async () => {
      mocked.wikiRevision.findMany.mockResolvedValue([
        revision(),
        revision({ id: "r2", mwRevId: null }),
      ]);

      const contribs = await ixwikiGetUserContribs("kir_x", 50, 0, 0);

      expect(contribs.map((c) => [c.page_title, c.rev_id])).toEqual([
        ["Foo", 100],
        ["Foo", 0],
      ]);
      const where = mocked.wikiRevision.findMany.mock.calls[0]?.[0].where;
      expect(where).toEqual({
        author: { equals: "Kir x", mode: "insensitive" },
        article: { namespace: 0, status: "PUBLISHED" },
      });
      expect(guard.calls()).toEqual([]);
    });

    it("also lists the edits saved under the id of the WikiOS user who proved the account", async () => {
      mocked.wikiAccountLink.findMany.mockResolvedValue([{ userId: "u1" }]);

      await ixwikiGetUserContribs("Kir", 50, 0, 3);

      expect(mocked.wikiAccountLink.findMany.mock.calls[0]?.[0].take).toBe(1);
      expect(mocked.wikiAccountLink.findMany.mock.calls[0]?.[0].where).toMatchObject({
        source: "ixwiki",
        username: "Kir",
        verifiedAt: { not: null },
      });
      expect(mocked.wikiRevision.findMany.mock.calls[0]?.[0].where).toEqual({
        OR: [{ author: { equals: "Kir", mode: "insensitive" } }, { authorId: { in: ["u1"] } }],
        article: { namespace: 3, status: "PUBLISHED" },
      });
    });
  });

  describe("pages a user created", () => {
    const sql = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

    it("are the published pages whose oldest live revision the account made, never asked of MediaWiki", async () => {
      mocked.$queryRaw.mockResolvedValue([
        {
          title: "Foo",
          namespace: 0,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          byteSize: 1234n,
        },
      ]);

      const pages = await ixwikiGetUserCreatedPages("Kir", 25);

      expect(pages).toEqual([
        { title: "Foo", namespace: 0, createdAt: "2026-01-02T00:00:00.000Z", byteSize: 1234 },
      ]);
      const query = sql(mocked.$queryRaw.mock.calls[0]!);
      expect(query).toContain(`r."parked" = false`);
      expect(query).toContain(`ORDER BY r."createdAt" ASC, r."id" ASC`);
      expect(query).toContain(`a."status" = 'PUBLISHED'`);
      expect(mocked.$queryRaw.mock.calls[0]).toContain("Kir");
      expect(mocked.$queryRaw.mock.calls[0]).toContain(25);
      expect(guard.calls()).toEqual([]);
    });
  });
});

describe("a page's wikitext", () => {
  const article = db.wikiArticle as unknown as Record<"findUnique" | "findMany" | "findFirst", jest.Mock>;

  const row = (over: Record<string, unknown> = {}) => ({
    id: "a1",
    title: "Caphiria",
    source: "ixwiki",
    status: "PUBLISHED",
    format: "WIKITEXT",
    wikitext: "'''Caphiria''' is a country.",
    namespace: 0,
    namespacePrefix: null,
    protectionLevel: "ALL",
    syncedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    ...over,
  });

  let guard: FetchGuard;

  afterEach(() => guard.restore());

  beforeEach(() => {
    jest.clearAllMocks();
    article.findUnique.mockResolvedValue(null);
    article.findMany.mockResolvedValue([]);
    article.findFirst.mockResolvedValue(null);
    guard = installFetchGuard();
  });

  describe("ixwikiGetWikitext", () => {
    it("answers null for a deleted page, without asking MediaWiki", async () => {
      article.findUnique.mockResolvedValue(row({ status: "ARCHIVED" }));

      expect(await ixwikiGetWikitext("Caphiria")).toBeNull();
      expect(guard.ixwikiCalls()).toEqual([]);
    });
  });

  describe("getArticleWikitextShadow", () => {
    it("still hides a deleted page from a reader who may not see it", async () => {
      article.findUnique.mockResolvedValue(row({ status: "ARCHIVED" }));

      expect(await getArticleWikitextShadow("Caphiria", "ixwiki")).toBeNull();
      expect(await getArticleWikitextShadow("Caphiria", "ixwiki", { includeArchived: true })).toMatchObject({
        wikitext: "'''Caphiria''' is a country.",
      });
      expect(guard.calls()).toEqual([]);
    });
  });

  describe("a sister wiki's page", () => {
    it("is still fetched from its own wiki (iiwiki)", async () => {
      guard.restore();
      guard = installFetchGuard((url) => {
        expect(url.hostname).toBe("iiwiki.com");
        return {
          query: {
            pages: { 7: { pageid: 7, title: "Elmeria", revisions: [{ slots: { main: { "*": "Sister text" } } }] } },
          },
        };
      });

      expect(await getArticleWikitext("Elmeria", "iiwiki")).toEqual({
        title: "Elmeria",
        pageId: 7,
        wikitext: "Sister text",
        length: 11,
      });
      expect(await getArticleWikitextShadow("Elmeria", "iiwiki")).toMatchObject({
        wikitext: "Sister text",
        fromShadow: false,
      });
      expect(guard.calls().every((url) => url.startsWith("https://iiwiki.com/"))).toBe(true);
      expect(guard.ixwikiCalls()).toEqual([]);
    });
  });
});

describe("a page's images", () => {
  const mocked = db as unknown as {
    wikiArticle: Record<"findFirst" | "findUnique" | "findMany", jest.Mock>;
    wikiAsset: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  const links = (...names: string[]) => ({ imageLinks: names.map((fileName) => ({ fileName })) });

  const asset = (filename: string, over: Record<string, unknown> = {}) => ({
    filename,
    slug: filename.toLowerCase(),
    md5Hash: `md5-${filename}`,
    title: filename.replace(/_/g, " "),
    url: `https://ixwiki.com/images/x/xx/${filename}`,
    thumbnailUrl: `https://ixwiki.com/images/thumb/x/xx/${filename}/300px-${filename}`,
    mimeType: "image/png",
    width: 800,
    height: 600,
    ...over,
  });

  let guard: FetchGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    guard = installFetchGuard();
    mocked.$queryRaw.mockResolvedValue([]); // no redirect
    mocked.wikiArticle.findUnique.mockResolvedValue(null);
    mocked.wikiArticle.findMany.mockResolvedValue([]);
    mocked.wikiArticle.findFirst.mockResolvedValue(null);
    mocked.wikiAsset.findMany.mockResolvedValue([]);
  });
  afterEach(() => guard.restore());

  describe("getPageImages for IxWiki", () => {
    it("leaves out excluded files, icons, non-images and files with no asset row", async () => {
      mocked.wikiArticle.findFirst.mockResolvedValue(
        links("Flag icon.png", "Tiny.png", "Doc.pdf", "Lost.png", "Real.png", "Unsized.png")
      );
      mocked.wikiAsset.findMany.mockResolvedValue([
        asset("Flag_icon.png"),
        asset("Tiny.png", { width: 40, height: 40 }),
        asset("Doc.pdf", { mimeType: "application/pdf" }),
        asset("Real.png"),
        asset("Unsized.png", { width: null, height: null }),
      ]);

      const images = await getPageImages("Caphiria", { excludePatterns: [/^File:Flag.icon/i] });

      expect(images?.map((image) => image.title)).toEqual(["File:Real.png", "File:Unsized.png"]);
      expect(images?.[1]).toMatchObject({ width: 0, height: 0 });
    });

    it("leaves out a file whose File: page was deleted, though the page still names it", async () => {
      mocked.wikiArticle.findFirst.mockResolvedValue(links("Gone.png", "Kept.png"));
      mocked.wikiAsset.findMany.mockResolvedValue([asset("Gone.png"), asset("Kept.png")]);
      mocked.wikiArticle.findMany.mockResolvedValue([{ title: "File:Gone.png" }]);

      const images = await getPageImages("Caphiria");

      expect(images?.map((image) => image.title)).toEqual(["File:Kept.png"]);
      expect(mocked.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject({
        source: "ixwiki",
        status: "ARCHIVED",
      });
      // The deleted file does not count against the limit either.
      mocked.wikiArticle.findFirst.mockResolvedValue(links("Gone.png", "Kept.png", "Other.png"));
      mocked.wikiAsset.findMany.mockResolvedValue([asset("Kept.png"), asset("Other.png")]);
      expect((await getPageImages("Caphiria", { limit: 2 }))?.map((image) => image.title)).toEqual([
        "File:Kept.png",
        "File:Other.png",
      ]);
    });

    it("applies the limit before looking the assets up", async () => {
      mocked.wikiArticle.findFirst.mockResolvedValue(links("A.png", "B.png", "C.png"));
      mocked.wikiAsset.findMany.mockResolvedValue([asset("A.png"), asset("B.png")]);

      const images = await getPageImages("Caphiria", { limit: 2 });

      expect(images?.map((image) => image.title)).toEqual(["File:A.png", "File:B.png"]);
    });
  });

  describe("getPageImages for a sister wiki", () => {
    it("asks that wiki for its own page's images (iiwiki)", async () => {
      guard.restore();
      const requested: string[] = [];
      guard = installFetchGuard((url) => {
        requested.push(url.searchParams.get("prop") ?? "");
        if (url.searchParams.get("prop") === "images") {
          return { query: { pages: { 1: { images: [{ title: "File:Elm.png" }] } } } };
        }
        return {
          query: {
            pages: {
              2: {
                title: "File:Elm.png",
                imageinfo: [{ url: "https://iiwiki.com/Elm.png", width: 640, height: 480, mime: "image/png" }],
              },
            },
          },
        };
      });

      const images = await getPageImages("Elmeria Images Test", { wiki: "iiwiki" });

      expect(images).toEqual([
        {
          title: "File:Elm.png",
          url: "https://iiwiki.com/Elm.png",
          thumbUrl: "https://iiwiki.com/Elm.png",
          width: 640,
          height: 480,
        },
      ]);
      expect(requested).toEqual(["images", "imageinfo"]);
      expect(guard.calls().every((url) => url.startsWith("https://iiwiki.com/api.php"))).toBe(true);
      // A sister wiki's page is not read from IxWiki's tables.
      expect(mocked.wikiArticle.findFirst).not.toHaveBeenCalled();
    });
  });
});

describe("the main page's reads", () => {
  const readsOf = {
    revisionFindMany: db.wikiRevision.findMany as unknown as jest.Mock,
    revisionCount: db.wikiRevision.count as unknown as jest.Mock,
    revisionGroupBy: db.wikiRevision.groupBy as unknown as jest.Mock,
    articleCount: db.wikiArticle.count as unknown as jest.Mock,
    assetCount: db.wikiAsset.count as unknown as jest.Mock,
    userCount: db.user.count as unknown as jest.Mock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ixwikiRecentChanges", () => {
    it("selects the revision's metadata and the article's title, summary and image: never a wikitext", async () => {
      readsOf.revisionFindMany.mockResolvedValue([
        {
          author: "amy",
          summary: "fix",
          byteSize: 1200,
          byteDelta: 200,
          createdAt: new Date("2026-06-01T00:00:00Z"),
          article: { title: "Aurelia", summary: "A '''country''' on Eurth.", leadImageUrl: "/i.png" },
        },
      ]);

      const [change] = await ixwikiRecentChanges(6);

      const args = readsOf.revisionFindMany.mock.calls[0]![0];
      expect(args).not.toHaveProperty("include");
      expect(JSON.stringify(args.select)).not.toContain("wikitext");
      expect(args.take).toBe(6);
      expect(change).toEqual({
        title: "Aurelia",
        user: "amy",
        timestamp: "2026-06-01T00:00:00.000Z",
        comment: "fix",
        type: "edit",
        oldLen: 1000,
        newLen: 1200,
        blurb: "A country on Eurth.",
        thumbnail: "/i.png",
      });
    });

    it("reads a first revision (no delta) as growing from nothing", async () => {
      readsOf.revisionFindMany.mockResolvedValue([
        {
          author: null,
          summary: null,
          byteSize: 500,
          byteDelta: 0,
          createdAt: new Date("2026-06-01T00:00:00Z"),
          article: { title: "New", summary: null, leadImageUrl: null },
        },
      ]);

      const [change] = await ixwikiRecentChanges(6);

      expect(change).toMatchObject({ user: "MediaWiki Editor", oldLen: 0, newLen: 500, blurb: null });
    });
  });

  describe("ixwikiGetSiteStats", () => {
    it("counts articles, pages, edits, images, users and the editors of the last 30 days", async () => {
      readsOf.articleCount.mockResolvedValueOnce(4800).mockResolvedValueOnce(12000);
      readsOf.revisionCount.mockResolvedValue(75000);
      readsOf.assetCount.mockResolvedValue(7500);
      readsOf.userCount.mockResolvedValue(130);
      readsOf.revisionGroupBy.mockResolvedValue([{ author: "a" }, { author: "b" }, { author: "c" }]);

      await expect(ixwikiGetSiteStats()).resolves.toEqual({
        articles: 4800,
        pages: 12000,
        edits: 75000,
        images: 7500,
        users: 130,
        activeUsers: 3,
      });
      expect(readsOf.revisionGroupBy.mock.calls[0]![0].where.createdAt.gte).toBeInstanceOf(Date);
    });

    it("counts the edits and the editors of edits that went live: a parked revision is neither", async () => {
      readsOf.articleCount.mockResolvedValue(1);
      readsOf.revisionCount.mockResolvedValue(1);
      readsOf.assetCount.mockResolvedValue(1);
      readsOf.userCount.mockResolvedValue(1);
      readsOf.revisionGroupBy.mockResolvedValue([]);

      await ixwikiGetSiteStats();

      expect(readsOf.revisionCount.mock.calls[0]![0].where).toEqual({ source: "ixwiki", parked: false });
      expect(readsOf.revisionGroupBy.mock.calls[0]![0].where).toMatchObject({
        source: "ixwiki",
        parked: false,
      });
    });

    it("reports zero as zero and a failed count as null, with no stand-in numbers", async () => {
      readsOf.articleCount.mockResolvedValue(0);
      readsOf.revisionCount.mockRejectedValue(new Error("db down"));
      readsOf.assetCount.mockResolvedValue(0);
      readsOf.userCount.mockRejectedValue(new Error("db down"));
      readsOf.revisionGroupBy.mockRejectedValue(new Error("db down"));

      await expect(ixwikiGetSiteStats()).resolves.toEqual({
        articles: 0,
        pages: 0,
        edits: null,
        images: 0,
        users: null,
        activeUsers: null,
      });
    });
  });
});

describe("lists never show a deleted page", () => {
  type Delegate = Record<string, jest.Mock>;
  const listsDb = jest.requireMock<{
    db: Record<
      | "wikiArticle"
      | "wikiRevision"
      | "wikiLink"
      | "wikiCategory"
      | "wikiCategoryMember"
      | "wikiAsset"
      | "wikiAccountLink"
      | "wikiTemplate"
      | "user",
      Delegate
    > & { $queryRawUnsafe: jest.Mock; $queryRaw: jest.Mock };
  }>("~/server/db").db;

  const published = { status: "PUBLISHED" };

  beforeEach(() => {
    jest.clearAllMocks();
    listsDb.wikiArticle.findMany.mockResolvedValue([]);
    listsDb.wikiArticle.findUnique.mockResolvedValue(null);
    listsDb.wikiArticle.count.mockResolvedValue(0);
    listsDb.wikiRevision.findMany.mockResolvedValue([]);
    listsDb.wikiRevision.count.mockResolvedValue(0);
    listsDb.wikiLink.findMany.mockResolvedValue([]);
    listsDb.wikiCategoryMember.findMany.mockResolvedValue([]);
    listsDb.wikiAsset.count.mockResolvedValue(0);
    listsDb.wikiAccountLink.findMany.mockResolvedValue([]);
    listsDb.user.count.mockResolvedValue(0);
    listsDb.$queryRaw.mockResolvedValue([]);
    listsDb.wikiTemplate.findMany.mockResolvedValue([]);
    listsDb.$queryRawUnsafe.mockResolvedValue([]);
  });

  describe("search", () => {
    it("spotlight search looks at published pages only", async () => {
      await NativeSearchService.spotlightSearch("Caph", "ixwiki", 5);

      const [sql] = listsDb.$queryRawUnsafe.mock.calls[0] as [string];
      expect(sql).toContain("status = 'PUBLISHED'");
    });

    it("full-text search filters the page query and the count query", async () => {
      await NativeSearchService.fulltextSearch("kingdom of caphiria", "ixwiki", 10);

      const [pageSql, countSql] = listsDb.$queryRawUnsafe.mock.calls.map((call) => call[0] as string);
      expect(pageSql).toContain("a.status = 'PUBLISHED'");
      expect(countSql).toContain("a.status = 'PUBLISHED'");
    });
    // last: it leaves the search on its slow queries (the indexes "are missing") for the rest of the file
  });

  describe("categories", () => {
    it("lists only published members and counts only those", async () => {
      listsDb.wikiCategory.findFirst.mockResolvedValue({
        id: "c1",
        slug: "nations",
        name: "Nations",
        description: null,
        parent: null,
        children: [{ id: "c2", slug: "kingdoms", name: "Kingdoms", _count: { members: 0 } }],
        members: [],
      });

      await CategoryService.getCategoryDetails("Nations");

      const include = listsDb.wikiCategory.findFirst.mock.calls[0]?.[0].include;
      expect(include.members.where).toEqual({ article: published });
      expect(include.children.select._count.select.members.where).toEqual({ article: published });
      expect(listsDb.wikiCategoryMember.findMany.mock.calls.map((c) => c[0].where.article)).toEqual([
        published,
        published,
      ]);
    });
  });

  describe("activity and links", () => {
    it("recent changes skip revisions of deleted pages", async () => {
      await ixwikiRecentChanges(10);
      expect(listsDb.wikiRevision.findMany.mock.calls[0]?.[0].where.article).toMatchObject(published);
    });

    it("contributions and created pages skip deleted pages", async () => {
      await ixwikiGetUserContribs("Amy", 10, 0);
      await ixwikiGetUserCreatedPages("Amy", 10);
      expect(listsDb.wikiRevision.findMany.mock.calls[0]?.[0].where.article).toMatchObject(published);
      // Created pages are one raw query over the pages' first revisions, which names the status.
      const [strings] = listsDb.$queryRaw.mock.calls[0] as [TemplateStringsArray];
      expect(strings.join("$")).toContain(`a."status" = 'PUBLISHED'`);
    });

    it("backlinks come from published pages, and a link to a deleted page is a red link", async () => {
      await LinkGraphService.getBacklinks("Caphiria");
      expect(listsDb.wikiLink.findMany.mock.calls[0]?.[0].where.sourceArticle).toMatchObject(
        published
      );

      // The render replaces an article's links; a target is resolved among published pages only.
      const tx = {
        ...listsDb,
        wikiLink: { ...listsDb.wikiLink, deleteMany: jest.fn(), createMany: jest.fn() },
      };
      await LinkGraphService.replaceLinks(tx as never, "a1", "ixwiki", [{ title: "Caphiria" }]);
      expect(listsDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject(published);
    });

    it("a redirect from a deleted page is not followed", async () => {
      await ixwikiResolveRedirect("Old name");
      // Both the exact-title and the slug-variant lookup are raw SQL that names the status.
      const queries = listsDb.$queryRaw.mock.calls.map(([strings]) => strings.join("$"));
      expect(queries).toHaveLength(2);
      for (const query of queries) expect(query).toContain(`"status" = 'PUBLISHED'`);
    });
  });

  describe("counts and usage", () => {
    it("media usage lists published pages only", async () => {
      await PageManagementService.getMediaUsage("Flag.png");
      expect(listsDb.wikiArticle.findMany.mock.calls[0]?.[0].where).toMatchObject(published);
    });
  });
});
