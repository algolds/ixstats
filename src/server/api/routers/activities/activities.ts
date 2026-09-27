// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const activitiesActivitiesRouter = createTRPCRouter({
  // Get activity statistics
  getActivityStats: publicProcedure
    .input(
      z.object({
        timeRange: z.enum(["24h", "7d", "30d"]).default("24h"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const now = new Date();
        let fromDate: Date;

        switch (input.timeRange) {
          case "24h":
            fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "7d":
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "30d":
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        const stats = await ctx.db.activityFeed.aggregate({
          where: {
            createdAt: { gte: fromDate },
          },
          _count: {
            id: true,
          },
          _sum: {
            likes: true,
            comments: true,
            shares: true,
            views: true,
          },
        });

        return {
          totalActivities: stats._count.id || 0,
          totalLikes: stats._sum.likes || 0,
          totalComments: stats._sum.comments || 0,
          totalShares: stats._sum.shares || 0,
          totalViews: stats._sum.views || 0,
        };
      } catch (error) {
        console.error("Error fetching activity stats:", error);
        return {
          totalActivities: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalViews: 0,
        };
      }
    }),
});
