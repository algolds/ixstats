/** @jest-environment node */
/**
 * Platform metrics (account scope): wiki activity only through a verified link, forum and ThinkTank
 * counts, the posting and claim streaks, card activity (trophy cards out of deck value), Lorewards
 * through the link, and the Renaissance week (wiki edit, post and card activity in one ISO week).
 */
jest.mock("~/lib/cards/copy-value", () => ({
  deckValueOf: jest.fn(async () => ({ total: 0, exTrophy: 0 })),
}));

import type { MetricContext } from "~/lib/achievements/metrics/registry";
import {
  PLATFORM_LOADERS,
  cardsActivityLoader,
  cardsDeckLoader,
  creationsLoader,
  effectiveClaimStreak,
  forumLoader,
  longestDayRun,
  lorewardsLoader,
  postingStreakLoader,
  renaissanceLoader,
  thinkTankLoader,
  wikiLoader,
} from "~/lib/achievements/metrics/platform";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { deckValueOf } from "~/lib/cards/copy-value";

const DAY = 86_400_000;
// A Wednesday in ISO week 2026-W42 (Monday 2026-10-12).
const NOW = new Date("2026-10-14T12:00:00.000Z");
const day = (n: number, hour = 9) => new Date(Date.UTC(2026, 9, n, hour));

type Db = ReturnType<typeof createMockPrisma>;
/** A mock client whose `$queryRaw` resolves each call to the next given result. */
const rawDb = (...results: unknown[]): Db => {
  const $queryRaw = jest.fn();
  for (const result of results) $queryRaw.mockResolvedValueOnce(result);
  return createMockPrisma({ $queryRaw });
};
/** The SQL text and bound parameters of one `$queryRaw` tagged-template call. */
const sqlOf = (db: Db, call = 0) => {
  const [strings, ...params] = db.$queryRaw.mock.calls[call]!;
  return { sql: (strings as string[]).join("?"), params };
};
const ctx = (db: Db): MetricContext => ({
  db: db as never,
  clerkUserId: "clerk",
  userId: "u1",
  countryId: null,
  now: NOW,
});

const linked = (db: Db, username = "Urcea") =>
  db.wikiAccountLink.findFirst.mockResolvedValue({ username });
const unlinked = (db: Db) => db.wikiAccountLink.findFirst.mockResolvedValue(null);

/** What each raw-query loader's single aggregate returns in the declared-keys check. */
const RAW_ROWS: Record<string, unknown[]> = {
  "platform-wiki": [{ edits: 0, created: 0, pages: 0 }],
  "platform-renaissance": [{ weeks: 0 }],
};

