/** @jest-environment node */
/**
 * Platform metrics (account scope): wiki activity only through a verified link, forum and ThinkTank
 * counts, the posting and claim streaks, card activity (trophy cards out of deck value), Lorewards
 * through the link, and the Renaissance week (wiki edit, post and card activity in one ISO week).
 */
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
  "platform-cards-deck": [{ value: 0 }],
  "platform-renaissance": [{ weeks: 0 }],
};

describe("registry shape", () => {
  it("every loader is account-scope and its keys are unique across the set", () => {
    expect(PLATFORM_LOADERS.every((l) => l.scope === "account")).toBe(true);
    const keys = PLATFORM_LOADERS.flatMap((l) => l.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("drops the NOT LIVE sets key and the map-edit key Task 14 owns", () => {
    const keys = PLATFORM_LOADERS.flatMap((l) => l.keys);
    expect(keys).not.toContain("setsCompleted");
    expect(keys).not.toContain("mapEditsApprovedByUser");
    expect(keys).not.toContain("mapEditsApproved");
  });

  it("each loader returns exactly its declared keys, in at most 3 queries and no row lists", async () => {
    for (const loader of PLATFORM_LOADERS) {
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

describe("wiki loader", () => {
  it("is zero and queries no revisions without a verified link", async () => {
    const db = rawDb();
    unlinked(db);
    const result = await wikiLoader.load(ctx(db));
    expect(result).toEqual({ wikiEdits: 0, wikiArticlesCreated: 0, wikiDistinctPages: 0 });
    expect(db.wikiAccountLink.findFirst.mock.calls[0]![0].where).toEqual({
      userId: "u1",
      source: "ixwiki",
      verifiedAt: { not: null },
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("aggregates edits, created articles and distinct pages in one query on the link's username", async () => {
    const db = rawDb([{ edits: 120, created: 11, pages: 50 }]);
    linked(db, "Urcea");
    const result = await wikiLoader.load(ctx(db));

    expect(result).toEqual({ wikiEdits: 120, wikiArticlesCreated: 11, wikiDistinctPages: 50 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const { sql, params } = sqlOf(db);
    expect(params).toEqual(["Urcea"]);
    expect(sql).toContain('COUNT(DISTINCT r."articleId")');
    expect(sql).toContain("r.author = ?");
    expect(sql).toContain("r.parked = false");
    expect(sql).toContain('r."userDeleted" = false');
    expect(sql).toContain('r."parentRevisionId" IS NULL AND a.namespace = 0');
    expect(sql).toContain('a."redirectTargetSlug" IS NULL');
  });

  it("is zero when the aggregate returns no row", async () => {
    const db = rawDb([]);
    linked(db);
    expect(await wikiLoader.load(ctx(db))).toEqual({
      wikiEdits: 0,
      wikiArticlesCreated: 0,
      wikiDistinctPages: 0,
    });
  });
});

describe("forum loader", () => {
  it("replies are posts minus the user's own thread openers, and never below zero", async () => {
    const db = createMockPrisma();
    db.forumThread.count.mockResolvedValue(10);
    db.forumPost.count.mockResolvedValueOnce(110).mockResolvedValueOnce(7);
    expect(await forumLoader.load(ctx(db))).toEqual({
      forumThreads: 10,
      forumReplies: 100,
      repliesReceived: 7,
    });
    db.forumThread.count.mockResolvedValue(3);
    db.forumPost.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    expect((await forumLoader.load(ctx(db))).forumReplies).toBe(0);
  });
  it("filters hidden rows and counts replies received from other authors on the user's threads", async () => {
    const db = createMockPrisma();
    db.forumThread.count.mockResolvedValue(0);
    db.forumPost.count.mockResolvedValue(0);
    await forumLoader.load(ctx(db));
    expect(db.forumThread.count.mock.calls[0]![0].where).toEqual({
      authorUserId: "u1",
      hidden: false,
    });
    expect(db.forumPost.count.mock.calls[0]![0].where).toEqual({
      authorUserId: "u1",
      hidden: false,
    });
    expect(db.forumPost.count.mock.calls[1]![0].where).toEqual({
      hidden: false,
      thread: { authorUserId: "u1", hidden: false },
      OR: [{ authorUserId: null }, { authorUserId: { not: "u1" } }],
    });
  });
});
describe("ThinkTank loader", () => {
  it("counts groups founded and joined by Clerk id, leaving out realm boards and own groups", async () => {
    const db = createMockPrisma();
    db.thinktankGroup.count.mockResolvedValue(2);
    db.thinktankMember.count.mockResolvedValue(3);
    expect(await thinkTankLoader.load(ctx(db))).toEqual({
      thinkTankFounded: 2,
      thinkTankJoined: 3,
    });
    expect(db.thinktankGroup.count.mock.calls[0]![0].where).toEqual({
      createdBy: "clerk",
      isActive: true,
      type: { not: "realm_board" },
    });
    expect(db.thinktankMember.count.mock.calls[0]![0].where).toEqual({
      userId: "clerk",
      isActive: true,
      group: { createdBy: { not: "clerk" }, isActive: true, type: { not: "realm_board" } },
    });
  });
});
describe("posting streak", () => {
  it("longestDayRun: 7 consecutive UTC days is 7, 6 is 6, a gap breaks the run", () => {
    const run = (days: number[]) => longestDayRun(days.map((n) => day(n)));
    expect(run([8, 9, 10, 11, 12, 13, 14])).toBe(7);
    expect(run([9, 10, 11, 12, 13, 14])).toBe(6);
    expect(run([8, 9, 10, 12, 13, 14])).toBe(3);
    expect(run([])).toBe(0);
  });

  it("counts a day once however many posts it holds, and uses UTC days", () => {
    expect(longestDayRun([day(10, 1), day(10, 5), day(10, 23)])).toBe(1);
    // 23:59 on the 10th and 00:01 on the 11th are consecutive days
    expect(
      longestDayRun([new Date("2026-10-10T23:59:00Z"), new Date("2026-10-11T00:01:00Z")])
    ).toBe(2);
  });

  it("reads the distinct days of human ThinkPages posts and visible forum posts from the last 14 days", async () => {
    const db = rawDb([8, 9, 10, 11, 12, 13, 14].map((n) => ({ day: day(n) })));

    expect(await postingStreakLoader.load(ctx(db))).toEqual({ postingStreakDays: 7 });

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const { sql, params } = sqlOf(db);
    expect(params).toEqual([
      "clerk",
      new Date(Date.UTC(2026, 9, 1)),
      "u1",
      new Date(Date.UTC(2026, 9, 1)),
    ]);
    expect(sql).toContain('p."isAutoGenerated" = false');
    expect(sql).toContain('p."repostOfId" IS NULL');
    expect(sql).toContain("f.hidden = false");
  });

  it("a streak broken by one missing day is not 7", async () => {
    const db = rawDb([8, 9, 10, 12, 13, 14].map((n) => ({ day: day(n) })));
    expect((await postingStreakLoader.load(ctx(db))).postingStreakDays).toBe(3);
  });
});

describe("claim streak", () => {
  const vault = (loginStreak: number, lastLoginDate: Date | null) => ({
    loginStreak,
    lastLoginDate,
  });

  it("a claim today or yesterday keeps the streak; an older one has lapsed", () => {
    expect(effectiveClaimStreak(vault(30, day(14, 1)), NOW)).toBe(30);
    expect(effectiveClaimStreak(vault(30, day(13, 23)), NOW)).toBe(30);
    expect(effectiveClaimStreak(vault(30, day(12, 23)), NOW)).toBe(0);
    expect(effectiveClaimStreak(vault(30, null), NOW)).toBe(0);
    expect(effectiveClaimStreak(null, NOW)).toBe(0);
  });
});

describe("cards activity loader", () => {
  it("counts packs opened, accepted trades and completed auction sales", async () => {
    const db = createMockPrisma();
    db.userPack.count.mockResolvedValue(25);
    db.tradeOffer.count.mockResolvedValue(10);
    db.cardAuction.count.mockResolvedValue(1);
    expect(await cardsActivityLoader.load(ctx(db))).toEqual({
      packsOpened: 25,
      tradesCompleted: 10,
      auctionSales: 1,
    });
    expect(db.userPack.count.mock.calls[0]![0].where).toEqual({ userId: "u1", isOpened: true });
    expect(db.tradeOffer.count.mock.calls[0]![0].where).toEqual({
      status: "ACCEPTED",
      OR: [{ initiatorId: "u1" }, { recipientId: "u1" }],
    });
    expect(db.cardAuction.count.mock.calls[0]![0].where).toEqual({
      sellerId: "u1",
      status: "COMPLETED",
    });
  });
});

describe("cards deck loader", () => {
  function setup(deck: unknown = [{ value: 0 }]) {
    const db = rawDb(deck);
    db.cardOwnership.count.mockResolvedValue(1);
    db.myVault.findUnique.mockResolvedValue({ loginStreak: 7, lastLoginDate: day(14, 2) });
    return db;
  }

  it("reads Legendaries, the trophy-excluding deck value and the effective claim streak", async () => {
    const db = setup([{ value: 10_000 }]);
    expect(await cardsDeckLoader.load(ctx(db))).toEqual({
      legendaryOwned: 1,
      deckValueExTrophy: 10_000,
      claimStreakDays: 7,
    });
  });

  it("a Legendary counts only from a pack or trade, never a trophy, retired or imported card", async () => {
    const db = setup();
    await cardsDeckLoader.load(ctx(db));
    expect(db.cardOwnership.count.mock.calls[0]![0].where).toEqual({
      ownerId: "u1",
      cards: { rarity: "LEGENDARY", isRetired: false, lorewardEntryId: null },
      transferEvents: { some: { toUserId: "u1", action: { in: ["PACK_OPEN", "TRADE"] } } },
    });
  });

  it("sums deck value in the database over live, non-trophy cards, with the user id bound", async () => {
    const db = setup([{ value: 9800 }]);
    await cardsDeckLoader.load(ctx(db));
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    const { sql, params } = sqlOf(db);
    expect(params).toEqual(["u1"]);
    expect(sql).toContain('SUM(c."marketValue" * o.quantity)');
    expect(sql).toContain('c."isRetired" = false');
    expect(sql).toContain('c."lorewardEntryId" IS NULL');
  });

  it("deck value is 0 when the aggregate returns no row, and the claim streak is 0 without a vault", async () => {
    const db = setup([]);
    db.myVault.findUnique.mockResolvedValue(null);
    const result = await cardsDeckLoader.load(ctx(db));
    expect(result.deckValueExTrophy).toBe(0);
    expect(result.claimStreakDays).toBe(0);
  });
});

describe("Lorewards loader", () => {
  it("is zero without a verified link", async () => {
    const db = createMockPrisma();
    unlinked(db);
    const result = await lorewardsLoader.load(ctx(db));
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
    expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
  });

  it("reads the stats row of the linked username, case-insensitively", async () => {
    const db = createMockPrisma();
    linked(db, "Urcea");
    db.lorewardUserStats.findFirst.mockResolvedValue({
      dailyWins: 235,
      weeklyWins: 4,
      monthlyWins: 1,
      dailyRunnerUps: 9,
      longestStreak: 8,
    });
    expect(await lorewardsLoader.load(ctx(db))).toEqual({
      lorewardDailyWins: 235,
      lorewardWeeklyWins: 4,
      lorewardMonthlyWins: 1,
      lorewardRunnerUps: 9,
      lorewardWinStreak: 8,
    });
    expect(db.lorewardUserStats.findFirst.mock.calls[0]![0].where).toEqual({
      username: { equals: "Urcea", mode: "insensitive" },
    });
  });

  it("is zero when the linked account has no stats row", async () => {
    const db = createMockPrisma();
    linked(db);
    db.lorewardUserStats.findFirst.mockResolvedValue(null);
    expect((await lorewardsLoader.load(ctx(db))).lorewardDailyWins).toBe(0);
  });
});

describe("creations loader", () => {
  it("counts Onoma language packs by User.id and published Vexel designs by Clerk id", async () => {
    const db = createMockPrisma();
    db.languagePack.count.mockResolvedValue(2);
    db.heraldryAchievement.count.mockResolvedValue(1);
    expect(await creationsLoader.load(ctx(db))).toEqual({ onomaCreations: 2, vexelPublished: 1 });
    expect(db.languagePack.count.mock.calls[0]![0].where).toEqual({ userId: "u1" });
    expect(db.heraldryAchievement.count.mock.calls[0]![0].where).toEqual({
      ownerId: "clerk",
      isPublished: true,
    });
  });
});

describe("Renaissance week loader", () => {
  const since = new Date(NOW.getTime() - 14 * DAY);

  it("is 1 when one aggregate query finds an ISO week with all three kinds of activity", async () => {
    const db = rawDb([{ weeks: 1 }]);
    linked(db, "Urcea");
    expect(await renaissanceLoader.load(ctx(db))).toEqual({ renaissanceWeek: 1 });

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const { sql, params } = sqlOf(db);
    // wiki author, ThinkPages clerk id + since, forum user + since, packs, trades x2 + since, sales, week keys
    expect(params).toEqual([
      "Urcea",
      since,
      "clerk",
      since,
      "u1",
      since,
      "u1",
      since,
      "u1",
      "u1",
      since,
      "u1",
      since,
      NOW,
      "2026-W42",
      "2026-W41",
    ]);
    expect(sql).toContain("HAVING COUNT(DISTINCT kind) = 3");
    expect(sql).toContain('IYYY-"W"IW');
    expect(sql).toContain('p."isAutoGenerated" = false');
    expect(sql).toContain("r.parked = false");
  });

  it("is 0 when no week holds all three", async () => {
    const db = rawDb([{ weeks: 0 }]);
    linked(db);
    expect(await renaissanceLoader.load(ctx(db))).toEqual({ renaissanceWeek: 0 });
    const empty = rawDb([]);
    linked(empty);
    expect(await renaissanceLoader.load(ctx(empty))).toEqual({ renaissanceWeek: 0 });
  });

  it("is 0 without a verified link and runs no activity query", async () => {
    const db = rawDb();
    unlinked(db);
    expect(await renaissanceLoader.load(ctx(db))).toEqual({ renaissanceWeek: 0 });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
