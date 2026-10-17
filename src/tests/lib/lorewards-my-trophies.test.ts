/** @jest-environment node */
/**
 * The viewer's own Lorewards: a verified link makes the name's record theirs; without one, only the places whose
 * winning edits are all theirs in WikiOS count, never the shared stats row of a name they happen to carry.
 */
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { loadMyTrophies, myRaceRank } from "~/lib/lorewards/my-trophies";

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
  author?: { in: string[] };
  createdAt?: { gte: Date; lt: Date };
  article?: { title: string };
};
type EntryWhere = {
  type: { in: string[] };
  OR: [{ winnerUser: { in: string[] } }, { runnerUpUser: { in: string[] } }];
};

const STATS = {
  dailyWins: 6,
  dailyRunnerUps: 2,
  weeklyWins: 1,
  monthlyWins: 0,
  currentStreak: 3,
};

const at = (r: Revision) => new Date(r.createdAt);

const placeMatches = (r: Revision, where: RevisionWhere) =>
  (where.author?.in ?? []).includes(r.author) &&
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
    lorewardUserStats: { findFirst: jest.fn(async () => STATS) },
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
  winnerUser: "Kir Republic",
  winnerPage: null,
  runnerUpUser: null,
  runnerUpPage: null,
  status: "approved",
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-17T12:00:00.000Z") });
});
afterEach(() => {
  jest.useRealTimers();
});

describe("loadMyTrophies", () => {
  it("gives a viewer with a verified link the name's whole record, without reading revisions", async () => {
    const db = fakeDb([], [], [{ userId: "u2", username: "Kir Republic" }]);
    expect(await loadMyTrophies(db as never, "u2")).toEqual({
      wikiUsername: "Kir Republic",
      verified: true,
      unmatched: 0,
      wins: { daily: 6, weekly: 1, monthly: 0 },
      runnerUps: 2,
      streak: 3,
      cards: [],
    });
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("has no wiki name for a viewer with no link and no ixwiki edits", async () => {
    const db = fakeDb([], [daily("2026-10-16")]);
    expect(await loadMyTrophies(db as never, "u2")).toMatchObject({
      wikiUsername: null,
      verified: false,
      unmatched: 0,
      wins: { daily: 0, weekly: 0, monthly: 0 },
    });
    expect(db.lorewardEntry.findMany).not.toHaveBeenCalled();
  });

  it("counts only the places whose winning edits are all the viewer's, never the name's stats row", async () => {
    const db = fakeDb(
      [
        edit("Kir_Republic", "u2", "2026-10-14T09:00:00.000Z", "First steps"),
        edit("Kir_Republic", "u2", "2026-10-16T10:00:00.000Z", "Seneca front"),
        edit("Kir_Republic", "u2", "2026-10-17T10:00:00.000Z", "Tide charts"),
        edit("Kir Republic", null, "2026-10-17T11:00:00.000Z", "Tide charts"),
        edit("Kir_Republic", "u2", "2026-10-15T10:00:00.000Z", "Isurians"),
      ],
      [
        daily("2026-10-16", { winnerPage: "Seneca front" }),
        // A MediaWiki edit under the name is among the winning edits.
        daily("2026-10-17", { winnerPage: "Tide charts" }),
        daily("2026-10-15", {
          winnerUser: "Rumahoki",
          runnerUpUser: "Kir Republic",
          runnerUpPage: "Isurians",
        }),
        // Before the viewer's first WikiOS edit: the real winner's, not theirs.
        daily("2019-05-01", { winnerPage: "Old page" }),
        { ...daily("2026-W42"), type: "weekly", dateStart: "2026-10-12", dateEnd: "2026-10-18" },
      ]
    );

    expect(await loadMyTrophies(db as never, "u2")).toEqual({
      wikiUsername: "Kir_Republic",
      verified: false,
      unmatched: 3,
      wins: { daily: 1, weekly: 0, monthly: 0 },
      runnerUps: 1,
      streak: 1,
      cards: [],
    });
    expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
    // The 2019 place is never looked up: it ended before the viewer's first edit.
    const pages = db.wikiRevision.groupBy.mock.calls.map(([args]) => args.where.article?.title);
    expect(pages).not.toContain("Old page");
  });

  it("leaves out a place whose name another account verified", async () => {
    const db = fakeDb(
      [edit("Kir Republic", "u2", "2026-10-16T10:00:00.000Z", "Seneca front")],
      [daily("2026-10-16", { winnerPage: "Seneca front" })],
      [{ userId: "u9", username: "Kir Republic" }]
    );
    expect(await loadMyTrophies(db as never, "u2")).toMatchObject({
      wikiUsername: "Kir Republic",
      unmatched: 0,
      wins: { daily: 0, weekly: 0, monthly: 0 },
    });
  });
});

describe("myRaceRank", () => {
  const race = {
    date: "2026-10-17",
    editCount: 4,
    entries: [
      {
        rank: 1,
        user: "Kir Republic",
        page: "Shared page",
        score: 900,
        bytesAdded: 1,
        editCount: 2,
      },
      {
        rank: 3,
        user: "Kir Republic",
        page: "Tide charts",
        score: 300,
        bytesAdded: 1,
        editCount: 1,
      },
    ],
  };

  it("ranks a verified viewer by their name", async () => {
    const db = fakeDb([], []);
    const mine = { wikiUsername: "kir republic", verified: true };
    expect(await myRaceRank(db as never, race, mine, "u2")).toBe(1);
  });

  it("ranks an unlinked viewer only by an entry whose edits today are all theirs", async () => {
    const db = fakeDb(
      [
        edit("Kir_Republic", "u2", "2026-10-17T08:00:00.000Z", "Shared page"),
        edit("Kir Republic", null, "2026-10-17T09:00:00.000Z", "Shared page"),
        edit("Kir_Republic", "u2", "2026-10-17T10:00:00.000Z", "Tide charts"),
      ],
      []
    );
    const mine = { wikiUsername: "Kir_Republic", verified: false };
    expect(await myRaceRank(db as never, race, mine, "u2")).toBe(3);
    expect(await myRaceRank(db as never, race, mine, "u9")).toBeNull();
  });
});