describe("registry shape", () => {
  it("every loader is account-scope and its keys are unique across the set", () => {
    expect(PLATFORM_LOADERS.every((l) => l.scope === "account")).toBe(true);
    const keys = PLATFORM_LOADERS.flatMap((l) => l.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });
  /**
   * The one loader allowed reads past the 3-query budget, and why (the header of metrics/platform.ts). Its deck value
   * is the shared per-copy value, mocked in this file, so its reads are not counted here: no other loader may reach it.
   */
  const BUDGET_EXEMPT: Record<string, string> = {
    "platform-cards-deck":
      "deckValueOf (src/lib/cards/copy-value.ts): batched reads of the player's live copies, bounded by card capacity",
  };

  it("each loader returns exactly its declared keys, in at most 3 queries and no row lists, bar the named exemption", async () => {
    for (const loader of PLATFORM_LOADERS) {
      jest.mocked(deckValueOf).mockClear();
      const db = rawDb(RAW_ROWS[loader.id] ?? []);
      linked(db);
      for (const model of [
        "forumThread",
        "forumPost",
        "thinktankGroup",
        "thinktankMember",
        "userPack",
        "tradeOffer",
        "cardAuction",
        "cardOwnership",
        "languagePack",
        "heraldryAchievement",
      ]) {
        db[model]!.count!.mockResolvedValue(0);
      }
      db.myVault.findUnique.mockResolvedValue(null);
      const result = await loader.load(ctx(db));
      expect(Object.keys(result).sort()).toEqual([...loader.keys].sort());

      const queries = Object.entries(db).flatMap(([name, delegate]) =>
        name === "$queryRaw"
          ? [db.$queryRaw]
          : typeof delegate === "object" && delegate !== null
            ? Object.values(delegate as Record<string, jest.Mock>)
            : []
      );
      const calls = queries.reduce((n, fn) => n + (fn.mock?.calls.length ?? 0), 0);
      expect(calls).toBeLessThanOrEqual(3);
      // Only the exempt loader reads through the mocked (uncounted) deck value.
      expect([loader.id, jest.mocked(deckValueOf).mock.calls.length > 0]).toEqual([
        loader.id,
        loader.id in BUDGET_EXEMPT,
      ]);
      for (const model of ["wikiRevision", "thinkpagesPost"]) {
        expect(db[model]?.findMany?.mock.calls.length ?? 0).toBe(0);
        expect(db[model]?.groupBy?.mock.calls.length ?? 0).toBe(0);
      }
    }
  });

  it("resolves the verified wiki username once per evaluation, whichever loaders ask", async () => {
    const db = rawDb([{ edits: 1, created: 0, pages: 1 }], [{ weeks: 0 }]);
    linked(db);
    db.lorewardUserStats.findFirst.mockResolvedValue(null);
    const shared = ctx(db);
    await Promise.all([wikiLoader, lorewardsLoader, renaissanceLoader].map((l) => l.load(shared)));
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe("raw-query loaders", () => {
  it("wiki: aggregates the account's own revisions, plus MediaWiki imports with no account under exactly the link's name", async () => {
    const db = rawDb([{ edits: 120, created: 11, pages: 50 }]);
    linked(db, "Urcea");
    expect(await wikiLoader.load(ctx(db))).toEqual({ wikiEdits: 120, wikiArticlesCreated: 11, wikiDistinctPages: 50 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const { sql, params } = sqlOf(db);
    // A row under "Urcea" that carries another account's id (a WikiOS label) is not counted.
    expect(params).toEqual(["u1", "Urcea"]);
    expect(sql).toContain('(r."authorId" = ? OR (r."authorId" IS NULL AND r.author = ?))');
    expect(sql).toContain('COUNT(DISTINCT r."articleId")');
    expect(sql).toContain("r.parked = false");
    expect(sql).toContain('r."userDeleted" = false');
    expect(sql).toContain('r."parentRevisionId" IS NULL AND a.namespace = 0');
    expect(sql).toContain('a."redirectTargetSlug" IS NULL');
  });

  it.each([
    ["no verified link (the name arm binds NULL, which matches no account-less row)", null, [{ edits: 3, created: 1, pages: 2 }], ["u1", null], { wikiEdits: 3, wikiArticlesCreated: 1, wikiDistinctPages: 2 }],
    ["no aggregate row", "Urcea", [], ["u1", "Urcea"], { wikiEdits: 0, wikiArticlesCreated: 0, wikiDistinctPages: 0 }],
  ] as const)("wiki with %s", async (_case, link, rows, params, expected) => {
    const db = rawDb(rows);
    if (link) linked(db, link);
    else unlinked(db);
    expect(await wikiLoader.load(ctx(db))).toEqual(expected);
    expect(sqlOf(db).params).toEqual(params);
  });

  it("posting streak: the distinct days of human ThinkPages posts and visible forum posts from the last 14 days", async () => {
    const db = rawDb([8, 9, 10, 11, 12, 13, 14].map((n) => ({ day: day(n) })));
    expect(await postingStreakLoader.load(ctx(db))).toEqual({ postingStreakDays: 7 });
    const { sql, params } = sqlOf(db);
    expect(params).toEqual(["clerk", new Date(Date.UTC(2026, 9, 1)), "u1", new Date(Date.UTC(2026, 9, 1))]);
    expect(sql).toContain('p."isAutoGenerated" = false');
    expect(sql).toContain('p."repostOfId" IS NULL');
    expect(sql).toContain("f.hidden = false");
  });

  it("Renaissance week: one aggregate finds an ISO week with all three kinds of activity", async () => {
    const since = new Date(NOW.getTime() - 14 * DAY);
    const db = rawDb([{ weeks: 1 }]);
    linked(db, "Urcea");
    expect(await renaissanceLoader.load(ctx(db))).toEqual({ renaissanceWeek: 1 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const { sql, params } = sqlOf(db);
    // wiki account + link name, ThinkPages clerk id + since, forum user + since, packs, trades x2 + since, sales,
    // week keys
    expect(params).toEqual([
      "u1", "Urcea", since, "clerk", since, "u1", since, "u1", since, "u1", "u1", since, "u1", since, NOW,
      "2026-W42", "2026-W41",
    ]);
    expect(sql).toContain("HAVING COUNT(DISTINCT kind) = 3");
    expect(sql).toContain('IYYY-"W"IW');
    expect(sql).toContain('p."isAutoGenerated" = false');
    expect(sql).toContain("r.parked = false");
    expect(sql).toContain('(r."authorId" = ? OR (r."authorId" IS NULL AND r.author = ?))');
  });

  it.each([
    ["no week holds all three", "Urcea", [{ weeks: 0 }], ["u1", "Urcea"], 0],
    ["no aggregate row", "Urcea", [], ["u1", "Urcea"], 0],
    ["no verified link (the account's own edits still count)", null, [{ weeks: 1 }], ["u1", null], 1],
    ["a link stored un-normalized (matched in WikiRevision.author's form)", "kir_Republic", [{ weeks: 0 }], ["u1", "Kir Republic"], 0],
  ] as const)("Renaissance week with %s", async (_case, link, rows, params, week) => {
    const db = rawDb(rows);
    if (link) linked(db, link);
    else unlinked(db);
    expect(await renaissanceLoader.load(ctx(db))).toEqual({ renaissanceWeek: week });
    expect(sqlOf(db).params.slice(0, 2)).toEqual(params);
  });
});

describe("count loaders", () => {
  it.each([
    {
      loader: forumLoader,
      counts: { forumThread: [10], forumPost: [110, 7] },
      expected: { forumThreads: 10, forumReplies: 100, repliesReceived: 7 },
      where: [
        ["forumThread", 0, { authorUserId: "u1", hidden: false }],
        ["forumPost", 0, { authorUserId: "u1", hidden: false }],
        // replies received: from other authors, on the user's visible threads
        ["forumPost", 1, { hidden: false, thread: { authorUserId: "u1", hidden: false }, OR: [{ authorUserId: null }, { authorUserId: { not: "u1" } }] }],
      ],
    },
    {
      loader: forumLoader,
      counts: { forumThread: [3], forumPost: [2, 0] },
      expected: { forumThreads: 3, forumReplies: 0, repliesReceived: 0 },
      where: [],
    },
    {
      loader: thinkTankLoader,
      counts: { thinktankGroup: [2], thinktankMember: [3] },
      expected: { thinkTankFounded: 2, thinkTankJoined: 3 },
      where: [
        ["thinktankGroup", 0, { createdBy: "clerk", isActive: true, type: { not: "realm_board" } }],
        ["thinktankMember", 0, { userId: "clerk", isActive: true, group: { createdBy: { not: "clerk" }, isActive: true, type: { not: "realm_board" } } }],
      ],
    },
    {
      loader: cardsActivityLoader,
      counts: { userPack: [25], tradeOffer: [10], cardAuction: [1] },
      expected: { packsOpened: 25, tradesCompleted: 10, auctionSales: 1 },
      where: [
        ["userPack", 0, { userId: "u1", isOpened: true }],
        ["tradeOffer", 0, { status: "ACCEPTED", OR: [{ initiatorId: "u1" }, { recipientId: "u1" }] }],
        ["cardAuction", 0, { sellerId: "u1", status: "COMPLETED" }],
      ],
    },
    {
      loader: creationsLoader,
      counts: { languagePack: [2], heraldryAchievement: [1] },
      expected: { onomaCreations: 2, vexelPublished: 1 },
      where: [
        ["languagePack", 0, { userId: "u1" }],
        ["heraldryAchievement", 0, { ownerId: "clerk", isPublished: true }],
      ],
    },
  ] as const)("$loader.id counts $expected from the user's own rows", async ({ loader, counts, expected, where }) => {
    const db = createMockPrisma();
    for (const [model, values] of Object.entries(counts)) {
      for (const value of values) db[model]!.count!.mockResolvedValueOnce(value);
    }
    expect(await loader.load(ctx(db))).toEqual(expected);
    for (const [model, call, clause] of where) {
      expect(db[model]!.count!.mock.calls[call]![0].where).toEqual(clause);
    }
  });
});

describe("streaks", () => {
  it.each([
    ["7 consecutive UTC days", [day(8), day(9), day(10), day(11), day(12), day(13), day(14)], 7],
    ["a gap", [day(8), day(9), day(10), day(12), day(13), day(14)], 3],
    ["several posts on one day", [day(10, 1), day(10, 5), day(10, 23)], 1],
    ["23:59 and 00:01 UTC", [new Date("2026-10-10T23:59:00Z"), new Date("2026-10-11T00:01:00Z")], 2],
    ["no posts", [], 0],
  ])("longestDayRun of %s is %d", (_case, days, run) => {
    expect(longestDayRun(days)).toBe(run);
  });

  it("a claim today or yesterday keeps the streak; an older one has lapsed", () => {
    const vault = (loginStreak: number, lastLoginDate: Date | null) => ({ loginStreak, lastLoginDate });
    expect(effectiveClaimStreak(vault(30, day(14, 1)), NOW)).toBe(30);
    expect(effectiveClaimStreak(vault(30, day(13, 23)), NOW)).toBe(30);
    expect(effectiveClaimStreak(vault(30, day(12, 23)), NOW)).toBe(0);
    expect(effectiveClaimStreak(vault(30, null), NOW)).toBe(0);
    expect(effectiveClaimStreak(null, NOW)).toBe(0);
  });
});

describe("cards deck loader", () => {
  it("counts a Legendary only from a pack or trade, values the deck by the shared copy value without trophies, and reads the effective claim streak", async () => {
    const db = rawDb();
    db.cardOwnership.count.mockResolvedValue(1);
    db.myVault.findUnique.mockResolvedValue({ loginStreak: 7, lastLoginDate: day(14, 2) });
    jest.mocked(deckValueOf).mockResolvedValue({ total: 10_500, exTrophy: 10_000 });
    expect(await cardsDeckLoader.load(ctx(db))).toEqual({
      legendaryOwned: 1,
      deckValueExTrophy: 10_000,
      claimStreakDays: 7,
    });
    expect(db.cardOwnership.count.mock.calls[0]![0].where).toEqual({
      ownerId: "u1",
      cards: { rarity: "LEGENDARY", isRetired: false, cardType: { not: "TROPHY" } },
      transferEvents: { some: { toUserId: "u1", action: { in: ["PACK_OPEN", "TRADE"] } } },
    });
    expect(jest.mocked(deckValueOf)).toHaveBeenCalledWith(db, "u1");
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("is 0 for an empty deck, and the claim streak 0 without a vault", async () => {
    const db = rawDb();
    db.cardOwnership.count.mockResolvedValue(0);
    db.myVault.findUnique.mockResolvedValue(null);
    jest.mocked(deckValueOf).mockResolvedValue({ total: 0, exTrophy: 0 });
    expect(await cardsDeckLoader.load(ctx(db))).toMatchObject({ deckValueExTrophy: 0, claimStreakDays: 0 });
  });
});

describe("Lorewards loader", () => {
  const STATS = { dailyWins: 235, weeklyWins: 4, monthlyWins: 1, dailyRunnerUps: 9, longestStreak: 8 };
  const WON = {
    lorewardDailyWins: 235,
    lorewardWeeklyWins: 4,
    lorewardMonthlyWins: 1,
    lorewardRunnerUps: 9,
    lorewardWinStreak: 8,
  };
  const NONE = Object.fromEntries(Object.keys(WON).map((k) => [k, 0]));

  it.each([
    ["no verified link", null, STATS, null, NONE],
    ["the linked username", "Urcea", STATS, "Urcea", WON],
    // MediaWiki usernames are case-sensitive after the first letter: "OstroZava" is not "Ostrozava"
    ["a link differing only in the first letter's case", "ostrozava", null, "Ostrozava", NONE],
    ["a linked account with no stats row", "Urcea", null, "Urcea", NONE],
  ] as const)("reads %s", async (_case, link, stats, username, expected) => {
    const db = createMockPrisma();
    if (link) linked(db, link);
    else unlinked(db);
    db.lorewardUserStats.findFirst.mockResolvedValue(stats);
    expect(await lorewardsLoader.load(ctx(db))).toEqual(expected);
    if (username) expect(db.lorewardUserStats.findFirst.mock.calls[0]![0].where).toEqual({ username });
    else expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
  });
});
