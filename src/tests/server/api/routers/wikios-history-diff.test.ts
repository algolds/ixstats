/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * History and diffs (plan 412, 413): what revision deletion hid stays hidden in the history and both ends of a diff, a
 * deleted page's revisions only for a reader who may see it, page sizes and references bounded and counted against the
 * public bucket, parked edits never a live revision's base; and the diff engine under them: minimal, rebuildable,
 * bounded (lines, rows, 2 MB, mark length), never hanging on unlike texts, never turning line text into markup.
 */
const mockGetRevisionView = jest.fn();
const mockCheck = jest.fn();
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
jest.mock("~/lib/wiki-os/services/revision-view-service", () => ({
  __esModule: true,
  getRevisionView: (...args: unknown[]) => mockGetRevisionView(...args),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { createCallerFactory } from "~/server/api/trpc";
import { resolveDiffRefs } from "~/lib/wiki-os/diff-refs";
import { wikiosHistoryDiffRouter } from "~/server/api/routers/wikios/history-diff";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getArticleHistoryShadow, getRevisionWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { DIFF_MAX_BYTES_PER_SIDE, DIFF_MAX_LINES_PER_SIDE, DIFF_MAX_ROWS, type DiffRow, DiffTooLargeError, diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";

const caller = () =>
  createCallerFactory(wikiosHistoryDiffRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

const revision = (wikitext: string | null) => ({
  wikitext,
  title: "Foo",
  source: "ixwiki",
  timestamp: "2026-06-01T00:00:00.000Z",
  fromShadow: true as const,
  parked: false,
});

const entry = (revid: string, user: string, comment = "") => ({
  revid,
  user,
  timestamp: "",
  comment,
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
  // the public bucket has room (the limits describe empties it)
  mockCheck.mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });
  jest.mocked(getArticleHistoryShadow).mockResolvedValue({
    revisions: [entry("r2", "bob", "second"), entry("r1", "amy", "first")],
    hasMore: false,
    fromShadow: true,
  });
});

describe("wikiosHistoryDiffRouter.getHistory (plan 413)", () => {
  it("hides what MediaWiki revision deletion hid: the hash, the user, the summary", async () => {
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [
        { ...entry("r4", "mallory", "secret"), sha1: "abc", textDeleted: true },
        { ...entry("r3", "mallory", "secret"), sha1: "def", userDeleted: true },
        { ...entry("r2", "mallory", "secret"), sha1: "ghi", commentDeleted: true },
        { ...entry("r1", "amy", "fine"), sha1: "jkl" },
      ],
      hasMore: false,
      fromShadow: true,
    });

    const { revisions } = await caller().getHistory({ title: "Foo" });

    expect(revisions.map(({ revid, user, comment, sha1 }) => [revid, user, comment, sha1])).toEqual(
      [
        ["r4", "mallory", "secret", null],
        ["r3", null, "secret", "def"],
        ["r2", "mallory", null, "ghi"],
        ["r1", "amy", "fine", "jkl"],
      ]
    );
    expect(JSON.stringify(revisions)).not.toMatch(/Deleted/);
  });

  it("hides them in a diff's two ends too", async () => {
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision("one\ntwo"))
      .mockResolvedValueOnce(revision("one"));
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [
        { ...entry("r2", "mallory", "secret"), userDeleted: true },
        { ...entry("r1", "evil", "secret"), commentDeleted: true },
      ],
      hasMore: false,
      fromShadow: true,
    });

    const result = await caller().getDiff({ torev: "r2" });

    expect(result.to).toMatchObject({ revid: "r2", user: null, comment: "secret" });
    expect(result.from).toMatchObject({ revid: "r1", user: "evil", comment: null });
  });
  it("allows up to 500 per request and no more", async () => {
    await expect(caller().getHistory({ title: "Foo", limit: 500 })).resolves.toBeDefined();
    await expect(caller().getHistory({ title: "Foo", limit: 501 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller().getHistory({ title: "Foo", limit: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("wikiosHistoryDiffRouter.getDiff (plan 402, 413)", () => {
  it("diffs a revision against the one before it and returns hunks, never the texts", async () => {
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision("one\ntwo\nthree"))
      .mockResolvedValueOnce(revision("one\nTWO\nthree"));

    const result = await caller().getDiff({ torev: "r2" });

    // `torev` and its neighbour (parked rows too, to know whether it is one), then the live one before it
    expect(getArticleHistoryShadow).toHaveBeenNthCalledWith(1, "Foo", 2, { from: "r2" }, "ixwiki", {
      includeParked: true,
    });
    expect(getArticleHistoryShadow).toHaveBeenNthCalledWith(2, "Foo", 2, { from: "r2" }, "ixwiki");
    expect(result).not.toHaveProperty("oldWikitext");
    expect(result).not.toHaveProperty("newWikitext");
    expect(result).not.toHaveProperty("diffHtml");
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.hunks).toHaveLength(1);
    expect(result.hunks[0]!.rows.map((r) => `${r.type}:${r.content}`)).toEqual([
      "context:one",
      "removed:TWO",
      "added:two",
      "context:three",
    ]);
    expect(result.from).toMatchObject({ revid: "r1", user: "amy", comment: "first" });
    expect(result.to).toMatchObject({ revid: "r2", user: "bob", comment: "second" });
  });
  it("refuses a text over 2 MB with 413 and the reason", async () => {
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision("x".repeat(2 * 1024 * 1024 + 1)))
      .mockResolvedValueOnce(revision("old"));

    await expect(caller().getDiff({ torev: "r2" })).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      message: expect.stringContaining("2 MB"),
    });
  });

  describe("which revision a diff starts from (plan 406)", () => {
    const entry = (revid: string, parked: boolean) => ({
      revid,
      user: "u",
      timestamp: "",
      comment: "",
      size: 1,
      byteDelta: 0,
      minor: false,
      parked,
    });
    const history = [
      entry("r3", false),
      entry("9001", true),
      entry("9000", true),
      entry("r1", false),
    ];

    /** The store as it answers: parked rows only to a caller that asks, a position anchored in what it sees. */
    const fakeStore = (rows: typeof history) =>
      (async (
        _title: string,
        limit?: number,
        position?: { before: string } | { from: string },
        _source?: string,
        options?: { includeParked?: boolean }
      ) => {
        const visible = options?.includeParked ? rows : rows.filter((r) => !r.parked);
        let start = 0;
        if (position) {
          const ref = "before" in position ? position.before : position.from;
          const at = visible.findIndex((r) => r.revid === ref);
          if (at < 0) return { revisions: [], hasMore: false, fromShadow: true as const };
          start = "before" in position ? at + 1 : at;
        }
        return {
          revisions: visible.slice(start, start + (limit ?? 50)),
          hasMore: false,
          fromShadow: true as const,
        };
      }) as never;

    beforeEach(() => {
      jest.mocked(getArticleHistoryShadow).mockImplementation(fakeStore(history));
      jest.mocked(getRevisionWikitextShadow).mockImplementation(async (ref: string) => ({
        ...revision(`text of ${ref}`),
      }));
    });

    it("a live revision is compared with the live one before it, not with a parked edit between them", async () => {
      const result = await caller().getDiff({ torev: "r3" });

      expect(result.from.revid).toBe("r1");
      expect(getRevisionWikitextShadow).toHaveBeenLastCalledWith("r1");
    });
    it("?diff=cur resolves to the live head when the newest row is parked: the default history read leaves it out", async () => {
      jest
        .mocked(getArticleHistoryShadow)
        .mockImplementation(fakeStore([entry("9002", true), ...history]));

      // what the diff view reads (no includeParked) ...
      const { revisions } = await caller().getHistory({ title: "Foo", limit: 100 });
      expect(revisions.map((r) => r.revid)).toEqual(["r3", "r1"]);
      expect(
        resolveDiffRefs(
          { oldid: "r1", diff: "cur" },
          revisions.map((r) => r.revid)
        )
      ).toEqual({ fromrev: "r1", torev: "r3" });

      // ... while the history views ask for the parked rows, to badge them
      const all = await caller().getHistory({ title: "Foo", limit: 100, includeParked: true });
      expect(all.revisions[0]).toMatchObject({ revid: "9002", parked: true });
    });
  });

  it.each<[string, string | null, string | null]>([
    ["the revision being viewed", null, "old"],
    ["the revision it is compared with", "new", null],
  ])("refuses to diff against a placeholder in %s", async (_label, to, from) => {
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision(to))
      .mockResolvedValueOnce(revision(from));

    await expect(caller().getDiff({ torev: "r2" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Revision text has not been imported yet.",
    });
  });
});
describe("wikiosHistoryDiffRouter.getRevisionHtml (plan 412)", () => {
  it("is NOT_FOUND for an unknown revision and PRECONDITION_FAILED for one with no text", async () => {
    mockGetRevisionView.mockResolvedValueOnce({ status: "missing" });
    await expect(caller().getRevisionHtml({ ref: "1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    mockGetRevisionView.mockResolvedValueOnce({ status: "text-unavailable" });
    await expect(caller().getRevisionHtml({ ref: "2" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Revision text has not been imported yet.",
    });
  });

  it("is TOO_MANY_REQUESTS when MediaWiki could not be asked, never a wrong page", async () => {
    mockGetRevisionView.mockRejectedValue(new ThrottledError("Rendering old revisions"));
    await expect(caller().getRevisionHtml({ ref: "3" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("lets only a reader who may see the page see its revisions: a deleted page's are hidden (plan 409)", async () => {
    mockGetRevisionView.mockResolvedValue({ status: "missing" });
    await caller()
      .getRevisionHtml({ ref: "5" })
      .catch(() => undefined);
    const canSee = mockGetRevisionView.mock.calls[0]?.[1] as (title: string) => Promise<boolean>;

    const findUnique = db.wikiArticle.findUnique as jest.Mock;
    findUnique.mockResolvedValueOnce({ status: "ARCHIVED" });
    await expect(canSee("Deleted page")).resolves.toBe(false);
    findUnique.mockResolvedValueOnce({ status: "PUBLISHED" });
    await expect(canSee("Live page")).resolves.toBe(true);
    findUnique.mockResolvedValueOnce(null);
    await expect(canSee("No such page")).resolves.toBe(true); // nothing to hide: the revision's own lookup decides
  });

  it("refuses a reference that cannot be a revision's, without looking it up", async () => {
    for (const ref of ["", "a b", "x;y", "a".repeat(65)]) {
      await expect(caller().getRevisionHtml({ ref })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(mockGetRevisionView).not.toHaveBeenCalled();
  });
});

describe("limits", () => {
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
});

describe("the diff engine", () => {
  const lines = (count: number, prefix = "line"): string[] =>
    Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);

  const rowsOf = (diff: ReturnType<typeof diffWikitext>): DiffRow[] =>
    diff.hunks.flatMap((h) => h.rows);

  /** The newer text rebuilt from every kept and added row of a context-free-of-limits diff. */
  const rebuildNew = (a: string, b: string): string => {
    const { hunks } = diffWikitext(a, b, { context: Infinity });
    return hunks
      .flatMap((h) => h.rows)
      .filter((r) => r.type !== "removed")
      .map((r) => r.content)
      .join("\n");
  };

  const rebuildOld = (a: string, b: string): string => {
    const { hunks } = diffWikitext(a, b, { context: Infinity });
    return hunks
      .flatMap((h) => h.rows)
      .filter((r) => r.type !== "added")
      .map((r) => r.content)
      .join("\n");
  };

  describe("diffWikitext hunks", () => {
    it("keeps 3 lines of context: 2 changes in 1,000 lines are at most 20 rows", () => {
      const base = lines(1000);
      const changed = [...base];
      changed[99] = "line 100 EDITED";
      changed[799] = "line 800 EDITED";

      const diff = diffWikitext(base.join("\n"), changed.join("\n"));

      expect(diff.hunks).toHaveLength(2);
      expect(rowsOf(diff).length).toBeLessThanOrEqual(20);
      expect(diff.added).toBe(2);
      expect(diff.removed).toBe(2);
      // 3 unchanged rows before and after each change
      const first = diff.hunks[0]!.rows;
      expect(first.map((r) => r.type)).toEqual([
        "context",
        "context",
        "context",
        "removed",
        "added",
        "context",
        "context",
        "context",
      ]);
      expect(first[0]).toMatchObject({ content: "line 97", oldNumber: 97, newNumber: 97 });
      expect(diff.hunks[0]!.skipped).toBe(96);
      expect(diff.hunks[1]!.skipped).toBe(800 - 3 - 1 - 100 - 3);
    });
  });

  describe("diffWikitext correctness", () => {
    it("rebuilds both texts from the rows, for random edits", () => {
      let seed = 12345;
      const rand = (max: number) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % max;
      };
      for (let round = 0; round < 60; round++) {
        const a = Array.from({ length: rand(40) }, () => `l${rand(6)}`);
        const b = a.filter(() => rand(4) !== 0);
        for (let i = rand(6); i > 0; i--) b.splice(rand(b.length + 1), 0, `n${rand(6)}`);
        const textA = a.join("\n");
        const textB = b.join("\n");
        expect(rebuildNew(textA, textB)).toBe(textB);
        expect(rebuildOld(textA, textB)).toBe(textA);
      }
    });

    it("finds the shortest script, not just a valid one", () => {
      const diff = diffWikitext("a\nb\nc\nd\ne\nf", "a\nc\nd\nx\ne\nf");
      expect(diff.removed).toBe(1);
      expect(diff.added).toBe(1);
    });

    it("replaces the middle of two completely different large texts instead of hanging", () => {
      const a = lines(8000, "old").join("\n");
      const b = lines(8000, "new").join("\n");
      const started = Date.now();

      const diff = diffWikitext(a, b);

      expect(Date.now() - started).toBeLessThan(5000 * TIMING_BUDGET_SCALE);
      expect(diff.removed).toBe(8000);
      expect(diff.added).toBe(8000);
    });
  });

  describe("diffWikitext answer caps", () => {
    it("does not diff a side of more than 20,000 lines: tooLarge, no hunks, counts by line content", () => {
      // two megabytes of one-character lines that share nothing but one line: 1M lines a side
      const old = Array.from({ length: 1_000_000 }, () => "a").join("\n");
      const next = Array.from({ length: 1_000_000 }, () => "b").join("\n");
      const started = Date.now();

      const diff = diffWikitext(old, next);

      expect(Date.now() - started).toBeLessThan(5000 * TIMING_BUDGET_SCALE);
      expect(diff.tooLarge).toBe(true);
      expect(diff.hunks).toEqual([]);
      expect(diff.added).toBe(1_000_000);
      expect(diff.removed).toBe(1_000_000);
      expect(JSON.stringify(diff).length).toBeLessThan(200);
    });
    it("refuses one line past the cap and accepts the cap itself", () => {
      expect(diffWikitext(lines(DIFF_MAX_LINES_PER_SIDE + 1).join("\n"), "x").tooLarge).toBe(true);
      expect(diffWikitext("x", lines(DIFF_MAX_LINES_PER_SIDE + 1).join("\n")).tooLarge).toBe(true);
      const atCap = lines(DIFF_MAX_LINES_PER_SIDE);
      expect(
        diffWikitext(atCap.join("\n"), [...atCap.slice(1), "x"].join("\n")).tooLarge
      ).toBeUndefined();
    });

    it("cuts an answer of more than 5,000 rows after the last whole hunk that fits", () => {
      // 1,000 edits 8 lines apart: 1,000 hunks of 8 context + 2 changed = 10 rows each → 10,000 rows
      const old = lines(8_000);
      const next = old.map((line, i) => (i % 8 === 4 ? `${line} edited` : line));

      const diff = diffWikitext(old.join("\n"), next.join("\n"));

      expect(diff.truncated).toBe(true);
      expect(diff.tooLarge).toBeUndefined();
      expect(rowsOf(diff).length).toBeLessThanOrEqual(DIFF_MAX_ROWS);
      expect(rowsOf(diff).length).toBeGreaterThan(DIFF_MAX_ROWS - 20);
      // the counts are of the whole diff, not of what is shown
      expect(diff.added).toBe(1_000);
      expect(diff.removed).toBe(1_000);
      expect(diff.trailingSkipped).toBe(0);
    });
  });

  describe("diffWikitext size cap", () => {
    it("refuses a side over 2 MB, counted in UTF-8 bytes", () => {
      const over = "x".repeat(DIFF_MAX_BYTES_PER_SIDE + 1);
      expect(() => diffWikitext(over, "a")).toThrow(DiffTooLargeError);
      expect(() => diffWikitext("a", over)).toThrow(DiffTooLargeError);
      // 3-byte characters: 700k of them are 2.1 MB although the string is shorter than the limit
      expect(() => diffWikitext("€".repeat(700_000), "a")).toThrow(DiffTooLargeError);
    });
  });

  describe("diffWikitext word marks", () => {
    it("skips marks for a line pair longer than 2,000 characters", () => {
      const long = "word ".repeat(450); // 2,250 characters
      const [removed, added] = rowsOf(diffWikitext(`${long}one`, `${long}two`));
      expect(removed!.marks).toBeUndefined();
      expect(added!.marks).toBeUndefined();
    });

    it("never turns line text into markup: content stays plain text", () => {
      const [removed, added] = rowsOf(diffWikitext("<b>x</b> & y", "<i>x</i> & y"));
      expect(removed!.content).toBe("<b>x</b> & y");
      expect(added!.content).toBe("<i>x</i> & y");
    });
  });
});
