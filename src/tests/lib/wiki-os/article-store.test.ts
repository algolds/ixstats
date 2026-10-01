import { db } from "~/server/db";
import {
  getArticleWikitextShadow,
  getArticleHistoryShadow,
  getArticleAuthors,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";

const mockGetArticleWikitext = jest.fn();
const mockGetCurrentRevMeta = jest.fn();
const mockGetPageHistory = jest.fn();
const mockGetRevisionWikitext = jest.fn();

const mockWikiArticleFindFirst = jest.fn();
const mockWikiArticleFindMany = jest.fn();
const mockWikiArticleUpsert = jest.fn();
const mockWikiArticleDelete = jest.fn();
const mockWikiArticleDeleteMany = jest.fn();
const mockWikiRevisionCreate = jest.fn();
const mockWikiRevisionFindFirst = jest.fn();
const mockWikiRevisionFindMany = jest.fn();
const mockTransaction = jest.fn();
const mockFetchAuthors = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    $transaction: (...args: any[]) => mockTransaction(...args),
    wikiArticle: {
      findFirst: (...args: any[]) => mockWikiArticleFindFirst(...args),
      findUnique: (...args: any[]) => mockWikiArticleFindFirst(...args),
      findMany: (...args: any[]) => mockWikiArticleFindMany(...args),
      upsert: (...args: any[]) => mockWikiArticleUpsert(...args),
      delete: (...args: any[]) => mockWikiArticleDelete(...args),
      deleteMany: (...args: any[]) => mockWikiArticleDeleteMany(...args),
    },
    wikiRevision: {
      create: (...args: any[]) => mockWikiRevisionCreate(...args),
      findFirst: (...args: any[]) => mockWikiRevisionFindFirst(...args),
      findMany: (...args: any[]) => mockWikiRevisionFindMany(...args),
    },
  },
}));

jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleWikitext: (...a: unknown[]) => mockGetArticleWikitext(...a),
  getCurrentRevMeta: (...a: unknown[]) => mockGetCurrentRevMeta(...a),
  getPageHistory: (...a: unknown[]) => mockGetPageHistory(...a),
  getRevisionWikitext: (...a: unknown[]) => mockGetRevisionWikitext(...a),
}));

jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge/http-reader", () => ({
  fetchMediaWikiPageAuthorsAndRevisions: (...a: unknown[]) => mockFetchAuthors(...a),
}));

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "1",
  source: "ixwiki",
  title: "Foo",
  wikitext: "shadow body",
  contentHtml: "<p>shadow body</p>",
  revisionId: 10,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  revTimestamp: "2026-01-01T00:00:00Z",
  syncedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (cb: (tx: any) => any) => {
    if (typeof cb === "function") {
      return cb(db);
    }
    return Promise.all(cb);
  });
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockWikiArticleFindMany.mockResolvedValue([]);
  mockWikiArticleUpsert.mockResolvedValue(row());
  mockWikiArticleDelete.mockResolvedValue(undefined);
  mockWikiArticleDeleteMany.mockResolvedValue(undefined);
  mockWikiRevisionCreate.mockResolvedValue({ id: "rev-1" });
  mockWikiRevisionFindFirst.mockResolvedValue(null);
  mockWikiRevisionFindMany.mockResolvedValue([]);
});

test("fresh shadow row is served without touching MediaWiki", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(row({ updatedAt: new Date("2026-06-01T00:00:00Z") }));

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toMatchObject({ wikitext: "shadow body", fromShadow: true, stale: false });
  expect(mockGetArticleWikitext).not.toHaveBeenCalled();
});

test("stale/missing shadow refetches from MediaWiki and backfills", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockGetArticleWikitext.mockResolvedValue({ wikitext: "fresh body", pageId: 42, length: 10 });
  mockGetCurrentRevMeta.mockResolvedValue({ revid: 42, timestamp: "2026-06-01T00:00:00Z" });

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toMatchObject({ wikitext: "fresh body", revid: 42, fromShadow: false });
});

