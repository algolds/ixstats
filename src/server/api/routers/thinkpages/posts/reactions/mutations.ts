import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notifications/hooks";
import { validateNoXSS } from "~/lib/utils";
import { globalCache } from "~/lib/cache";

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

// Create schema - all required fields with defaults
const CreateAccountSchema = thinkpagesAccountBaseSchema;

// Update schema - all fields optional
const UpdateAccountSchema = thinkpagesAccountBaseSchema.partial();

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

const AddReactionSchema = z.object({
  postId: z.string(),
  accountId: z.string(), // ThinkpagesAccount ID for reactions
  reactionType: z.union([
    z.enum(["like", "laugh", "angry", "sad", "fire", "thumbsup", "thumbsdown"]),
    z.string().startsWith("discord:"), // Support Discord emoji reactions like "discord:ixnay"
  ]),
});

const GetFeedSchema = z.object({
  countryId: z.string().optional(), // Feed filtered by country
  hashtag: z.string().optional(),
  filter: z.enum(["recent", "trending", "hot"]).default("recent"),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

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

export const thinkpagesPostsReactionsMutationsRouter = createTRPCRouter({
  // Search Unsplash images

  // Fetch Discord Channel Topic (Easter Egg)

  // Search Wiki Commons images

  // Calculate trending topics

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
  addReaction: protectedProcedure.input(AddReactionSchema).mutation(async ({ ctx, input }) => {
    const { db } = ctx;
    const clerkUserId = ctx.auth?.userId;

    if (!clerkUserId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to react to posts",
      });
    }

    // Verify the account belongs to the current user
    const account = await db.thinkpagesAccount.findUnique({
      where: { id: input.accountId },
    });

    if (!account || account.clerkUserId !== clerkUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to use this account",
      });
    }

    const post = await db.thinkpagesPost.findUnique({
      where: { id: input.postId },
      select: { reactionCounts: true, content: true },
    });

    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Post not found",
      });
    }

    const reactionCounts = (() => {
      try {
        return post.reactionCounts ? JSON.parse(post.reactionCounts) : {};
      } catch (error) {
        console.warn("Failed to parse reactionCounts in addReaction:", error);
        return {};
      }
    })();

    const existingReaction = await db.postReaction.findUnique({
      where: {
        postId_accountId: {
          postId: input.postId,
          accountId: input.accountId,
        },
      },
    });

    if (existingReaction) {
      if (existingReaction.reactionType === input.reactionType) {
        // Same reaction - remove it (toggle behavior)
        await (db as any).$transaction(async (tx: any) => {
          reactionCounts[existingReaction.reactionType] =
            (reactionCounts[existingReaction.reactionType] || 1) - 1;

          await tx.postReaction.delete({
            where: {
              postId_accountId: {
                postId: input.postId,
                accountId: input.accountId,
              },
            },
          });

          await tx.thinkpagesPost.update({
            where: { id: input.postId },
            data: { reactionCounts: JSON.stringify(reactionCounts) },
          });
        });

        // Sync removal to Discord if message exists
        const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
        if (match && match[1]) {
          try {
            const { removeDiscordReaction } = await import("~/lib/discord/ixtwitter-sync");
            removeDiscordReaction(match[1], existingReaction.reactionType).catch((err: unknown) =>
              console.error("[ThinkPages] Remove Discord reaction promise error:", err)
            );
          } catch (error) {
            console.error("[ThinkPages] Failed to trigger Discord reaction removal:", error);
          }
        }

        await invalidateFeeds();
        return { removed: true };
      }

      // Different reaction - update it
      await (db as any).$transaction(async (tx: any) => {
        reactionCounts[existingReaction.reactionType] =
          (reactionCounts[existingReaction.reactionType] || 1) - 1;
        reactionCounts[input.reactionType] = (reactionCounts[input.reactionType] || 0) + 1;

        await tx.postReaction.update({
          where: {
            postId_accountId: {
              postId: input.postId,
              accountId: input.accountId,
            },
          },
          data: { reactionType: input.reactionType },
        });

        await tx.thinkpagesPost.update({
          where: { id: input.postId },
          data: { reactionCounts: JSON.stringify(reactionCounts) },
        });
      });

      // Sync reaction update to Discord
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      if (match && match[1]) {
        try {
          const { addDiscordReaction, removeDiscordReaction } =
            await import("~/lib/discord/ixtwitter-sync");
          removeDiscordReaction(match[1], existingReaction.reactionType)
            .then(() => addDiscordReaction(match[1], input.reactionType))
            .catch((err: unknown) =>
              console.error("[ThinkPages] Sync update Discord reaction error:", err)
            );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord reaction update:", error);
        }
      }

      await invalidateFeeds();
      return { updated: true, reactionType: input.reactionType };
    } else {
      // New reaction - create it
      const reaction = await (db as any).$transaction(async (tx: any) => {
        reactionCounts[input.reactionType] = (reactionCounts[input.reactionType] || 0) + 1;

        const newReaction = await tx.postReaction.create({
          data: {
            postId: input.postId,
            accountId: input.accountId,
            reactionType: input.reactionType,
          },
        });

        await tx.thinkpagesPost.update({
          where: { id: input.postId },
          data: { reactionCounts: JSON.stringify(reactionCounts) },
        });

        return newReaction;
      });

      // Sync reaction creation to Discord if message exists
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      if (match && match[1]) {
        try {
          const { addDiscordReaction } = await import("~/lib/discord/ixtwitter-sync");
          addDiscordReaction(match[1], input.reactionType).catch((err: unknown) =>
            console.error("[ThinkPages] Add Discord reaction promise error:", err)
          );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord reaction sync:", error);
        }
      }

      // 🔔 Notify post author of new reaction (likes only)
      if (input.reactionType === "like") {
        const postWithAuthor = await db.thinkpagesPost.findUnique({
          where: { id: input.postId },
          select: { accountId: true, content: true },
        });

        if (postWithAuthor && postWithAuthor.accountId !== input.accountId) {
          await notificationHooks
            .onThinkPageActivity({
              thinkpageId: input.postId,
              title: postWithAuthor.content.substring(0, 50),
              action: "liked",
              authorId: input.accountId,
              targetUserId: postWithAuthor.accountId,
            })
            .catch((err) => console.error("[ThinkPages] Failed to send like notification:", err));
        }
      }

      await invalidateFeeds();
      return reaction;
    }
  }),

  // Remove reaction
  removeReaction: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to remove reactions",
        });
      }

      // Verify the account belongs to the current user
      const account = await db.thinkpagesAccount.findUnique({
        where: { id: input.accountId },
      });

      if (!account || account.clerkUserId !== clerkUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to use this account",
        });
      }

      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { reactionCounts: true, content: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      const reactionCounts = (() => {
        try {
          return post.reactionCounts ? JSON.parse(post.reactionCounts) : {};
        } catch (error) {
          console.warn("Failed to parse reactionCounts in addReaction:", error);
          return {};
        }
      })();

      const existingReaction = await db.postReaction.findUnique({
        where: {
          postId_accountId: {
            postId: input.postId,
            accountId: input.accountId,
          },
        },
      });

      if (existingReaction) {
        // Use transaction to ensure consistency
        await (db as any).$transaction(async (tx: any) => {
          // Update reaction counts
          reactionCounts[existingReaction.reactionType] =
            (reactionCounts[existingReaction.reactionType] || 1) - 1;

          // Remove the reaction
          await tx.postReaction.delete({
            where: {
              postId_accountId: {
                postId: input.postId,
                accountId: input.accountId,
              },
            },
          });

          // Update post with new counts
          await tx.thinkpagesPost.update({
            where: { id: input.postId },
            data: { reactionCounts: JSON.stringify(reactionCounts) },
          });
        });

        // Sync reaction removal to Discord
        const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
        if (match && match[1]) {
          try {
            const { removeDiscordReaction } = await import("~/lib/discord/ixtwitter-sync");
            removeDiscordReaction(match[1], existingReaction.reactionType).catch((err: unknown) =>
              console.error("[ThinkPages] Remove Discord reaction promise error:", err)
            );
          } catch (error) {
            console.error("[ThinkPages] Failed to trigger Discord reaction removal:", error);
          }
        }

        await invalidateFeeds();
        return { success: true };
      }

      return { success: false };
    }),

  // Get feed

  // Get trending topics

  // Get account details

  // Get Thinkpages account by Clerk User ID

  // Get post details with replies

  // Get posts by Clerk User ID - shows all posts from all accounts owned by this user

  // Trigger citizen reaction to a post

  // Calculate and store country mood metrics

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
