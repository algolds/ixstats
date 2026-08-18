import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { achievementService } from "~/lib/achievements/service";

export const achievementsManagementRouter = createTRPCRouter({
  // Get recent achievements for a country

  // Get all achievements for a country

  // Get achievement leaderboard

  // Get current user's achievement progress statistics

  // Admin action: Manually trigger baseline sync
  adminSync: adminProcedure.mutation(async ({ ctx }) => {
    const { syncAchievements } = await import("~/lib/achievements/sync");
    await syncAchievements(ctx.db);
    return { success: true };
  }),

  // User action: Retroactively sync collector achievements and titles
  syncMyCollectorAchievements: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.clerkUserId;
    const user = await ctx.db.user.findUnique({
      where: { clerkUserId: userId },
      select: { countryId: true },
    });
    if (!user?.countryId) {
      return { success: false, message: "No claimed country found for this user." };
    }
    const unlocked = await achievementService.checkAndUnlock(userId, user.countryId, ctx.db);
    return { success: true, unlocked };
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
