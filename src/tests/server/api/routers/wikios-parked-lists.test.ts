/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
// Plan 406 follow-up: contributions and the watchlist feed keep a parked revision (a MediaWiki edit that
// conflicted with WikiOS's head and never went live) in the list, and say so.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {},
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getUserContribs: jest.fn(),
  getUserInfo: jest.fn(),
  getBacklinks: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getUserContribs } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const signedOut = (db: object) => createMockRouterContext({ auth: null, user: null, db }) as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("wikios.getUserContribs", () => {
  it("passes the parked flag of a bridge contribution on", async () => {
    jest.mocked(getUserContribs).mockResolvedValue([
      {
        rev_id: 101,
        page_title: "Foo",
        page_namespace: 0,
        rev_timestamp: "2026-09-27T10:00:00Z",
        rev_len: 20,
        diff: 5,
        rev_comment: "conflicting edit",
        rev_minor_edit: 0,
        is_new: false,
        parked: true,
      },
      {
        rev_id: 99,
        page_title: "Bar",
        page_namespace: 0,
        rev_timestamp: "2026-09-26T10:00:00Z",
        rev_len: 10,
        diff: 1,
        rev_comment: "",
        rev_minor_edit: 0,
        is_new: false,
        parked: false,
      },
    ]);

    const result = await createCallerFactory(wikiosUserTalkRouter)(signedOut({})).getUserContribs({
      user: "carol",
    });

    expect(result.contribs.map((c) => [c.revid, c.parked])).toEqual([
      [101, true],
      [99, false],
    ]);
  });

  it("flags a parked revision in the PostgreSQL fallback too", async () => {
    jest.mocked(getUserContribs).mockResolvedValue([]);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "rev-1",
        mwRevId: 101,
        article: { title: "Foo" },
        createdAt: new Date("2026-09-27T10:00:00Z"),
        summary: "conflicting edit",
        byteSize: 20,
        minor: false,
        parked: true,
        parentRevisionId: "p",
      },
    ]);

    const result = await createCallerFactory(wikiosUserTalkRouter)(
      signedOut({ wikiRevision: { findMany } })
    ).getUserContribs({ user: "carol" });

    expect(result.contribs[0]).toMatchObject({ title: "Foo", parked: true });
    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty("parked");
  });
});

describe("wikios.getWatchlistFeed", () => {
  it("lists a parked revision of a watched page, flagged", async () => {
    const wikiRevisionFindMany = jest.fn().mockResolvedValue(
      ["rev-1", "rev-2"].map((id, i) => ({
        id,
        articleId: "art-1",
        mwRevId: 100 + i,
        author: "carol",
        summary: null,
        minor: false,
        parked: i === 0,
        byteSize: 20,
        byteDelta: 5,
        createdAt: new Date("2026-09-27T10:00:00Z"),
        wikitext: "text",
        article: { id: "art-1", title: "Foo", slug: "foo", namespacePrefix: null },
      }))
    );
    const ctx = createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 10 } },
      db: {
        wikiWatchlist: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ articleId: "art-1", lastViewedTime: new Date(0) }]),
        },
        wikiRevision: { findMany: wikiRevisionFindMany },
      },
    }) as never;

    const feed = await createCallerFactory(wikiosWatchlistAnnotationsRouter)(ctx).getWatchlistFeed({
      days: 7,
      limit: 50,
    });

    expect(feed.map((item) => [item.id, item.parked])).toEqual([
      ["rev-1", true],
      ["rev-2", false],
    ]);
    expect(wikiRevisionFindMany.mock.calls[0]?.[0].where).not.toHaveProperty("parked");
  });
});
