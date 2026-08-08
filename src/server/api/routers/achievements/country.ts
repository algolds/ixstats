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
              flag: country.flag || null,
              economicTier: country.economicTier || "Developed",
              populationTier: country.populationTier || "Medium",
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
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const whereClause: Record<string, unknown> = {};
        if (input.searchQuery && input.searchQuery.trim().length > 0) {
          whereClause.name = {
            contains: input.searchQuery.trim(),
            mode: "insensitive",
          };
        }

        const countries = await ctx.db.country.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            flag: true,
            economicTier: true,
            populationTier: true,
            currentPopulation: true,
            baselinePopulation: true,
            currentTotalGdp: true,
            currentGdpPerCapita: true,
            baselineGdpPerCapita: true,
            landArea: true,
            populationDensity: true,
            realGDPGrowthRate: true,
            adjustedGdpGrowth: true,
            averageAnnualIncome: true,
            totalWorkforce: true,
            laborForceParticipationRate: true,
            employmentRate: true,
            literacyRate: true,
            lifeExpectancy: true,
            governmentRevenueTotal: true,
            taxRevenueGDPPercent: true,
            totalGovernmentSpending: true,
            spendingGDPPercent: true,
            economicVitality: true,
            populationWellbeing: true,
            overallNationalHealth: true,
            infrastructureRating: true,
            urbanPopulationPercent: true,
            publicApproval: true,
          },
        });

        const mapped = countries.map((c) => {
          const pop =
            c.currentPopulation && c.currentPopulation > 0
              ? c.currentPopulation
              : c.baselinePopulation || 0;
          const gdpPerCap =
            c.currentGdpPerCapita && c.currentGdpPerCapita > 0
              ? c.currentGdpPerCapita
              : c.baselineGdpPerCapita || 0;
          const totalGdp =
            c.currentTotalGdp && c.currentTotalGdp > 0
              ? c.currentTotalGdp
              : gdpPerCap * pop;

          let val = 0;
          switch (input.metric) {
            case "population":
              val = pop;
              break;
            case "totalGdp":
              val = totalGdp;
              break;
            case "gdpPerCapita":
              val = gdpPerCap;
              break;
            case "populationDensity":
              val =
                c.populationDensity && c.populationDensity > 0
                  ? c.populationDensity
                  : c.landArea && c.landArea > 0
                    ? pop / c.landArea
                    : 50;
              break;
            case "landArea":
              val = c.landArea || 100000;
              break;
            case "gdpGrowth":
              val = c.realGDPGrowthRate ?? c.adjustedGdpGrowth ?? 2.5;
              break;
            case "avgIncome":
              val = c.averageAnnualIncome ?? gdpPerCap * 0.45;
              break;
            case "workforce":
              val =
                c.totalWorkforce ?? pop * (c.laborForceParticipationRate ?? 0.65);
              break;
            case "employmentRate":
              val = c.employmentRate ?? 94.0;
              break;
            case "literacyRate":
              val = c.literacyRate ?? 95.0;
              break;
            case "lifeExpectancy":
              val = c.lifeExpectancy ?? 75.0;
              break;
            case "govRevenue":
              val =
                c.governmentRevenueTotal ??
                totalGdp *
                  (c.taxRevenueGDPPercent ? c.taxRevenueGDPPercent / 100 : 0.25);
              break;
            case "govSpending":
              val =
                c.totalGovernmentSpending ??
                totalGdp *
                  (c.spendingGDPPercent ? c.spendingGDPPercent / 100 : 0.28);
              break;
            case "economicVitality":
              val = c.economicVitality || 50;
              break;
            case "wellbeing":
              val = c.populationWellbeing || 50;
              break;
            case "nationalHealth":
              val = c.overallNationalHealth || 50;
              break;
            case "infrastructure":
              val = c.infrastructureRating || 50;
              break;
            case "urbanization":
              val = c.urbanPopulationPercent ?? 68.0;
              break;
            case "approval":
              val = c.publicApproval || 50;
              break;
          }

          return {
            countryId: c.id,
            countryName: c.name,
            flag: c.flag || null,
            value: Number.isNaN(val) ? 0 : val,
            economicTier: c.economicTier || "Developed",
            populationTier: c.populationTier || "Medium",
          };
        });

        return mapped
          .sort((a, b) => b.value - a.value)
          .slice(0, input.limit);
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
