/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getArticleHistoryShadow).mockResolvedValue({
    revisions: [
      { revid: "r2", user: "bob", timestamp: "", comment: "", size: 1, byteDelta: 0, minor: false },
      { revid: "r1", user: "amy", timestamp: "", comment: "", size: 1, byteDelta: 0, minor: false },
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
    expect(mockGetRevisionView).toHaveBeenCalledWith("123");
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

  it("refuses a reference that cannot be a revision's, without looking it up", async () => {
    for (const ref of ["", "a b", "x;y", "a".repeat(65)]) {
      await expect(caller().getRevisionHtml({ ref })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(mockGetRevisionView).not.toHaveBeenCalled();
  });
});
