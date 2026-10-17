/** @jest-environment node */
/**
 * Lorewards is IxWiki's contest: only ixwiki revisions score, so a name can only win from IxWiki edits (which is all
 * `resolveLorewardPlace` reads when it pays a place).
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRevision: { findMany: jest.fn(), count: jest.fn() },
    wikiLink: { count: jest.fn().mockResolvedValue(0) },
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { DEFAULT_WEIGHTS, scoreDailyWikiOS } from "~/lib/lorewards/scoring";

interface Row {
  id: string;
  source: string;
  articleId: string;
  author: string;
  byteSize: number;
  byteDelta: number;
  minor: boolean;
  createdAt: Date;
  article: { id: string; title: string; slug: string };
}

const row = (id: string, source: string, author: string, byteDelta: number): Row => ({
  id,
  source,
  articleId: `a-${id}`,
  author,
  byteSize: byteDelta,
  byteDelta,
  minor: false,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  article: { id: `a-${id}`, title: `Page ${id}`, slug: `page_${id}` },
});

const ROWS = [
  row("big", "iiwiki", "Elsewhere", 90_000),
  row("small", "ixwiki", "Local", 5_000),
  row("second", "ixwiki", "Neighbour", 2_000),
];

/** Rows matching a `where` the way Postgres would, for the fields the scorer filters on. */
const matching = (where: { source?: string; articleId?: string; author?: unknown }) =>
  ROWS.filter(
    (r) =>
      (where.source === undefined || r.source === where.source) &&
      (where.articleId === undefined || r.articleId === where.articleId) &&
      (typeof where.author !== "string" || r.author === where.author)
  );

describe("scoreDailyWikiOS", () => {
  beforeEach(() => {
    jest
      .mocked(db.wikiRevision.findMany)
      .mockReset()
      .mockImplementation((async ({ where }: { where: Parameters<typeof matching>[0] }) =>
        matching(where)) as never);
    jest
      .mocked(db.wikiRevision.count)
      .mockReset()
      .mockImplementation(
        (async ({ where }: { where: Parameters<typeof matching>[0] }) =>
          matching(where).length) as never
      );
  });

  it("does not let an iiwiki revision win, however large", async () => {
    const day = await scoreDailyWikiOS("2026-10-01", DEFAULT_WEIGHTS);

    expect(day.winner?.user).toBe("Local");
    expect(day.runnerUp?.user).toBe("Neighbour");
    expect(day.candidates.map((c) => c.user)).not.toContain("Elsewhere");
    expect(day.editCount).toBe(2);
  });

  it("asks for ixwiki revisions only, for the day and for each candidate's edit depth", async () => {
    await scoreDailyWikiOS("2026-10-01", DEFAULT_WEIGHTS);

    expect(jest.mocked(db.wikiRevision.findMany).mock.calls[0]?.[0]?.where).toMatchObject({
      source: "ixwiki",
    });
    for (const [args] of jest.mocked(db.wikiRevision.count).mock.calls) {
      expect(args?.where).toMatchObject({ source: "ixwiki" });
    }
  });
});
