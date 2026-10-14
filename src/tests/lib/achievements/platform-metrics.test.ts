/** @jest-environment node */
/**
 * Platform metrics (account scope): wiki activity only through a verified link, forum and ThinkTank
 * counts, the posting and claim streaks, card activity (trophy cards out of deck value), Lorewards
 * through the link, and the Renaissance week (wiki edit, post and card activity in one ISO week).
 */
import type { MetricContext } from "~/lib/achievements/metrics/registry";
import {
  PLATFORM_LOADERS,
  cardsLoader,
  creationsLoader,
  effectiveClaimStreak,
  forumLoader,
  longestDayRun,
  lorewardsLoader,
  postingStreakLoader,
  renaissanceLoader,
  renaissanceWeek,
  thinkTankLoader,
  wikiLoader,
} from "~/lib/achievements/metrics/platform";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const DAY = 86_400_000;
// A Wednesday in ISO week 2026-W42 (Monday 2026-10-12).
const NOW = new Date("2026-10-14T12:00:00.000Z");
const day = (n: number, hour = 9) => new Date(Date.UTC(2026, 9, n, hour));

type Db = ReturnType<typeof createMockPrisma>;
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

  it("each loader returns exactly its declared keys", async () => {
    for (const loader of PLATFORM_LOADERS) {
      const db = createMockPrisma();
      linked(db);
      for (const model of [
        "wikiRevision",
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
      db.wikiRevision.groupBy.mockResolvedValue([]);
      const result = await loader.load(ctx(db));
      expect(Object.keys(result).sort()).toEqual([...loader.keys].sort());
    }
  });
});

