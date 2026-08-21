import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notifications/hooks";
import { validateNoXSS } from "~/lib/utils";
import { vaultService } from "~/lib/vault/vault-service";
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
  visibility: z.enum(["public", "private", "unlisted", "draft"]).default("public"),
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
export const thinkpagesPostsPostsCreateRouter = createTRPCRouter({
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
  createPost: protectedProcedure.input(CreatePostSchema).mutation(async ({ ctx, input }) => {
    const { db } = ctx;

    // Verify account exists and is active
    const clerkUserId = ctx.auth?.userId;
    if (!clerkUserId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to create posts",
      });
    }

    const account = await db.thinkpagesAccount.findUnique({
      where: { id: input.accountId },
    });

    if (!account || !account.isActive) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Account not found or inactive",
      });
    }

    if (account.clerkUserId !== clerkUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to post from this account",
      });
    }

    // Determine post type
    let postType: "original" | "repost" | "reply" = "original";
    if (input.parentPostId) postType = "reply";
    if (input.repostOfId) postType = "repost";

    let pollId: string | null = null;
    if (input.poll) {
      const createdPoll = await db.poll.create({
        data: {
          question: input.poll.question,
          description: input.poll.description,
          pollType: input.poll.pollType,
          multiple: input.poll.multiple,
          options: {
            create: input.poll.options.map((opt) => ({
              label: opt,
            })),
          },
        },
      });
      pollId = createdPoll.id;
    }

    // Create the post
    const post = await db.thinkpagesPost.create({
      data: {
        accountId: input.accountId,
        content: input.content,
        hashtags: input.hashtags ? JSON.stringify(input.hashtags) : null,
        visualizations: input.visualizations ? JSON.stringify(input.visualizations) : null,
        postType,
        parentPostId: input.parentPostId,
        repostOfId: input.repostOfId,
        visibility: input.visibility,
        ixTimeTimestamp: new Date(), // Store real-world time for social media timestamps
        pollId,
      } as any,
      include: {
        account: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            clerkUserId: true,
            accountType: true,
            verified: true,
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
                clerkUserId: true,
                accountType: true,
                verified: true,
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
                clerkUserId: true,
                accountType: true,
                verified: true,
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
      },
    });

    // Create media attachments if any
    if (input.mediaUrls && input.mediaUrls.length > 0) {
      await db.mediaAttachment.createMany({
        data: input.mediaUrls.map((url, index) => ({
          postId: post.id,
          type: "image",
          url: url,
          filename: `image_${index + 1}`,
          mimeType: url.startsWith("data:") ? url.split(";")[0]!.split(":")[1] : "image/jpeg",
          fileSize: null,
        })),
      });
    }

    // Update account post count
    await db.thinkpagesAccount.update({
      where: { id: input.accountId },
      data: {
        postCount: { increment: 1 },
      },
    });

    // Create mentions if any
    if (input.mentions && input.mentions.length > 0) {
      const mentionedAccounts = await db.thinkpagesAccount.findMany({
        where: {
          username: {
            in: input.mentions.map((m) => m.replace("@", "")),
          },
        },
        select: { id: true, username: true, clerkUserId: true },
      });

      const mentionData = mentionedAccounts.map((mentionedAccount: any) => ({
        postId: post.id,
        mentionedAccountId: mentionedAccount.id,
        position: input.content.indexOf(`@${mentionedAccount.username}`),
      }));

      if (mentionData.length > 0) {
        await db.postMention.createMany({
          data: mentionData,
        });

        // 🔔 Notify mentioned users
        for (const mentioned of mentionedAccounts) {
          await notificationHooks
            .onSocialActivity({
              activityType: "mention",
              fromUserId: account.clerkUserId,
              toUserId: mentioned.clerkUserId,
              contentTitle: input.content.substring(0, 50),
              contentId: post.id,
            })
            .catch((err) =>
              console.error("[ThinkPages] Failed to send mention notification:", err)
            );
        }
      }
    }

    // 🔔 Notify if this is a reply
    if (input.parentPostId && (post as any).parentPost) {
      const parentPost = await db.thinkpagesPost.findUnique({
        where: { id: input.parentPostId },
        select: {
          id: true,
          accountId: true,
          account: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
              clerkUserId: true,
            },
          },
        },
      });

      if (parentPost && parentPost.accountId !== input.accountId) {
        await notificationHooks
          .onThinkPageActivity({
            thinkpageId: post.id,
            title: input.content.substring(0, 50),
            action: "commented",
            authorId: account.clerkUserId,
            targetUserId: parentPost.account.clerkUserId,
          })
          .catch((err) => console.error("[ThinkPages] Failed to send reply notification:", err));
      }
    }

    // 💰 Award IxCredits for social post (if within daily cap)
    let creditsEarned = 0;
    try {
      // Check daily post count
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const postsToday = await db.thinkpagesPost.count({
        where: {
          accountId: input.accountId,
          createdAt: { gte: today },
        },
      });

      // Only award for first 5 posts per day (1 IxC each)
      if (postsToday <= 5) {
        const earnResult = await vaultService.earnCredits(
          clerkUserId,
          1,
          "EARN_SOCIAL",
          "SOCIAL_POST",
          db as any,
          {
            postId: post.id,
            postType,
            accountId: input.accountId,
          }
        );

        if (earnResult.success) {
          creditsEarned = 1;
        }
      }
    } catch (error) {
      // Don't block post creation if earning fails
      console.error("[ThinkPages] Failed to award post credits:", error);
    }

    // 📣 Autopost public, non-repost posts to Discord IxTwitter channel
    if (input.postToDiscord && post.visibility === "public" && post.postType !== "repost") {
      try {
        const { postThinkPagesToDiscord } = await import("~/lib/discord/ixtwitter-sync");
        // Run asynchronously without awaiting to keep createPost response fast
        postThinkPagesToDiscord(
          db as any,
          post,
          {
            displayName: account.displayName,
            username: account.username,
            verified: account.verified,
            profileImageUrl: account.profileImageUrl,
          },
          input.mediaUrls
        ).catch((err: unknown) =>
          console.error("[ThinkPages] Autopost to Discord promise error:", err)
        );
      } catch (error) {
        console.error("[ThinkPages] Failed to trigger Discord autopost:", error);
      }
    }

    // 📰 Mirror to the admin-configured #thinkpages Discord feed (filtered, deduped).
    // Independent of the IxTwitter autopost above; the filter/enable lives in admin config.
    if (post.visibility === "public") {
      try {
        const { mirrorThinkPagesPostToDiscordFeed } = await import("~/lib/discord/thinkpages-feed");
        mirrorThinkPagesPostToDiscordFeed(db as any, post.id, input.mediaUrls).catch(
          (err: unknown) => console.error("[ThinkPages] Discord feed mirror promise error:", err)
        );
      } catch (error) {
        console.error("[ThinkPages] Failed to trigger Discord feed mirror:", error);
      }
    }

    await invalidateFeeds();

    return {
      ...post,
      creditsEarned,
    };
  }),

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
