// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const usersAdminRouter = createTRPCRouter({
  // Get active users/members for finding friends. Public, so each member is named by their
  // nation: no Clerk id, and no last-active time (online status follows the member's privacy
  // settings elsewhere). The signed-in caller is left out.
  getActiveUsers: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        /** Ignored: the caller (from the session) is the one left out. */
        excludeUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const viewer = ctx.auth?.userId;
        const activeUsers = await ctx.db.user.findMany({
          where: {
            countryId: { not: null }, // Only users with countries
            ...(viewer && { clerkUserId: { not: viewer } }),
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
          id: user.countryId!,
          countryId: user.countryId!,
          countryName: user.country?.name || "Unknown Country",
          leader: user.country?.leader || "Leader",
          economicTier: user.country?.economicTier || "Unknown",
          totalGdp: user.country?.currentTotalGdp || 0,
          population: user.country?.currentPopulation || 0,
          joinedAt: user.createdAt,
          flag: user.country?.flag || null,
        }));
      } catch (error) {
        console.error("Error fetching active users:", error);
        return [];
      }
    }),
});