describe("wiki loader", () => {
  it("is zero and queries no revisions without a verified link", async () => {
    const db = createMockPrisma();
    unlinked(db);
    const result = await wikiLoader.load(ctx(db));
    expect(result).toEqual({ wikiEdits: 0, wikiArticlesCreated: 0, wikiDistinctPages: 0 });
    expect(db.wikiAccountLink.findFirst.mock.calls[0]![0].where).toEqual({
      userId: "u1",
      source: "ixwiki",
      verifiedAt: { not: null },
    });
    expect(db.wikiRevision.count).not.toHaveBeenCalled();
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("matches revisions by the link's username exactly (authorId is never set)", async () => {
    const db = createMockPrisma();
    linked(db, "Urcea");
    db.wikiRevision.count.mockResolvedValueOnce(120).mockResolvedValueOnce(11);
    db.wikiRevision.groupBy.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ articleId: `a${i}` }))
    );
    const result = await wikiLoader.load(ctx(db));

    expect(result).toEqual({ wikiEdits: 120, wikiArticlesCreated: 11, wikiDistinctPages: 50 });
    const base = { author: "Urcea", source: "ixwiki", parked: false, userDeleted: false };
    expect(db.wikiRevision.count.mock.calls[0]![0].where).toEqual(base);
    expect(db.wikiRevision.count.mock.calls[1]![0].where).toEqual({
      ...base,
      parentRevisionId: null,
      article: { namespace: 0, redirectTargetSlug: null },
    });
    expect(db.wikiRevision.groupBy.mock.calls[0]![0]).toEqual({ by: ["articleId"], where: base });
  });

  it("counts 49 distinct pages as 49", async () => {
    const db = createMockPrisma();
    linked(db);
    db.wikiRevision.count.mockResolvedValue(60);
    db.wikiRevision.groupBy.mockResolvedValue(
      Array.from({ length: 49 }, (_, i) => ({ articleId: `a${i}` }))
    );
    expect((await wikiLoader.load(ctx(db))).wikiDistinctPages).toBe(49);
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

  it("merges human ThinkPages posts and visible forum posts from the last 14 days", async () => {
    const db = createMockPrisma();
    db.thinkpagesPost.findMany.mockResolvedValue(
      [8, 9, 10, 11].map((n) => ({ createdAt: day(n) }))
    );
    db.forumPost.findMany.mockResolvedValue([12, 13, 14].map((n) => ({ createdAt: day(n) })));

    expect(await postingStreakLoader.load(ctx(db))).toEqual({ postingStreakDays: 7 });

    const since = new Date(Date.UTC(2026, 9, 1));
    expect(db.thinkpagesPost.findMany.mock.calls[0]![0].where).toEqual({
      isAutoGenerated: false,
      repostOfId: null,
      account: { clerkUserId: "clerk" },
      createdAt: { gte: since },
    });
    expect(db.forumPost.findMany.mock.calls[0]![0].where).toEqual({
      authorUserId: "u1",
      hidden: false,
      createdAt: { gte: since },
    });
  });

  it("a streak broken by one missing day is not 7", async () => {
    const db = createMockPrisma();
    db.thinkpagesPost.findMany.mockResolvedValue(
      [8, 9, 10, 12, 13, 14].map((n) => ({ createdAt: day(n) }))
    );
    db.forumPost.findMany.mockResolvedValue([]);
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

describe("cards loader", () => {
  function setup() {
    const db = createMockPrisma();
    db.userPack.count.mockResolvedValue(25);
    db.tradeOffer.count.mockResolvedValue(10);
    db.cardAuction.count.mockResolvedValue(1);
    db.cardOwnership.count.mockResolvedValue(1);
    db.cardOwnership.findMany.mockResolvedValue([]);
    db.myVault.findUnique.mockResolvedValue({ loginStreak: 7, lastLoginDate: day(14, 2) });
    return db;
  }

  it("reads packs, trades, sales, Legendaries and the effective claim streak", async () => {
    const db = setup();
    const result = await cardsLoader.load(ctx(db));

    expect(result).toEqual({
      packsOpened: 25,
      tradesCompleted: 10,
      auctionSales: 1,
      legendaryOwned: 1,
      deckValueExTrophy: 0,
      claimStreakDays: 7,
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

  it("a Legendary counts only from a pack or trade, never a trophy, retired or imported card", async () => {
    const db = setup();
    await cardsLoader.load(ctx(db));
    expect(db.cardOwnership.count.mock.calls[0]![0].where).toEqual({
      ownerId: "u1",
      cards: { rarity: "LEGENDARY", isRetired: false, lorewardEntryId: null },
      transferEvents: { some: { toUserId: "u1", action: { in: ["PACK_OPEN", "TRADE"] } } },
    });
  });

  it("deck value sums market value times quantity and asks the database to leave trophy cards out", async () => {
    const db = setup();
    db.cardOwnership.findMany.mockResolvedValue([
      { quantity: 2, cards: { marketValue: 100 } },
      { quantity: 1, cards: { marketValue: 9800 } },
    ]);
    const result = await cardsLoader.load(ctx(db));

    expect(result.deckValueExTrophy).toBe(10_000);
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({
      ownerId: "u1",
      cards: { isRetired: false, lorewardEntryId: null },
    });
  });

  it("claim streak is zero for a user with no vault", async () => {
    const db = setup();
    db.myVault.findUnique.mockResolvedValue(null);
    expect((await cardsLoader.load(ctx(db))).claimStreakDays).toBe(0);
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

describe("Renaissance week", () => {
  const wiki = [day(13)];
  const posts = [day(14)];
  const cards = [day(12)];

  it("needs a wiki edit, a post and card activity in one ISO week", () => {
    expect(renaissanceWeek({ wiki, posts, cards }, NOW)).toBe(1);
    expect(renaissanceWeek({ wiki: [], posts, cards }, NOW)).toBe(0);
    expect(renaissanceWeek({ wiki, posts: [], cards }, NOW)).toBe(0);
    expect(renaissanceWeek({ wiki, posts, cards: [] }, NOW)).toBe(0);
  });

  it("does not combine activity from different weeks", () => {
    // Sunday 11 Oct is last week, Monday 12 Oct this week
    expect(renaissanceWeek({ wiki: [day(11)], posts, cards }, NOW)).toBe(0);
  });

  it("counts the previous week, but not the one before it", () => {
    expect(renaissanceWeek({ wiki: [day(6)], posts: [day(7)], cards: [day(11)] }, NOW)).toBe(1);
    expect(renaissanceWeek({ wiki: [day(4)], posts: [day(5)], cards: [day(1)] }, NOW)).toBe(0);
  });

  it("loads the three activity streams since 14 days back, wiki only through a link", async () => {
    const db = createMockPrisma();
    linked(db, "Urcea");
    db.wikiRevision.findMany.mockResolvedValue([{ createdAt: day(13) }]);
    db.thinkpagesPost.findMany.mockResolvedValue([{ createdAt: day(14) }]);
    db.forumPost.findMany.mockResolvedValue([]);
    db.userPack.findMany.mockResolvedValue([{ openedAt: day(12) }, { openedAt: null }]);
    db.tradeOffer.findMany.mockResolvedValue([]);
    db.cardAuction.findMany.mockResolvedValue([]);

    expect(await renaissanceLoader.load(ctx(db))).toEqual({ renaissanceWeek: 1 });

    const since = new Date(NOW.getTime() - 14 * DAY);
    expect(db.wikiRevision.findMany.mock.calls[0]![0].where).toEqual({
      author: "Urcea",
      source: "ixwiki",
      parked: false,
      userDeleted: false,
      createdAt: { gte: since },
    });
    expect(db.userPack.findMany.mock.calls[0]![0].where).toEqual({
      userId: "u1",
      isOpened: true,
      openedAt: { gte: since },
    });
    expect(db.tradeOffer.findMany.mock.calls[0]![0].where).toEqual({
      status: "ACCEPTED",
      respondedAt: { gte: since },
      OR: [{ initiatorId: "u1" }, { recipientId: "u1" }],
    });
    expect(db.cardAuction.findMany.mock.calls[0]![0].where).toEqual({
      sellerId: "u1",
      status: "COMPLETED",
      endTime: { gte: since, lte: NOW },
    });
  });

  it("is 0 without a verified link, whatever else the user did", async () => {
    const db = createMockPrisma();
    unlinked(db);
    db.thinkpagesPost.findMany.mockResolvedValue([{ createdAt: day(14) }]);
    db.forumPost.findMany.mockResolvedValue([]);
    db.userPack.findMany.mockResolvedValue([{ openedAt: day(12) }]);
    db.tradeOffer.findMany.mockResolvedValue([]);
    db.cardAuction.findMany.mockResolvedValue([]);

    expect(await renaissanceLoader.load(ctx(db))).toEqual({ renaissanceWeek: 0 });
    expect(db.wikiRevision.findMany).not.toHaveBeenCalled();
  });
});
