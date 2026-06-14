import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
// Import the wiki search service
import { validateNoXSS } from "~/lib/sanitize-html";
import { globalCache } from "~/lib/advanced-cache-system";

// eslint-disable-next-line unused-imports/no-unused-vars
const invalidateFeeds = async () => {
  try {
    await Promise.all([
      globalCache.deleteByPattern("thinkpages_feed:*"),
      globalCache.deleteByPattern("global_activity_feed:*"),
      globalCache.deleteByPattern("user_following_feed:*"),
    ]);
  } catch (error) {
    console.error("Failed to invalidate feeds:", error);
  }
};

// eslint-disable-next-line unused-imports/no-unused-vars
const hydratePostDates = (post: any) => {
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
      ? post.reactions.map((r: any) => ({
          ...r,
          createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        }))
      : undefined,
  };
};

// eslint-disable-next-line unused-imports/no-unused-vars
const SearchUnsplashImagesSchema = z.object({
  query: z.string().min(1),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(30).default(10),
  orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
  color: z.string().optional(), // Unsplash API supports specific color names or hex codes
});

// Base schema for ThinkPages accounts
const thinkpagesAccountBaseSchema = z.object({
  countryId: z.string(),
  accountType: z.enum(["government", "media", "citizen"]),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().max(50).optional().default(""),
  bio: z.string().max(500).optional().default(""),
  verified: z.boolean().default(false),
  postingFrequency: z.enum(["active", "moderate", "low"]).default("moderate"),
  politicalLean: z.enum(["left", "center", "right"]).default("center"),
  personality: z.enum(["serious", "casual", "satirical"]).default("casual"),
  profileImageUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

// eslint-disable-next-line unused-imports/no-unused-vars
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

// eslint-disable-next-line unused-imports/no-unused-vars
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

// Create schema - all required fields with defaults
// eslint-disable-next-line unused-imports/no-unused-vars
const CreateAccountSchema = thinkpagesAccountBaseSchema;

// Update schema - all fields optional
// eslint-disable-next-line unused-imports/no-unused-vars
const UpdateAccountSchema = thinkpagesAccountBaseSchema.partial();

// eslint-disable-next-line unused-imports/no-unused-vars
const CreatePostSchema = z.object({
  accountId: z.string(), // ThinkpagesAccount ID for feed posts
  content: z
    .string()
    .max(10000)
    .optional()
    .default("")
    .refine(
      (content) => {
        if (!content) return true;
        const validation = validateNoXSS(content);
        return validation.valid;
      },
      {
        message:
          "Content contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers.",
      }
    ),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  visibility: z.enum(["public", "private", "unlisted"]).default("public"),
  parentPostId: z.string().optional(), // For replies
  repostOfId: z.string().optional(), // For reposts
  visualizations: z
    .array(
      z.object({
        type: z.enum([
          "economic_chart",
          "diplomatic_map",
          "trade_flow",
          "gdp_growth",
          "demographics",
          "budget_debt",
          "labor_market",
          "national_vitality",
        ]),
        title: z.string(),
        config: z
          .object({
            chartType: z.string().optional(),
            dataSource: z.string().optional(),
            timeRange: z
              .union([
                z.string(),
                z.object({
                  start: z.string().optional(),
                  end: z.string().optional(),
                }),
              ])
              .optional(),
            metrics: z.array(z.string()).optional(),
            countries: z.array(z.string()).optional(),
            colors: z.array(z.string()).optional(),
            displayOptions: z
              .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
              .optional(),
          })
          .passthrough(), // Allow additional custom properties
      })
    )
    .optional(), // Data visualizations embedded in post
  mediaUrls: z.array(z.string()).max(4).optional(), // Up to 4 images per post
  postToDiscord: z.boolean().optional().default(true),
  poll: z
    .object({
      question: z.string().min(1).max(500),
      description: z.string().max(2000).optional(),
      pollType: z.enum(["choice", "feature-poll"]).default("choice"),
      multiple: z.boolean().default(false),
      options: z.array(z.string().min(1).max(200)).min(2, "At least 2 options are required"),
    })
    .optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const AddReactionSchema = z.object({
  postId: z.string(),
  accountId: z.string(), // ThinkpagesAccount ID for reactions
  reactionType: z.union([
    z.enum(["like", "laugh", "angry", "sad", "fire", "thumbsup", "thumbsdown"]),
    z.string().startsWith("discord:"), // Support Discord emoji reactions like "discord:ixnay"
  ]),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const GetFeedSchema = z.object({
  countryId: z.string().optional(), // Feed filtered by country
  hashtag: z.string().optional(),
  filter: z.enum(["recent", "trending", "hot"]).default("recent"),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
async function getWikiCommonsImageInfo(
  title: string
): Promise<{ url: string; description: string; photographer: string } | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    format: "json",
    formatversion: "2",
  });

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: {
      "User-Agent": "IxStats-Builder",
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch image info for ${title}: ${response.statusText}`);
    return null;
  }

  const data = (await response.json()) as Record<string, unknown>;
  const page = (data.query as any)?.pages?.[0];

  if (!page || page.missing || !page.imageinfo?.[0]) {
    return null;
  }

  const imageInfo = page.imageinfo[0];
  const extMetadata = imageInfo.extmetadata;

  return {
    url: imageInfo.url,
    description: extMetadata?.ImageDescription?.value || page.title,
    photographer: extMetadata?.Artist?.value || "Unknown",
  };
}

export const thinkpagesFeedRouter = createTRPCRouter({
  // Search Unsplash images

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

  // Search Wiki Commons images

  // Calculate trending topics
  calculateTrendingTopics: publicProcedure.mutation(async ({ ctx }) => {
    const { db } = ctx;

    const posts = await db.thinkpagesPost.findMany({
      where: {
        ixTimeTimestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: {
        hashtags: true,
        likeCount: true,
        repostCount: true,
        replyCount: true,
      },
      take: 500,
    });

    const hashtagCounts: Record<string, { count: number; engagement: number }> = {};

    for (const post of posts) {
      const hashtags = post.hashtags ? JSON.parse(post.hashtags) : [];
      for (const hashtag of hashtags) {
        if (!hashtagCounts[hashtag]) {
          hashtagCounts[hashtag] = { count: 0, engagement: 0 };
        }
        hashtagCounts[hashtag].count++;
        hashtagCounts[hashtag].engagement +=
          (post.likeCount ?? 0) + (post.repostCount ?? 0) + (post.replyCount ?? 0);
      }
    }

    await Promise.all(
      Object.entries(hashtagCounts).map(([hashtag, hashtagData]) =>
        db.trendingTopic.upsert({
          where: { hashtag },
          create: {
            hashtag,
            postCount: hashtagData.count,
            engagement: hashtagData.engagement,
            peakTimestamp: new Date(),
          },
          update: {
            postCount: hashtagData.count,
            engagement: hashtagData.engagement,
            peakTimestamp: new Date(),
          },
        })
      )
    );

    return { success: true };
  }),

  // Search users globally for ThinkTanks/ThinkShare

  // Update ThinkPages Feed Account
  // Username availability check for ThinkPages Feed Accounts

  // Generate random profile picture

  // Create ThinkPages Feed Account - For Feed only (not ThinkTanks/ThinkShare)

  // Get ThinkPages Feed Accounts by Country - For Feed only

  // Get current user's ThinkPages accounts

  // Get Account Counts by Type - For Feed only

  // Post creation

  // Update post content (edit post)

  // Delete post (soft delete)

  // Add reaction to post

  // Remove reaction

  // Get feed

  // Get trending topics

  // Get account details

  // Get Thinkpages account by Clerk User ID

  // Get post details with replies

  // Get posts by Clerk User ID - shows all posts from all accounts owned by this user

  // Trigger citizen reaction to a post
  triggerCitizenReaction: publicProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ input }) => {
      const { generateAndPostCitizenReaction } = await import("~/lib/auto-post-service");
      await generateAndPostCitizenReaction(input.postId);
      return { success: true, message: "Citizen reaction triggered" };
    }),

  // Calculate and store country mood metrics
  calculateCountryMoodMetrics: publicProcedure.mutation(async ({ ctx }) => {
    const { db } = ctx;
    const { analyzePostSentiment } = await import("~/lib/sentiment-analysis");
    const currentIxTime = IxTime.getCurrentIxTime();
    const twentyFourHoursAgo = new Date(currentIxTime - 24 * 60 * 60 * 1000);

    const countries = await db.country.findMany({
      take: 250,
      select: { id: true, name: true },
    });

    // Batch-fetch all active users and recent posts in 2 queries instead of per-country
    const allUsers = await db.user.findMany({
      where: {
        countryId: { in: countries.map((c: any) => c.id) },
        isActive: true,
      },
      select: { id: true, countryId: true },
    });

    // Group users by countryId
    const usersByCountry = new Map<string, string[]>();
    for (const u of allUsers) {
      if (!u.countryId) continue;
      const existing = usersByCountry.get(u.countryId) ?? [];
      existing.push(u.id);
      usersByCountry.set(u.countryId, existing);
    }

    // Batch-fetch all recent posts for all active users
    const allUserIds = allUsers.map((u: any) => u.id);
    const allRecentPosts =
      allUserIds.length > 0
        ? await db.thinkpagesPost.findMany({
            where: {
              accountId: { in: allUserIds },
              ixTimeTimestamp: { gte: twentyFourHoursAgo },
            },
            include: { reactions: true },
          })
        : [];

    // Group posts by accountId for fast lookup
    const postsByAccount = new Map<string, typeof allRecentPosts>();
    for (const post of allRecentPosts) {
      const existing = postsByAccount.get(post.accountId) ?? [];
      existing.push(post);
      postsByAccount.set(post.accountId, existing);
    }

    const dailyTimestamp = new Date(currentIxTime);
    dailyTimestamp.setHours(0, 0, 0, 0);
    const upsertPromises: Promise<any>[] = [];

    for (const country of countries) {
      const citizenIds = usersByCountry.get(country.id);
      if (!citizenIds || citizenIds.length === 0) continue;

      // Collect posts for this country's citizens
      const countryPosts: typeof allRecentPosts = [];
      for (const userId of citizenIds) {
        const userPosts = postsByAccount.get(userId);
        if (userPosts) countryPosts.push(...userPosts);
      }

      if (countryPosts.length === 0) continue;

      let totalSentiment = 0;
      for (const post of countryPosts) {
        totalSentiment += analyzePostSentiment(post as any);
      }
      const averageSentiment = totalSentiment / countryPosts.length;

      upsertPromises.push(
        db.countryMoodMetric.upsert({
          where: {
            countryId_timestamp: {
              countryId: country.id,
              timestamp: dailyTimestamp,
            },
          },
          update: {
            sentimentScore: averageSentiment,
            postCount: countryPosts.length,
            timestamp: dailyTimestamp,
          },
          create: {
            countryId: country.id,
            sentimentScore: averageSentiment,
            postCount: countryPosts.length,
            timestamp: dailyTimestamp,
          },
        })
      );
    }

    // Execute all upserts in parallel
    await Promise.allSettled(upsertPromises);

    return { success: true, message: "Country mood metrics calculated" };
  }),

  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Create a new ThinkTank group

  // Get ThinkTanks globally (no country restriction)

  // Join a ThinkTank group

  // Leave a ThinkTank group

  // Get ThinkTank messages

  // Send message to ThinkTank

  // Update a ThinkTank group

  // Invite users to a ThinkTank group

  // Get collaborative documents for a ThinkTank

  // Create a collaborative document

  // Update a collaborative document

  // Delete a collaborative document

  // Get a single document

  // Add reaction to a Thinkshare message

  // Remove reaction from a Thinkshare message

  // Edit a Thinkshare message

  // Delete a Thinkshare message

  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Create a new conversation

  // Get conversations for a user

  // Get messages for a conversation

  // Send message to conversation

  // Mark messages as read

  // Update user presence/online status

  // Get presence for multiple users

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

  // Pin/unpin a post

  // Bookmark/unbookmark a post
  // Get user's bookmarked posts

  // Check if a post is bookmarked by user

  // Bookmark or unbookmark a post

  // Get all flagged posts (admin only)

  // Check if a post is flagged by user

  // Flag a post for moderation

  // Remove a flag (unflag post)

  // Create a conversation between two countries' official accounts

  // Get post reactions with account details
});
