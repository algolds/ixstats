/** @jest-environment node */
/**
 * The viewer's own Lorewards: a place is theirs when the payout rule pays it to them (a plain name's exact verified
 * link, or a `wikios>` name's WikiOS edits), never because a name they carry matches a stats row.
 */
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { loadMyTrophies, myRaceRank, viewerNames } from "~/lib/lorewards/my-trophies";

interface Revision {
  author: string;
  authorId: string | null;
  createdAt: string;
  page: string;
}
interface Entry {
  type: string;
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
  status: string;
}
interface Link {
  userId: string;
  username: string;
}
type LinkWhere = { userId?: string; username?: string };
type RevisionWhere = {
  authorId?: string;
  author?: string;
  createdAt?: { gte: Date; lt: Date };
  article?: { title: string };
};
type EntryWhere = {
  type: { in: string[] };
  OR: [{ winnerUser: { in: string[] } }, { runnerUpUser: { in: string[] } }];
};

const at = (r: Revision) => new Date(r.createdAt);

const placeMatches = (r: Revision, where: RevisionWhere) =>
  r.author === where.author &&
  !!where.createdAt &&
  at(r) >= where.createdAt.gte &&
  at(r) < where.createdAt.lt &&
  r.page === where.article?.title;

/** A database answering the queries the viewer's trophies make, over these rows. */
function fakeDb(revisions: Revision[], entries: Entry[], links: Link[] = []) {
  const labelGroups = (userId: string) => {
    const mine = revisions.filter((r) => r.authorId === userId);
    return [...new Set(mine.map((r) => r.author))].map((author) => {
      const times = mine.filter((r) => r.author === author).map((r) => at(r).getTime());
      return {
        author,
        _min: { createdAt: new Date(Math.min(...times)) },
        _max: { createdAt: new Date(Math.max(...times)) },
      };
    });
  };
  const authorGroups = (where: RevisionWhere) =>
    [...new Set(revisions.filter((r) => placeMatches(r, where)).map((r) => r.authorId))].map(
      (authorId) => ({ authorId })
    );
  return {
    wikiAccountLink: {
      findFirst: jest.fn(async ({ where }: { where: LinkWhere }) => {
        const link = links.find((l) =>
          where.userId ? l.userId === where.userId : l.username === where.username
        );
        return link ? { userId: link.userId, username: link.username } : null;
      }),
    },
    wikiRevision: {
      groupBy: jest.fn(async ({ by, where }: { by: string[]; where: RevisionWhere }) =>
        by[0] === "author" ? labelGroups(where.authorId ?? "") : authorGroups(where)
      ),
    },
    lorewardEntry: {
      findMany: jest.fn(async ({ where }: { where: EntryWhere }) => {
        const names = where.OR[0].winnerUser.in;
        return entries.filter(
          (e) =>
            e.status === "approved" &&
            where.type.in.includes(e.type) &&
            (names.includes(e.winnerUser ?? "") || names.includes(e.runnerUpUser ?? ""))
        );
      }),
    },
    lorewardUserStats: { findFirst: jest.fn(async () => null) },
    cardOwnership: { findMany: jest.fn(async () => []) },
  };
}

const edit = (author: string, authorId: string | null, createdAt: string, page: string) => ({
  author,
  authorId,
  createdAt,
  page,
});
const daily = (date: string, over: Partial<Entry> = {}): Entry => ({
  type: "daily",
  date,
  dateStart: null,
  dateEnd: null,
  winnerUser: "wikios>Kir_Republic",
  winnerPage: null,
  runnerUpUser: null,
  runnerUpPage: null,
  status: "approved",
  ...over,
});

async function mineOf(db: ReturnType<typeof fakeDb>, userId: string) {
  return loadMyTrophies(db as never, userId, await viewerNames(db as never, userId));
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-17T12:00:00.000Z") });
});
afterEach(() => {
  jest.useRealTimers();
});

