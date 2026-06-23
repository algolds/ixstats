import { z } from "zod";
import { createTRPCRouter, rateLimitedPublicProcedure } from "~/server/api/trpc";

export const achievementsCountryRouter = createTRPCRouter({
  // Get recent achievements for a country
  getRecentByCountry: rateLimitedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const users = await ctx.db.user.findMany({
          where: { countryId: input.countryId },
          select: { clerkUserId: true },
        });

        const userIds = users.map((u) => u.clerkUserId);

        const achievements = await ctx.db.userAchievement.findMany({
          where: {
            userId: { in: userIds },
          },
          orderBy: { unlockedAt: "desc" },
          take: input.limit,
        });

        return achievements.map((achievement) => ({
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.iconUrl || "🏆",
          unlockedAt: achievement.unlockedAt.toISOString(),
          category: achievement.category,
          rarity: achievement.rarity,
          points: 10,
        }));
      } catch (error) {
        console.error("Error fetching recent achievements:", error);
        return [];
      }
    }),

  // Get all achievements for a country
  getAllByCountry: rateLimitedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const users = await ctx.db.user.findMany({
          where: { countryId: input.countryId },
          select: { clerkUserId: true },
        });

        const userIds = users.map((u) => u.clerkUserId);

        const achievements = await ctx.db.userAchievement.findMany({
          where: {
            userId: { in: userIds },
          },
          orderBy: { unlockedAt: "desc" },
        });

        return achievements.map((achievement) => ({
          id: achievement.id,
          achievementId: achievement.achievementId,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.iconUrl || "🏆",
          unlockedAt: achievement.unlockedAt.toISOString(),
          category: achievement.category,
          rarity: achievement.rarity,
          points: 10,
          progress: 100,
        }));
      } catch (error) {
        return [];
      }
    }),

  // Get achievement leaderboard
  getLeaderboard: rateLimitedPublicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(20),
        category: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const countries = await ctx.db.country.findMany({
          include: {
            users: {
              select: {
                clerkUserId: true,
              },
            },
          },
          take: input.limit,
        });

        const leaderboard = await Promise.all(
          countries.map(async (country) => {
            const userIds =
              country.users && country.users.length > 0
                ? country.users.map((u) => u.clerkUserId)
                : [];

            const achievements = await ctx.db.userAchievement.findMany({
              where: {
                userId: { in: userIds },
                ...(input.category ? { category: input.category } : {}),
              },
            });

            const totalPoints = achievements.length * 10;
            const achievementCount = achievements.length;

            return {
              countryId: country.id,
              countryName: country.name,
              totalPoints,
              achievementCount,
              rareAchievements: achievements.filter(
                (a: { rarity?: string | null }) =>
                  a.rarity === "Rare" || a.rarity === "Epic" || a.rarity === "Legendary"
              ).length,
            };
          })
        );

        return leaderboard
          .filter((entry: { achievementCount: number }) => entry.achievementCount > 0)
          .sort(
            (a: { totalPoints: number }, b: { totalPoints: number }) =>
              b.totalPoints - a.totalPoints
          )
          .slice(0, input.limit);
      } catch (error) {
        console.error("Error fetching achievements leaderboard:", error);
        return [];
      }
    }),

  // Get country leaderboard ranked by a chosen metric (GDP, population, etc.)
  getCountryLeaderboard: rateLimitedPublicProcedure
    .input(
      z.object({
        metric: z
          .enum([
            "totalGdp",
            "gdpPerCapita",
            "population",
            "populationDensity",
            "landArea",
            "gdpGrowth",
            "avgIncome",
            "workforce",
            "employmentRate",
            "literacyRate",
            "lifeExpectancy",
            "govRevenue",
            "govSpending",
            "economicVitality",
            "wellbeing",
            "nationalHealth",
            "infrastructure",
            "urbanization",
            "approval",
          ])
          .default("totalGdp"),
        limit: z.number().optional().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // metric id → Country column
      const field = {
        totalGdp: "currentTotalGdp",
        gdpPerCapita: "currentGdpPerCapita",
        population: "currentPopulation",
        populationDensity: "populationDensity",
        landArea: "landArea",
        gdpGrowth: "realGDPGrowthRate",
        avgIncome: "averageAnnualIncome",
        workforce: "totalWorkforce",
        employmentRate: "employmentRate",
        literacyRate: "literacyRate",
        lifeExpectancy: "lifeExpectancy",
        govRevenue: "governmentRevenueTotal",
        govSpending: "totalGovernmentSpending",
        economicVitality: "economicVitality",
        wellbeing: "populationWellbeing",
        nationalHealth: "overallNationalHealth",
        infrastructure: "infrastructureRating",
        urbanization: "urbanPopulationPercent",
        approval: "publicApproval",
      }[input.metric];

      try {
        const countries = await ctx.db.country.findMany({
          where: { [field]: { not: null } } as Record<string, unknown>,
          orderBy: { [field]: "desc" } as Record<string, "desc">,
          take: input.limit,
          select: {
            id: true,
            name: true,
            flag: true,
            economicTier: true,
            populationTier: true,
            [field]: true,
          } as Record<string, true>,
        });

        return countries.map((c) => {
          const row = c as Record<string, unknown>;
          return {
            countryId: row.id as string,
            countryName: row.name as string,
            flag: row.flag as string | null,
            value: (row[field] as number | null) ?? 0,
            economicTier: row.economicTier as string,
            populationTier: row.populationTier as string,
          };
        });
      } catch (error) {
        console.error("Error fetching country leaderboard:", error);
        return [];
      }
    }),

  // Get current user's achievement progress statistics

  // Admin action: Manually trigger baseline sync

  // User action: Retroactively sync collector achievements and titles

  // Unlock achievement (internal use & backward compatibility)
});
