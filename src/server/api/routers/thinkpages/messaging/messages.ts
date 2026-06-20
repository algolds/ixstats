import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { getThinkPagesServer } from "~/server/websocket-server";
import { notificationAPI } from "~/lib/notification-api";
import { validateNoXSS } from "~/lib/sanitize-html";
import { globalCache } from "~/lib/advanced-cache-system";

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

export const thinkpagesMessagingMessagesRouter = createTRPCRouter({
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

  // Remove reaction

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
  getConversationMessages: publicProcedure
    .input(
      z.object({
        conversationId: z.string().min(1, "Conversation ID is required").optional(),
        userId: z.string().min(1, "User ID is required").optional(), // Changed to userId (clerkUserId)
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      console.log("🔍 getConversationMessages - Input:", {
        conversationId: input.conversationId,
        userId: input.userId,
        limit: input.limit,
      });

      // Validate required fields exist
      if (!input.conversationId || !input.userId) {
        console.log("❌ Missing required fields");
        return {
          messages: [],
          nextCursor: null,
        };
      }

      // Validate IDs are not placeholder values
      if (
        input.conversationId === "INVALID" ||
        input.userId === "INVALID" ||
        input.conversationId === "SKIP_QUERY" ||
        input.userId === "SKIP_QUERY"
      ) {
        console.log("❌ Placeholder values detected");
        return {
          messages: [],
          nextCursor: null,
        };
      }

      // Verify user is participant
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId,
          },
        },
      });

      console.log("👤 Participant check:", {
        found: !!participant,
        isActive: participant?.isActive,
      });

      if (!participant || !participant.isActive) {
        console.log("❌ Not a participant or inactive");
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a participant in this conversation",
        });
      }

      const messages = await db.thinkshareMessage.findMany({
        where: {
          conversationId: input.conversationId,
          deletedAt: null,
        },
        include: {
          replyTo: true,
          readReceipts: true,
        },
        orderBy: { ixTimeTimestamp: "desc" },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
      });

      // Fetch unique user IDs from messages
      const userIds = [...new Set(messages.map((msg) => msg.userId))];

      // Fetch all accounts in one query
      const accounts = await db.user.findMany({
        where: {
          clerkUserId: { in: userIds },
        },
        include: { country: true },
      });

      // Create a map for quick lookup
      const accountMap = new Map(accounts.map((acc: any) => [acc.clerkUserId, acc]));

      // Fallback: diplomatic channels store countryId as userId — look up by country CUID
      const unmatchedIds = userIds.filter((id) => !accountMap.has(id));
      const countryFallbacks =
        unmatchedIds.length > 0
          ? await db.country.findMany({
              where: { id: { in: unmatchedIds } },
              select: { id: true, name: true, slug: true, flag: true },
            })
          : [];
      const countryFallbackMap = new Map(countryFallbacks.map((c) => [c.id, c]));

      return {
        messages: messages.map((msg) => ({
          ...msg,
          account: (() => {
            const u = accountMap.get(msg.userId);
            if (u)
              return {
                id: u.clerkUserId,
                username: u.country?.slug || "",
                displayName: u.country?.name || "Unknown Country",
                profileImageUrl: u.country?.flag || null,
                accountType: "country",
              };
            const c = countryFallbackMap.get(msg.userId);
            if (c)
              return {
                id: msg.userId,
                username: c.slug || "",
                displayName: c.name || "Unknown Country",
                profileImageUrl: c.flag || null,
                accountType: "country",
              };
            return {
              id: msg.userId,
              username: "unknown",
              displayName: "Unknown User",
              profileImageUrl: null,
              accountType: "user",
            };
          })(),
          accountId: msg.userId, // Keep accountId for compatibility
          reactions: msg.reactions ? JSON.parse(msg.reactions) : {},
          mentions: msg.mentions ? JSON.parse(msg.mentions) : [],
          attachments: msg.attachments ? JSON.parse(msg.attachments) : [],
        })),
        nextCursor: messages.length === input.limit ? messages[messages.length - 1]?.id : null,
      };
    }),

  // Send message to conversation
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
        content: z
          .string()
          .min(1)
          .refine((content) => validateNoXSS(content).valid, {
            message: "Content contains potentially unsafe HTML",
          }),
        messageType: z.enum(["text", "image", "file", "system"]).default("text"),
        replyToId: z.string().optional(),
        mentions: z.array(z.string()).optional(),
        attachments: z
          .array(
            z.object({
              type: z.string(),
              url: z.string(),
              filename: z.string().optional(),
              size: z.number().optional(),
            })
          )
          .optional(),
        // Diplomatic messaging extensions
        classification: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
          .optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]).optional(),
        subject: z.string().optional(),
        signature: z.string().optional(),
        encryptedContent: z.string().optional(),
        status: z.enum(["SENT", "DELIVERED", "READ", "ARCHIVED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("🔍 sendMessage called with input:", input);
      console.log("🔍 messageType:", input.messageType);

      const { db } = ctx;

      // Enforce authenticated user matches input userId
      if (!ctx.user?.clerkUserId || ctx.user.clerkUserId !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User mismatch" });
      }

      // Verify user is participant
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId,
          },
        },
      });

      if (!participant || !participant.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a participant in this conversation",
        });
      }

      // Create the message
      const message = await db.thinkshareMessage.create({
        data: {
          conversationId: input.conversationId,
          userId: input.userId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          mentions: input.mentions ? JSON.stringify(input.mentions) : null,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          ixTimeTimestamp: new Date(),
          // Diplomatic extensions
          classification: input.classification,
          priority: input.priority,
          subject: input.subject,
          signature: input.signature,
          encryptedContent: input.encryptedContent,
          status: input.status || "SENT",
        },
        include: {
          conversation: true,
          replyTo: true,
        },
      });

      // Update conversation last activity
      await db.thinkshareConversation.update({
        where: { id: input.conversationId },
        data: { lastActivity: new Date() },
      });

      // Broadcast real-time event to conversation subscribers
      try {
        const thinkpages = getThinkPagesServer();
        thinkpages?.broadcastMessage({
          type: "message:new",
          conversationId: input.conversationId,
          messageId: message.id,
          accountId: input.userId,
          content: input.content,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.warn("[ThinkPages] Failed to broadcast message update (non-fatal):", e);
      }

      // Create notifications for other participants
      try {
        const participants = await db.conversationParticipant.findMany({
          where: { conversationId: input.conversationId, isActive: true },
          select: { userId: true },
        });

        const recipientIds = participants
          .map((p) => p.userId)
          .filter((uid) => uid !== input.userId);

        // Create one notification per recipient
        for (const recipientId of recipientIds) {
          await notificationAPI
            .create({
              title: "New ThinkShare message",
              message:
                input.content.replace(/<[^>]*>/g, "").slice(0, 140) || "You have a new message",
              userId: recipientId,
              category: "social",
              type: "update",
              priority: "medium",
              href: `/messages?conversation=${input.conversationId}`,
              source: "thinkshare",
              actionable: true,
              metadata: {
                conversationId: input.conversationId,
                messageId: message.id,
                fromUserId: input.userId,
              },
            })
            .catch((err: unknown) => {
              console.error("[ThinkPages] Background op failed:", (err as Error).message);
            });
        }
      } catch (e) {
        console.warn("[ThinkPages] Failed to create notifications (non-fatal):", e);
      }

      return message;
    }),

  // Mark messages as read
  markMessagesAsRead: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
        messageIds: z.array(z.string()).optional(), // If not provided, mark all as read
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Enforce authenticated user matches input userId
      if (!ctx.user?.clerkUserId || ctx.user.clerkUserId !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User mismatch" });
      }

      // Verify participant exists before updating
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId,
          },
        },
      });

      if (!participant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Not a participant in this conversation",
        });
      }

      // Update participant lastReadAt
      await db.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId,
          },
        },
        data: { lastReadAt: new Date() },
      });

      // If specific message IDs provided, create read receipts (skip duplicates)
      if (input.messageIds && input.messageIds.length > 0) {
        // Filter out already-read messages to avoid duplicate key errors
        const existingReceipts = await db.messageReadReceipt.findMany({
          where: {
            messageId: { in: input.messageIds },
            userId: input.userId,
          },
          select: { messageId: true },
        });

        const existingMessageIds = new Set(existingReceipts.map((r) => r.messageId));
        const newMessageIds = input.messageIds.filter((id) => !existingMessageIds.has(id));

        if (newMessageIds.length > 0) {
          await db.messageReadReceipt.createMany({
            data: newMessageIds.map((messageId) => ({
              messageId,
              userId: input.userId,
              messageType: "thinkshare" as const,
            })),
          });
        }
      }

      return { success: true };
    }),

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