describe("loadMyTrophies", () => {
  it("counts the places under the viewer's verified name from the entries, not the name's stats row", async () => {
    const db = fakeDb(
      [],
      [
        daily("2026-10-16", { winnerUser: "Kir Republic" }),
        { ...daily("2026-W42"), type: "weekly", winnerUser: "Kir_Republic" },
        daily("2026-10-15", { winnerUser: "Rumahoki", runnerUpUser: "Kir Republic" }),
      ],
      [{ userId: "u2", username: "Kir Republic" }]
    );
    expect(await mineOf(db, "u2")).toEqual({
      wikiUsername: "Kir Republic",
      verified: true,
      unmatched: 0,
      wins: { daily: 1, weekly: 1, monthly: 0 },
      runnerUps: 1,
      streak: 1,
      cards: [],
      holderHandle: null,
    });
    expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
  });

  it("has no wiki name for a viewer with no link and no ixwiki edits", async () => {
    const db = fakeDb([], [daily("2026-10-16")]);
    expect(await mineOf(db, "u2")).toMatchObject({
      wikiUsername: null,
      verified: false,
      unmatched: 0,
      wins: { daily: 0, weekly: 0, monthly: 0 },
      holderHandle: null,
    });
    expect(db.lorewardEntry.findMany).not.toHaveBeenCalled();
  });

  it("counts a wikios> place the viewer's WikiOS edits won, and no other", async () => {
    const db = fakeDb(
      [
        edit("Kir_Republic", "u2", "2026-10-14T09:00:00.000Z", "First steps"),
        // An Eastern-evening edit, after midnight UTC: still the 16th's contest.
        edit("Kir_Republic", "u2", "2026-10-17T01:00:00.000Z", "Seneca front"),
        edit("Kir_Republic", "u2", "2026-10-15T10:00:00.000Z", "Isurians"),
        // Another player's country carries the same label on this page.
        edit("Kir_Republic", "u2", "2026-10-13T10:00:00.000Z", "Shared page"),
        edit("Kir_Republic", "u7", "2026-10-13T11:00:00.000Z", "Shared page"),
      ],
      [
        daily("2026-10-16", { winnerPage: "Seneca front" }),
        daily("2026-10-15", {
          winnerUser: "Rumahoki",
          runnerUpUser: "wikios>Kir_Republic",
          runnerUpPage: "Isurians",
        }),
        daily("2026-10-13", { winnerPage: "Shared page" }),
        // Before the viewer's first WikiOS edit: never theirs, and never looked up.
        daily("2019-05-01", { winnerPage: "Old page" }),
      ]
    );

    expect(await mineOf(db, "u2")).toEqual({
      wikiUsername: "Kir_Republic",
      verified: false,
      unmatched: 0,
      wins: { daily: 1, weekly: 0, monthly: 0 },
      runnerUps: 1,
      streak: 1,
      cards: [],
      holderHandle: null,
    });
    const pages = db.wikiRevision.groupBy.mock.calls.map(([args]) => args.where.article?.title);
    expect(pages).not.toContain("Old page");
  });

  it("never ties a plain-named place to an unlinked viewer, and counts it as possibly theirs", async () => {
    // A classic-wiki win under the viewer's label: only a verified link could claim it.
    const db = fakeDb(
      [edit("Ostrozava", "u2", "2026-10-16T10:00:00.000Z", "Seneca front")],
      [daily("2026-10-16", { winnerUser: "Ostrozava", winnerPage: "Seneca front" })]
    );
    expect(await mineOf(db, "u2")).toMatchObject({
      wikiUsername: "Ostrozava",
      unmatched: 1,
      wins: { daily: 0, weekly: 0, monthly: 0 },
    });
  });

  it("leaves out a plain-named place whose name another account verified", async () => {
    const db = fakeDb(
      [edit("Ostrozava", "u2", "2026-10-16T10:00:00.000Z", "Seneca front")],
      [daily("2026-10-16", { winnerUser: "Ostrozava", winnerPage: "Seneca front" })],
      [{ userId: "u9", username: "Ostrozava" }]
    );
    expect(await mineOf(db, "u2")).toMatchObject({ unmatched: 0, wins: { daily: 0 } });
  });
});

describe("myRaceRank", () => {
  const race = {
    date: "2026-10-17",
    editCount: 4,
    entries: [
      {
        rank: 1,
        user: "Kir_Republic",
        page: "Shared page",
        score: 900,
        bytesAdded: 1,
        editCount: 2,
      },
      {
        rank: 2,
        user: "Kir Republic",
        page: "Linked page",
        score: 600,
        bytesAdded: 1,
        editCount: 1,
      },
      {
        rank: 3,
        user: "Kir_Republic",
        page: "Tide charts",
        score: 300,
        bytesAdded: 1,
        editCount: 1,
      },
    ],
  };
  const revisions = [
    edit("Kir_Republic", "u2", "2026-10-17T08:00:00.000Z", "Shared page"),
    edit("Kir_Republic", "u7", "2026-10-17T09:00:00.000Z", "Shared page"),
    edit("Kir Republic", null, "2026-10-17T09:30:00.000Z", "Linked page"),
    edit("Kir_Republic", "u2", "2026-10-17T10:00:00.000Z", "Tide charts"),
  ];

  it("ranks the viewer by an entry whose scored edits are theirs", async () => {
    const db = fakeDb(revisions, []);
    const names = { link: null, labels: ["Kir_Republic"], since: 0 };
    expect(await myRaceRank(db as never, race, names, "u2")).toBe(3);
    expect(await myRaceRank(db as never, race, names, "u9")).toBeNull();
  });

  it("ranks a linked viewer by MediaWiki edits under their exact name", async () => {
    const db = fakeDb(revisions, [], [{ userId: "u5", username: "Kir Republic" }]);
    const names = { link: "Kir Republic", labels: [], since: Infinity };
    expect(await myRaceRank(db as never, race, names, "u5")).toBe(2);
    // The same name lower-cased is another MediaWiki account.
    const other = { link: "Kir republic", labels: [], since: Infinity };
    expect(await myRaceRank(db as never, race, other, "u5")).toBeNull();
  });
});
