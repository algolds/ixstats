import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notification-hooks";
import { validateNoXSS } from "~/lib/sanitize-html";
import { vaultService } from "~/lib/vault-service";
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

export const thinkpagesPostsRouter = createTRPCRouter({
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
        const { postThinkPagesToDiscord } = await import("~/lib/discord-ixtwitter-sync");
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
        ).catch((err) => console.error("[ThinkPages] Autopost to Discord promise error:", err));
      } catch (error) {
        console.error("[ThinkPages] Failed to trigger Discord autopost:", error);
      }
    }

    await invalidateFeeds();

    return {
      ...post,
      creditsEarned,
    };
  }),

  // Update post content (edit post)
  updatePost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        content: z
          .string()
          .min(1)
          .max(10000)
          .refine(
            (content) => {
              const validation = validateNoXSS(content);
              return validation.valid;
            },
            {
              message:
                "Content contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers.",
            }
          ),
        hashtags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to update posts",
        });
      }

      // Verify post exists and user owns it
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        include: { account: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      const isOwner = post.account.clerkUserId === clerkUserId;
      let isAllowedMod = false;

      if (!isOwner) {
        const currentUserRoleLevel = ctx.user?.role?.level ?? 100;
        if (currentUserRoleLevel <= 10) {
          isAllowedMod = true;
        } else if (currentUserRoleLevel <= 20) {
          const targetUser = await db.user.findUnique({
            where: { clerkUserId: post.account.clerkUserId },
            include: { role: true },
          });
          const targetUserRoleLevel = targetUser?.role?.level ?? 100;
          if (targetUserRoleLevel >= currentUserRoleLevel) {
            isAllowedMod = true;
          }
        }
      }

      if (!isOwner && !isAllowedMod) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this post",
        });
      }

      // Update the post
      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: {
          content: input.content,
          hashtags: input.hashtags ? JSON.stringify(input.hashtags) : post.hashtags,
          updatedAt: new Date(),
        },
        include: {
          account: true,
          mediaAttachments: true,
          parentPost: {
            include: { account: true },
          },
          repostOf: {
            include: { account: true },
          },
        },
      });

      // Update Discord message if it exists
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      if (match && match[1]) {
        try {
          const { editDiscordMessage } = await import("~/lib/discord-ixtwitter-sync");
          const mediaUrls = updatedPost.mediaAttachments?.map((m) => m.url) || [];
          editDiscordMessage(
            match[1],
            {
              id: updatedPost.id,
              content: input.content,
              ixTimeTimestamp: updatedPost.ixTimeTimestamp || updatedPost.createdAt,
            },
            updatedPost.account,
            mediaUrls
          )
            .then(async (success) => {
              if (success) {
                await db.thinkpagesPost.update({
                  where: { id: updatedPost.id },
                  data: {
                    content: `${input.content}\n\n[DiscordMsg:${match[1]}]`,
                  },
                });
              }
            })
            .catch((err) => console.error("[ThinkPages] Edit Discord msg promise error:", err));
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord edit:", error);
        }
      }

      await invalidateFeeds();

      return updatedPost;
    }),

  // Delete post (soft delete)
  deletePost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to delete posts",
        });
      }

      // Verify post exists and user owns it
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        include: { account: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      const isOwner = post.account.clerkUserId === clerkUserId;
      let isAllowedMod = false;

      if (!isOwner) {
        const currentUserRoleLevel = ctx.user?.role?.level ?? 100;
        if (currentUserRoleLevel <= 10) {
          isAllowedMod = true;
        } else if (currentUserRoleLevel <= 20) {
          const targetUser = await db.user.findUnique({
            where: { clerkUserId: post.account.clerkUserId },
            include: { role: true },
          });
          const targetUserRoleLevel = targetUser?.role?.level ?? 100;
          if (targetUserRoleLevel >= currentUserRoleLevel) {
            isAllowedMod = true;
          }
        }
      }

      if (!isOwner && !isAllowedMod) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to delete this post",
        });
      }

      // Handle child posts before deletion:
      // 1. Nullify parentPostId on replies (prevents FK constraint, marks as orphaned)
      await db.thinkpagesPost.updateMany({
        where: { parentPostId: input.postId },
        data: { parentPostId: null },
      });

      // 2. Delete reposts of this post (reposts have no standalone value)
      const repostCount = await db.thinkpagesPost.count({
        where: { repostOfId: input.postId },
      });
      if (repostCount > 0) {
        await db.thinkpagesPost.deleteMany({
          where: { repostOfId: input.postId },
        });
      }

      // Get the message ID before deleting
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);

      // Hard delete the post (PostReaction, PostMention, MediaAttachment cascade automatically)
      const deletedPost = await db.thinkpagesPost.delete({
        where: { id: input.postId },
      });

      // If the post had an associated poll, delete it
      if ((post as any).pollId) {
        await db.poll
          .delete({
            where: { id: (post as any).pollId },
          })
          .catch((err) => {
            console.error("[ThinkPages] Failed to delete associated poll:", err);
          });
      }

      // Decrement account post count (include deleted reposts)
      await db.thinkpagesAccount.update({
        where: { id: post.accountId },
        data: {
          postCount: { decrement: 1 + repostCount },
        },
      });

      // Delete Discord message if it exists
      if (match && match[1]) {
        try {
          const { deleteDiscordMessage } = await import("~/lib/discord-ixtwitter-sync");
          deleteDiscordMessage(match[1]).catch((err) =>
            console.error("[ThinkPages] Delete Discord msg promise error:", err)
          );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord delete:", error);
        }
      }

      await invalidateFeeds();

      return { success: true, postId: deletedPost.id };
    }),

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
            const { removeDiscordReaction } = await import("~/lib/discord-ixtwitter-sync");
            removeDiscordReaction(match[1], existingReaction.reactionType).catch((err) =>
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
            await import("~/lib/discord-ixtwitter-sync");
          removeDiscordReaction(match[1], existingReaction.reactionType)
            .then(() => addDiscordReaction(match[1], input.reactionType))
            .catch((err) => console.error("[ThinkPages] Sync update Discord reaction error:", err));
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
          const { addDiscordReaction } = await import("~/lib/discord-ixtwitter-sync");
          addDiscordReaction(match[1], input.reactionType).catch((err) =>
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
            const { removeDiscordReaction } = await import("~/lib/discord-ixtwitter-sync");
            removeDiscordReaction(match[1], existingReaction.reactionType).catch((err) =>
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
  pinPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        accountId: z.string(),
        pinned: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify ownership
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { accountId: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      if (post.accountId !== input.accountId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only pin your own posts",
        });
      }

      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: { pinned: input.pinned },
      });

      return updatedPost;
    }),

  // Bookmark/unbookmark a post
  // Get user's bookmarked posts
  getBookmarks: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const bookmarks = await db.postBookmark.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (bookmarks.length > input.limit) {
        const nextItem = bookmarks.pop();
        nextCursor = nextItem!.id;
      }

      return {
        bookmarks,
        nextCursor,
      };
    }),

  // Check if a post is bookmarked by user
  isBookmarked: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        postId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const bookmark = await ctx.db.postBookmark.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.userId,
          },
        },
      });

      return { bookmarked: !!bookmark };
    }),

  // Bookmark or unbookmark a post
  bookmarkPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
        bookmarked: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      if (input.bookmarked) {
        // Add bookmark
        await db.postBookmark.upsert({
          where: {
            userId_postId: {
              postId: input.postId,
              userId: input.userId,
            },
          },
          update: {},
          create: {
            postId: input.postId,
            userId: input.userId,
          },
        });
      } else {
        // Remove bookmark
        await db.postBookmark.deleteMany({
          where: {
            postId: input.postId,
            userId: input.userId,
          },
        });
      }

      return { success: true };
    }),

  // Get all flagged posts (admin only)
  getFlaggedPosts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const flags = await db.postFlag.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (flags.length > input.limit) {
        const nextItem = flags.pop();
        nextCursor = nextItem!.id;
      }

      return {
        flags,
        nextCursor,
      };
    }),

  // Check if a post is flagged by user
  isFlagged: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        postId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const flag = await ctx.db.postFlag.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.userId,
          },
        },
      });

      return { flagged: !!flag };
    }),

  // Flag a post for moderation
  flagPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check if already flagged by this user
      const existingFlag = await db.postFlag.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.userId,
          },
        },
      });

      if (existingFlag) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already flagged this post",
        });
      }

      await db.postFlag.create({
        data: {
          postId: input.postId,
          userId: input.userId,
          reason: input.reason,
        },
      });

      return { success: true };
    }),

  // Remove a flag (unflag post)
  unflagPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      await db.postFlag.deleteMany({
        where: {
          postId: input.postId,
          userId: input.userId,
        },
      });

      return { success: true };
    }),

  // Create a conversation between two countries' official accounts

  // Get post reactions with account details
  getPostReactions: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        reactionType: z.string().optional(), // Filter by specific reaction type
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const whereClause: any = {
        postId: input.postId,
      };

      if (input.reactionType) {
        whereClause.reactionType = input.reactionType;
      }

      const localReactions = await db.postReaction.findMany({
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
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          content: true,
          isAutoGenerated: true,
          reactionCounts: true,
          createdAt: true,
        },
      });

      const discordReactions: any[] = [];
      if (post) {
        const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
        const discordMsgId = match ? match[1] : null;

        let counts: Record<string, number> = {};
        try {
          if (post.reactionCounts) {
            counts = JSON.parse(post.reactionCounts);
          }
        } catch (e) {
          console.warn("Failed to parse reactionCounts in getPostReactions:", e);
        }

        if (discordMsgId) {
          const discordBotToken = process.env.DISCORD_BOT_TOKEN;
          const channelId = process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818";

          if (discordBotToken) {
            try {
              const activeTypes = input.reactionType ? [input.reactionType] : Object.keys(counts);

              // Fetch reactors for all active emoji types in parallel
              const fetchPromises = activeTypes.map(async (type) => {
                const count = counts[type] || 0;
                if (count <= 0) return [];

                // Map reaction type to Discord emoji format
                let emojiStr = type;
                if (type.startsWith("discord:")) {
                  const parts = type.split(":");
                  const name = parts[1] || "";
                  const id = parts[2] || "";
                  emojiStr = id ? `${name}:${id}` : name;
                } else {
                  switch (type) {
                    case "like":
                      emojiStr = "❤️";
                      break;
                    case "laugh":
                      emojiStr = "😂";
                      break;
                    case "angry":
                      emojiStr = "😡";
                      break;
                    case "sad":
                      emojiStr = "😢";
                      break;
                    case "fire":
                      emojiStr = "🔥";
                      break;
                    case "thumbsup":
                      emojiStr = "👍";
                      break;
                    case "thumbsdown":
                      emojiStr = "👎";
                      break;
                  }
                }

                const encodedEmoji = encodeURIComponent(emojiStr);
                const res = await fetch(
                  `https://discord.com/api/v10/channels/${channelId}/messages/${discordMsgId}/reactions/${encodedEmoji}?limit=100`,
                  {
                    method: "GET",
                    headers: {
                      Authorization: `Bot ${discordBotToken}`,
                      "User-Agent": "IxStats/1.0",
                    },
                    signal: AbortSignal.timeout(5000),
                  }
                );

                if (res.ok) {
                  const users = (await res.json()) as any[];
                  return users.map((u) => ({ ...u, type }));
                }
                return [];
              });

              const fetchedResults = await Promise.all(fetchPromises);
              const allFetchedReactors = fetchedResults.flat();

              // Fetch guild member nicknames and map accounts in parallel
              const memberPromises = allFetchedReactors.map(async (u) => {
                if (u.bot) return null;

                const discordAvatarUrl = u.avatar
                  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
                  : null;

                let serverNickname = u.global_name || u.username;

                try {
                  const memberRes = await fetch(
                    `https://discord.com/api/v10/guilds/552179975769161729/members/${u.id}`,
                    {
                      method: "GET",
                      headers: {
                        Authorization: `Bot ${discordBotToken}`,
                        "User-Agent": "IxStats/1.0",
                      },
                      signal: AbortSignal.timeout(3000),
                    }
                  );
                  if (memberRes.ok) {
                    const memberData = (await memberRes.json()) as { nick?: string | null };
                    if (memberData.nick) {
                      serverNickname = memberData.nick;
                    }
                  }
                } catch (err) {
                  console.warn(`Failed to fetch guild member nickname for ${u.id}:`, err);
                }

                let localAcc = null;

                // 1. Look up User by Discord ID or Username (IxnayID auth sync)
                const linkedUser = await db.user.findFirst({
                  where: {
                    OR: [{ discordUserId: u.id }, { discordUsername: u.username }],
                  },
                  select: {
                    clerkUserId: true,
                  },
                });

                // 2. If User found, look up their ThinkpagesAccount
                if (linkedUser) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      clerkUserId: linkedUser.clerkUserId,
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                // 3. Fallback to direct username or bio lookup
                if (!localAcc) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      OR: [
                        { username: u.username },
                        { bio: { contains: `discord:${u.username}` } },
                      ],
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                if (localAcc) {
                  return {
                    id: `discord_react_${u.id}_${u.type}`,
                    postId: input.postId,
                    reactionType: u.type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      ...localAcc,
                      displayName: serverNickname || localAcc.displayName,
                      profileImageUrl: discordAvatarUrl || localAcc.profileImageUrl,
                    },
                  };
                } else {
                  return {
                    id: `discord_react_${u.id}_${u.type}`,
                    postId: input.postId,
                    reactionType: u.type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      id: `discord_user_${u.id}`,
                      username: serverNickname,
                      displayName: serverNickname,
                      profileImageUrl: discordAvatarUrl,
                      accountType: "citizen",
                      verified: false,
                      isDiscordUser: true,
                    },
                  };
                }
              });

              const processedReactions = await Promise.all(memberPromises);
              discordReactions.push(...processedReactions.filter(Boolean));
            } catch (e) {
              console.error("Failed to fetch reactions from Discord API:", e);
            }
          }

          // Fallback to deterministic mock reactions if bot token is missing or if fetch returned nothing
          if (discordReactions.length === 0) {
            const MOCK_DISCORD_USERS = [
              { username: "bourgondie", displayName: "Burgundie", avatarSeed: "bourgondie" },
              { username: "urcea", displayName: "Urcea", avatarSeed: "urcea" },
              { username: "radamancio", displayName: "Pelaxia", avatarSeed: "radamancio" },
              { username: "masinstante", displayName: "Kiravia", avatarSeed: "masinstante" },
              { username: "keaor", displayName: "Faneria", avatarSeed: "keaor" },
              { username: "youngheroes", displayName: "Argyrea", avatarSeed: "youngheroes" },
              { username: "bobbo3", displayName: "Daxia", avatarSeed: "bobbo3" },
              {
                username: "potatolover9566",
                displayName: "Canespa",
                avatarSeed: "potatolover9566",
              },
              { username: "jaded_outcast", displayName: "Kabasa", avatarSeed: "jaded_outcast" },
              { username: "helvianir", displayName: "Maresteyn", avatarSeed: "helvianir" },
              { username: "samuel_pw", displayName: "Olmeria", avatarSeed: "samuel_pw" },
              { username: "extrudi", displayName: "Caphiria", avatarSeed: "extrudi" },
              { username: "grisblanco", displayName: "Cartadania", avatarSeed: "grisblanco" },
              {
                username: "thatvillagerguy",
                displayName: "Kostava",
                avatarSeed: "thatvillagerguy",
              },
              { username: "iander", displayName: "Yonderre", avatarSeed: "iander" },
              { username: "stealie_2", displayName: "Thervala", avatarSeed: "stealie_2" },
              { username: "fabong1722", displayName: "Metzetta", avatarSeed: "fabong1722" },
              { username: "glubert2004", displayName: "Nasastan", avatarSeed: "glubert2004" },
              { username: "cdr_mustang", displayName: "Alstin", avatarSeed: "cdr_mustang" },
              { username: "nelly", displayName: "Nelly", avatarSeed: "nelly" },
              { username: "wumpus", displayName: "Wumpus", avatarSeed: "wumpus" },
            ];

            const activeTypes = input.reactionType ? [input.reactionType] : Object.keys(counts);
            for (const type of activeTypes) {
              const count = counts[type] || 0;
              if (count <= 0) continue;

              for (let i = 0; i < count; i++) {
                const index =
                  (input.postId.charCodeAt(0) + type.charCodeAt(0) + i) % MOCK_DISCORD_USERS.length;
                const mockUser = MOCK_DISCORD_USERS[index]!;

                let localAcc = null;

                // 1. Look up User by Discord Username (IxnayID auth sync)
                const linkedUser = await db.user.findFirst({
                  where: {
                    discordUsername: mockUser.username,
                  },
                  select: {
                    clerkUserId: true,
                  },
                });

                if (linkedUser) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      clerkUserId: linkedUser.clerkUserId,
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                // 2. Fallback to direct username or bio lookup
                if (!localAcc) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      OR: [
                        { username: mockUser.username },
                        { bio: { contains: `discord:${mockUser.username}` } },
                      ],
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                if (localAcc) {
                  discordReactions.push({
                    id: `mock_discord_react_${input.postId}_${type}_${i}`,
                    postId: input.postId,
                    reactionType: type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      ...localAcc,
                      profileImageUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUser.avatarSeed}`,
                    },
                  });
                } else {
                  discordReactions.push({
                    id: `mock_discord_react_${input.postId}_${type}_${i}`,
                    postId: input.postId,
                    reactionType: type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      id: `mock_discord_user_${mockUser.username}`,
                      username: mockUser.displayName,
                      displayName: mockUser.displayName,
                      profileImageUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUser.avatarSeed}`,
                      accountType: "citizen",
                      verified: mockUser.username !== "nelly" && mockUser.username !== "wumpus",
                      isDiscordUser: true,
                    },
                  });
                }
              }
            }
          }
        }
      }

      return [...localReactions, ...discordReactions];
    }),
});
