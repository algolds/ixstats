import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { ActivityHooks } from "~/lib/activity-hooks";
import { notificationHooks } from "~/lib/notification-hooks";
import { vaultService } from "~/lib/vault-service";
import { achievementService } from "~/lib/achievement-service";

export const achievementsRouter = createTRPCRouter({
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

  // Get current user's achievement progress statistics
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    return achievementService.getProgress(ctx.user.clerkUserId, ctx.db);
  }),

  getAllWithStatus: rateLimitedPublicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        let targetUserId = input.userId;

        // If no user specified but countryId is provided, find country's owner/first user
        if (!targetUserId && input.countryId) {
          const user = await ctx.db.user.findFirst({
            where: { countryId: input.countryId },
            select: { clerkUserId: true },
          });
          if (user) targetUserId = user.clerkUserId;
        }

        // Fallback to logged-in user
        if (!targetUserId) {
          targetUserId = ctx.user?.clerkUserId || undefined;
        }

        // Get all active master achievements
        let masterAchievements = await ctx.db.achievement.findMany({
          where: { isActive: true },
          orderBy: { key: "asc" },
        });

        // Auto-sync if database achievements count doesn't match definitions registry
        const { ACHIEVEMENT_DEFINITIONS } = await import("~/lib/achievement-definitions");
        if (masterAchievements.length < ACHIEVEMENT_DEFINITIONS.length) {
          const { syncAchievements } = await import("~/lib/achievement-sync");
          await syncAchievements(ctx.db);
          // Re-fetch master achievements after sync
          masterAchievements = await ctx.db.achievement.findMany({
            where: { isActive: true },
            orderBy: { key: "asc" },
          });
        }

        // Get user's unlocked achievements if target user is known
        const userUnlocks = targetUserId
          ? await ctx.db.userAchievement.findMany({
              where: { userId: targetUserId },
            })
          : [];

        const unlockMap = new Map(userUnlocks.map((u) => [u.achievementId, u]));

        // Calculate global unlock stats
        const totalUsersCount = await ctx.db.user.count() || 1;
        const globalUnlocksGroup = await ctx.db.userAchievement.groupBy({
          by: ["achievementId"],
          _count: {
            achievementId: true,
          },
        });
        const countMap = new Map(
          globalUnlocksGroup.map((g) => [g.achievementId, g._count.achievementId])
        );

        return masterAchievements.map((m) => {
          const unlock = unlockMap.get(m.key);
          let rewards = null;
          if (m.rewardsJson) {
            try {
              rewards = JSON.parse(m.rewardsJson);
            } catch (e) {
              // ignore
            }
          }

          const globalUnlocks = countMap.get(m.key) || 0;
          const globalUnlockPercent = parseFloat(((globalUnlocks / totalUsersCount) * 100).toFixed(1));

          return {
            key: m.key,
            title: m.title,
            description: m.description,
            category: m.category,
            rarity: m.rarity,
            points: m.points,
            iconUrl: m.iconUrl || "🏆",
            triggerType: m.triggerType,
            conditionJson: m.conditionJson,
            isUnlocked: !!unlock,
            unlockedAt: unlock ? unlock.unlockedAt.toISOString() : null,
            metadata: unlock ? unlock.metadata : null,
            rewards,
            globalUnlockPercent,
          };
        });
      } catch (error) {
        console.error("Error in getAllWithStatus:", error);
        return [];
      }
    }),

  // Admin action: Manually trigger baseline sync
  adminSync: adminProcedure.mutation(async ({ ctx }) => {
    const { syncAchievements } = await import("~/lib/achievement-sync");
    await syncAchievements(ctx.db);
    return { success: true };
  }),

  // Unlock achievement (internal use & backward compatibility)
  unlock: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        achievementId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
        category: z.string().optional(),
        rarity: z.enum(["Common", "Uncommon", "Rare", "Epic", "Legendary"]).optional(),
        points: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const success = await achievementService.unlockSpecific(
        input.userId,
        input.achievementId,
        ctx.db
      );

      const achievement = await ctx.db.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId: input.userId,
            achievementId: input.achievementId,
          },
        },
      });

      return {
        ...achievement,
        creditsEarned: success ? 5 : 0,
      };
    }),
});
