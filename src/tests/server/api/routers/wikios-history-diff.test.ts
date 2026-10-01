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

const revision = (wikitext: string | null) => ({
  wikitext,
  title: "Foo",
  source: "ixwiki",
  timestamp: "2026-06-01T00:00:00.000Z",
  fromShadow: true as const,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getArticleHistoryShadow).mockResolvedValue({
    revisions: [
      { revid: "r2", user: "bob", timestamp: "", comment: "", size: 1, byteDelta: 0, minor: false, parked: false },
      { revid: "r1", user: "amy", timestamp: "", comment: "", size: 1, byteDelta: 0, minor: false, parked: false },
    ],
    hasMore: false,
    fromShadow: true,
  });
});

describe("wikiosHistoryDiffRouter.getDiff (plan 402)", () => {
  it("diffs two revisions whose text is known", async () => {
    jest
      .mocked(getRevisionWikitextShadow)
      .mockResolvedValueOnce(revision("new"))
      .mockResolvedValueOnce(revision("old"));

    const result = await caller().getDiff({ torev: "r2" });

    expect(result).toMatchObject({ oldWikitext: "old", newWikitext: "new" });
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
  it("asks the store for parked revisions and passes them on flagged", async () => {
    jest.mocked(getArticleHistoryShadow).mockResolvedValue({
      revisions: [
        { revid: "9001", user: "carol", timestamp: "", comment: "x", size: 1, byteDelta: 0, minor: false, parked: true },
        { revid: "r1", user: "amy", timestamp: "", comment: "", size: 1, byteDelta: 0, minor: false, parked: false },
      ],
      hasMore: false,
      fromShadow: true,
    });

    const result = await caller().getHistory({ title: "Foo" });

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

    expect(getArticleHistoryShadow).toHaveBeenCalledWith("Foo", 100, undefined, "ixwiki", {
      includeParked: true,
    });
  });
});
