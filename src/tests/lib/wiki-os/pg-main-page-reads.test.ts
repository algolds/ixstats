/** @jest-environment node */
/**
 * Plan 413 (item 3): the reads behind the Main Page take only the columns they show and report the
 * counts they could read; a count that fails is null, never a made-up number.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";

const mockRevisionFindMany = jest.fn();
const mockRevisionCount = jest.fn();
const mockRevisionGroupBy = jest.fn();
const mockArticleCount = jest.fn();
const mockAssetCount = jest.fn();
const mockUserCount = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiRevision: {
      findMany: (...a: unknown[]) => mockRevisionFindMany(...a),
      count: (...a: unknown[]) => mockRevisionCount(...a),
      groupBy: (...a: unknown[]) => mockRevisionGroupBy(...a),
    },
    wikiArticle: { count: (...a: unknown[]) => mockArticleCount(...a) },
    wikiAsset: { count: (...a: unknown[]) => mockAssetCount(...a) },
    user: { count: (...a: unknown[]) => mockUserCount(...a) },
  },
}));
jest.mock("~/lib/wiki-os/core", () => ({ MediaAssetService: {} }));

import { ixwikiRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";
import { ixwikiGetSiteStats } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-site";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ixwikiRecentChanges", () => {
  it("selects the revision's metadata and the article's title, summary and image: never a wikitext", async () => {
    mockRevisionFindMany.mockResolvedValue([
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

    const args = mockRevisionFindMany.mock.calls[0]![0];
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
    mockRevisionFindMany.mockResolvedValue([
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
    mockArticleCount.mockResolvedValueOnce(4800).mockResolvedValueOnce(12000);
    mockRevisionCount.mockResolvedValue(75000);
    mockAssetCount.mockResolvedValue(7500);
    mockUserCount.mockResolvedValue(130);
    mockRevisionGroupBy.mockResolvedValue([{ author: "a" }, { author: "b" }, { author: "c" }]);

    await expect(ixwikiGetSiteStats()).resolves.toEqual({
      articles: 4800,
      pages: 12000,
      edits: 75000,
      images: 7500,
      users: 130,
      activeUsers: 3,
    });
    expect(mockRevisionGroupBy.mock.calls[0]![0].where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("counts the edits and the editors of edits that went live: a parked revision is neither", async () => {
    mockArticleCount.mockResolvedValue(1);
    mockRevisionCount.mockResolvedValue(1);
    mockAssetCount.mockResolvedValue(1);
    mockUserCount.mockResolvedValue(1);
    mockRevisionGroupBy.mockResolvedValue([]);

    await ixwikiGetSiteStats();

    expect(mockRevisionCount.mock.calls[0]![0].where).toEqual({ source: "ixwiki", parked: false });
    expect(mockRevisionGroupBy.mock.calls[0]![0].where).toMatchObject({
      source: "ixwiki",
      parked: false,
    });
  });

  it("reports zero as zero and a failed count as null, with no stand-in numbers", async () => {
    mockArticleCount.mockResolvedValue(0);
    mockRevisionCount.mockRejectedValue(new Error("db down"));
    mockAssetCount.mockResolvedValue(0);
    mockUserCount.mockRejectedValue(new Error("db down"));
    mockRevisionGroupBy.mockRejectedValue(new Error("db down"));

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
