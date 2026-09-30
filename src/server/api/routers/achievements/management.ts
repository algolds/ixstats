import { z } from "zod";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { achievementService } from "~/lib/achievements/service";

export const achievementsManagementRouter = createTRPCRouter({
  // User action: evaluate the caller's achievements now. Account-level achievements
  // evaluate without a country; country achievements use the active country if any.
  syncMyCollectorAchievements: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.clerkUserId;
    const user = await ctx.db.user.findUnique({
      where: { clerkUserId: userId },
      select: { countryId: true },
    });
    const countryId = user?.countryId ?? null;
    const unlocked = await achievementService.checkAndUnlock(userId, countryId, ctx.db);
    return { success: true, unlocked, countryEvaluated: countryId !== null };
  }),

  // Admin: grant a specific achievement to a user. Admin-only because it takes an
  // arbitrary userId and pays the achievement's reward.
  unlock: adminProcedure
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