test("MediaWiki failure falls back to null when not found in DB", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockGetArticleWikitext.mockRejectedValue(new Error("ECONNREFUSED"));

  const res = await getArticleWikitextShadow("Foo").catch(() => null);

  expect(res).toBeNull();
});

test("page deleted on MediaWiki returns null when not in DB", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockGetArticleWikitext.mockResolvedValue(null);

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toBeNull();
});

test("history read-through serves local revisions when present", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(row({ id: "art1" }));
  mockWikiRevisionFindMany.mockResolvedValue([
    {
      id: "rev-1",
      articleId: "art1",
      createdAt: new Date("2026-06-01T00:00:00Z"),
      author: "bob",
      summary: "edit",
      wikitext: "body",
      minor: false,
      byteSize: 4,
      byteDelta: -2,
    },
    {
      id: "rev-0",
      mwRevId: 9001,
      articleId: "art1",
      createdAt: new Date("2026-05-01T00:00:00Z"),
      author: "alice",
      summary: "synced",
      wikitext: "bodyxx",
      minor: false,
      byteSize: 6,
      byteDelta: 6,
    },
  ]);

  const res = await getArticleHistoryShadow("Foo", 50);

  // Native edits are referenced by row id, MediaWiki-synced ones by rev_id.
  expect(res.revisions[0]).toMatchObject({
    revid: "rev-1",
    user: "bob",
    comment: "edit",
    byteDelta: -2,
  });
  expect(res.revisions[1]).toMatchObject({ revid: "9001", byteDelta: 6 });
  expect(mockWikiRevisionFindMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { articleId: "art1" } })
  );
  expect(mockGetPageHistory).not.toHaveBeenCalled();
});

test("history asks for one more revision than the page to tell whether an older page exists", async () => {
  const row = (n: number) => ({
    id: `rev-${n}`,
    mwRevId: null,
    articleId: "art1",
    createdAt: new Date(`2026-06-0${n}T00:00:00Z`),
    author: "bob",
    summary: "",
    minor: false,
    byteSize: n,
    byteDelta: 1,
    sha1: null,
  });
  mockWikiArticleFindFirst.mockResolvedValue(row({ id: "art1" }));
  mockWikiRevisionFindMany.mockResolvedValue([row(3), row(2), row(1)]);

  const res = await getArticleHistoryShadow("Foo", 2);

  expect(mockWikiRevisionFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  expect(res.revisions.map((r) => r.revid)).toEqual(["rev-3", "rev-2"]);
  expect(res.hasMore).toBe(true);

  mockWikiRevisionFindMany.mockResolvedValue([row(2), row(1)]);
  expect((await getArticleHistoryShadow("Foo", 2)).hasMore).toBe(false);
});

test("a page after a cursor is answered from PostgreSQL only, empty past the oldest revision", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(row({ id: "art1" }));
  mockWikiRevisionFindFirst.mockResolvedValue({ id: "rev-1" });
  mockWikiRevisionFindMany.mockResolvedValue([]);

  const res = await getArticleHistoryShadow("Foo", 50, { before: "rev-1" });

  expect(res).toEqual({ revisions: [], hasMore: false, fromShadow: true });
  expect(mockGetPageHistory).not.toHaveBeenCalled();
});

test("history read-through falls back to MediaWiki bridge when no local revisions", async () => {
  mockWikiRevisionFindMany.mockResolvedValue([]);
  mockGetPageHistory.mockResolvedValue([
    {
      rev_id: 7,
      rev_timestamp: "2026-06-01T00:00:00Z",
      rev_user_text: "carol",
      rev_comment: "",
      rev_len: 10,
      rev_minor_edit: 0,
      diff: 3,
    },
  ]);

  const res = await getArticleHistoryShadow("Foo", 50);

  expect(mockGetPageHistory).toHaveBeenCalled();
  expect(res.revisions[0]).toMatchObject({ revid: "7", user: "carol", byteDelta: 3 });
});

