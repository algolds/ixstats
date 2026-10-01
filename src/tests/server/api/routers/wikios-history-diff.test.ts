/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
jest.mock("~/server/db", () => ({
  __esModule: true,
  // plan 409: a read first looks the page's status up (a deleted page is hidden from most readers)
  db: {
    wikiArticle: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
  isDatabaseReadOnly: true,
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
import { db } from "~/server/db";
import { createCallerFactory } from "~/server/api/trpc";
import { resolveDiffRefs } from "~/lib/wiki-os/diff-refs";
import { wikiosHistoryDiffRouter } from "~/server/api/routers/wikios/history-diff";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";

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
  jest.mocked(getArticleHistoryShadow).mockResolvedValue({
    revisions: [entry("r2", "bob", "second"), entry("r1", "amy", "first")],
    hasMore: false,
    fromShadow: true,
  });
});

describe("wikiosHistoryDiffRouter.getHistory (plan 413)", () => {
  it("asks for one page, from after the revision the client already has", async () => {
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [entry("r2", "bob")],
      hasMore: true,
      fromShadow: true,
    });

    const result = await caller().getHistory({ title: "Foo", limit: 1, before: "r3" });

    expect(getArticleHistoryShadow).toHaveBeenCalledWith("Foo", 1, { before: "r3" }, "ixwiki", {
      includeParked: false,
    });
    // the deletion flags are for the server: they do not leave it
    const { textDeleted, commentDeleted, userDeleted, ...visible } = entry("r2", "bob");
    expect([textDeleted, commentDeleted, userDeleted]).toEqual([false, false, false]);
    expect(result).toEqual({ revisions: [visible], hasMore: true });
  });

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

  it("starts at the newest revision without a cursor, 50 at a time", async () => {
    await caller().getHistory({ title: "Foo" });
    expect(getArticleHistoryShadow).toHaveBeenCalledWith("Foo", 50, undefined, "ixwiki", {
      includeParked: false,
    });
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

  it("names the explicit older revision from its own history entry", async () => {
    jest
      .mocked(getArticleHistoryShadow)
      .mockResolvedValueOnce({
        revisions: [entry("r5", "eve", "five"), entry("r4", "dan")],
        hasMore: false,
        fromShadow: true,
      })
      .mockResolvedValueOnce({
        revisions: [entry("r1", "amy", "first")],
        hasMore: false,
        fromShadow: true,
      });
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision("new"))
      .mockResolvedValueOnce(revision("old"));

    const result = await caller().getDiff({ torev: "r5", fromrev: "r1" });

    expect(getArticleHistoryShadow).toHaveBeenLastCalledWith("Foo", 1, { from: "r1" }, "ixwiki", {
      includeParked: true,
    });
    expect(getRevisionWikitextShadow).toHaveBeenLastCalledWith("r1");
    expect(result.from).toMatchObject({ revid: "r1", user: "amy" });
    expect(result.to).toMatchObject({ revid: "r5", user: "eve" });
  });

  it("is a whole-text diff against an empty text for the first revision", async () => {
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [entry("r1", "amy")],
      hasMore: false,
      fromShadow: true,
    });
    jest.mocked(getRevisionWikitextShadow).mockResolvedValueOnce(revision("a\nb"));

    const result = await caller().getDiff({ torev: "r1" });

    expect(result.from).toMatchObject({ revid: "", user: "Initial Document" });
    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
  });

  it("a change in 1,000 lines is a few rows of context, not the thousand", async () => {
    const base = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
    const changed = [...base];
    changed[100] = "edited";
    changed[800] = "edited";
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision(changed.join("\n")))
      .mockResolvedValueOnce(revision(base.join("\n")));

    const result = await caller().getDiff({ torev: "r2" });

    expect(result.hunks.flatMap((h) => h.rows).length).toBeLessThanOrEqual(20);
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

    it("a parked revision is compared with the revision next to it in the history", async () => {
      const result = await caller().getDiff({ torev: "9001" });

      expect(result.from.revid).toBe("9000");
    });

    it("an explicit fromrev is honoured, parked or not", async () => {
      const result = await caller().getDiff({ torev: "r3", fromrev: "9001" });

      expect(result.from.revid).toBe("9001");
      // the answer says which end is parked, so the diff view offers no revert to it
      expect(result.from.parked).toBe(true);
      expect(result.to.parked).toBe(false);
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

    it("the first live revision has nothing before it, however many parked edits follow it in the list", async () => {
      const result = await caller().getDiff({ torev: "r1" });

      expect(result.from.revid).toBe("");
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

describe("wikiosHistoryDiffRouter.getHistory (plan 406)", () => {
  it("asks the store for parked revisions only when told to, and passes them on flagged", async () => {
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [
        {
          revid: "9001",
          user: "carol",
          timestamp: "",
          comment: "x",
          size: 1,
          byteDelta: 0,
          minor: false,
          parked: true,
        },
        {
          revid: "r1",
          user: "amy",
          timestamp: "",
          comment: "",
          size: 1,
          byteDelta: 0,
          minor: false,
          parked: false,
        },
      ],
      hasMore: false,
      fromShadow: true,
    });

    const result = await caller().getHistory({ title: "Foo", includeParked: true });

    expect(getArticleHistoryShadow).toHaveBeenCalledWith("Foo", 50, undefined, "ixwiki", {
      includeParked: true,
    });
    expect(result.revisions.map((r) => r.parked)).toEqual([true, false]);
  });

  it("a diff finds a parked revision in the history it reads, and names its predecessor", async () => {
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision("new"))
      .mockResolvedValueOnce(revision("old"));

    await caller().getDiff({ torev: "r2" });

    expect(getArticleHistoryShadow).toHaveBeenCalledWith("Foo", 2, { from: "r2" }, "ixwiki", {
      includeParked: true,
    });
  });
});

describe("wikiosHistoryDiffRouter.getRevisionHtml (plan 412)", () => {
  const view = {
    title: "Foo",
    timestamp: "2026-06-01T00:00:00.000Z",
    contentHtml: "<p>old</p>",
    infoboxHtml: null,
    noticesHtml: null,
    toc: [],
    renderQuality: "rendered" as const,
  };

  it("returns the rendered revision", async () => {
    mockGetRevisionView.mockResolvedValue({ status: "ok", view });

    await expect(caller().getRevisionHtml({ ref: "123" })).resolves.toEqual(view);
    expect(mockGetRevisionView).toHaveBeenCalledWith("123", expect.any(Function));
  });

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
