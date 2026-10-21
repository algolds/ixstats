/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A3): authorship comes from the revision ledger in Postgres. The creator is the author of
// the oldest live revision however long the history; parked revisions count for nothing; contributors
// are sorted by edit count then name, IP authors folded into one "Anonymous" entry. MediaWiki is not asked.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    wikiRevision: { findFirst: jest.fn(), groupBy: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import { getArticleAuthors } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiArticle: Record<"findUnique" | "findMany" | "findFirst", jest.Mock>;
  wikiRevision: Record<"findFirst" | "groupBy", jest.Mock>;
  user: { findUnique: jest.Mock };
};

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

const article = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  title: "Caphiria",
  source: "ixwiki",
  status: "PUBLISHED",
  format: "WIKITEXT",
  wikitext: "text",
  namespace: 0,
  authorId: null,
  syncedAt: day(1),
  updatedAt: day(20),
  ...over,
});

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  mocked.wikiArticle.findUnique.mockResolvedValue(article());
  mocked.wikiArticle.findMany.mockResolvedValue([]);
  mocked.wikiArticle.findFirst.mockResolvedValue(null);
  mocked.user.findUnique.mockResolvedValue(null);
});
afterEach(() => guard.restore());

/** `findFirst` answers by order: oldest first, newest second (the order the loader asks). */
function ledger(
  oldest: { author: string | null; createdAt: Date; userDeleted?: boolean } | null,
  newest: { author: string | null; createdAt: Date; userDeleted?: boolean } | null,
  groups: Array<{ author: string | null; edits: number; last: Date; userDeleted?: boolean }>
) {
  mocked.wikiRevision.findFirst.mockImplementation(
    async ({ orderBy }: { orderBy: Array<{ createdAt: "asc" | "desc" }> }) =>
      orderBy[0]?.createdAt === "asc" ? oldest : newest
  );
  mocked.wikiRevision.groupBy.mockResolvedValue(
    groups.map((g) => ({
      author: g.author,
      userDeleted: g.userDeleted ?? false,
      _count: { _all: g.edits },
      _max: { createdAt: g.last },
    }))
  );
}

