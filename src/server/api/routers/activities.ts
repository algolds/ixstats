// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { getRecentChanges as getWikiBridgeRecentChanges } from "~/lib/wiki-bridge";
import { getForumActivity, getForumTrendingThreads } from "~/modules/forum";

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

export const activitiesRouter = createTRPCRouter({
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
  getGlobalFeed: publicProcedure.input(activityFilterSchema).query(async ({ ctx, input }) => {
    try {
      // Build where clause based on filters
      const where: any = {};

      if (input.filter !== "all") {
        where.type = input.filter;
      }

      if (input.category !== "all") {
        where.category = input.category;
      }

      if (input.userId) {
        where.userId = input.userId;
      }

      /** Pull a wider slice per source so merges with ThinkPages / wiki / forum stay representative */
      const mergeCap = Math.min(Math.max(input.limit * 4, 48), 150);

      // Get ActivityFeed entries
      const activityFeedEntries = await ctx.db.activityFeed.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: mergeCap,
      });

      // Get ThinkPages posts (only if not filtering by specific type that excludes social)
      const includeThinkPages = input.filter === "all" || input.filter === "social";
      const thinkpagesPosts = includeThinkPages
        ? await ctx.db.thinkpagesPost.findMany({
            where: {
              visibility: "public",
            },
            orderBy: { ixTimeTimestamp: "desc" },
            take: mergeCap,
            include: {
              account: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  profileImageUrl: true,
                  accountType: true,
                  verified: true,
                  country: {
                    select: {
                      id: true,
                      name: true,
                      flag: true,
                    },
                  },
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
          })
        : [];

      // Combine activities and ThinkPages posts
      const combinedActivities: any[] = [];

      // Batch fetch users and countries to avoid N+1 queries
      const userIds = [
        ...new Set(activityFeedEntries.filter((a) => a.userId).map((a) => a.userId!)),
      ] as string[];
      const countryIds = [
        ...new Set(activityFeedEntries.filter((a) => a.countryId).map((a) => a.countryId!)),
      ] as string[];

      const [users, countries] = await Promise.all([
        userIds.length > 0
          ? ctx.db.user.findMany({
              where: { clerkUserId: { in: userIds } },
              include: { country: true },
            })
          : [],
        countryIds.length > 0
          ? ctx.db.country.findMany({
              where: { id: { in: countryIds } },
              select: { id: true, name: true, leader: true, flag: true },
            })
          : [],
      ]);

      // Create lookup maps for O(1) access
      const userMap = new Map(users.map((u) => [u.clerkUserId, u]));
      const countryMap = new Map(countries.map((c) => [c.id, c]));

      // Transform ActivityFeed entries
      for (const activity of activityFeedEntries) {
        // Parse metadata if it exists
        let metadata: any = {};
        try {
          if (activity.metadata) {
            metadata = JSON.parse(activity.metadata);
          }
        } catch (e) {
          console.warn("Failed to parse activity metadata:", e);
        }

        // Parse related countries if they exist
        let relatedCountries: string[] = [];
        try {
          if (activity.relatedCountries) {
            relatedCountries = JSON.parse(activity.relatedCountries);
          }
        } catch (e) {
          console.warn("Failed to parse related countries:", e);
        }

        // Get user/country details from pre-fetched maps (fixes N+1 query)
        let user: any = null;
        let country: any = null;

        if (activity.userId) {
          const dbUser = userMap.get(activity.userId);
          if (dbUser) {
            user = {
              id: dbUser.clerkUserId,
              name: "User",
              countryName: dbUser.country?.name,
              countryId: dbUser.countryId,
              countryFlag: dbUser.country?.flag ?? null,
            };
          }
        }

        if (activity.countryId) {
          country = countryMap.get(activity.countryId);
        }

        combinedActivities.push({
          id: activity.id,
          type: activity.type,
          category: activity.category,
          source: "activity",
          user:
            user ||
            (country
              ? {
                  id: `country-${country.id}`,
                  name: country.leader || `Leader of ${country.name}`,
                  countryName: country.name,
                  countryId: country.id,
                  countryFlag: country.flag ?? null,
                }
              : {
                  id: "system",
                  name: "IxStats System",
                  countryFlag: null,
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
            mediaAttachments: post.mediaAttachments.map((m) => ({
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

      // Add wiki recent changes as feed items
      if (input.filter === "all" || input.filter === "meta") {
        try {
          const wikiChanges = await getWikiBridgeRecentChanges(20);
          for (const rc of wikiChanges) {
            const sizeChange = rc.newLen - rc.oldLen;
            const isNewPage = rc.type === "new";
            combinedActivities.push({
              id: `wiki-rc-${rc.title}-${rc.timestamp}`,
              type: "meta",
              category: "platform",
              source: "wiki",
              user: {
                id: `wiki-user-${rc.user}`,
                name: rc.user,
                countryFlag: null,
              },
              content: {
                title: isNewPage ? `New wiki page: ${rc.title}` : `Wiki edit: ${rc.title}`,
                description: (() => {
                  const sizeStr = `${sizeChange > 0 ? "+" : ""}${sizeChange} bytes`;
                  if (isNewPage) return `Created new page (${sizeStr})`;
                  if (!rc.comment) return `Edited page (${sizeStr})`;
                  const clean = rc.comment.replace(/\/\*.*?\*\/\s*/, "").trim();
                  if (!clean) return `Edited page (${sizeStr})`;
                  return clean.length <= 100
                    ? `${clean} (${sizeStr})`
                    : `${clean.slice(0, 97)}... (${sizeStr})`;
                })(),
                metadata: {
                  source: "ixwiki",
                  pageTitle: rc.title,
                  sizeChange,
                  isNewPage,
                  wikiUrl: `https://ixwiki.com/wiki/${encodeURIComponent(rc.title.replace(/ /g, "_"))}`,
                },
              },
              engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
              timestamp: new Date(rc.timestamp),
              priority: isNewPage ? "medium" : "low",
              visibility: "public",
              relatedCountries: [],
            });
          }
        } catch (error) {
          console.error("[GlobalFeed] Wiki recent changes failed:", error);
        }
      }

      // Add forum activity as feed items
      if (input.filter === "all" || input.filter === "social") {
        try {
          const forumItems = await getForumActivity(20);
          for (const item of forumItems) {
            combinedActivities.push({
              id: item.id,
              type: "social",
              category: "social",
              source: "forum",
              user: {
                id: `forum-user-${item.author}`,
                name: item.author,
                countryFlag: null,
              },
              content: {
                title:
                  item.type === "thread"
                    ? `New forum thread: ${item.title}`
                    : `Forum reply in: ${item.title}`,
                description: item.excerpt || `${item.author} posted in the IxWiki community forum`,
                metadata: {
                  source: "xenforo",
                  forumName: item.forumName,
                  replyCount: item.replyCount,
                  viewCount: item.viewCount,
                  forumUrl: item.url,
                },
              },
              engagement: {
                likes: 0,
                comments: item.replyCount ?? 0,
                shares: 0,
                views: item.viewCount ?? 0,
              },
              timestamp: item.timestamp,
              priority: "low",
              visibility: "public",
              relatedCountries: [],
            });
          }
        } catch (error) {
          console.error("[GlobalFeed] Forum activity failed:", error);
        }
      }

      // Sort combined activities by timestamp (most recent first)
      combinedActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination limit to combined results
      const paginatedActivities = combinedActivities.slice(0, input.limit);
      const nextCursor =
        combinedActivities.length > input.limit ? combinedActivities[input.limit]?.id : undefined;

      return {
        activities: paginatedActivities,
        nextCursor,
      };
    } catch (error) {
      console.error("Error fetching global activity feed:", error);
      throw new Error("Failed to fetch activity feed");
    }
  }),

  // Get feed from countries the user follows
  getFollowingFeed: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(30) }))
    .query(async ({ ctx, input }) => {
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

      // Fetch ActivityFeed entries from followed countries
      const activityFeedEntries = await ctx.db.activityFeed.findMany({
        where: { countryId: { in: followedIds } },
        orderBy: { createdAt: "desc" },
        take: input.limit,
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

      const combinedActivities: any[] = [];

      // Transform ActivityFeed entries
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
                name: country.leader || `Leader of ${country.name}`,
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
            mediaAttachments: post.mediaAttachments.map((m) => ({
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

      return {
        activities: combinedActivities.slice(0, input.limit),
        followingCount: followedIds.length,
      };
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

        return { success: true, activity };
      } catch (error) {
        console.error("Error creating activity:", error);
        throw new Error("Failed to create activity");
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

      return { success: true, comment };
    } catch (error) {
      console.error("Error adding comment:", error);
      throw new Error("Failed to add comment");
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
        throw new Error("Failed to fetch comments");
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
  getTrendingTopics: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(10).default(5),
        timeRange: z.enum(["1h", "6h", "24h", "7d"]).default("24h"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Calculate time range
        const now = new Date();
        let fromDate: Date;

        switch (input.timeRange) {
          case "1h":
            fromDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case "6h":
            fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case "24h":
            fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "7d":
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        }

        // Get trending activities with weighted engagement scoring
        const activities = await ctx.db.activityFeed.findMany({
          where: {
            createdAt: { gte: fromDate },
            visibility: "public",
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
          take: 200,
        });

        // Calculate engagement score with weighted metrics
        const trendingActivities = activities
          .map((activity) => {
            // Weighted scoring: reshares worth 3x, comments worth 2x, likes worth 1x
            const engagementScore =
              activity.shares * 3 +
              activity.comments * 2 +
              activity.likes * 1 +
              activity.views * 0.1; // Views have minimal weight

            // Time decay factor (newer content gets bonus)
            const hoursSinceCreated =
              (Date.now() - activity.createdAt.getTime()) / (1000 * 60 * 60);
            const timeDecayFactor = Math.max(0.1, 1 - hoursSinceCreated / 24); // Decay over 24 hours

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
          trend: "up" as const,
        }));

        return topics;
      } catch (error) {
        console.error("Error fetching trending topics:", error);
        return [];
      }
    }),

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

  /**
   * Global headlines engine — aggregates live data from multiple game systems
   * into short, news-style headlines for the ThinkPages ticker.
   * Pulls from: countries (economic stats), crisis events, diplomatic events,
   * embassy missions, ThinkPages government/media posts, and security threats.
   */
  getGlobalHeadlines: publicProcedure
    .input(
      z.object({
        limit: z.number().min(5).max(60).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      type Headline = {
        id: string;
        text: string;
        category:
          | "economic"
          | "crisis"
          | "diplomatic"
          | "military"
          | "social"
          | "political"
          | "achievement"
          | "wiki"
          | "forum";
        priority: "critical" | "high" | "medium" | "low";
        timestamp: string;
        url?: string;
      };

      const headlines: Headline[] = [];

      // ── 1. Country economic snapshots (GDP leaders, growth, decline) ──
      const [topGdp, fastGrowth, declining, highPop] = await Promise.all([
        ctx.db.country.findMany({
          orderBy: { currentTotalGdp: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            currentTotalGdp: true,
            currentGdpPerCapita: true,
            economicTier: true,
            updatedAt: true,
          },
        }),
        ctx.db.country.findMany({
          where: { adjustedGdpGrowth: { gt: 0.025 } },
          orderBy: { adjustedGdpGrowth: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            adjustedGdpGrowth: true,
            economicTier: true,
            updatedAt: true,
          },
        }),
        ctx.db.country.findMany({
          where: { adjustedGdpGrowth: { lt: -0.005 } },
          orderBy: { adjustedGdpGrowth: "asc" },
          take: 3,
          select: { id: true, name: true, adjustedGdpGrowth: true, updatedAt: true },
        }),
        ctx.db.country.findMany({
          where: { currentPopulation: { gt: 100_000_000 } },
          orderBy: { currentPopulation: "desc" },
          take: 3,
          select: {
            id: true,
            name: true,
            currentPopulation: true,
            populationGrowthRate: true,
            updatedAt: true,
          },
        }),
      ]);

      // Format GDP
      const fmtGdp = (v: number) => {
        if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
        return `$${v.toLocaleString()}`;
      };
      const fmtPop = (v: number) => {
        if (v >= 1e9) return `${Math.round(v / 1e9)}B`;
        if (v >= 1e6) return `${Math.round(v / 1e6)}M`;
        return Math.round(v).toLocaleString();
      };

      const wikiUrl = (name: string) =>
        `https://ixwiki.com/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;

      topGdp.forEach((c, i) => {
        headlines.push({
          id: `gdp_rank_${c.id}`,
          text: `${c.name} holds #${i + 1} global GDP at ${fmtGdp(c.currentTotalGdp)} (${c.economicTier})`,
          category: "economic",
          priority: i === 0 ? "high" : "medium",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      fastGrowth.forEach((c) => {
        headlines.push({
          id: `growth_${c.id}`,
          text: `${c.name} reports ${(c.adjustedGdpGrowth * 100).toFixed(1)}% GDP growth — ${c.economicTier} economy accelerating`,
          category: "economic",
          priority: c.adjustedGdpGrowth > 0.05 ? "high" : "medium",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      declining.forEach((c) => {
        headlines.push({
          id: `decline_${c.id}`,
          text: `Economic contraction: ${c.name} GDP shrinks ${(Math.abs(c.adjustedGdpGrowth) * 100).toFixed(1)}%`,
          category: "economic",
          priority: c.adjustedGdpGrowth < -0.02 ? "high" : "medium",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      highPop.forEach((c) => {
        headlines.push({
          id: `pop_${c.id}`,
          text: `${c.name} population reaches ${fmtPop(c.currentPopulation)} — growth at ${(c.populationGrowthRate * 100).toFixed(1)}%`,
          category: "economic",
          priority: "low",
          timestamp: c.updatedAt.toISOString(),
          url: wikiUrl(c.name),
        });
      });

      // ── 2. Active crisis events ──
      const crises = await ctx.db.crisisEvent.findMany({
        where: {
          responseStatus: { in: ["pending", "in_progress", "monitoring"] },
        },
        orderBy: [{ severity: "desc" }, { timestamp: "desc" }],
        take: 8,
      });

      crises.forEach((crisis) => {
        const severityMap: Record<string, "critical" | "high" | "medium" | "low"> = {
          critical: "critical",
          high: "high",
          medium: "medium",
          low: "low",
        };
        const prefix =
          crisis.severity === "critical"
            ? "BREAKING"
            : crisis.severity === "high"
              ? "ALERT"
              : "UPDATE";
        headlines.push({
          id: `crisis_${crisis.id}`,
          text: `${prefix}: ${crisis.title}${crisis.location ? ` — ${crisis.location}` : ""}`,
          category: "crisis",
          priority: severityMap[crisis.severity ?? "medium"] ?? "medium",
          timestamp: crisis.timestamp.toISOString(),
        });
      });

      // ── 3. Recent diplomatic events ──
      const diplomaticEvents = await ctx.db.diplomaticEvent.findMany({
        where: { createdAt: { gte: last48h } },
        orderBy: { createdAt: "desc" },
        take: 8,
      });

      // Resolve country names for diplomatic events
      const diploCountryIds = new Set<string>();
      diplomaticEvents.forEach((e) => {
        diploCountryIds.add(e.country1Id);
        if (e.country2Id) diploCountryIds.add(e.country2Id);
      });
      const diploCountries =
        diploCountryIds.size > 0
          ? await ctx.db.country.findMany({
              where: { id: { in: [...diploCountryIds] } },
              select: { id: true, name: true },
            })
          : [];
      const diploMap = new Map(diploCountries.map((c) => [c.id, c.name]));

      diplomaticEvents.forEach((event) => {
        const c1 = diploMap.get(event.country1Id) ?? "Unknown";
        const c2 = event.country2Id ? diploMap.get(event.country2Id) : null;
        const eventLabel = event.eventType?.replace(/_/g, " ") ?? "diplomatic exchange";
        const text = c2
          ? `${c1} and ${c2}: ${event.title || eventLabel}`
          : `${c1}: ${event.title || eventLabel}`;
        headlines.push({
          id: `diplo_${event.id}`,
          text,
          category: "diplomatic",
          priority: event.severity === "high" || event.severity === "critical" ? "high" : "medium",
          timestamp: event.createdAt.toISOString(),
          url: wikiUrl(c1),
        });
      });

      // ── 4. Embassy missions (completed/in-progress) ──
      const missions = await ctx.db.embassyMission.findMany({
        where: {
          OR: [
            { status: "in_progress", updatedAt: { gte: last48h } },
            { status: "completed", updatedAt: { gte: last48h } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: {
          embassy: {
            include: {
              hostCountry: { select: { name: true } },
              guestCountry: { select: { name: true } },
            },
          },
        },
      });

      missions.forEach((mission) => {
        const host = mission.embassy?.hostCountry?.name ?? "Unknown";
        const guest = mission.embassy?.guestCountry?.name ?? "Unknown";
        const statusText = mission.status === "completed" ? "completes" : "underway";
        headlines.push({
          id: `mission_${mission.id}`,
          text: `Embassy mission ${statusText}: ${mission.name} between ${host} and ${guest}`,
          category: "diplomatic",
          url: wikiUrl(host),
          priority: mission.status === "completed" ? "medium" : "low",
          timestamp: mission.updatedAt.toISOString(),
        });
      });

      // ── 5. Security threats (active) ──
      const threats = await ctx.db.securityThreat.findMany({
        where: { isActive: true },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
        take: 5,
        include: {
          country: { select: { name: true } },
        },
      });

      threats.forEach((threat) => {
        const countryName = threat.country?.name ?? "Unknown region";
        const prefix =
          threat.severity === "critical" || threat.severity === "high"
            ? "Security alert"
            : "Monitoring";
        headlines.push({
          id: `threat_${threat.id}`,
          text: `${prefix}: ${threat.threatName} — ${countryName} (${threat.threatType.replace(/_/g, " ")})`,
          category: "military",
          priority:
            threat.severity === "critical"
              ? "critical"
              : threat.severity === "high"
                ? "high"
                : "medium",
          timestamp: threat.updatedAt.toISOString(),
        });
      });

      // ── 6. ThinkPages notable posts (government/media verified accounts, recent) ──
      const notablePosts = await ctx.db.thinkpagesPost.findMany({
        where: {
          visibility: "public",
          createdAt: { gte: last48h },
          account: {
            OR: [
              { accountType: "government", verified: true },
              { accountType: "media", verified: true },
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          account: {
            select: {
              displayName: true,
              username: true,
              accountType: true,
              country: { select: { name: true } },
            },
          },
        },
      });

      notablePosts.forEach((post) => {
        const source =
          post.account?.accountType === "government"
            ? `Gov. of ${post.account.country?.name ?? "Unknown"}`
            : `@${post.account?.username ?? "unknown"}`;
        const preview = post.content.length > 80 ? post.content.slice(0, 77) + "..." : post.content;
        headlines.push({
          id: `post_${post.id}`,
          text: `${source}: "${preview}"`,
          category: "social",
          priority: post.account?.accountType === "government" ? "medium" : "low",
          timestamp: post.isAutoGenerated
            ? post.ixTimeTimestamp.toISOString()
            : post.createdAt.toISOString(),
        });
      });

      // ── 7. Cabinet meetings (scheduled/completed recently) ──
      const meetings = await ctx.db.cabinetMeeting.findMany({
        where: {
          OR: [
            { status: "scheduled" },
            { status: "in_progress" },
            { status: "completed", completedAt: { gte: last48h } },
          ],
        },
        take: 4,
        orderBy: { scheduledDate: "desc" },
      });

      // Resolve country names for meetings
      const meetingCountryIds = [...new Set(meetings.map((m) => m.countryId))];
      const meetingCountries =
        meetingCountryIds.length > 0
          ? await ctx.db.country.findMany({
              where: { id: { in: meetingCountryIds } },
              select: { id: true, name: true },
            })
          : [];
      const meetingMap = new Map(meetingCountries.map((c) => [c.id, c.name]));

      meetings.forEach((meeting) => {
        const countryName = meetingMap.get(meeting.countryId) ?? "Unknown";
        const statusLabel =
          meeting.status === "completed"
            ? "concluded"
            : meeting.status === "in_progress"
              ? "in session"
              : "scheduled";
        headlines.push({
          id: `meeting_${meeting.id}`,
          text: `${countryName} cabinet meeting ${statusLabel}: ${meeting.title}`,
          category: "political",
          priority: meeting.status === "in_progress" ? "high" : "low",
          timestamp: (meeting.scheduledDate ?? meeting.createdAt).toISOString(),
        });
      });

      // ── 8. Wiki recent edits ──
      try {
        const wikiChanges = await getWikiBridgeRecentChanges(8);
        for (const rc of wikiChanges) {
          const sizeChange = rc.newLen - rc.oldLen;
          const sizeLabel = sizeChange > 0 ? `+${sizeChange}` : String(sizeChange);
          const isNewPage = rc.type === "new";
          // Clean up edit summary: drop auto-generated "Created page with ..." noise
          let summary = "";
          if (!isNewPage && rc.comment) {
            const clean = rc.comment.replace(/\/\*.*?\*\/\s*/, "").trim();
            if (clean && clean.length <= 80) summary = ` — ${clean}`;
            else if (clean) summary = ` — ${clean.slice(0, 77)}...`;
          }
          const verb = isNewPage ? "created" : "edited";
          const wikiDate = new Date(rc.timestamp);
          const wikiTimestamp = isNaN(wikiDate.getTime())
            ? new Date().toISOString()
            : wikiDate.toISOString();
          headlines.push({
            id: `wiki_${rc.title}_${rc.timestamp}`,
            text: `Wiki: ${rc.user} ${verb} "${rc.title}"${summary} (${sizeLabel} bytes)`,
            category: "wiki",
            priority: isNewPage ? "medium" : "low",
            timestamp: wikiTimestamp,
            url: `https://ixwiki.com/wiki/${encodeURIComponent(rc.title.replace(/ /g, "_"))}`,
          });
        }
      } catch (error) {
        console.error("[Headlines] Wiki recent changes failed:", error);
      }

      // ── 9. Forum activity ──
      try {
        const forumItems = await getForumActivity(6);
        for (const item of forumItems) {
          const verb = item.type === "thread" ? "started thread" : "posted in";
          headlines.push({
            id: item.id,
            text: `Forum: ${item.author} ${verb} "${item.title}"${item.forumName ? ` in ${item.forumName}` : ""}`,
            category: "forum",
            priority: "low",
            timestamp: item.timestamp.toISOString(),
            url: item.url,
          });
        }
      } catch (error) {
        console.error("[Headlines] Forum activity failed:", error);
      }

      // ── Shuffle headlines (Fisher-Yates) so the ticker feels dynamic ──
      for (let i = headlines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [headlines[i]!, headlines[j]!] = [headlines[j]!, headlines[i]!];
      }

      return {
        headlines: headlines.slice(0, input.limit),
        generatedAt: now.toISOString(),
      };
    }),

  /**
   * Unified trending — cross-platform trending topics scored by engagement.
   * Aggregates: ThinkPages posts, forum threads, wiki page activity, IxStats activities.
   * Scoring: weighted engagement with time decay (newer content ranks higher).
   */
  getUnifiedTrending: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      type TrendingItem = {
        id: string;
        title: string;
        source: "thinkpages" | "forum" | "wiki" | "ixstats" | "crisis";
        score: number;
        engagement: { views: number; replies: number; likes: number; reposts: number };
        author?: string;
        url?: string;
        excerpt?: string;
        timestamp: string;
        isNew?: boolean;
      };

      const now = Date.now();
      const last48h = new Date(now - 48 * 60 * 60 * 1000);
      const items: TrendingItem[] = [];

      // Time decay: content from 0h ago = 1.0x, 48h ago = 0.1x
      const timeDecay = (ts: Date | string) => {
        const d = typeof ts === "string" ? new Date(ts) : ts;
        const time = isNaN(d.getTime()) ? now : d.getTime();
        return Math.max(0.1, 1 - (now - time) / (48 * 60 * 60 * 1000));
      };

      // ── 1. ThinkPages trending posts ──
      try {
        const posts = await ctx.db.thinkpagesPost.findMany({
          where: { visibility: "public", createdAt: { gte: last48h } },
          orderBy: { impressions: "desc" },
          take: 30,
          include: {
            account: { select: { username: true, displayName: true, verified: true } },
          },
        });

        for (const post of posts) {
          const raw =
            post.repostCount * 3 + post.replyCount * 2 + post.likeCount + post.impressions * 0.01;
          const score = raw * timeDecay(post.createdAt);
          const preview =
            post.content.length > 100 ? post.content.slice(0, 97) + "..." : post.content;
          items.push({
            id: `tp-${post.id}`,
            title: `@${post.account?.username ?? "unknown"}`,
            source: "thinkpages",
            score,
            engagement: {
              views: post.impressions,
              replies: post.replyCount,
              likes: post.likeCount,
              reposts: post.repostCount,
            },
            author: post.account?.displayName ?? post.account?.username,
            excerpt: preview,
            timestamp: post.isAutoGenerated
              ? post.ixTimeTimestamp.toISOString()
              : post.createdAt.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] ThinkPages failed:", error);
      }

      // ── 2. Forum threads ──
      try {
        const threads = await getForumTrendingThreads(25);
        for (const thread of threads) {
          // Forum engagement: views are significant, replies = comments
          const raw = thread.replyCount * 2 + thread.viewCount * 0.05;
          const score = raw * timeDecay(thread.timestamp);
          items.push({
            id: `forum-${thread.threadId}`,
            title: thread.title,
            source: "forum",
            score,
            engagement: {
              views: thread.viewCount,
              replies: thread.replyCount,
              likes: 0,
              reposts: 0,
            },
            author: thread.author,
            url: thread.url,
            timestamp: thread.timestamp.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] Forum failed:", error);
      }

      // ── 3. Wiki trending pages ──
      try {
        // Build trending pages from recent changes (aggregated by title)
        const recentEdits = await getWikiBridgeRecentChanges(100);
        const pageMap = new Map<
          string,
          {
            title: string;
            editCount: number;
            uniqueEditors: Set<string>;
            totalBytesChanged: number;
            isNew: boolean;
            latestEdit: Date;
          }
        >();
        for (const rc of recentEdits) {
          const editDate = new Date(rc.timestamp);
          const validDate = isNaN(editDate.getTime()) ? new Date() : editDate;
          const existing = pageMap.get(rc.title);
          if (existing) {
            existing.editCount++;
            existing.uniqueEditors.add(rc.user);
            existing.totalBytesChanged += Math.abs(rc.newLen - rc.oldLen);
            if (rc.type === "new") existing.isNew = true;
            if (validDate > existing.latestEdit) {
              existing.latestEdit = validDate;
            }
          } else {
            pageMap.set(rc.title, {
              title: rc.title,
              editCount: 1,
              uniqueEditors: new Set([rc.user]),
              totalBytesChanged: Math.abs(rc.newLen - rc.oldLen),
              isNew: rc.type === "new",
              latestEdit: validDate,
            });
          }
        }
        const pages = [...pageMap.values()]
          .map((p) => ({ ...p, uniqueEditors: p.uniqueEditors.size }))
          .sort((a, b) => b.editCount - a.editCount)
          .slice(0, 25);
        for (const page of pages) {
          // Wiki engagement: edits = activity signal, multiple editors = collaborative interest
          // Byte changes proxy for content depth; new pages get a bonus
          const raw =
            page.editCount * 5 +
            page.uniqueEditors * 10 +
            Math.min(page.totalBytesChanged / 500, 20) +
            (page.isNew ? 15 : 0);
          const score = raw * timeDecay(page.latestEdit);
          items.push({
            id: `wiki-${page.title}`,
            title: page.title,
            source: "wiki",
            score,
            engagement: {
              views: 0,
              replies: 0,
              likes: 0,
              reposts: 0,
            },
            author: undefined,
            url: `https://ixwiki.com/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
            excerpt: page.isNew
              ? `New page — ${page.editCount} edit${page.editCount > 1 ? "s" : ""} by ${page.uniqueEditors} editor${page.uniqueEditors > 1 ? "s" : ""}`
              : `${page.editCount} edit${page.editCount > 1 ? "s" : ""} by ${page.uniqueEditors} editor${page.uniqueEditors > 1 ? "s" : ""} (${page.totalBytesChanged > 0 ? "+" : ""}${page.totalBytesChanged} bytes)`,
            timestamp: page.latestEdit.toISOString(),
            isNew: page.isNew,
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] Wiki failed:", error);
      }

      // ── 4. IxStats activities ──
      try {
        const activities = await ctx.db.activityFeed.findMany({
          where: { createdAt: { gte: last48h }, visibility: "public" },
          orderBy: { views: "desc" },
          take: 40,
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

        for (const a of activities) {
          let baseScore = 5;
          if (a.type === "diplomatic") baseScore = 25;
          else if (a.type === "economic") baseScore = 20;
          else if (a.type === "achievement") baseScore = 15;
          else if (a.type === "meta") baseScore = 10;

          const raw = baseScore + a.shares * 3 + a.comments * 2 + a.likes + a.views * 0.01;
          const score = raw * timeDecay(a.createdAt);
          items.push({
            id: `ix-${a.id}`,
            title: a.title,
            source: "ixstats",
            score,
            engagement: {
              views: a.views,
              replies: a.comments,
              likes: a.likes,
              reposts: a.shares,
            },
            timestamp: a.createdAt.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] IxStats activities failed:", error);
      }

      // ── 5. Crisis Events ──
      try {
        const crises = await ctx.db.crisisEvent.findMany({
          where: {
            responseStatus: { in: ["pending", "in_progress", "monitoring"] },
          },
          orderBy: [{ severity: "desc" }, { timestamp: "desc" }],
          take: 10,
        });

        for (const crisis of crises) {
          const baseScore =
            crisis.severity === "critical"
              ? 60
              : crisis.severity === "high"
                ? 45
                : crisis.severity === "medium"
                  ? 30
                  : 20;
          const score = baseScore * Math.max(0.4, timeDecay(crisis.timestamp));
          items.push({
            id: `crisis-${crisis.id}`,
            title: crisis.title,
            source: "crisis",
            score,
            engagement: {
              views: crisis.casualties ?? 0,
              replies: 0,
              likes: 0,
              reposts: 0,
            },
            excerpt: crisis.description ?? "Active international crisis requiring resolution.",
            timestamp: crisis.timestamp.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] Crisis events failed:", error);
      }

      // Sort by score descending and return top items
      items.sort((a, b) => b.score - a.score);
      return { items: items.slice(0, input.limit), generatedAt: new Date().toISOString() };
    }),
});
