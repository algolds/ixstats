// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const usersAdminRouter = createTRPCRouter({
  // Get active users/members for finding friends
  getActiveUsers: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        excludeUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get users with countries, ordered by recent activity (createdAt for now)
        const activeUsers = await ctx.db.user.findMany({
          where: {
            countryId: { not: null }, // Only users with countries
            ...(input.excludeUserId && {
              clerkUserId: { not: input.excludeUserId },
            }),
          },
          include: {
            country: {
              select: {
                id: true,
                name: true,
                leader: true,
                economicTier: true,
                currentTotalGdp: true,
                currentPopulation: true,
                flag: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });

        return activeUsers.map((user) => ({
          id: user.clerkUserId,
          countryId: user.countryId!,
          countryName: user.country?.name || "Unknown Country",
          leader: user.country?.leader || "Leader",
          economicTier: user.country?.economicTier || "Unknown",
          totalGdp: user.country?.currentTotalGdp || 0,
          population: user.country?.currentPopulation || 0,
          lastActive: user.updatedAt,
          joinedAt: user.createdAt,
          flag: user.country?.flag || null,
        }));
      } catch (error) {
        console.error("Error fetching active users:", error);
        return [];
      }
    }),
});
