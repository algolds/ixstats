// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
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
  metadata: z.record(z.string(), z.any()).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  visibility: z.enum(['public', 'followers', 'friends']).default('public'),
  relatedCountries: z.array(z.string()).optional(),
});

const engagementActionSchema = z.object({
  activityId: z.string(),
  action: z.enum(['like', 'comment', 'share', 'view']),
  userId: z.string(),
});

export const activitiesRouter = createTRPCRouter({
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
  createActivity: publicProcedure
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

  // Handle engagement actions (like, comment, share, view)
  engageWithActivity: publicProcedure
    .input(engagementActionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: any = {};
        
        switch (input.action) {
          case 'like':
            updateData.likes = { increment: 1 };
            break;
          case 'comment':
            updateData.comments = { increment: 1 };
            break;
          case 'share':
            updateData.shares = { increment: 1 };
            break;
          case 'view':
            updateData.views = { increment: 1 };
            break;
        }

        const activity = await ctx.db.activityFeed.update({
          where: { id: input.activityId },
          data: updateData,
        });

        return { success: true, activity };
      } catch (error) {
        console.error('Error engaging with activity:', error);
        throw new Error('Failed to engage with activity');
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

        // Get trending activities (most engaged with)
        const trendingActivities = await ctx.db.activityFeed.findMany({
          where: {
            createdAt: { gte: fromDate },
            visibility: 'public',
          },
          orderBy: [
            { likes: 'desc' },
            { comments: 'desc' },
            { shares: 'desc' },
          ],
          take: input.limit,
        });

        // Transform to trending topics format
        const topics = trendingActivities.map((activity, index) => ({
          id: activity.id,
          title: activity.title,
          category: activity.type.charAt(0).toUpperCase() + activity.type.slice(1),
          participants: activity.likes + activity.comments + activity.shares,
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
});