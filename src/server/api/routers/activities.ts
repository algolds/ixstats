// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

// Input schemas
const activityFilterSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
  filter: z.enum(['all', 'achievements', 'diplomatic', 'economic', 'social', 'meta']).default('all'),
  category: z.enum(['all', 'game', 'platform', 'social']).default('all'),
  userId: z.string().optional(),
});

const createActivitySchema = z.object({
  type: z.enum(['achievement', 'diplomatic', 'economic', 'social', 'meta']),
  category: z.enum(['game', 'platform', 'social']).default('game'),
  userId: z.string().optional(),
  countryId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  metadata: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
  ])).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  visibility: z.enum(['public', 'followers', 'friends']).default('public'),
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

export const activitiesRouter = createTRPCRouter({
  // Test mutation to debug parameter passing
  testMutation: publicProcedure
    .input(z.object({
      testId: z.string(),
      testAction: z.string(),
    }))
    .mutation(async ({ input }) => {
      console.log('TEST MUTATION - Raw input:', JSON.stringify(input));
      return { success: true, received: input };
    }),

  // Get global activity feed
  getGlobalFeed: publicProcedure
    .input(activityFilterSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Build where clause based on filters
        const where: any = {};
        
        if (input.filter !== 'all') {
          where.type = input.filter;
        }
        
        if (input.category !== 'all') {
          where.category = input.category;
        }
        
        if (input.userId) {
          where.userId = input.userId;
        }

        // Get activities with pagination
        const activities = await ctx.db.activityFeed.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          skip: input.cursor ? 1 : 0,
        });

        let nextCursor: string | undefined = undefined;
        if (activities.length > input.limit) {
          const nextItem = activities.pop();
          nextCursor = nextItem!.id;
        }

        // Transform activities for frontend
        const transformedActivities = await Promise.all(
          activities.map(async (activity) => {
            // Parse metadata if it exists
            let metadata: any = {};
            try {
              if (activity.metadata) {
                metadata = JSON.parse(activity.metadata);
              }
            } catch (e) {
              console.warn('Failed to parse activity metadata:', e);
            }

            // Parse related countries if they exist
            let relatedCountries: string[] = [];
            try {
              if (activity.relatedCountries) {
                relatedCountries = JSON.parse(activity.relatedCountries);
              }
            } catch (e) {
              console.warn('Failed to parse related countries:', e);
            }

            // Get user/country details if available
            let user: any = null;
            let country: any = null;

            if (activity.userId) {
              const dbUser = await ctx.db.user.findUnique({
                where: { clerkUserId: activity.userId },
                include: { country: true },
              });
              if (dbUser) {
                user = {
                  id: dbUser.clerkUserId,
                  name: 'User', // Would need to get from Clerk
                  countryName: dbUser.country?.name,
                  countryId: dbUser.countryId,
                };
              }
            }

            if (activity.countryId) {
              country = await ctx.db.country.findUnique({
                where: { id: activity.countryId },
                select: { id: true, name: true, leader: true },
              });
            }

            return {
              id: activity.id,
              type: activity.type,
              category: activity.category,
              user: user || (country ? {
                id: `country-${country.id}`,
                name: country.leader || `Leader of ${country.name}`,
                countryName: country.name,
                countryId: country.id,
              } : {
                id: 'system',
                name: 'IxStats System',
              }),
              content: {
                title: activity.title,
                description: activity.description,
                metadata,
              },
              engagement: {
                likes: activity.likes,
                comments: activity.comments,
                shares: activity.shares,
                views: activity.views,
              },
              timestamp: activity.createdAt,
              priority: activity.priority.toLowerCase(),
              visibility: activity.visibility,
              relatedCountries,
            };
          })
        );

        return {
          activities: transformedActivities,
          nextCursor,
        };
      } catch (error) {
        console.error('Error fetching global activity feed:', error);
        throw new Error('Failed to fetch activity feed');
      }
    }),

  // Get user-specific activity feed
  getUserFeed: publicProcedure
    .input(activityFilterSchema.extend({
      userId: z.string(),
      includeFollowing: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get user's connections if including following
        let followingCountries: string[] = [];
        let friendIds: string[] = [];

        if (input.includeFollowing) {
          const connections = await ctx.db.userConnection.findMany({
            where: {
              userId: input.userId,
              status: 'active',
            },
          });

          followingCountries = connections
            .filter(c => c.connectionType === 'following_country' && c.targetCountryId)
            .map(c => c.targetCountryId!);
          
          friendIds = connections
            .filter(c => c.connectionType === 'friend' && c.targetUserId)
            .map(c => c.targetUserId!);
        }

        // Build where clause
        const where: any = {
          OR: [
            { userId: input.userId }, // User's own activities
            { countryId: { in: followingCountries } }, // Followed countries
            { userId: { in: friendIds } }, // Friends' activities
            { visibility: 'public' }, // Public activities
          ],
        };

        if (input.filter !== 'all') {
          where.type = input.filter;
        }

        // Get activities
        const activities = await ctx.db.activityFeed.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          skip: input.cursor ? 1 : 0,
        });

        let nextCursor: string | undefined = undefined;
        if (activities.length > input.limit) {
          const nextItem = activities.pop();
          nextCursor = nextItem!.id;
        }

        return {
          activities,
          nextCursor,
        };
      } catch (error) {
        console.error('Error fetching user activity feed:', error);
        throw new Error('Failed to fetch user activity feed');
      }
    }),

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
            relatedCountries: input.relatedCountries ? JSON.stringify(input.relatedCountries) : null,
          },
        });

        return { success: true, activity };
      } catch (error) {
        console.error('Error creating activity:', error);
        throw new Error('Failed to create activity');
      }
    }),

  // Handle engagement actions (like, unlike, share, view)  
  engageWithActivity: protectedProcedure
    .input(z.object({
      activityId: z.string(),
      action: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('ENGAGEMENT MUTATION - Raw input received:', JSON.stringify(input));
      
      if (input.action === 'like') {
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
          return { success: false, message: 'Already liked' };
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

        return { success: true, message: 'Liked!' };
      }

      if (input.action === 'unlike') {
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
          return { success: false, message: 'Not liked' };
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

        return { success: true, message: 'Unliked!' };
      }

      if (input.action === 'reshare') {
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
          return { success: false, message: 'Already reshared' };
        }

        // Get the original activity for reshare content
        const originalActivity = await ctx.db.activityFeed.findUnique({
          where: { id: input.activityId },
          include: {
            activityLikes: { where: { userId: input.userId } },
          },
        });

        if (!originalActivity) {
          return { success: false, message: 'Original activity not found' };
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
              type: 'social',
              category: 'social',
              userId: input.userId,
              countryId: userProfile?.countryId || null,
              title: `Reshared: ${originalActivity.title}`,
              description: `${userProfile?.country?.name || 'User'} reshared: ${originalActivity.description}`,
              metadata: JSON.stringify({
                originalActivityId: originalActivity.id,
                originalType: originalActivity.type,
                originalUserId: originalActivity.userId,
                originalCountryId: originalActivity.countryId,
                reshareType: 'activity_reshare',
              }),
              priority: 'medium',
              visibility: 'public',
              relatedCountries: originalActivity.relatedCountries,
            },
          });
        });

        return { success: true, message: 'Reshared to your profile!' };
      }

      if (input.action === 'view') {
        // Increment view counter (no user tracking needed)
        await ctx.db.activityFeed.update({
          where: { id: input.activityId },
          data: { views: { increment: 1 } },
        });

        return { success: true, message: 'View recorded!' };
      }

      return { success: false, message: 'Invalid action' };
    }),

  // Add comment to activity
  addComment: protectedProcedure
    .input(commentActionSchema)
    .mutation(async ({ ctx, input }) => {
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

        return { success: true, comment };
      } catch (error) {
        console.error('Error adding comment:', error);
        throw new Error('Failed to add comment');
      }
    }),

  // Get comments for an activity
  getComments: publicProcedure
    .input(z.object({
      activityId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const comments = await ctx.db.activityComment.findMany({
          where: { activityId: input.activityId },
          orderBy: { createdAt: 'desc' },
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
        console.error('Error fetching comments:', error);
        throw new Error('Failed to fetch comments');
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

        const likedActivityIds = new Set(likes.map(like => like.activityId));
        const sharedActivityIds = new Set(shares.map(share => share.activityId));

        const engagement: Record<string, { liked: boolean; shared: boolean }> = {};
        
        input.activityIds.forEach(activityId => {
          engagement[activityId] = {
            liked: likedActivityIds.has(activityId),
            shared: sharedActivityIds.has(activityId),
          };
        });

        return engagement;
      } catch (error) {
        console.error('Error fetching user engagement:', error);
        return {};
      }
    }),

  // Get trending topics based on activity data
  getTrendingTopics: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(10).default(5),
      timeRange: z.enum(['1h', '6h', '24h', '7d']).default('24h'),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Calculate time range
        const now = new Date();
        let fromDate: Date;
        
        switch (input.timeRange) {
          case '1h':
            fromDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '6h':
            fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case '24h':
            fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        }

        // Get trending activities with weighted engagement scoring
        const activities = await ctx.db.activityFeed.findMany({
          where: {
            createdAt: { gte: fromDate },
            visibility: 'public',
          },
          select: {
            id: true,
            title: true,
            type: true,
            likes: true,
            comments: true,
            shares: true,
            views: true,
            createdAt: true,
          },
        });

        // Calculate engagement score with weighted metrics
        const trendingActivities = activities
          .map((activity) => {
            // Weighted scoring: reshares worth 3x, comments worth 2x, likes worth 1x
            const engagementScore =
              (activity.shares * 3) +
              (activity.comments * 2) +
              (activity.likes * 1) +
              (activity.views * 0.1); // Views have minimal weight

            // Time decay factor (newer content gets bonus)
            const hoursSinceCreated = (Date.now() - activity.createdAt.getTime()) / (1000 * 60 * 60);
            const timeDecayFactor = Math.max(0.1, 1 - (hoursSinceCreated / 24)); // Decay over 24 hours

            const finalScore = engagementScore * timeDecayFactor;

            return {
              ...activity,
              engagementScore: finalScore,
              participants: activity.likes + activity.comments + activity.shares,
            };
          })
          .sort((a, b) => b.engagementScore - a.engagementScore)
          .slice(0, input.limit);

        // Transform to trending topics format
        const topics = trendingActivities.map((activity) => ({
          id: activity.id,
          title: activity.title,
          category: activity.type.charAt(0).toUpperCase() + activity.type.slice(1),
          participants: activity.participants,
          trend: 'up' as const,
        }));

        return topics;
      } catch (error) {
        console.error('Error fetching trending topics:', error);
        return [];
      }
    }),

  // Get activity statistics
  getActivityStats: publicProcedure
    .input(z.object({
      timeRange: z.enum(['24h', '7d', '30d']).default('24h'),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const now = new Date();
        let fromDate: Date;

        switch (input.timeRange) {
          case '24h':
            fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
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
        console.error('Error fetching activity stats:', error);
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
  getCountryActivity: publicProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().min(1).max(50).default(5),
      timeRange: z.enum(['24h', '7d', '30d', '90d']).default('7d'),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Calculate time range
        const now = new Date();
        let fromDate: Date;

        switch (input.timeRange) {
          case '24h':
            fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        }

        // Get country data for context
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true },
        });

        if (!country) {
          return { activities: [], nextCursor: undefined };
        }

        // Get ActivityFeed entries for this country
        const activityFeedEntries = await ctx.db.activityFeed.findMany({
          where: {
            countryId: input.countryId,
            createdAt: { gte: fromDate },
            visibility: 'public',
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
        });

        // Get ThinkPages posts from country's accounts
        const countryAccounts = await ctx.db.thinkpagesAccount.findMany({
          where: { countryId: input.countryId },
          select: { id: true, username: true, accountType: true },
        });

        const accountIds = countryAccounts.map(acc => acc.id);

        const thinkpagesPosts = accountIds.length > 0 ? await ctx.db.thinkpagesPost.findMany({
          where: {
            accountId: { in: accountIds },
            createdAt: { gte: fromDate },
            visibility: 'public',
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          include: {
            account: {
              select: {
                username: true,
                accountType: true,
                verified: true,
              },
            },
          },
        }) : [];

        // Combine and transform activities
        const combinedActivities: Array<{
          id: string;
          type: string;
          source: 'activity' | 'thinkpages';
          title: string;
          description: string;
          timestamp: Date;
          metadata?: any;
          engagement?: {
            likes: number;
            comments: number;
            shares: number;
          };
        }> = [];

        // Add ActivityFeed entries
        activityFeedEntries.forEach(activity => {
          let metadata: any = {};
          try {
            if (activity.metadata) {
              metadata = JSON.parse(activity.metadata);
            }
          } catch (e) {
            console.warn('Failed to parse activity metadata:', e);
          }

          combinedActivities.push({
            id: activity.id,
            type: activity.type,
            source: 'activity',
            title: activity.title,
            description: activity.description,
            timestamp: activity.createdAt,
            metadata,
            engagement: {
              likes: activity.likes,
              comments: activity.comments,
              shares: activity.shares,
            },
          });
        });

        // Add ThinkPages posts
        thinkpagesPosts.forEach(post => {
          combinedActivities.push({
            id: post.id,
            type: 'social',
            source: 'thinkpages',
            title: `@${post.account.username} posted on ThinkPages`,
            description: post.content,
            timestamp: post.createdAt,
            metadata: {
              accountType: post.account.accountType,
              verified: post.account.verified,
              trending: post.trending,
            },
            engagement: {
              likes: post.likeCount,
              comments: post.replyCount,
              shares: post.repostCount,
            },
          });
        });

        // Sort by timestamp (most recent first) and limit
        combinedActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const limitedActivities = combinedActivities.slice(0, input.limit);

        return {
          activities: limitedActivities,
          nextCursor: undefined, // Could implement cursor-based pagination if needed
        };
      } catch (error) {
        console.error('Error fetching country activity:', error);
        return { activities: [], nextCursor: undefined };
      }
    }),
});