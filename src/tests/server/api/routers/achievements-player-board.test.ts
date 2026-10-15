/** @jest-environment node */
/**
 * The Vault achievements board is keyed by account (the Clerk id on UserAchievement), not by country:
 * `getMySummary` is the signed-in player's unlocked / points / rank, `getPlayerLeaderboard` the ranked players.
 */
import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { achievementsProgressRouter } from "~/server/api/routers/achievements/progress";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(achievementsProgressRouter);

const totals = (
  userId: string,
  totalPoints: number,
  achievementCount: number,
  rareAchievements: number
) => ({ userId, totalPoints, achievementCount, rareAchievements });

/**
 * A row of getMySummary's newest-unlock query. `rewardsJson` (the achievement's static rewards) is not selected; a
 * test sets it anyway to show the reward is never read from it.
 */
interface LatestUnlockRow {
  metadata: string | null;
  achievement: {
    key: string;
    title: string;
    rarity: string;
    category: string;
    iconUrl: string;
    rewardsJson?: string | null;
  };
}

// What the unlock wrote: the credits actually paid, not the achievement's static rewards.
const LATEST_UNLOCK: LatestUnlockRow = {
  metadata: JSON.stringify({ points: 20, rewards: { credits: 25, cardIds: [] } }),
  achievement: {
    key: "first-trade",
    title: "First trade",
    rarity: "Rare",
    category: "Cards",
    iconUrl: "Cart",
  },
};

function makeDb() {
  return {
    achievement: { count: jest.fn().mockResolvedValue(40) },
    userAchievement: {
      findMany: jest.fn(),
      // The newest unlock of an active achievement, for the caller only.
      findFirst: jest.fn(
        ({ where }: { where: { userId: string } }): Promise<LatestUnlockRow | null> =>
          Promise.resolve(where.userId === "u_me" ? LATEST_UNLOCK : null)
      ),
    },
    // The database's aggregate, already ordered: points, then active count, then user id.
    $queryRaw: jest
      .fn()
      .mockResolvedValue([
        totals("u_top", 260, 2, 1),
        totals("u_me", 100, 2, 1),
        totals("u_tie", 100, 1, 1),
        totals("u_low", 5, 1, 0),
      ]),
    user: {
      findMany: jest.fn().mockResolvedValue([
        { clerkUserId: "u_top", handle: "topdog", forumUsername: "TopForum" },
        { clerkUserId: "u_me", handle: null, forumUsername: "MeForum" },
        { clerkUserId: "u_tie", handle: null, forumUsername: null },
        { clerkUserId: "u_low", handle: "lowly", forumUsername: null },
      ]),
    },
  };
}

function callerFor(db: ReturnType<typeof makeDb>, clerkUserId: string | null = "u_me") {
  const ctx = createMockRouterContext({
    db,
    auth: clerkUserId ? { userId: clerkUserId } : null,
    user: clerkUserId ? { id: "db_me", clerkUserId } : null,
  });
  return createCaller(ctx as never);
}

describe("playerTotals", () => {
  it("is one grouped query over the joined rules, never a scan of the unlock rows", async () => {
    const db = makeDb();
    await callerFor(db).getMySummary();

    expect(db.userAchievement.findMany).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const query = db.$queryRaw.mock.calls[0]![0] as { sql: string; values: string[] };
    expect(query.sql).toMatch(/GROUP BY ua\."userId"/);
    expect(query.sql).toMatch(
      /ORDER BY "totalPoints" DESC, "achievementCount" DESC, ua\."userId" ASC/
    );
    expect(query.values).toEqual(["Rare", "Epic", "Legendary"]);
  });
});

describe("achievements.getMySummary", () => {
  it("counts the caller's unlocks of active achievements, all their points (Legacy too) and their rank", async () => {
    const db = makeDb();
    const summary = await callerFor(db).getMySummary();

    // 2 active unlocks of "N of 40"; the Legacy unlock adds its 40 points but no count
    expect(summary).toMatchObject({ unlocked: 2, activeTotal: 40, points: 100, rank: 2 });
    expect(db.achievement.count).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  it("names the caller's newest unlock of an active achievement, with its credit reward", async () => {
    const db = makeDb();
    const { latest } = await callerFor(db).getMySummary();

    expect(latest).toEqual({
      key: "first-trade",
      title: "First trade",
      rarity: "Rare",
      category: "Cards",
      iconUrl: "Cart",
      reward: 25,
    });
    expect(db.userAchievement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u_me", achievement: { isActive: true } },
        orderBy: { unlockedAt: "desc" },
      })
    );
  });

  it("shows what the unlock actually paid, not the achievement's static reward", async () => {
    const db = makeDb();
    db.userAchievement.findFirst.mockResolvedValue({
      ...LATEST_UNLOCK,
      metadata: JSON.stringify({ rewards: { credits: 40 } }),
      achievement: { ...LATEST_UNLOCK.achievement, rewardsJson: JSON.stringify({ credits: 5 }) },
    });
    expect((await callerFor(db).getMySummary()).latest?.reward).toBe(40);
  });

  it("has no reward when the unlock paid nothing or its metadata is absent, unreadable or not a number", async () => {
    const metadatas = [
      null,
      "not json",
      JSON.stringify({}),
      JSON.stringify({ rewards: { credits: 0 } }),
      JSON.stringify({ rewards: { credits: "25" } }),
      JSON.stringify({ rewards: null }),
      JSON.stringify([1, 2]),
    ];
    for (const metadata of metadatas) {
      const db = makeDb();
      db.userAchievement.findFirst.mockResolvedValue({ ...LATEST_UNLOCK, metadata });
      expect((await callerFor(db).getMySummary()).latest?.reward).toBeNull();
    }
  });

  it("gives a caller with no unlocks zeros and no rank", async () => {
    const db = makeDb();
    const summary = await callerFor(db, "u_new").getMySummary();

    expect(summary).toEqual({
      unlocked: 0,
      activeTotal: 40,
      points: 0,
      rank: null,
      latest: null,
    });
  });

  it("rejects a signed-out caller", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(callerFor(makeDb(), null).getMySummary()).rejects.toThrow();
    warn.mockRestore();
  });
});

describe("achievements.getPlayerLeaderboard", () => {
  it("ranks players by achievement points (Legacy included), ties sharing a rank, with names from the account", async () => {
    const db = makeDb();
    const board = await callerFor(db).getPlayerLeaderboard({ limit: 10 });

    expect(board.map((r) => [r.rank, r.name, r.totalPoints])).toEqual([
      [1, "topdog", 260],
      [2, "MeForum", 100],
      [2, "Player", 100],
      [4, "lowly", 5],
    ]);
    expect(board[0]).toMatchObject({ achievementCount: 2, rareAchievements: 1, isViewer: false });
    expect(board.find((r) => r.name === "MeForum")?.isViewer).toBe(true);
  });

  it("honours the limit and never exposes a Clerk id", async () => {
    const board = await callerFor(makeDb(), null).getPlayerLeaderboard({ limit: 2 });

    expect(board).toHaveLength(2);
    expect(JSON.stringify(board)).not.toContain("u_top");
    expect(board.every((r) => r.isViewer === false)).toBe(true);
  });
});
