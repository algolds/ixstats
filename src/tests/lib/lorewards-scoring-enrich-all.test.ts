/** @jest-environment node */
/** The dividend needs every editor's score, not just the top ten the contest enriches. */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRevision: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(1) },
    wikiLink: { count: jest.fn().mockResolvedValue(0) },
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { DEFAULT_WEIGHTS, scoreDailyWikiOS } from "~/lib/lorewards/scoring";

const revisions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    articleId: `a${i}`,
    author: `Editor${i}`,
    byteSize: 5000,
    byteDelta: 1000 + i,
    minor: false,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    article: { id: `a${i}`, title: `Page ${i}`, slug: `page_${i}` },
  }));

describe("scoreDailyWikiOS enrichAll", () => {
  beforeEach(() => {
    jest.mocked(db.wikiRevision.findMany).mockReset();
    jest.mocked(db.wikiLink.count).mockClear();
  });

  it("returns and enriches only the top ten by default", async () => {
    jest.mocked(db.wikiRevision.findMany).mockResolvedValue(revisions(12) as never);
    const r = await scoreDailyWikiOS("2026-10-01", DEFAULT_WEIGHTS);
    expect(r.candidates).toHaveLength(10);
    expect(db.wikiLink.count).toHaveBeenCalledTimes(10);
  });

  it("enriches and returns every candidate when asked", async () => {
    jest.mocked(db.wikiRevision.findMany).mockResolvedValue(revisions(12) as never);
    const r = await scoreDailyWikiOS("2026-10-01", DEFAULT_WEIGHTS, { enrichAll: true });
    expect(r.candidates).toHaveLength(12);
    expect(db.wikiLink.count).toHaveBeenCalledTimes(12);
    expect(r.candidates.every((c) => c.proseRatio !== -1)).toBe(true);
  });

  it("carries the WikiOS accounts of each candidate's scored revisions, for the dividend", async () => {
    const [first] = revisions(1);
    jest.mocked(db.wikiRevision.findMany).mockResolvedValue([
      { ...first, id: "r0", authorId: "u1" },
      { ...first, id: "r1", authorId: null },
      { ...first, id: "r2", authorId: "u1" },
    ] as never);
    const r = await scoreDailyWikiOS("2026-10-01", DEFAULT_WEIGHTS, { enrichAll: true });
    expect(r.candidates.map((c) => c.authorIds)).toEqual([["u1", null]]);
    const args = jest.mocked(db.wikiRevision.findMany).mock.calls[0]?.[0];
    expect(args?.select).toHaveProperty("authorId", true);
  });

  it("does not read the revision text it never uses", async () => {
    jest.mocked(db.wikiRevision.findMany).mockResolvedValue([] as never);
    await scoreDailyWikiOS("2026-10-01", DEFAULT_WEIGHTS);
    const args = jest.mocked(db.wikiRevision.findMany).mock.calls[0]?.[0];
    expect(args?.select).not.toHaveProperty("wikitext");
  });
});
