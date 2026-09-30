// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Input schemas
export const activitiesFollowsRouter = createTRPCRouter({
  // Country Follow System
  // Follow a country
  followCountry: protectedProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (ctx.user?.countryId !== input.followerCountryId) {
        throw new Error("You can only follow countries from your own country");
      }

      // Cannot follow yourself
      if (input.followerCountryId === input.followedCountryId) {
        throw new Error("Cannot follow your own country");
      }

      // Check if already following
      const existing = await ctx.db.countryFollow.findUnique({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.followerCountryId,
            followedCountryId: input.followedCountryId,
          },
        },
      });

      if (existing) {
        return { success: true, alreadyFollowing: true, follow: existing };
      }

      const follow = await ctx.db.countryFollow.create({
        data: {
          followerCountryId: input.followerCountryId,
          followedCountryId: input.followedCountryId,
        },
        include: {
          followedCountry: { select: { id: true, name: true, flag: true, slug: true } },
          followerCountry: { select: { id: true, name: true, flag: true, slug: true } },
        },
      });

      return { success: true, alreadyFollowing: false, follow };
    }),
});
