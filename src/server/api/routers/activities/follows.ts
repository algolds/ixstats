// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";

// Input schemas
export const activitiesFollowsRouter = createTRPCRouter({
  // Test mutation to debug parameter passing

  // Get global activity feed

  // Get feed from countries the user follows

  // Get user-specific activity feed

  // Create new activity

  // Handle engagement actions (like, unlike, share, view)

  // Add comment to activity

  // Get comments for an activity

  // Get user engagement state for activities

  // Get trending topics based on activity data

  // Get activity statistics

  // Get country-specific activity feed combining ActivityFeed and ThinkPages posts

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

  // Unfollow a country
  unfollowCountry: protectedProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      if (ctx.user?.countryId !== input.followerCountryId) {
        throw new Error("You can only unfollow countries from your own country");
      }

      await ctx.db.countryFollow.deleteMany({
        where: {
          followerCountryId: input.followerCountryId,
          followedCountryId: input.followedCountryId,
        },
      });

      return { success: true };
    }),

  // Get countries that a country is following
  getFollowing: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const follows = await ctx.db.countryFollow.findMany({
        where: { followerCountryId: input.countryId },
        include: {
          followedCountry: {
            select: { id: true, name: true, flag: true, slug: true, region: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return follows.map((f) => ({
        id: f.id,
        country: f.followedCountry,
        followedAt: f.createdAt.toISOString(),
      }));
    }),

  // Get countries that follow a country (followers)
  getFollowers: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const followers = await ctx.db.countryFollow.findMany({
        where: { followedCountryId: input.countryId },
        include: {
          followerCountry: {
            select: { id: true, name: true, flag: true, slug: true, region: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return followers.map((f) => ({
        id: f.id,
        country: f.followerCountry,
        followedAt: f.createdAt.toISOString(),
      }));
    }),

  // Check if a country is following another
  isFollowing: publicProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const follow = await ctx.db.countryFollow.findUnique({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.followerCountryId,
            followedCountryId: input.followedCountryId,
          },
        },
      });

      return { isFollowing: !!follow };
    }),

  // Get follow statistics for a country
  getFollowStats: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [followingCount, followersCount] = await Promise.all([
        ctx.db.countryFollow.count({
          where: { followerCountryId: input.countryId },
        }),
        ctx.db.countryFollow.count({
          where: { followedCountryId: input.countryId },
        }),
      ]);

      return {
        following: followingCount,
        followers: followersCount,
      };
    }),
});
