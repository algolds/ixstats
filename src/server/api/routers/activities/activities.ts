// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { globalCache } from "~/lib/cache";

// Input schemas
const activityFilterSchema = z.object({
  limit: z.number().min(1).max(80).default(20),
  cursor: z.string().optional(),
  filter: z
    .enum(["all", "achievements", "diplomatic", "economic", "social", "meta"])
    .default("all"),
  category: z.enum(["all", "game", "platform", "social"]).default("all"),
  userId: z.string().optional(),
});

const createActivitySchema = z.object({
  type: z.enum(["achievement", "diplomatic", "economic", "social", "meta"]),
  category: z.enum(["game", "platform", "social"]).default("game"),
  userId: z.string().optional(),
  countryId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
    )
    .optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  visibility: z.enum(["public", "followers", "friends"]).default("public"),
  relatedCountries: z.array(z.string()).optional(),
});

const engagementActionSchema = z.object({
  activityId: z.string(),
  action: z.string(),
  userId: z.string(),
});

const commentActionSchema = z.object({
  activityId: z.string(),
  userId: z.string(),
  content: z.string().min(1).max(2000),
});

const getUserEngagementSchema = z.object({
  activityIds: z.array(z.string()),
  userId: z.string(),
});

export const activitiesActivitiesRouter = createTRPCRouter({
  // Test mutation to debug parameter passing
  testMutation: publicProcedure
    .input(
      z.object({
        testId: z.string(),
        testAction: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("TEST MUTATION - Raw input:", JSON.stringify(input));
      return { success: true, received: input };
    }),

  // Get global activity feed

  // Get feed from countries the user follows

  // Get user-specific activity feed

  // Create new activity
  createActivity: protectedProcedure
    .input(createActivitySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const activity = await ctx.db.activityFeed.create({
          data: {
            type: input.type,
            category: input.category,
            userId: input.userId,
            countryId: input.countryId,
            title: input.title,
            description: input.description,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            priority: input.priority,
            visibility: input.visibility,
            relatedCountries: input.relatedCountries
              ? JSON.stringify(input.relatedCountries)
              : null,
          },
        });

        // Invalidate feed caches
        await Promise.all([
          globalCache.deleteByPattern("global_activity_feed:*"),
          globalCache.deleteByPattern("user_following_feed:*"),
        ]);

        return { success: true, activity };
      } catch (error) {
        console.error("Error creating activity:", error);
        throw new Error("Failed to create activity", { cause: error });
      }
    }),

  // Handle engagement actions (like, unlike, share, view)
  engageWithActivity: protectedProcedure
    .input(
      z.object({
        activityId: z.string(),
        action: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("ENGAGEMENT MUTATION - Raw input received:", JSON.stringify(input));

      if (input.action === "like") {
        // Check if already liked
        const existingLike = await ctx.db.activityLike.findUnique({
          where: {
            activityId_userId: {
              activityId: input.activityId,
              userId: input.userId,
            },
          },
        });

        if (existingLike) {
          return { success: false, message: "Already liked" };
        }

        // Create like and increment counter
        await ctx.db.$transaction([
          ctx.db.activityLike.create({
            data: {
              activityId: input.activityId,
              userId: input.userId,
            },
          }),
          ctx.db.activityFeed.update({
            where: { id: input.activityId },
            data: { likes: { increment: 1 } },
          }),
        ]);

        await Promise.all([
          globalCache.deleteByPattern("global_activity_feed:*"),
          globalCache.deleteByPattern("user_following_feed:*"),
        ]);

        return { success: true, message: "Liked!" };
      }

      if (input.action === "unlike") {
        // Find and remove like
        const like = await ctx.db.activityLike.findUnique({
          where: {
            activityId_userId: {
              activityId: input.activityId,
              userId: input.userId,
            },
          },
        });

        if (!like) {
          return { success: false, message: "Not liked" };
        }

        await ctx.db.$transaction([
          ctx.db.activityLike.delete({
            where: { id: like.id },
          }),
          ctx.db.activityFeed.update({
            where: { id: input.activityId },
            data: { likes: { decrement: 1 } },
          }),
        ]);

        await Promise.all([
          globalCache.deleteByPattern("global_activity_feed:*"),
          globalCache.deleteByPattern("user_following_feed:*"),
        ]);

        return { success: true, message: "Unliked!" };
      }

      if (input.action === "reshare") {
        // Check if already reshared
        const existingShare = await ctx.db.activityShare.findUnique({
          where: {
            activityId_userId: {
              activityId: input.activityId,
              userId: input.userId,
            },
          },
        });

        if (existingShare) {
          return { success: false, message: "Already reshared" };
        }

        // Get the original activity for reshare content
        const originalActivity = await ctx.db.activityFeed.findUnique({
          where: { id: input.activityId },
          include: {
            activityLikes: { where: { userId: input.userId } },
          },
        });

        if (!originalActivity) {
          return { success: false, message: "Original activity not found" };
        }

        // Get user's country for context
        const userProfile = await ctx.db.user.findUnique({
          where: { clerkUserId: input.userId },
          include: { country: true },
        });

        await ctx.db.$transaction(async (tx) => {
          // 1. Create the share record
          await tx.activityShare.create({
            data: {
              activityId: input.activityId,
              userId: input.userId,
            },
          });

          // 2. Increment share counter on original
          await tx.activityFeed.update({
            where: { id: input.activityId },
            data: { shares: { increment: 1 } },
          });

          // 3. Create new reshare activity entry under user's profile
          await tx.activityFeed.create({
            data: {
              type: "social",
              category: "social",
              userId: input.userId,
              countryId: userProfile?.countryId || null,
              title: `Reshared: ${originalActivity.title}`,
              description: `${userProfile?.country?.name || "User"} reshared: ${originalActivity.description}`,
              metadata: JSON.stringify({
                originalActivityId: originalActivity.id,
                originalType: originalActivity.type,
                originalUserId: originalActivity.userId,
                originalCountryId: originalActivity.countryId,
                reshareType: "activity_reshare",
              }),
              priority: "medium",
              visibility: "public",
              relatedCountries: originalActivity.relatedCountries,
            },
          });
        });

        await Promise.all([
          globalCache.deleteByPattern("global_activity_feed:*"),
          globalCache.deleteByPattern("user_following_feed:*"),
        ]);

        return { success: true, message: "Reshared to your profile!" };
      }

      if (input.action === "view") {
        // Increment view counter (no user tracking needed)
        await ctx.db.activityFeed.update({
          where: { id: input.activityId },
          data: { views: { increment: 1 } },
        });

        return { success: true, message: "View recorded!" };
      }

      return { success: false, message: "Invalid action" };
    }),

  // Add comment to activity
  addComment: protectedProcedure.input(commentActionSchema).mutation(async ({ ctx, input }) => {
    try {
      // Create comment and increment counter
      const comment = await ctx.db.$transaction(async (tx) => {
        const newComment = await tx.activityComment.create({
          data: {
            activityId: input.activityId,
            userId: input.userId,
            content: input.content,
          },
        });

        await tx.activityFeed.update({
          where: { id: input.activityId },
          data: { comments: { increment: 1 } },
        });

        return newComment;
      });

      await Promise.all([
        globalCache.deleteByPattern("global_activity_feed:*"),
        globalCache.deleteByPattern("user_following_feed:*"),
      ]);

      return { success: true, comment };
    } catch (error) {
      console.error("Error adding comment:", error);
      throw new Error("Failed to add comment", { cause: error });
    }
  }),

  // Get comments for an activity
  getComments: publicProcedure
    .input(
      z.object({
        activityId: z.string(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const comments = await ctx.db.activityComment.findMany({
          where: { activityId: input.activityId },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          skip: input.cursor ? 1 : 0,
        });

        let nextCursor: string | undefined = undefined;
        if (comments.length > input.limit) {
          const nextItem = comments.pop();
          nextCursor = nextItem!.id;
        }

        return { comments, nextCursor };
      } catch (error) {
        console.error("Error fetching comments:", error);
        throw new Error("Failed to fetch comments", { cause: error });
      }
    }),

  // Get user engagement state for activities
  getUserEngagement: publicProcedure
    .input(getUserEngagementSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Return empty object if no activity IDs provided
        if (!input.activityIds?.length || !input.userId) {
          return {};
        }

        const [likes, shares] = await Promise.all([
          ctx.db.activityLike.findMany({
            where: {
              activityId: { in: input.activityIds },
              userId: input.userId,
            },
            select: { activityId: true },
          }),
          ctx.db.activityShare.findMany({
            where: {
              activityId: { in: input.activityIds },
              userId: input.userId,
            },
            select: { activityId: true },
          }),
        ]);

        const likedActivityIds = new Set(likes.map((like) => like.activityId));
        const sharedActivityIds = new Set(shares.map((share) => share.activityId));

        const engagement: Record<string, { liked: boolean; shared: boolean }> = {};

        input.activityIds.forEach((activityId) => {
          engagement[activityId] = {
            liked: likedActivityIds.has(activityId),
            shared: sharedActivityIds.has(activityId),
          };
        });

        return engagement;
      } catch (error) {
        console.error("Error fetching user engagement:", error);
        return {};
      }
    }),

  // Get trending topics based on activity data

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

  // Get country-specific activity feed combining ActivityFeed and ThinkPages posts

  // Country Follow System
  // Follow a country

  // Unfollow a country

  // Get countries that a country is following

  // Get countries that follow a country (followers)

  // Check if a country is following another

  // Get follow statistics for a country
});
