import { db } from "~/server/db";
import {
  getArticleWikitextShadow,
  recordArticleRevision,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { syncWikiRecentChanges } from "~/server/cron/sync-wiki-recentchanges";

const mockGetArticleWikitext = jest.fn();
const mockGetCurrentRevMeta = jest.fn();
const mockGetPageHistory = jest.fn();
const mockGetRevisionWikitext = jest.fn();
const mockGetRecentChanges = jest.fn();

const mockWikiArticleFindFirst = jest.fn();
const mockWikiArticleUpsert = jest.fn();
const mockWikiArticleDelete = jest.fn();
const mockWikiArticleDeleteMany = jest.fn();
const mockWikiRevisionCreate = jest.fn();
const mockWikiRevisionFindFirst = jest.fn();
const mockWikiRevisionFindMany = jest.fn();
const mockTransaction = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    $transaction: (...args: any[]) => mockTransaction(...args),
    wikiArticle: {
      findFirst: (...args: any[]) => mockWikiArticleFindFirst(...args),
      findUnique: (...args: any[]) => mockWikiArticleFindFirst(...args),
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
  getRecentChanges: (...a: unknown[]) => mockGetRecentChanges(...a),
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

// ──────────────────────────────────────────────
// Stage 2b — write-through + revision history
// ──────────────────────────────────────────────

test("recordArticleRevision upserts the article and inserts a revision", async () => {
  mockWikiArticleUpsert.mockResolvedValue(row({ id: "art1", title: "Foo_Bar" }));
  mockWikiRevisionCreate.mockResolvedValue({ id: "rev1" });

  const ok = await recordArticleRevision({
    title: "Foo Bar",
    wikitext: "new body",
    mwRevId: 99,
    author: "alice",
    summary: "tweak",
    minor: true,
  });

  expect(ok).toBe(true);
  expect(mockWikiArticleUpsert).toHaveBeenCalled();
  expect(mockWikiRevisionCreate).toHaveBeenCalled();
});

test("recordArticleRevision returns false (no throw) when the table is missing", async () => {
  mockTransaction.mockRejectedValue(new Error("relation does not exist"));

  const ok = await recordArticleRevision({ title: "Foo", wikitext: "x" });

  expect(ok).toBe(false);
});

test("history read-through serves local revisions when present", async () => {
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
    },
  ]);

  const res = await getArticleHistoryShadow("Foo", 50);

  expect(res.revisions[0]).toMatchObject({ revid: 1, user: "bob", comment: "edit" });
  expect(mockGetPageHistory).not.toHaveBeenCalled();
});

test("history read-through falls back to MediaWiki bridge when no local revisions", async () => {
  mockWikiRevisionFindMany.mockResolvedValue([]);
  mockGetPageHistory.mockResolvedValue({ revisions: [{ revid: 7 }], hasMore: false });

  const res = await getArticleHistoryShadow("Foo", 50);

  expect(mockGetPageHistory).toHaveBeenCalled();
  expect(res.revisions[0]).toMatchObject({ revid: 7 });
});

test("recentchanges sync skips a page whose latest mwRevId is already recorded", async () => {
  mockGetRecentChanges.mockResolvedValue([
    {
      title: "Foo",
      user: "carol",
      comment: "c",
      timestamp: "t",
      type: "edit",
      oldLen: 0,
      newLen: 1,
    },
  ]);
  mockGetCurrentRevMeta.mockResolvedValue({ revid: 500, timestamp: "t" });
  mockWikiRevisionFindFirst.mockResolvedValue({ id: "existing" }); // already known

  const res = await syncWikiRecentChanges();

  expect(res.skipped).toBe(1);
  expect(res.recorded).toBe(0);
  expect(mockGetArticleWikitext).not.toHaveBeenCalled();
});

test("recentchanges sync records a page with a new mwRevId", async () => {
  mockGetRecentChanges.mockResolvedValue([
    {
      title: "Bar",
      user: "dave",
      comment: "d",
      timestamp: "t",
      type: "edit",
      oldLen: 0,
      newLen: 1,
    },
  ]);
  mockGetCurrentRevMeta.mockResolvedValue({ revid: 600, timestamp: "t" });
  mockWikiRevisionFindFirst.mockResolvedValue(null); // not yet known
  mockGetArticleWikitext.mockResolvedValue({ wikitext: "bar body", pageId: 2, length: 8 });
  mockWikiArticleUpsert.mockResolvedValue(row({ id: "art2", title: "Bar" }));
  mockWikiRevisionCreate.mockResolvedValue({ id: "rev2" });

  const res = await syncWikiRecentChanges();

  expect(res.recorded).toBe(1);
  expect(mockWikiRevisionCreate).toHaveBeenCalled();
});