describe("getArticleAuthors MediaWiki lookup caching (NEW-5)", () => {
  const mwData = (title: string) => ({
    creator: { username: `creator-of-${title}`, timestamp: "2026-01-01T00:00:00Z" },
    lastEditor: { username: "editor", timestamp: "2026-02-01T00:00:00Z" },
    revisions: [],
    contributors: [{ username: "editor", editCount: 1 }],
    totalContributors: 1,
  });

  it("calls MediaWiki once for repeated views, with a short timeout", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("CachedPage"));

    const first = await getArticleAuthors("CachedPage");
    const second = await getArticleAuthors("cachedpage");

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
    expect(mockFetchAuthors).toHaveBeenCalledWith("CachedPage", "ixwiki", 250, 2500);
    expect(first.creator).toMatchObject({ username: "creator-of-CachedPage" });
    expect(second.creator).toMatchObject({ username: "creator-of-CachedPage" });
  });

  it("shares one in-flight request between concurrent views", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("ConcurrentPage"));

    await Promise.all([getArticleAuthors("ConcurrentPage"), getArticleAuthors("ConcurrentPage")]);

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
  });

  it("remembers a failed lookup briefly instead of retrying every view", async () => {
    mockFetchAuthors.mockRejectedValue(new Error("timeout"));

    await getArticleAuthors("DownPage");
    await getArticleAuthors("DownPage");

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
  });

  it("takes the title as already decoded: a '%' in it neither throws nor is decoded again (plan 403)", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("100% Pure"));

    await expect(getArticleAuthors("100% Pure")).resolves.toMatchObject({
      creator: { username: "creator-of-100% Pure" },
    });
    await getArticleAuthors("100%25 Pure");

    expect(mockFetchAuthors).toHaveBeenCalledWith("100% Pure", "ixwiki", 250, 2500);
    expect(mockFetchAuthors).toHaveBeenCalledWith("100%25 Pure", "ixwiki", 250, 2500);
  });

  it("still overlays a newer Postgres edit on the cached MediaWiki data", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("OverlayPage"));
    mockWikiRevisionFindFirst.mockResolvedValue({
      author: "WikiOSUser",
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });

    await getArticleAuthors("OverlayPage");
    const again = await getArticleAuthors("OverlayPage");

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
    expect(again.lastEditor).toMatchObject({ username: "WikiOSUser" });
  });

  it("never has more than a few lookups in flight: a further title is answered from Postgres, without an error", async () => {
    const releases: Array<() => void> = [];
    mockFetchAuthors.mockImplementation(
      (title: string) => new Promise((resolve) => releases.push(() => resolve(mwData(title))))
    );
    mockWikiArticleFindFirst.mockResolvedValue(null);

    const lookups = Array.from({ length: 7 }, (_, n) => getArticleAuthors(`Fan out ${n}`));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockFetchAuthors).toHaveBeenCalledTimes(6);
    releases.forEach((release) => release());
    const results = await Promise.all(lookups);
    expect(results.slice(0, 6).every((r) => r.creator?.username?.startsWith("creator-of-"))).toBe(
      true
    );
    expect(results[6]).toMatchObject({ creator: null, totalContributors: 0 });
  });

  it("holds lookups to a steady rate per process", async () => {
    mockFetchAuthors.mockImplementation(async (title: string) => mwData(title));
    mockWikiArticleFindFirst.mockResolvedValue(null);
    const realNow = Date.now.bind(Date);
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => realNow() + 10 * 60 * 1000);
    mockFetchAuthors.mockClear();

    const results = [];
    for (let n = 0; n < 125; n++) results.push(await getArticleAuthors(`Steady ${n}`));

    expect(mockFetchAuthors).toHaveBeenCalledTimes(120);
    expect(results.filter((r) => r.creator === null)).toHaveLength(5);
    nowSpy.mockRestore();
  });
});
