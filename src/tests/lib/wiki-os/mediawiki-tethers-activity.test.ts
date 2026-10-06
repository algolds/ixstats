/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A5-A7): recent changes, a user's contributions and the pages a user created
// are read from Postgres alone. When Postgres has little or nothing, the answer is little or nothing:
// MediaWiki is never asked.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiRevision: { findMany: jest.fn() },
    wikiAccountLink: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  ixwikiGetUserContribs,
  ixwikiGetUserCreatedPages,
  ixwikiRecentChanges,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiRevision: { findMany: jest.Mock };
  wikiAccountLink: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};

const revision = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  mwRevId: 100,
  author: "Kir",
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

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  mocked.wikiRevision.findMany.mockResolvedValue([]);
  mocked.wikiAccountLink.findMany.mockResolvedValue([]);
  mocked.$queryRaw.mockResolvedValue([]);
});
afterEach(() => guard.restore());

describe("recent changes", () => {
  it("is empty when Postgres has no revision, and MediaWiki is not asked", async () => {
    expect(await ixwikiRecentChanges(20)).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });

  it("is empty when the read fails, and MediaWiki is not asked", async () => {
    mocked.wikiRevision.findMany.mockRejectedValue(new Error("db down"));

    expect(await ixwikiRecentChanges(20)).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });

  it("lists the revisions Postgres has", async () => {
    mocked.wikiRevision.findMany.mockResolvedValue([revision()]);

    // The size is the revision's stored one, and no wikitext is read: the select names none.
    expect(await ixwikiRecentChanges(20)).toMatchObject([
      {
        title: "Foo",
        user: "Kir",
        type: "edit",
        comment: "an edit",
        oldLen: 15,
        newLen: 20,
        parked: false,
      },
    ]);
    expect(
      mocked.wikiRevision.findMany.mock.calls[0]?.[0].select.article.select
    ).not.toHaveProperty("wikitext");
  });
});

describe("user contributions", () => {
  it("lists the account's revisions by the name it edited under, never asking MediaWiki", async () => {
    mocked.wikiRevision.findMany.mockResolvedValue([
      revision(),
      revision({ id: "r2", mwRevId: null }),
    ]);

    const contribs = await ixwikiGetUserContribs("kir_x", 50, 0, 0);

    expect(contribs.map((c) => [c.page_title, c.rev_id])).toEqual([
      ["Foo", 100],
      ["Foo", 0],
    ]);
    const where = mocked.wikiRevision.findMany.mock.calls[0]?.[0].where;
    expect(where).toEqual({
      author: { equals: "Kir x", mode: "insensitive" },
      article: { namespace: 0, status: "PUBLISHED" },
    });
    expect(guard.calls()).toEqual([]);
  });

  it("also lists the edits saved under the id of the WikiOS user who proved the account", async () => {
    mocked.wikiAccountLink.findMany.mockResolvedValue([{ userId: "u1" }]);

    await ixwikiGetUserContribs("Kir", 50, 0, 3);

    expect(mocked.wikiAccountLink.findMany.mock.calls[0]?.[0].take).toBe(1);
    expect(mocked.wikiAccountLink.findMany.mock.calls[0]?.[0].where).toMatchObject({
      source: "ixwiki",
      username: "Kir",
      verifiedAt: { not: null },
    });
    expect(mocked.wikiRevision.findMany.mock.calls[0]?.[0].where).toEqual({
      OR: [{ author: { equals: "Kir", mode: "insensitive" } }, { authorId: { in: ["u1"] } }],
      article: { namespace: 3, status: "PUBLISHED" },
    });
  });

  it("is empty when the read fails, without asking MediaWiki", async () => {
    mocked.wikiRevision.findMany.mockRejectedValue(new Error("db down"));

    expect(await ixwikiGetUserContribs("Kir", 50)).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });
});

describe("pages a user created", () => {
  const sql = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

  it("are the published pages whose oldest live revision the account made, never asked of MediaWiki", async () => {
    mocked.$queryRaw.mockResolvedValue([
      {
        title: "Foo",
        namespace: 0,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        byteSize: 1234n,
      },
    ]);

    const pages = await ixwikiGetUserCreatedPages("Kir", 25);

    expect(pages).toEqual([
      { title: "Foo", namespace: 0, createdAt: "2026-01-02T00:00:00.000Z", byteSize: 1234 },
    ]);
    const query = sql(mocked.$queryRaw.mock.calls[0]!);
    expect(query).toContain(`r."parked" = false`);
    expect(query).toContain(`ORDER BY r."createdAt" ASC, r."id" ASC`);
    expect(query).toContain(`a."status" = 'PUBLISHED'`);
    expect(mocked.$queryRaw.mock.calls[0]).toContain("Kir");
    expect(mocked.$queryRaw.mock.calls[0]).toContain(25);
    expect(guard.calls()).toEqual([]);
  });

  it("include the pages created under the id of the user who proved the account", async () => {
    mocked.wikiAccountLink.findMany.mockResolvedValue([{ userId: "u1" }]);

    await ixwikiGetUserCreatedPages("Kir");

    const owner = mocked.$queryRaw.mock.calls[0]!.find(
      (value: unknown): value is Prisma.Sql =>
        typeof value === "object" && value !== null && "sql" in value
    );
    expect(owner?.sql).toContain(`f."authorId" IN`);
    expect(owner?.values).toEqual(["u1"]);
  });

  it("are empty when the read fails, without asking MediaWiki", async () => {
    mocked.$queryRaw.mockRejectedValue(new Error("db down"));

    expect(await ixwikiGetUserCreatedPages("Kir")).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });
});
