import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { ActivityHooks } from "~/lib/activity-hooks";
import { notificationHooks } from "~/lib/notification-hooks";

export const achievementsRouter = createTRPCRouter({
  // Get recent achievements for a country
  getRecentByCountry: publicProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().optional().default(10)
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get users for this country
        const users = await ctx.db.user.findMany({
          where: { countryId: input.countryId },
          select: { clerkUserId: true }
        });

        const userIds = users.map(u => u.clerkUserId);

        const achievements = await ctx.db.userAchievement.findMany({
          where: {
            userId: { in: userIds }
          },
          orderBy: { unlockedAt: 'desc' },
          take: input.limit
        });

        return achievements.map(achievement => ({
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.iconUrl || "🏆",
          unlockedAt: achievement.unlockedAt.toISOString(),
          category: achievement.category,
          rarity: achievement.rarity,
          points: 10 // Default points
        }));
      } catch (error) {
        console.error('Error fetching recent achievements:', error);
        return [];
      }
    }),

  // Get all achievements for a country
  getAllByCountry: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get users for this country
        const users = await ctx.db.user.findMany({
          where: { countryId: input.countryId },
          select: { clerkUserId: true }
        });

        const userIds = users.map(u => u.clerkUserId);

        const achievements = await ctx.db.userAchievement.findMany({
          where: {
            userId: { in: userIds }
          },
          orderBy: { unlockedAt: 'desc' }
        });

        return achievements.map(achievement => ({
          id: achievement.id,
          achievementId: achievement.achievementId,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.iconUrl || "🏆",
          unlockedAt: achievement.unlockedAt.toISOString(),
          category: achievement.category,
          rarity: achievement.rarity,
          points: 10, // Default points
          progress: 100 // Default progress
        }));
      } catch (error) {
        return [];
      }
    }),

  // Get achievement leaderboard
  getLeaderboard: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      category: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get all countries with user
        const countries = await ctx.db.country.findMany({
          include: {
            user: {
              select: {
                clerkUserId: true
              }
            }
          },
          take: input.limit
        });

        const leaderboard = await Promise.all(countries.map(async (country) => {
          const userIds = country.user ? [country.user.clerkUserId] : [];

          const achievements = await ctx.db.userAchievement.findMany({
            where: {
              userId: { in: userIds },
              ...(input.category ? { category: input.category } : {})
            }
          });

          const totalPoints = achievements.length * 10; // Default 10 points per achievement
          const achievementCount = achievements.length;

          return {
            countryId: country.id,
            countryName: country.name,
            totalPoints,
            achievementCount,
            rareAchievements: achievements.filter((a: { rarity?: string | null }) => a.rarity === 'rare' || a.rarity === 'epic' || a.rarity === 'legendary').length
          };
        }));

        return leaderboard
          .filter((entry: { achievementCount: number }) => entry.achievementCount > 0)
          .sort((a: { totalPoints: number }, b: { totalPoints: number }) => b.totalPoints - a.totalPoints)
          .slice(0, input.limit);
      } catch (error) {
        console.error('Error fetching achievements leaderboard:', error);
        return [];
      }
    }),

  // Unlock achievement (internal use)
  unlock: protectedProcedure
    .input(z.object({
      userId: z.string(),
      achievementId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
      category: z.string().optional(),
      rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']).optional(),
      points: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if already unlocked
      const existing = await ctx.db.userAchievement.findFirst({
        where: {
          userId: input.userId,
          achievementId: input.achievementId
        }
      });

      if (existing) {
        return existing;
      }

      const achievement = await ctx.db.userAchievement.create({
        data: {
          userId: input.userId,
          achievementId: input.achievementId,
          title: input.title,
          description: input.description || "",
          iconUrl: input.icon || "🏆",
          category: input.category || "General",
          rarity: input.rarity || "Common",
          unlockedAt: new Date()
        }
      });

      // Get user's country for activity feed
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        select: { countryId: true, clerkUserId: true }
      });

      // Generate activity feed entry (non-blocking)
      if (user?.countryId) {
        await ActivityHooks.User.onAchievementUnlocked(
          user.clerkUserId,
          user.countryId,
          input.title,
          input.description || `Unlocked ${input.rarity || 'Common'} achievement worth ${input.points || 10} points`
        ).catch(err => console.error('Failed to create achievement activity:', err));
      }

      // 🔔 Notify user about achievement unlock
      try {
        await notificationHooks.onAchievementUnlock({
          userId: input.userId,
          achievementId: input.achievementId,
          name: input.title,
          description: input.description || `You've unlocked a ${input.rarity || 'Common'} achievement!`,
          category: input.category || 'General',
          rarity: (input.rarity?.toLowerCase() as 'common' | 'rare' | 'epic' | 'legendary') || 'common',
        });
      } catch (error) {
        console.error('[Achievements] Failed to send achievement notification:', error);
      }

      return achievement;
    })
});
