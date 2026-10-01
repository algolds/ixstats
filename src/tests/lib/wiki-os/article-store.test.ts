import { db } from "~/server/db";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";
import {
  getArticleWikitextShadow,
  getArticleHistoryShadow,
  getArticleAuthors,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";

const mockGetArticleWikitext = jest.fn();
const mockGetCurrentRevMeta = jest.fn();
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

/** A request to IxWiki's MediaWiki is recorded (and rejected) even where the code under test would swallow it. */
let guard: FetchGuard;

beforeEach(() => {
  guard = installFetchGuard();
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

afterEach(() => guard.restore());

test("fresh shadow row is served without touching MediaWiki", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(row({ updatedAt: new Date("2026-06-01T00:00:00Z") }));

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toMatchObject({ wikitext: "shadow body", fromShadow: true, stale: false });
  expect(mockGetArticleWikitext).not.toHaveBeenCalled();
});

test("a sister wiki's missing shadow is fetched from that wiki", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockGetArticleWikitext.mockResolvedValue({ wikitext: "fresh body", pageId: 42, length: 10 });

  const res = await getArticleWikitextShadow("Foo", "iiwiki");

  expect(mockGetArticleWikitext).toHaveBeenCalledWith("Foo", "iiwiki");
  expect(res).toMatchObject({ wikitext: "fresh body", revid: 42, fromShadow: false });
});

test("an IxWiki page Postgres lacks is null: MediaWiki is not asked (plan 418)", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockGetArticleWikitext.mockResolvedValue({ wikitext: "fresh body", pageId: 42, length: 10 });

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toBeNull();
  expect(mockGetArticleWikitext).not.toHaveBeenCalled();
});

test("a sister wiki's failure falls back to null when not found in DB", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockGetArticleWikitext.mockRejectedValue(new Error("ECONNREFUSED"));

  const res = await getArticleWikitextShadow("Foo", "iiwiki").catch(() => null);

  expect(res).toBeNull();
});

test("a sister wiki's page that is not there returns null when not in DB", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockGetArticleWikitext.mockResolvedValue(null);

  const res = await getArticleWikitextShadow("Foo", "iiwiki");

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
  expect(guard.calls()).toEqual([]);
  expect(mockWikiRevisionFindMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { articleId: "art1", parked: false } })
  );
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

test("history lists ask for parked revisions and get them flagged; everything else never sees them", async () => {
  mockWikiArticleFindFirst.mockResolvedValue(row({ id: "art1" }));
  mockWikiRevisionFindMany.mockResolvedValue([
    {
      id: "rev-2",
      mwRevId: 9002,
      articleId: "art1",
      createdAt: new Date("2026-06-02T00:00:00Z"),
      author: "carol",
      summary: "conflicting edit",
      wikitext: "other",
      minor: false,
      byteSize: 5,
      byteDelta: 1,
      parked: true,
    },
  ]);

  const res = await getArticleHistoryShadow("Foo", 50, undefined, "ixwiki", {
    includeParked: true,
  });

  expect(res.revisions[0]).toMatchObject({ revid: "9002", parked: true });
  expect(guard.calls()).toEqual([]);
  expect(mockWikiRevisionFindMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { articleId: "art1" } })
  );
});

test("a page with no local revisions has an empty history: MediaWiki is not asked (plan 418)", async () => {
  mockWikiRevisionFindMany.mockResolvedValue([]);

  const res = await getArticleHistoryShadow("Foo", 50);

  expect(res).toEqual({ revisions: [], hasMore: false, fromShadow: true });
  expect(guard.calls()).toEqual([]);
});

describe("getArticleAuthors: a sister wiki's lookup is cached, single-flight and limited (NEW-5)", () => {
  const mwData = (title: string) => ({
    creator: { username: `creator-of-${title}`, timestamp: "2026-01-01T00:00:00Z" },
    lastEditor: { username: "editor", timestamp: "2026-02-01T00:00:00Z" },
    revisions: [],
    contributors: [{ username: "editor", editCount: 1 }],
    totalContributors: 1,
  });

  it("calls MediaWiki once for repeated views, with a short timeout", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("CachedPage"));

    const first = await getArticleAuthors("CachedPage", "iiwiki");
    const second = await getArticleAuthors("cachedpage", "iiwiki");

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
    expect(mockFetchAuthors).toHaveBeenCalledWith("CachedPage", "iiwiki", 250, 2500);
    expect(first.creator).toMatchObject({ username: "creator-of-CachedPage" });
    expect(second.creator).toMatchObject({ username: "creator-of-CachedPage" });
  });

  it("shares one in-flight request between concurrent views", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("ConcurrentPage"));

    await Promise.all([getArticleAuthors("ConcurrentPage", "iiwiki"), getArticleAuthors("ConcurrentPage", "iiwiki")]);

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
  });

  it("remembers a failed lookup briefly instead of retrying every view", async () => {
    mockFetchAuthors.mockRejectedValue(new Error("timeout"));

    await getArticleAuthors("DownPage", "iiwiki");
    await getArticleAuthors("DownPage", "iiwiki");

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
  });

  it("takes the title as already decoded: a '%' in it neither throws nor is decoded again (plan 403)", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("100% Pure"));

    await expect(getArticleAuthors("100% Pure", "iiwiki")).resolves.toMatchObject({
      creator: { username: "creator-of-100% Pure" },
    });
    await getArticleAuthors("100%25 Pure", "iiwiki");

    expect(mockFetchAuthors).toHaveBeenCalledWith("100% Pure", "iiwiki", 250, 2500);
    expect(mockFetchAuthors).toHaveBeenCalledWith("100%25 Pure", "iiwiki", 250, 2500);
  });

  it("still overlays a newer Postgres edit on the cached MediaWiki data", async () => {
    mockFetchAuthors.mockResolvedValue(mwData("OverlayPage"));
    mockWikiRevisionFindFirst.mockResolvedValue({
      author: "WikiOSUser",
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });

    await getArticleAuthors("OverlayPage", "iiwiki");
    const again = await getArticleAuthors("OverlayPage", "iiwiki");

    expect(mockFetchAuthors).toHaveBeenCalledTimes(1);
    expect(again.lastEditor).toMatchObject({ username: "WikiOSUser" });
  });

  it("never has more than a few lookups in flight: a further title is answered from Postgres, without an error", async () => {
    const releases: Array<() => void> = [];
    mockFetchAuthors.mockImplementation(
      (title: string) => new Promise((resolve) => releases.push(() => resolve(mwData(title))))
    );
    mockWikiArticleFindFirst.mockResolvedValue(null);

    const lookups = Array.from({ length: 7 }, (_, n) => getArticleAuthors(`Fan out ${n}`, "iiwiki"));
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
    for (let n = 0; n < 125; n++) results.push(await getArticleAuthors(`Steady ${n}`, "iiwiki"));

    expect(mockFetchAuthors).toHaveBeenCalledTimes(120);
    expect(results.filter((r) => r.creator === null)).toHaveLength(5);
    nowSpy.mockRestore();
  });
});
