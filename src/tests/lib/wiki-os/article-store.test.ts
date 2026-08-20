// Tests the shadow read-through decision logic: fresh hit, stale refetch,
// MediaWiki-down fallback, and page-deleted handling.

const mockDb = {
  wikiArticle: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  wikiRevision: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};
const mockGetArticleWikitext = jest.fn();
const mockGetCurrentRevMeta = jest.fn();
const mockGetPageHistory = jest.fn();
const mockGetRevisionWikitext = jest.fn();
const mockGetRecentChanges = jest.fn();

jest.mock("~/server/db", () => ({ db: mockDb }));
jest.mock("~/lib/wiki-os/bridge", () => ({
  getArticleWikitext: (...a: unknown[]) => mockGetArticleWikitext(...a),
  getCurrentRevMeta: (...a: unknown[]) => mockGetCurrentRevMeta(...a),
  getPageHistory: (...a: unknown[]) => mockGetPageHistory(...a),
  getRevisionWikitext: (...a: unknown[]) => mockGetRevisionWikitext(...a),
  getRecentChanges: (...a: unknown[]) => mockGetRecentChanges(...a),
}));

import {
  getArticleWikitextShadow,
  recordArticleRevision,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/article-store";
import { syncWikiRecentChanges } from "~/server/cron/sync-wiki-recentchanges";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "1",
  source: "ixwiki",
  title: "Foo",
  wikitext: "shadow body",
  revisionId: 10,
  revTimestamp: "2026-01-01T00:00:00Z",
  syncedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.wikiArticle.upsert.mockResolvedValue(row());
  mockDb.wikiArticle.delete.mockResolvedValue(undefined);
  mockDb.wikiArticle.deleteMany.mockResolvedValue(undefined);
});

test("fresh shadow row is served without touching MediaWiki", async () => {
  mockDb.wikiArticle.findUnique.mockResolvedValue(row({ syncedAt: new Date() }));

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toMatchObject({ wikitext: "shadow body", fromShadow: true, stale: false });
  expect(mockGetArticleWikitext).not.toHaveBeenCalled();
});

test("stale/missing shadow refetches from MediaWiki and backfills", async () => {
  mockDb.wikiArticle.findUnique.mockResolvedValue(null);
  mockGetArticleWikitext.mockResolvedValue({ wikitext: "fresh body", pageId: 1, length: 10 });
  mockGetCurrentRevMeta.mockResolvedValue({ revid: 42, timestamp: "2026-06-01T00:00:00Z" });

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toMatchObject({ wikitext: "fresh body", revid: 42, fromShadow: false });
  expect(mockDb.wikiArticle.upsert).toHaveBeenCalled();
});

test("MediaWiki failure falls back to the last-known shadow copy", async () => {
  mockDb.wikiArticle.findUnique.mockResolvedValue(
    row({ syncedAt: new Date(Date.now() - 60 * 60 * 1000) }) // stale → forces refetch path
  );
  mockGetArticleWikitext.mockRejectedValue(new Error("ECONNREFUSED"));

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toMatchObject({ wikitext: "shadow body", stale: true, fromShadow: true });
});

test("page deleted on MediaWiki drops the shadow and returns null", async () => {
  mockDb.wikiArticle.findUnique.mockResolvedValue(
    row({ syncedAt: new Date(Date.now() - 60 * 60 * 1000) })
  );
  mockGetArticleWikitext.mockResolvedValue(null);

  const res = await getArticleWikitextShadow("Foo");

  expect(res).toBeNull();
  expect(mockDb.wikiArticle.delete).toHaveBeenCalled();
});

// ──────────────────────────────────────────────
// Stage 2b — write-through + revision history
// ──────────────────────────────────────────────

test("recordArticleRevision upserts the article and inserts a revision", async () => {
  mockDb.wikiArticle.upsert.mockResolvedValue(row({ id: "art1" }));
  mockDb.wikiRevision.create.mockResolvedValue({ id: "rev1" });

  const ok = await recordArticleRevision({
    title: "Foo Bar",
    wikitext: "new body",
    mwRevId: 99,
    author: "alice",
    summary: "tweak",
    minor: true,
  });

  expect(ok).toBe(true);
  // Title normalized to underscores for the shadow upsert.
  expect(mockDb.wikiArticle.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ where: { source_title: { source: "ixwiki", title: "Foo_Bar" } } })
  );
  expect(mockDb.wikiRevision.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ articleId: "art1", mwRevId: 99, wikitext: "new body" }),
    })
  );
});

test("recordArticleRevision returns false (no throw) when the table is missing", async () => {
  mockDb.wikiArticle.upsert.mockRejectedValue(new Error("relation does not exist"));

  const ok = await recordArticleRevision({ title: "Foo", wikitext: "x" });

  expect(ok).toBe(false);
});

test("history read-through serves local revisions when present", async () => {
  mockDb.wikiArticle.findUnique.mockResolvedValue({ id: "art1" });
  mockDb.wikiRevision.findMany.mockResolvedValue([
    {
      mwRevId: 42,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      author: "bob",
      summary: "edit",
      wikitext: "body",
      minor: false,
    },
  ]);

  const res = await getArticleHistoryShadow("Foo", 50);

  expect(res.revisions[0]).toMatchObject({ revid: 42, user: "bob", comment: "edit" });
  expect(mockGetPageHistory).not.toHaveBeenCalled();
});

test("history read-through falls back to MySQL when no local revisions", async () => {
  mockDb.wikiArticle.findUnique.mockResolvedValue(null);
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
  mockDb.wikiRevision.findFirst.mockResolvedValue({ id: "existing" }); // already known

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
  mockDb.wikiRevision.findFirst.mockResolvedValue(null); // not yet known
  mockGetArticleWikitext.mockResolvedValue({ wikitext: "bar body", pageId: 2, length: 8 });
  mockDb.wikiArticle.upsert.mockResolvedValue(row({ id: "art2" }));
  mockDb.wikiRevision.create.mockResolvedValue({ id: "rev2" });

  const res = await syncWikiRecentChanges();

  expect(res.recorded).toBe(1);
  expect(mockDb.wikiRevision.create).toHaveBeenCalled();
});
