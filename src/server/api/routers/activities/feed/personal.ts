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

export const activitiesFeedPersonalRouter = createTRPCRouter({
  // Test mutation to debug parameter passing

  // Get global activity feed

  // Get feed from countries the user follows
  getFollowingFeed: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(30) }))
    .query(async ({ ctx, input }) => {
      try {
        const countryId = ctx.user?.countryId;
        if (!countryId) {
          return { activities: [], followingCount: 0 };
        }

        // Get followed country IDs
        const follows = await ctx.db.countryFollow.findMany({
          where: { followerCountryId: countryId },
          select: { followedCountryId: true },
        });

        const followedIds = follows.map((f) => f.followedCountryId);
        if (followedIds.length === 0) {
          return { activities: [], followingCount: 0 };
        }

        const cacheKey = `user_following_feed:${ctx.auth.userId}:${input.limit}`;
        const cachedData = await globalCache.get<{
          combinedActivities: any[];
          followingCount: number;
        }>(cacheKey);
        let combinedActivities: any[] = [];
        let followingCount = 0;

        if (cachedData) {
          // Hydrate Date objects from JSON cache
          combinedActivities = cachedData.combinedActivities.map((act) => ({
            ...act,
            timestamp: new Date(act.timestamp),
            rawPost: act.rawPost
              ? {
                  ...act.rawPost,
                  createdAt: new Date(act.rawPost.createdAt),
                  ixTimeTimestamp: new Date(act.rawPost.ixTimeTimestamp),
                }
              : undefined,
            poll: act.poll
              ? {
                  ...act.poll,
                  endDate: act.poll.endDate ? new Date(act.poll.endDate) : null,
                }
              : null,
          }));
          followingCount = cachedData.followingCount;
        } else {
          // Fetch ActivityFeed entries from followed countries
          const activityFeedEntries = await ctx.db.activityFeed.findMany({
            where: { countryId: { in: followedIds } },
            orderBy: { createdAt: "desc" },
            take: input.limit,
            include: {
              poll: {
                include: {
                  options: {
                    include: {
                      _count: {
                        select: { votes: true },
                      },
                    },
                  },
                },
              },
            },
          });

          // Fetch ThinkPages posts from followed countries
          const thinkpagesPosts = await ctx.db.thinkpagesPost.findMany({
            where: {
              visibility: "public",
              account: { countryId: { in: followedIds } },
            },
            orderBy: { ixTimeTimestamp: "desc" },
            take: input.limit,
            include: {
              account: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  profileImageUrl: true,
                  accountType: true,
                  verified: true,
                  country: { select: { id: true, name: true, flag: true } },
                },
              },
              parentPost: {
                include: {
                  account: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  },
                },
              },
              repostOf: {
                include: {
                  account: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  },
                },
              },
              reactions: true,
              mediaAttachments: true,
              reposts: {
                select: { accountId: true },
              },
              _count: {
                select: {
                  replies: true,
                  reposts: true,
                },
              },
            },
          });

          // Batch fetch countries for activity entries
          const countryIds = [
            ...new Set(activityFeedEntries.filter((a) => a.countryId).map((a) => a.countryId!)),
          ];
          const countries =
            countryIds.length > 0
              ? await ctx.db.country.findMany({
                  where: { id: { in: countryIds } },
                  select: { id: true, name: true, leader: true, flag: true },
                })
              : [];
          const countryMap = new Map(countries.map((c) => [c.id, c]));

          combinedActivities = [];

          // Transform ActivityFeed entries (excluding user-specific votes)
          for (const activity of activityFeedEntries) {
            let metadata: any = {};
            try {
              if (activity.metadata) metadata = JSON.parse(activity.metadata);
            } catch {}

            const country = activity.countryId ? countryMap.get(activity.countryId) : null;

            combinedActivities.push({
              id: activity.id,
              type: activity.type,
              category: activity.category,
              source: "activity",
              user: country
                ? {
                    id: `country-${country.id}`,
                    name: country.name,
                    countryName: country.name,
                    countryId: country.id,
                    countryFlag: country.flag ?? null,
                  }
                : { id: "system", name: "IxStats System", countryFlag: null },
              content: {
                title: activity.title,
                description: activity.description,
                metadata,
              },
              poll: (activity as any).poll
                ? {
                    id: (activity as any).poll.id,
                    question: (activity as any).poll.question,
                    description: (activity as any).poll.description,
                    pollType: (activity as any).poll.pollType,
                    multiple: (activity as any).poll.multiple,
                    isActive: (activity as any).poll.isActive,
                    endDate: (activity as any).poll.endDate,
                    options: (activity as any).poll.options.map((o: any) => ({
                      id: o.id,
                      label: o.label,
                      description: o.description,
                    })),
                    votes: (() => {
                      const v: Record<string, number> = {};
                      (activity as any).poll.options.forEach((opt: any) => {
                        v[opt.id] = opt._count.votes;
                      });
                      return v;
                    })(),
                    totalVotes: (activity as any).poll.options.reduce(
                      (sum: number, o: any) => sum + o._count.votes,
                      0
                    ),
                    hasVoted: false,
                    userVotedOptionIds: [],
                  }
                : null,
              engagement: {
                likes: activity.likes,
                comments: activity.comments,
                shares: activity.shares,
                views: activity.views,
              },
              timestamp: activity.createdAt,
              priority: activity.priority.toLowerCase(),
              visibility: activity.visibility,
              relatedCountries: [],
            });
          }

          // Transform ThinkPages posts
          for (const post of thinkpagesPosts) {
            const cleanContent = post.content.replace(/\s*\[DiscordMsg:\d+\]\s*$/, "");
            combinedActivities.push({
              id: `thinkpages-${post.id}`,
              type: "social",
              category: "social",
              source: "thinkpages",
              user: {
                id: post.accountId,
                name: `@${post.account.username}`,
                countryName: post.account.country?.name,
                countryId: post.account.country?.id,
                countryFlag: post.account.country?.flag ?? null,
              },
              content: {
                title: (() => {
                  const raw = cleanContent.replace(/\s+/g, " ").trim();
                  return raw.length ? raw : `@${post.account.username} · ThinkPages`;
                })(),
                description: cleanContent,
                mediaAttachments: post.mediaAttachments.map((m: any) => ({
                  id: m.id,
                  url: m.url,
                  filename: m.filename,
                })),
                reactionCounts: (() => {
                  try {
                    if (typeof post.reactionCounts === "string") {
                      return JSON.parse(post.reactionCounts);
                    }
                    return post.reactionCounts || null;
                  } catch {
                    return null;
                  }
                })(),
                metadata: {
                  accountType: post.account.accountType,
                  verified: post.account.verified,
                  trending: post.trending,
                  postType: "thinkpages",
                },
              },
              engagement: {
                likes: post.likeCount,
                comments: post.replyCount,
                shares: post.repostCount,
                views: post.impressions,
              },
              timestamp: post.isAutoGenerated ? post.ixTimeTimestamp : post.createdAt,
              priority: post.trending ? "high" : "medium",
              visibility: post.visibility,
              relatedCountries: post.account.country?.id ? [post.account.country.id] : [],
              rawPost: {
                ...post,
                hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
                reactionCounts: (() => {
                  let baseline: Record<string, number> = {};
                  try {
                    if (post.reactionCounts) {
                      baseline =
                        typeof post.reactionCounts === "string"
                          ? JSON.parse(post.reactionCounts)
                          : post.reactionCounts;
                    }
                  } catch {
                    // ignore
                  }
                  return (post as any).reactions.reduce((acc: any, reaction: any) => {
                    acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1;
                    return acc;
                  }, baseline);
                })(),
                timestamp: post.isAutoGenerated
                  ? post.ixTimeTimestamp.toISOString()
                  : post.createdAt.toISOString(),
              },
            });
          }

          // Sort by timestamp and paginate
          combinedActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          await globalCache.set(
            cacheKey,
            { combinedActivities, followingCount: followedIds.length },
            { ttl: 15 }
          );
          followingCount = followedIds.length;
        }

        const paginatedActivities = combinedActivities.slice(0, input.limit);

        // Populate user-specific votes dynamically on the paginated slice
        const pollIds = paginatedActivities
          .filter((a) => a.poll && a.poll.id)
          .map((a) => a.poll.id) as string[];
        const userVotedPollOptionsMap = new Map<string, string[]>();
        if (ctx.auth?.userId && pollIds.length > 0) {
          const userVotes = await ctx.db.pollVote.findMany({
            where: {
              pollId: { in: pollIds },
              userId: ctx.auth.userId,
            },
            select: { pollId: true, optionId: true },
          });
          for (const vote of userVotes) {
            const list = userVotedPollOptionsMap.get(vote.pollId) || [];
            list.push(vote.optionId);
            userVotedPollOptionsMap.set(vote.pollId, list);
          }
        }

        const activitiesWithVotes = paginatedActivities.map((act) => {
          if (act.poll) {
            return {
              ...act,
              poll: {
                ...act.poll,
                hasVoted: userVotedPollOptionsMap.has(act.poll.id),
                userVotedOptionIds: userVotedPollOptionsMap.get(act.poll.id) || [],
              },
            };
          }
          return act;
        });

        return {
          activities: activitiesWithVotes,
          followingCount,
        };
      } catch (error) {
        console.error("Error fetching following activity feed:", error);
        throw new Error("Failed to fetch following activity feed");
      }
    }),

  // Get user-specific activity feed
  getUserFeed: publicProcedure
    .input(
      activityFilterSchema.extend({
        userId: z.string(),
        includeFollowing: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get user's connections if including following
        let followingCountries: string[] = [];
        let friendIds: string[] = [];

        if (input.includeFollowing) {
          const connections = await ctx.db.userConnection.findMany({
            where: {
              userId: input.userId,
              status: "active",
            },
          });

          followingCountries = connections
            .filter((c) => c.connectionType === "following_country" && c.targetCountryId)
            .map((c) => c.targetCountryId!);

          friendIds = connections
            .filter((c) => c.connectionType === "friend" && c.targetUserId)
            .map((c) => c.targetUserId!);
        }

        // Build where clause
        const where: any = {
          OR: [
            { userId: input.userId }, // User's own activities
            { countryId: { in: followingCountries } }, // Followed countries
            { userId: { in: friendIds } }, // Friends' activities
            { visibility: "public" }, // Public activities
          ],
        };

        if (input.filter !== "all") {
          where.type = input.filter;
        }

        // Get activities
        const activities = await ctx.db.activityFeed.findMany({
          where,
          orderBy: { createdAt: "desc" },
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
        console.error("Error fetching user activity feed:", error);
        throw new Error("Failed to fetch user activity feed");
      }
    }),

  // Create new activity

  // Handle engagement actions (like, unlike, share, view)

  // Add comment to activity

  // Get comments for an activity

  // Get user engagement state for activities

  // Get trending topics based on activity data

  // Get activity statistics

  // Get country-specific activity feed combining ActivityFeed and ThinkPages posts
  getCountryActivity: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(50).default(5),
        timeRange: z.enum(["24h", "7d", "30d", "90d"]).default("7d"),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Calculate time range
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
          case "90d":
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
            visibility: "public",
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });

        // Get ThinkPages posts from country's accounts
        const countryAccounts = await ctx.db.thinkpagesAccount.findMany({
          where: { countryId: input.countryId },
          select: { id: true, username: true, accountType: true },
        });

        const accountIds = countryAccounts.map((acc) => acc.id);

        const thinkpagesPosts =
          accountIds.length > 0
            ? await ctx.db.thinkpagesPost.findMany({
                where: {
                  accountId: { in: accountIds },
                  createdAt: { gte: fromDate },
                  visibility: "public",
                },
                orderBy: { ixTimeTimestamp: "desc" },
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
              })
            : [];

        // Combine and transform activities
        const combinedActivities: Array<{
          id: string;
          type: string;
          source: "activity" | "thinkpages";
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
        activityFeedEntries.forEach((activity) => {
          let metadata: any = {};
          try {
            if (activity.metadata) {
              metadata = JSON.parse(activity.metadata);
            }
          } catch (e) {
            console.warn("Failed to parse activity metadata:", e);
          }

          combinedActivities.push({
            id: activity.id,
            type: activity.type,
            source: "activity",
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
        thinkpagesPosts.forEach((post) => {
          combinedActivities.push({
            id: post.id,
            type: "social",
            source: "thinkpages",
            title: (() => {
              const raw = post.content.replace(/\s+/g, " ").trim();
              return raw.length ? raw : `@${post.account.username} · ThinkPages`;
            })(),
            description: post.content,
            timestamp: post.isAutoGenerated ? post.ixTimeTimestamp : post.createdAt,
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
        console.error("Error fetching country activity:", error);
        return { activities: [], nextCursor: undefined };
      }
    }),

  // Country Follow System
  // Follow a country

  // Unfollow a country

  // Get countries that a country is following

  // Get countries that follow a country (followers)

  // Check if a country is following another

  // Get follow statistics for a country
});
