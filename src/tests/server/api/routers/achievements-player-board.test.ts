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

const unlock = (userId: string, points: number, rarity = "Common") => ({
  userId,
  achievement: { points, rarity },
});

function makeDb() {
  return {
    achievement: { count: jest.fn().mockResolvedValue(40) },
    userAchievement: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          unlock("u_me", 10),
          unlock("u_me", 50, "Epic"),
          unlock("u_top", 250, "Legendary"),
          unlock("u_top", 10),
          unlock("u_tie", 60, "Rare"),
          unlock("u_low", 5),
        ]),
    },
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

describe("achievements.getMySummary", () => {
  it("counts the caller's unlocks of active achievements, their points and their rank", async () => {
    const db = makeDb();
    const summary = await callerFor(db).getMySummary();

    expect(summary).toEqual({ unlocked: 2, activeTotal: 40, points: 60, rank: 2 });
    expect(db.achievement.count).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(db.userAchievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { achievement: { isActive: true } } })
    );
  });

  it("gives a caller with no unlocks zeros and no rank", async () => {
    const db = makeDb();
    const summary = await callerFor(db, "u_new").getMySummary();

    expect(summary).toEqual({ unlocked: 0, activeTotal: 40, points: 0, rank: null });
  });

  it("rejects a signed-out caller", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(callerFor(makeDb(), null).getMySummary()).rejects.toThrow();
    warn.mockRestore();
  });
});

describe("achievements.getPlayerLeaderboard", () => {
  it("ranks players by achievement points, ties sharing a rank, with names from the account", async () => {
    const db = makeDb();
    const board = await callerFor(db).getPlayerLeaderboard({ limit: 10 });

    expect(board.map((r) => [r.rank, r.name, r.totalPoints])).toEqual([
      [1, "topdog", 260],
      [2, "MeForum", 60],
      [2, "Player", 60],
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
