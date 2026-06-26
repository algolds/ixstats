// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getRecentChanges as getWikiBridgeRecentChanges } from "~/lib/wiki-bridge";
import { getForumActivity } from "~/server/modules/forum";
import { globalCache } from "~/lib/advanced-cache-system";

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

export const activitiesFeedGlobalRouter = createTRPCRouter({
  // Test mutation to debug parameter passing

  // Get global activity feed
  getGlobalFeed: publicProcedure.input(activityFilterSchema).query(async ({ ctx, input }) => {
    try {
      const cacheKey = `global_activity_feed:${input.filter}:${input.category}:${input.userId || "all"}:${input.limit}:${input.cursor || "none"}`;

      const cachedData = await globalCache.get<{ combinedActivities: any[] }>(cacheKey);
      let combinedActivities: any[] = [];

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
        }));
      } else {
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

        // Get ThinkPages posts (only if not filtering by specific type that excludes social)
        const includeThinkPages = input.filter === "all" || input.filter === "social";
        const thinkpagesPosts = includeThinkPages
          ? await ctx.db.thinkpagesPost.findMany({
              where: {
                visibility: "public",
              },
              orderBy: { ixTimeTimestamp: "desc" },
              include: {
                account: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    profileImageUrl: true,
                    accountType: true,
                    verified: true,
                    clerkUserId: true,
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
                        clerkUserId: true,
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
                        clerkUserId: true,
                      },
                    },
                  },
                },
                reactions: true,
                mediaAttachments: true,
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
                reposts: {
                  select: { accountId: true },
                },
                _count: {
                  select: {
                    replies: true,
                    reposts: true,
                  },
                },
              } as any,
            })
          : [];

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
                name:
                  dbUser.wikiUsername ??
                  dbUser.discordUsername ??
                  dbUser.forumUsername ??
                  dbUser.country?.name ??
                  "User",
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
                    name: country.name,
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
            relatedCountries,
          });
        }

        // Transform ThinkPages posts
        for (const post of thinkpagesPosts as any[]) {
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
            poll: post.poll
              ? {
                  id: post.poll.id,
                  question: post.poll.question,
                  description: post.poll.description,
                  pollType: post.poll.pollType,
                  multiple: post.poll.multiple,
                  isActive: post.poll.isActive,
                  endDate: post.poll.endDate,
                  options: post.poll.options.map((o: any) => ({
                    id: o.id,
                    label: o.label,
                    description: o.description,
                  })),
                  votes: (() => {
                    const v: Record<string, number> = {};
                    post.poll.options.forEach((opt: any) => {
                      v[opt.id] = opt._count?.votes ?? 0;
                    });
                    return v;
                  })(),
                  totalVotes: post.poll.options.reduce(
                    (sum: number, o: any) => sum + (o._count?.votes ?? 0),
                    0
                  ),
                  hasVoted: false,
                  userVotedOptionIds: [],
                }
              : null,
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
                    wikiUrl: `/wiki/${encodeURIComponent(rc.title.replace(/ /g, "_"))}`,
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
                  description:
                    item.excerpt || `${item.author} posted in the IxWiki community forum`,
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

        // Cache the combined activities for 15 seconds
        await globalCache.set(cacheKey, { combinedActivities }, { ttl: 15 });
      }

      // Apply pagination limit to combined results
      const paginatedActivities = combinedActivities.slice(0, input.limit);
      const nextCursor =
        combinedActivities.length > input.limit ? combinedActivities[input.limit]?.id : undefined;

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
        nextCursor,
      };
    } catch (error) {
      console.error("Error fetching global activity feed:", error);
      throw new Error("Failed to fetch activity feed");
    }
  }),

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

  // Unfollow a country

  // Get countries that a country is following

  // Get countries that follow a country (followers)

  // Check if a country is following another

  // Get follow statistics for a country
});
