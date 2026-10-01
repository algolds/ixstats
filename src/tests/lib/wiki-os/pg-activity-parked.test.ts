/** @jest-environment node */
/**
 * Plan 406 follow-up: recent changes, page history and user contributions keep a parked revision (a
 * MediaWiki edit that conflicted with WikiOS's head and never went live) in the list, and say so.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiRevision: { findMany: jest.fn() } },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge/http-reader", () => ({
  __esModule: true,
  fetchMediaWikiPageAuthorsAndRevisions: jest.fn().mockResolvedValue(null),
}));

import { db } from "~/server/db";
import {
  ixwikiGetHistory,
  ixwikiGetUserContribs,
  ixwikiRecentChanges,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";

const findMany = db.wikiRevision.findMany as unknown as jest.Mock;

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  mwRevId: 100,
  author: "carol",
  summary: "an edit",
  minor: false,
  parked: false,
  byteSize: 20,
  byteDelta: 5,
  wikitext: "Some text.",
  createdAt: new Date("2026-09-27T10:00:00Z"),
  article: {
    title: "Foo",
    namespace: 0,
    summary: null,
    leadImageUrl: null,
    wikitext: "Some text.",
  },
  ...over,
});

const realFetch = globalThis.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = jest.fn().mockRejectedValue(new Error("offline")) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("recent changes", () => {
  it("leaves a parked revision out by default: it never went live, so it is no recent change of the wiki", async () => {
    findMany.mockResolvedValue([row({ id: "r2" })]);

    const changes = await ixwikiRecentChanges(10);

    expect(changes.map((c) => c.parked)).toEqual([false]);
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({ parked: false });
  });

  it("lists it, flagged, for the page that asks for it, and the others unflagged", async () => {
    findMany.mockResolvedValue([row({ parked: true, mwRevId: 101 }), row({ id: "r2" })]);

    const changes = await ixwikiRecentChanges(10, { includeParked: true });

    expect(changes.map((c) => c.parked)).toEqual([true, false]);
    // No `parked` filter: the row stays in the list.
    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty("parked");
  });
});

describe("page history (bridge)", () => {
  it("flags parked revisions", async () => {
    findMany.mockResolvedValue([row({ parked: true }), row({ id: "r2", mwRevId: 99 })]);

    const history = await ixwikiGetHistory("Foo", 10);

    expect(history.map((r) => r.parked)).toEqual([true, false]);
    expect(findMany.mock.calls[0]?.[0].select).toHaveProperty("parked", true);
  });
});

describe("user contributions", () => {
  it("flags a PostgreSQL revision that is parked", async () => {
    findMany.mockResolvedValue([
      row({ parked: true, mwRevId: 101 }),
      row({ id: "r2", mwRevId: 99 }),
    ]);

    const contribs = await ixwikiGetUserContribs("carol", 10);

    expect(contribs.map((c) => [c.rev_id, c.parked]).sort()).toEqual([
      [101, true],
      [99, false],
    ]);
  });

  it("flags the MediaWiki contribution of a revision WikiOS parked (MediaWiki lists every edit its editor made)", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          usercontribs: [
            {
              revid: 101,
              title: "Foo",
              ns: 0,
              timestamp: "2026-09-27T10:00:00Z",
              comment: "x",
              size: 20,
            },
            {
              revid: 99,
              title: "Bar",
              ns: 0,
              timestamp: "2026-09-26T10:00:00Z",
              comment: "y",
              size: 10,
            },
          ],
        },
      }),
    }) as typeof fetch;
    findMany.mockResolvedValue([row({ parked: true, mwRevId: 101 })]);

    const contribs = await ixwikiGetUserContribs("carol", 10);

    expect(contribs.map((c) => [c.rev_id, c.parked])).toEqual([
      [101, true],
      [99, false],
    ]);
  });
});
