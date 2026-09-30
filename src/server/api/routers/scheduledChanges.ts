import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Scheduled Changes Router
 *
 * Handles delayed changes to country data based on impact level:
 * - instant: Applied immediately (cosmetic changes)
 * - next_day: Applied next IxDay (minor changes)
 * - short_term: Applied in 3-5 IxDays (medium impact)
 * - long_term: Applied in 1 IxWeek (major changes)
 *
 * Applying lives in `~/server/modules/scheduled-changes/service` (shared with the cron job).
 */

export const scheduledChangesRouter = createTRPCRouter({
  /**
   * Get all pending scheduled changes for a user's country
   */
  getPendingChanges: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth?.userId) {
      return [];
    }

    // Get user's country
    const userProfile = await ctx.db.user.findUnique({
      where: { clerkUserId: ctx.auth.userId },
      select: { countryId: true, id: true },
    });

    if (!userProfile?.countryId) {
      return [];
    }

    const changes = await ctx.db.scheduledChange.findMany({
      where: {
        countryId: userProfile.countryId,
        userId: userProfile.id,
        status: "pending",
      },
      orderBy: {
        scheduledFor: "asc",
      },
    });

    return changes;
  }),
});
