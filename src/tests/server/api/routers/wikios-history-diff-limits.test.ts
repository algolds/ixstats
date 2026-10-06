/** @jest-environment node */
// Plan 413 review: the history and diff reads are anonymous, so they sit behind the public rate
// limiter, and a diff's answer is bounded however large the two texts are.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
  isDatabaseReadOnly: true,
}));
const mockCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));
const mockGetRevisionView = jest.fn();
jest.mock("~/lib/wiki-os/services/revision-view-service", () => ({
  __esModule: true,
  getRevisionView: (...args: unknown[]) => mockGetRevisionView(...args),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosHistoryDiffRouter } from "~/server/api/routers/wikios/history-diff";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";

const caller = () =>
  createCallerFactory(wikiosHistoryDiffRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

const text = (wikitext: string) => ({
  wikitext,
  title: "Foo",
  source: "ixwiki",
  timestamp: "2026-06-01T00:00:00.000Z",
  fromShadow: true as const,
  parked: false,
});

const entry = (revid: string) => ({
  revid,
  user: "u",
  timestamp: "",
  comment: "",
  size: 1,
  byteDelta: 0,
  minor: false,
  sha1: null,
  parked: false,
  textDeleted: false,
  commentDeleted: false,
  userDeleted: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });
  jest.mocked(getArticleHistoryShadow).mockResolvedValue({
    revisions: [entry("2"), entry("1")],
    hasMore: false,
    fromShadow: true,
  });
});

describe("getHistory, getDiff, getRevisionContent and getRevisionHtml are rate limited", () => {
  it("counts each against the public bucket", async () => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(text("a"));
    mockGetRevisionView.mockResolvedValue({ status: "ok", view: { title: "Foo" } });

    await caller().getHistory({ title: "Foo" });
    await caller().getDiff({ torev: "2" });
    await caller().getRevisionContent({ revid: "2" });
    await caller().getRevisionHtml({ ref: "2" });

    expect(mockCheck).toHaveBeenCalledTimes(4);
    for (let call = 1; call <= 4; call++) {
      expect(mockCheck).toHaveBeenNthCalledWith(
        call,
        expect.any(String),
        "public",
        expect.anything()
      );
    }
  });

  it("answers none once the bucket is empty, and does no work", async () => {
    mockCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });

    await expect(caller().getHistory({ title: "Foo" })).rejects.toThrow(/Too many requests/);
    await expect(caller().getDiff({ torev: "2" })).rejects.toThrow(/Too many requests/);
    await expect(caller().getRevisionContent({ revid: "2" })).rejects.toThrow(/Too many requests/);
    await expect(caller().getRevisionHtml({ ref: "2" })).rejects.toThrow(/Too many requests/);

    expect(getArticleHistoryShadow).not.toHaveBeenCalled();
    expect(getRevisionWikitextShadow).not.toHaveBeenCalled();
    expect(mockGetRevisionView).not.toHaveBeenCalled();
  });
});

describe("getDiff answers are bounded", () => {
  it("answers two 2 MB texts of one-character lines in a few hundred bytes, not megabytes", async () => {
    const oneCharLines = (char: string) => Array.from({ length: 1_000_000 }, () => char).join("\n"); // ~2 MB
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(text(oneCharLines("b")))
      .mockResolvedValueOnce(text(oneCharLines("a")));

    const result = await caller().getDiff({ torev: "2" });

    expect(result.tooLarge).toBe(true);
    expect(result.hunks).toEqual([]);
    expect(result.added).toBe(1_000_000);
    expect(result.removed).toBe(1_000_000);
    expect(JSON.stringify(result).length).toBeLessThan(1000);
  });

  it("cuts a diff of more than 5,000 rows to its first hunks and says so", async () => {
    const base = Array.from({ length: 8_000 }, (_, i) => `line ${i}`);
    const edited = base.map((line, i) => (i % 8 === 4 ? `${line} edited` : line));
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(text(edited.join("\n")))
      .mockResolvedValueOnce(text(base.join("\n")));

    const result = await caller().getDiff({ torev: "2" });

    expect(result.truncated).toBe(true);
    expect(result.hunks.flatMap((h) => h.rows).length).toBeLessThanOrEqual(5_000);
    expect(result.added).toBe(1_000);
  });
});

describe("a revision reference is checked at the door", () => {
  it.each(["99999999999", "2147483648", "9".repeat(40), "a/b", "x y", "<b>", ""])(
    "refuses %j as before, torev, fromrev and revid, without reading anything",
    async (ref) => {
      await expect(caller().getHistory({ title: "Foo", before: ref })).rejects.toThrow(
        /Not a revision reference/
      );
      await expect(caller().getDiff({ torev: ref })).rejects.toThrow(/Not a revision reference/);
      await expect(caller().getDiff({ fromrev: ref, torev: "2" })).rejects.toThrow(
        /Not a revision reference/
      );
      await expect(caller().getRevisionContent({ revid: ref })).rejects.toThrow(
        /Not a revision reference/
      );
      expect(getArticleHistoryShadow).not.toHaveBeenCalled();
      expect(getRevisionWikitextShadow).not.toHaveBeenCalled();
    }
  );

  it.each(["1", "2147483647", "r2", "cmabc123def456ghi789jkl012"])("accepts %j", async (ref) => {
    jest.mocked(getRevisionWikitextShadow).mockResolvedValue(text("a"));

    await expect(caller().getHistory({ title: "Foo", before: ref })).resolves.toBeDefined();
    await expect(caller().getDiff({ torev: ref })).resolves.toBeDefined();
  });
});
