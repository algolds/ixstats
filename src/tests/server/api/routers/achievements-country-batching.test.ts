import { achievementsCountryRouter } from "~/server/api/routers/achievements/country";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("Plan 159: Achievements Country Leaderboard Query Batching", () => {
  const createCaller = createCallerFactory(achievementsCountryRouter);

  it("fetches all user achievements in a single batch query across multiple countries", async () => {
    const userAchievementFindManyMock = jest.fn().mockResolvedValue([
      { userId: "u1", rarity: "Legendary" },
      { userId: "u1", rarity: "Common" },
      { userId: "u1", rarity: "Epic" },
      { userId: "u3", rarity: "Rare" },
    ]);

    const mockDb = {
      country: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "c1",
            name: "Nation 1",
            flag: "flag1.png",
            economicTier: "Developed",
            populationTier: "Large",
            owner: { clerkUserId: "u1" },
          },
          {
            id: "c2",
            name: "Nation 2",
            flag: "flag2.png",
            economicTier: "Emerging",
            populationTier: "Medium",
            owner: { clerkUserId: "u3" },
          },
          {
            id: "c3",
            name: "Nation 3 (Zero)",
            flag: "flag3.png",
            economicTier: "Developing",
            populationTier: "Small",
            owner: { clerkUserId: "u4" },
          },
          {
            id: "c4",
            name: "Nation 4 (Unowned)",
            flag: "flag4.png",
            economicTier: "Developing",
            populationTier: "Small",
            owner: null,
          },
        ]),
      },
      userAchievement: {
        findMany: userAchievementFindManyMock,
      },
    };

    const ctx = createMockRouterContext({
      db: mockDb,
      auth: null,
    });
    const caller = createCaller(ctx as any);

    const leaderboard = await (caller as any).getLeaderboard({ limit: 10 });

    // Assert query batching over owners only
    expect(userAchievementFindManyMock).toHaveBeenCalledTimes(1);
    expect(userAchievementFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: ["u1", "u3", "u4"] } } })
    );

    // Assert filtering of 0-achievement country and sorting
    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].countryId).toBe("c1");
    expect(leaderboard[0].achievementCount).toBe(3);
    expect(leaderboard[0].totalPoints).toBe(30);
    expect(leaderboard[0].rareAchievements).toBe(2); // 1 Legendary + 1 Epic

    expect(leaderboard[1].countryId).toBe("c2");
    expect(leaderboard[1].achievementCount).toBe(1);
    expect(leaderboard[1].totalPoints).toBe(10);
    expect(leaderboard[1].rareAchievements).toBe(1); // 1 Rare
  });
});