describe("getArticleAuthors for IxWiki", () => {
  it("names the creator, the last editor and the contributors from the ledger, never asking MediaWiki", async () => {
    ledger({ author: "Kir", createdAt: day(2) }, { author: "Bea", createdAt: day(19) }, [
      { author: "Kir", edits: 2, last: day(5) },
      { author: "Bea", edits: 7, last: day(19) },
    ]);

    const info = await getArticleAuthors("Caphiria");

    expect(info).toMatchObject({
      creator: { username: "Kir", timestamp: day(2).toISOString() },
      createdAt: day(2).toISOString(),
      lastEditor: { username: "Bea", timestamp: day(19).toISOString() },
      lastEditedAt: day(19).toISOString(),
      totalContributors: 2,
    });
    expect(info.contributors).toEqual([
      { username: "Bea", editCount: 7, lastContributedAt: day(19).toISOString() },
      { username: "Kir", editCount: 2, lastContributedAt: day(5).toISOString() },
    ]);
    expect(guard.calls()).toEqual([]);
  });
  it("folds every IP author into one Anonymous entry", async () => {
    ledger({ author: "Kir", createdAt: day(1) }, { author: "203.0.113.9", createdAt: day(9) }, [
      { author: "Kir", edits: 3, last: day(2) },
      { author: "203.0.113.9", edits: 2, last: day(9) },
      { author: "198.51.100.7", edits: 4, last: day(6) },
      { author: "2001:db8::1", edits: 1, last: day(3) },
    ]);

    const info = await getArticleAuthors("Caphiria");

    expect(info.contributors).toEqual([
      { username: "Anonymous", editCount: 7, lastContributedAt: day(9).toISOString() },
      { username: "Kir", editCount: 3, lastContributedAt: day(2).toISOString() },
    ]);
    // Three distinct IPs and one account: MediaWiki's count of contributors plus anonymous contributors.
    expect(info.totalContributors).toBe(4);
    expect(info.lastEditor).toMatchObject({ username: "203.0.113.9" });
  });

  it("lists no contributor for revisions whose user was hidden, as MediaWiki's contributor list does", async () => {
    ledger({ author: "Kir", createdAt: day(2) }, { author: "Bea", createdAt: day(19) }, [
      { author: "Kir", edits: 2, last: day(5) },
      { author: "Bea", edits: 3, last: day(19) },
      { author: "(deleted)", edits: 9, last: day(12), userDeleted: true },
    ]);

    const info = await getArticleAuthors("Caphiria");

    expect(info.contributors?.map((c) => c.username)).toEqual(["Bea", "Kir"]);
    expect(info.totalContributors).toBe(2);
    // The query groups by the hidden flag, so a hidden revision never merges into an account's count.
    expect(mocked.wikiRevision.groupBy.mock.calls[0]?.[0].by).toEqual(["author", "userDeleted"]);
  });

  it("does not credit a hidden user as the creator or the last editor", async () => {
    ledger(
      { author: "(deleted)", createdAt: day(1), userDeleted: true },
      { author: "(deleted)", createdAt: day(9), userDeleted: true },
      [{ author: "(deleted)", edits: 2, last: day(9), userDeleted: true }]
    );

    const info = await getArticleAuthors("Caphiria");

    expect(info.creator).toMatchObject({ username: "MediaWiki Contributor" });
    expect(info.lastEditor).toMatchObject({ username: "MediaWiki Contributor" });
    expect(info.totalContributors).toBe(0);
  });

  it("does not credit a hidden last editor to the creator", async () => {
    ledger(
      { author: "Kir", createdAt: day(1) },
      { author: "(deleted)", createdAt: day(9), userDeleted: true },
      [
        { author: "Kir", edits: 1, last: day(1) },
        { author: "(deleted)", edits: 1, last: day(9), userDeleted: true },
      ]
    );

    const info = await getArticleAuthors("Caphiria");

    expect(info.creator).toMatchObject({ username: "Kir" });
    expect(info.lastEditor).toMatchObject({ username: "MediaWiki Contributor", timestamp: day(9).toISOString() });
    expect(info.contributors?.map((c) => c.username)).toEqual(["Kir"]);
  });

  it("does not reveal a hidden creator through the article's owner (the owner of a page a hidden user made is that user)", async () => {
    mocked.wikiArticle.findUnique.mockResolvedValue(article({ authorId: "u1" }));
    mocked.user.findUnique.mockResolvedValue({ wikiUsername: "OwnerName" });
    // revision 1, by the owner, has its user hidden; revision 2 is a visible edit by Bea
    ledger(
      { author: "OwnerName", createdAt: day(1), userDeleted: true },
      { author: "Bea", createdAt: day(5) },
      [
        { author: "OwnerName", edits: 1, last: day(1), userDeleted: true },
        { author: "Bea", edits: 1, last: day(5) },
      ]
    );

    const info = await getArticleAuthors("Caphiria");

    expect(info.creator).toMatchObject({ username: "MediaWiki Contributor" });
    expect(JSON.stringify(info)).not.toContain("OwnerName");
    expect(info.lastEditor).toMatchObject({ username: "Bea" });
    expect(info.contributors?.map((c) => c.username)).toEqual(["Bea"]);
    expect(mocked.user.findUnique).not.toHaveBeenCalled(); // the owner is not even looked up
  });

  it("still credits an unnamed (not hidden) last revision to the creator", async () => {
    ledger({ author: "Kir", createdAt: day(1) }, { author: null, createdAt: day(9) }, [
      { author: "Kir", edits: 1, last: day(1) },
      { author: null, edits: 1, last: day(9) },
    ]);

    const info = await getArticleAuthors("Caphiria");

    expect(info.lastEditor).toMatchObject({ username: "Kir" });
  });

  it("credits an unnamed first revision to the article's owner", async () => {
    mocked.wikiArticle.findUnique.mockResolvedValue(article({ authorId: "u1" }));
    mocked.user.findUnique.mockResolvedValue({ wikiUsername: "OwnerName" });
    ledger({ author: null, createdAt: day(1) }, { author: null, createdAt: day(2) }, [
      { author: null, edits: 2, last: day(2) },
    ]);

    const info = await getArticleAuthors("Caphiria");

    expect(info.creator).toMatchObject({ username: "OwnerName" });
    expect(guard.calls()).toEqual([]);
  });
  it("answers with no author at all for a page Postgres lacks, without asking MediaWiki", async () => {
    mocked.wikiArticle.findUnique.mockResolvedValue(null);

    expect(await getArticleAuthors("Nowhere")).toMatchObject({
      creator: null,
      lastEditor: null,
      totalContributors: 0,
    });
    expect(guard.calls()).toEqual([]);
  });

  it("answers with no author when the ledger cannot be read, without asking MediaWiki", async () => {
    mocked.wikiRevision.findFirst.mockRejectedValue(new Error("db down"));
    mocked.wikiRevision.groupBy.mockRejectedValue(new Error("db down"));

    expect(await getArticleAuthors("Caphiria")).toMatchObject({ creator: null });
    expect(guard.calls()).toEqual([]);
  });
});
