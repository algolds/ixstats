import { z } from "zod";
import type { Prisma, PrismaClient, UserAchievement } from "@prisma/client";
import { createTRPCRouter, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";

/** Clerk ids of the users who own the country. */
async function ownerClerkIds(db: PrismaClient, countryId: string) {
  const users = await db.user.findMany({
    where: { ownedCountries: { some: { id: countryId } } },
    select: { clerkUserId: true },
  });
  return users.map((u) => u.clerkUserId);
}

const achievementView = (a: UserAchievement) => ({
  id: a.id,
  title: a.title,
  description: a.description,
  icon: a.iconUrl || "🏆",
  unlockedAt: a.unlockedAt.toISOString(),
  category: a.category,
  rarity: a.rarity,
  points: 10,
});

const LEADERBOARD_SELECT = {
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
} satisfies Prisma.CountrySelect;

type LeaderboardRow = Prisma.CountryGetPayload<{ select: typeof LEADERBOARD_SELECT }>;

/** Current figures, falling back to the baseline while a country has not been projected yet. */
function headlineFigures(c: LeaderboardRow) {
  const population =
    c.currentPopulation && c.currentPopulation > 0
      ? c.currentPopulation
      : c.baselinePopulation || 0;
  const gdpPerCapita =
    c.currentGdpPerCapita && c.currentGdpPerCapita > 0
      ? c.currentGdpPerCapita
      : c.baselineGdpPerCapita || 0;
  const totalGdp =
    c.currentTotalGdp && c.currentTotalGdp > 0 ? c.currentTotalGdp : gdpPerCapita * population;
  return { population, gdpPerCapita, totalGdp };
}

// Not-yet-computed vitality/wellbeing/health sit at their 0 default; treat as not recorded.
const computed = (v: number) => (v > 0 ? v : null);

const METRIC_VALUE = {
  population: (_c, f) => f.population,
  totalGdp: (_c, f) => f.totalGdp,
  gdpPerCapita: (_c, f) => f.gdpPerCapita,
  populationDensity: (c, f) =>
    c.populationDensity && c.populationDensity > 0
      ? c.populationDensity
      : c.landArea && c.landArea > 0
        ? f.population / c.landArea
        : null,
  landArea: (c) => c.landArea || null,
  gdpGrowth: (c) => c.realGDPGrowthRate ?? c.adjustedGdpGrowth,
  avgIncome: (c) => c.averageAnnualIncome,
  workforce: (c) => c.totalWorkforce,
  employmentRate: (c) => c.employmentRate,
  literacyRate: (c) => c.literacyRate,
  lifeExpectancy: (c) => c.lifeExpectancy,
  govRevenue: (c) => c.governmentRevenueTotal,
  govSpending: (c) => c.totalGovernmentSpending,
  economicVitality: (c) => computed(c.economicVitality),
  wellbeing: (c) => computed(c.populationWellbeing),
  nationalHealth: (c) => computed(c.overallNationalHealth),
  infrastructure: (c) => c.infrastructureRating,
  urbanization: (c) => c.urbanPopulationPercent,
  approval: (c) => c.publicApproval,
} satisfies Record<
  string,
  (c: LeaderboardRow, f: ReturnType<typeof headlineFigures>) => number | null
>;

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
        const achievements = await ctx.db.userAchievement.findMany({
          where: { userId: { in: await ownerClerkIds(ctx.db, input.countryId) } },
          orderBy: { unlockedAt: "desc" },
          take: input.limit,
        });
        return achievements.map(achievementView);
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
        const achievements = await ctx.db.userAchievement.findMany({
          where: { userId: { in: await ownerClerkIds(ctx.db, input.countryId) } },
          orderBy: { unlockedAt: "desc" },
        });
        return achievements.map((a) => ({
          ...achievementView(a),
          achievementId: a.achievementId,
          progress: 100,
        }));
      } catch {
        return [];
      }
    }),

  // Get achievement leaderboard
  getLeaderboard: rateLimitedPublicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(20),
        category: z.string().optional(),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const countries = await ctx.db.country.findMany({
          where: { realmId: await viewerRealmId(ctx, input.realm) },
          include: {
            owner: {
              select: {
                clerkUserId: true,
              },
            },
          },
        });

        const userToCountryMap = new Map<string, string>();
        const allUserIds: string[] = [];
        for (const country of countries) {
          if (country.owner) {
            userToCountryMap.set(country.owner.clerkUserId, country.id);
            allUserIds.push(country.owner.clerkUserId);
          }
        }

        const countryAchievements = new Map<string, { count: number; rare: number }>();
        if (allUserIds.length > 0) {
          const allAchievements = await ctx.db.userAchievement.findMany({
            where: {
              userId: { in: allUserIds },
              ...(input.category ? { category: input.category } : {}),
            },
            select: {
              userId: true,
              rarity: true,
            },
          });

          for (const a of allAchievements) {
            const countryId = userToCountryMap.get(a.userId);
            if (countryId) {
              const curr = countryAchievements.get(countryId) ?? { count: 0, rare: 0 };
              curr.count += 1;
              if (a.rarity === "Rare" || a.rarity === "Epic" || a.rarity === "Legendary") {
                curr.rare += 1;
              }
              countryAchievements.set(countryId, curr);
            }
          }
        }

        const leaderboard = countries.map((country) => {
          const agg = countryAchievements.get(country.id) ?? { count: 0, rare: 0 };
          return {
            countryId: country.id,
            countryName: country.name,
            flag: country.flag || null,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
            totalPoints: agg.count * 10,
            achievementCount: agg.count,
            rareAchievements: agg.rare,
          };
        });

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

  /**
   * Backend tRPC Procedure with Zod Validation & Prisma Queries.
   * 1. .input(z.object({...})) validates incoming parameters before execution
   * 2. ctx.db.country.findMany() queries PostgreSQL for 145 member nations
   * 3. .map() and .sort() transform and rank data on the Linux server
   */
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
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const whereClause: Record<string, unknown> = {
          realmId: await viewerRealmId(ctx, input.realm),
        };
        if (input.searchQuery && input.searchQuery.trim().length > 0) {
          whereClause.name = {
            contains: input.searchQuery.trim(),
            mode: "insensitive",
          };
        }

        const countries = await ctx.db.country.findMany({
          where: whereClause,
          select: LEADERBOARD_SELECT,
        });

        const mapped = countries.map((c) => {
          const val = METRIC_VALUE[input.metric](c, headlineFigures(c));
          return {
            countryId: c.id,
            countryName: c.name,
            flag: c.flag || null,
            value: val !== null && Number.isFinite(val) ? val : null,
            economicTier: c.economicTier,
            populationTier: c.populationTier,
          };
        });

        // Countries with no recorded value for this metric are left off rather than ranked on an invented one.
        return mapped
          .flatMap((row) => (row.value === null ? [] : [{ ...row, value: row.value }]))
          .sort((a, b) => b.value - a.value)
          .slice(0, input.limit);
      } catch (error) {
        console.error("Error fetching country leaderboard:", error);
        return [];
      }
    }),
});
