import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationAPI } from "~/lib/notifications/api";
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

export const thinkpagesMessagingConversationsRouter = createTRPCRouter({
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
  createConversation: protectedProcedure
    .input(
      z.object({
        participantIds: z.array(z.string().min(1)), // Now expects userIds (clerkUserIds)
        // Diplomatic conversation extensions
        conversationType: z.enum(["personal", "diplomatic", "official"]).optional(),
        diplomaticClassification: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
          .optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]).optional(),
        encrypted: z.boolean().optional(),
        channelType: z.enum(["BILATERAL", "MULTILATERAL", "EMERGENCY"]).optional(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("🔍 Server mutation called with raw input:", input);
      console.log("🔍 Input type:", typeof input);
      console.log("🔍 Input keys:", Object.keys(input || {}));
      console.log("🔍 participantIds:", input?.participantIds);

      const { db } = ctx;
      const { participantIds } = input;

      // Validate participants
      if (participantIds.length === 0 || participantIds.length > 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Direct conversations must have 1-2 participants",
        });
      }

      const uniqueParticipantIds = [...new Set(participantIds)];

      // Verify all participants exist as users
      const users = await db.user.findMany({
        where: {
          clerkUserId: { in: uniqueParticipantIds },
          isActive: true,
        },
        include: { country: true },
      });

      if (users.length !== uniqueParticipantIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more participants not found",
        });
      }

      // Check for existing conversation
      const existingConv = await db.thinkshareConversation.findFirst({
        where: {
          type: "direct",
          AND: uniqueParticipantIds.map((participantId) => ({
            participants: {
              some: {
                userId: participantId,
                isActive: true,
              },
            },
          })),
          participants: {
            none: {
              userId: {
                notIn: uniqueParticipantIds,
              },
              isActive: true,
            },
          },
        },
        include: {
          participants: {
            where: { isActive: true },
          },
        },
      });

      if (existingConv) {
        return existingConv;
      }

      // Create new conversation
      const conversation = await db.thinkshareConversation.create({
        data: {
          type: "direct",
          name: input.name,
          participants: {
            createMany: {
              data: uniqueParticipantIds.map((userId) => ({
                userId,
                role: "participant",
              })),
            },
          },
          // Diplomatic extensions
          conversationType: input.conversationType,
          diplomaticClassification: input.diplomaticClassification,
          priority: input.priority,
          encrypted: input.encrypted || false,
          channelType: input.channelType,
        },
        include: {
          participants: {
            where: { isActive: true },
          },
        },
      });

      // Notify other participant(s) about new conversation
      if (uniqueParticipantIds.length === 2) {
        try {
          const initiatorId = uniqueParticipantIds[0];
          const otherUserId = uniqueParticipantIds[1];

          const initiator = await db.user.findUnique({
            where: { clerkUserId: initiatorId },
          });

          if (initiator) {
            const initiatorDisplayName = `User ${initiatorId.slice(0, 8)}`;
            await notificationAPI
              .create({
                title: "New conversation started",
                message: `${initiatorDisplayName} started a conversation with you`,
                userId: otherUserId,
                category: "social",
                type: "update",
                priority: "low",
                href: `/messages?conversation=${conversation.id}`,
                source: "thinkshare",
                actionable: true,
                metadata: {
                  conversationId: conversation.id,
                  fromUserId: initiatorId,
                },
              })
              .catch((err: unknown) => {
                console.error("[ThinkPages] Background op failed:", (err as Error).message);
              });
          }
        } catch (e) {
          console.warn("[ThinkShare] Failed to send conversation start notification:", e);
        }
      }

      return conversation;
    }),

  // Get conversations for a user
  getConversations: publicProcedure
    .input(
      z
        .object({
          userId: z.string().optional().default(""), // Changed to userId (clerkUserId)
          limit: z.number().min(1).max(50).optional().default(20),
          cursor: z.string().optional(),
        })
        .optional()
        .default(() => ({ userId: "", limit: 20 }))
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      try {
        // FAILSAFE: Handle ANY invalid input scenario
        if (!input) {
          console.log("getConversations: No input provided, returning empty result");
          return {
            conversations: [],
            nextCursor: null,
          };
        }

        if (!input.userId || input.userId.trim() === "" || input.userId === "INVALID") {
          console.log("getConversations: Invalid userId, returning empty result");
          return {
            conversations: [],
            nextCursor: null,
          };
        }

        const conversations = await db.thinkshareConversation.findMany({
          where: {
            isActive: true,
            participants: {
              some: {
                userId: input.userId,
                isActive: true,
              },
            },
          },
          include: {
            participants: {
              where: { isActive: true },
            },
            messages: {
              orderBy: { ixTimeTimestamp: "desc" },
              take: 1,
              include: {
                readReceipts: {
                  where: {
                    userId: input.userId,
                    messageType: "thinkshare",
                  },
                },
              },
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { lastActivity: "desc" },
          take: input.limit,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          skip: input.cursor ? 1 : 0,
        });

        // Calculate unread counts for each conversation
        const conversationIds = conversations.map((c: any) => c.id);
        const unreadCountsPromises = conversationIds.map(async (convId: string) => {
          const participant = conversations
            .find((c: any) => c.id === convId)
            ?.participants.find((p: any) => p.userId === input.userId);
          const lastReadAt = participant?.lastReadAt;

          // Count messages that are:
          // 1. In this conversation
          // 2. Not sent by the current user
          // 3. Created after the user's lastReadAt timestamp OR don't have a read receipt
          const unreadCount = await db.thinkshareMessage.count({
            where: {
              conversationId: convId,
              userId: { not: input.userId },
              deletedAt: null,
              OR: [
                // Messages sent after user's last read timestamp
                lastReadAt
                  ? {
                      ixTimeTimestamp: { gt: lastReadAt },
                    }
                  : {},
                // Messages without read receipts for this user
                {
                  readReceipts: {
                    none: {
                      userId: input.userId,
                      messageType: "thinkshare",
                    },
                  },
                },
              ],
            },
          });

          return { convId, unreadCount };
        });

        const unreadCountsResults = await Promise.all(unreadCountsPromises);
        const unreadCountsMap = new Map(unreadCountsResults.map((r) => [r.convId, r.unreadCount]));

        // Fetch user profiles for all participants and last messages in a single batch
        const participantUserIds = new Set<string>();
        for (const conv of conversations as any[]) {
          for (const p of conv.participants) participantUserIds.add(p.userId);
          if (conv.messages[0]?.userId) participantUserIds.add(conv.messages[0].userId);
        }

        const users = await db.user.findMany({
          where: { clerkUserId: { in: Array.from(participantUserIds) } },
          include: { country: true },
        });
        const userMap = new Map(users.map((u) => [u.clerkUserId, u]));

        // Fallback: diplomatic channels store countryId as userId — look up by country CUID
        const unmatchedParticipantIds = Array.from(participantUserIds).filter(
          (id) => !userMap.has(id)
        );
        const countryParticipantFallbacks =
          unmatchedParticipantIds.length > 0
            ? await db.country.findMany({
                where: { id: { in: unmatchedParticipantIds } },
                select: { id: true, name: true, slug: true, flag: true },
              })
            : [];
        const countryParticipantMap = new Map(countryParticipantFallbacks.map((c) => [c.id, c]));

        return {
          conversations: conversations.map((conv: any) => {
            const participantWithAccount = conv.participants.map((p: any) => {
              const u = userMap.get(p.userId);
              const c = !u ? countryParticipantMap.get(p.userId) : null;
              return {
                ...p,
                accountId: p.userId,
                account: u
                  ? {
                      id: u.clerkUserId,
                      username: u.country?.slug || "",
                      displayName: u.country?.name || "Unknown Country",
                      profileImageUrl: u.country?.flag || null,
                      accountType: "country",
                    }
                  : c
                    ? {
                        id: p.userId,
                        username: c.slug || "",
                        displayName: c.name || "Unknown Country",
                        profileImageUrl: c.flag || null,
                        accountType: "country",
                      }
                    : null,
              };
            });

            const otherParticipants = participantWithAccount.filter(
              (p: any) => p.userId !== input.userId
            );
            const lastMessageRaw = conv.messages[0];
            const lastMessageUser = lastMessageRaw ? userMap.get(lastMessageRaw.userId) : null;
            const lastMessageCountry =
              lastMessageRaw && !lastMessageUser
                ? (countryParticipantMap.get(lastMessageRaw.userId) ?? null)
                : null;
            const lastMessage = lastMessageRaw
              ? {
                  ...lastMessageRaw,
                  accountId: lastMessageRaw.userId,
                  account: lastMessageUser
                    ? {
                        id: lastMessageUser.clerkUserId,
                        username: lastMessageUser.country?.slug || "",
                        displayName: lastMessageUser.country?.name || "Unknown Country",
                        profileImageUrl: lastMessageUser.country?.flag || null,
                        accountType: "country",
                      }
                    : lastMessageCountry
                      ? {
                          id: lastMessageRaw.userId,
                          username: lastMessageCountry.slug || "",
                          displayName: lastMessageCountry.name || "Unknown Country",
                          profileImageUrl: lastMessageCountry.flag || null,
                          accountType: "country",
                        }
                      : null,
                }
              : undefined;

            // Get calculated unread count from map
            const participant = conv.participants.find((p: any) => p.userId === input.userId);
            const unreadCount = unreadCountsMap.get(conv.id) || 0;

            return {
              ...conv,
              participants: participantWithAccount,
              otherParticipants,
              lastMessage,
              lastReadAt: participant?.lastReadAt,
              unreadCount,
            };
          }),
          nextCursor:
            conversations.length === input.limit
              ? conversations[conversations.length - 1]?.id
              : null,
        };
      } catch (error) {
        console.error("Error in getConversations:", error);
        // FAILSAFE: Return empty result instead of throwing error
        return {
          conversations: [],
          nextCursor: null,
        };
      }
    }),

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
  createConversationByCountries: protectedProcedure
    .input(
      z.object({
        fromCountryId: z.string(),
        toCountryId: z.string(),
        initialMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get users for both countries
      const fromUsers = await ctx.db.user.findMany({
        where: { countryId: input.fromCountryId },
        take: 1,
      });

      const toUsers = await ctx.db.user.findMany({
        where: { countryId: input.toCountryId },
        take: 1,
      });

      if (fromUsers.length === 0) {
        throw new Error("Sender country has no users");
      }

      if (toUsers.length === 0) {
        throw new Error("Recipient country has no users");
      }

      const fromUser = fromUsers[0]!;
      const toUser = toUsers[0]!;

      // Create a conversation
      const conversation = await ctx.db.thinkshareConversation.create({
        data: {
          type: "direct",
          name: `Diplomatic Channel`,
        },
      });

      // Add participants
      await ctx.db.conversationParticipant.createMany({
        data: [
          { conversationId: conversation.id, userId: fromUser.clerkUserId },
          { conversationId: conversation.id, userId: toUser.clerkUserId },
        ],
      });

      // Send initial message if provided
      if (input.initialMessage) {
        await ctx.db.thinkshareMessage.create({
          data: {
            conversationId: conversation.id,
            userId: fromUser.clerkUserId,
            content: input.initialMessage,
          },
        });
      }

      return conversation;
    }),

  // Get post reactions with account details
});
