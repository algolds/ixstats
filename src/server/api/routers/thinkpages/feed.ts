import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
// Import the wiki search service
import { globalCache } from "~/lib/cache";
import { resolveReactionCounts } from "./post-utils";

interface PostDateFields {
  createdAt?: string | Date | null;
  ixTimeTimestamp?: string | Date | null;
  parentPost?: PostDateFields | null;
  repostOf?: PostDateFields | null;
  reactions?: Array<{ createdAt?: string | Date | null; [key: string]: unknown }> | null;
  [key: string]: unknown;
}

export function hydratePostDates<T extends PostDateFields | null | undefined>(post: T): T {
  if (!post) return post;
  return {
    ...post,
    createdAt: post.createdAt ? new Date(post.createdAt) : undefined,
    ixTimeTimestamp: post.ixTimeTimestamp ? new Date(post.ixTimeTimestamp) : undefined,
    parentPost: post.parentPost
      ? {
          ...post.parentPost,
          createdAt: post.parentPost.createdAt ? new Date(post.parentPost.createdAt) : undefined,
          ixTimeTimestamp: post.parentPost.ixTimeTimestamp
            ? new Date(post.parentPost.ixTimeTimestamp)
            : undefined,
        }
      : undefined,
    repostOf: post.repostOf
      ? {
          ...post.repostOf,
          createdAt: post.repostOf.createdAt ? new Date(post.repostOf.createdAt) : undefined,
          ixTimeTimestamp: post.repostOf.ixTimeTimestamp
            ? new Date(post.repostOf.ixTimeTimestamp)
            : undefined,
        }
      : undefined,
    reactions: post.reactions
      ? post.reactions.map((r) => ({
          ...r,
          createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        }))
      : undefined,
  } as T;
}

function formatPollForClient(poll: any) {
  if (!poll) return null;
  const votes: Record<string, number> = {};
  let totalVotes = 0;
  poll.options.forEach((opt: any) => {
    const count = opt._count?.votes ?? 0;
    votes[opt.id] = count;
    totalVotes += count;
  });

  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    pollType: poll.pollType,
    multiple: poll.multiple,
    isActive: poll.isActive,
    endDate: poll.endDate,
    countryId: poll.countryId,
    options: poll.options.map((opt: any) => ({
      id: opt.id,
      label: opt.label,
      description: opt.description,
    })),
    votes,
    totalVotes,
    hasVoted: false,
    userVotedOptionIds: [],
  };
}

const pollInclude = {
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
};

/**
 * Feed ordering. "trending" (posts the thinkpages-trending cron flagged) and "hot" (every post)
 * rank by the cron's engagement-decay `trendingScore`, newest first among equals; "recent" is
 * pinned-then-newest.
 */
export function feedOrderBy(
  filter: "recent" | "trending" | "hot"
): Prisma.ThinkpagesPostOrderByWithRelationInput[] {
  if (filter === "trending") {
    return [{ trendingScore: "desc" }, { ixTimeTimestamp: "desc" }];
  }
  if (filter === "hot") {
    return [{ pinned: "desc" }, { trendingScore: "desc" }, { ixTimeTimestamp: "desc" }];
  }
  return [{ pinned: "desc" }, { ixTimeTimestamp: "desc" }];
}

const GetFeedSchema = z.object({
  countryId: z.string().optional(), // Feed filtered by country
  hashtag: z.string().optional(),
  filter: z.enum(["recent", "trending", "hot"]).default("recent"),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export const thinkpagesFeedRouter = createTRPCRouter({
  // Fetch Discord Channel Topic (Easter Egg)
  getDiscordChannelTopic: publicProcedure.query(async () => {
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    if (!discordBotToken) {
      return null;
    }
    try {
      const channelId = "557016199427522561";
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        method: "GET",
        headers: {
          Authorization: `Bot ${discordBotToken}`,
          "User-Agent": "IxStats/1.0",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.error(`Failed to fetch Discord channel topic: ${res.status} ${res.statusText}`);
        return null;
      }
      const data = (await res.json()) as { topic?: string | null };
      return data.topic || null;
    } catch (err) {
      console.error("Error fetching Discord channel topic:", err);
      return null;
    }
  }),

  // Get feed
  getFeed: rateLimitedPublicProcedure.input(GetFeedSchema).query(async ({ ctx, input }) => {
    try {
      const cacheKey = `thinkpages_feed:${input.countryId || "all"}:${input.hashtag || "all"}:${input.filter}:${input.limit}:${input.cursor || "none"}`;

      const cached = await globalCache.get<{ posts: any[]; nextCursor: string | null }>(cacheKey);
      if (cached) {
        const hydratedPosts = cached.posts.map((post) => hydratePostDates(post));
        return {
          posts: hydratedPosts,
          nextCursor: cached.nextCursor,
        };
      }

      const { db } = ctx;

      const whereClause: any = {
        visibility: "public",
      };

      if ((input as any).countryId) {
        whereClause.account = {
          countryId: (input as any).countryId,
        };
      }

      if (input.filter === "trending") {
        whereClause.trending = true;
      }

      if (input.hashtag) {
        whereClause.hashtags = {
          contains: `"${input.hashtag}"`,
        };
      }

      const posts = await db.thinkpagesPost.findMany({
        where: whereClause,
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
              countryId: true,
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
                  countryId: true,
                  country: {
                    select: {
                      id: true,
                      name: true,
                      flag: true,
                    },
                  },
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
                  countryId: true,
                  country: {
                    select: {
                      id: true,
                      name: true,
                      flag: true,
                    },
                  },
                },
              },
            },
          },
          reactions: true,
          mediaAttachments: true,
          ...pollInclude,
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
        orderBy: feedOrderBy(input.filter),
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
      });

      const transformedPosts = posts.map((post) => ({
        ...post,
        poll: formatPollForClient((post as any).poll),
        hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
        reactionCounts: resolveReactionCounts(post.reactionCounts, (post as any).reactions),
        timestamp: post.isAutoGenerated
          ? post.ixTimeTimestamp.toISOString()
          : post.createdAt.toISOString(),
      }));

      const nextCursor = posts.length === input.limit ? posts[posts.length - 1]?.id : null;

      const result = {
        posts: transformedPosts,
        nextCursor,
      };

      await globalCache.set(cacheKey, result, { ttl: 15 });

      return result;
    } catch (error) {
      console.error("Error fetching thinkpages feed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch thinkpages feed",
      });
    }
  }),

  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Get Discord server emojis
  getDiscordEmojis: publicProcedure
    .input(
      z.object({
        guildId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
        const url = input.guildId ? `${botUrl}/emojis?guild=${input.guildId}` : `${botUrl}/emojis`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (!response.ok) {
          throw new Error(`Discord bot responded with status ${response.status}`);
        }

        const data = (await response.json()) as {
          success: boolean;
          error?: string;
          emojis?: Array<{ id: string; name: string; url: string; animated?: boolean }>;
        };

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch Discord emojis");
        }

        return {
          success: true,
          emojis: (data.emojis || []).map(
            (emoji: { id: string; name: string; url: string; animated?: boolean }) => ({
              id: emoji.id,
              name: emoji.name,
              url: emoji.url,
              animated: emoji.animated,
            })
          ),
          count: data.emojis?.length ?? 0,
        };
      } catch (error) {
        console.error("Error fetching Discord emojis:", error);
        return {
          success: false,
          emojis: [],
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});
