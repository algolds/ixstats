import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notifications/hooks";
import { notificationAPI } from "~/lib/notifications/api";
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

export const thinkpagesThinktanksMembershipRouter = createTRPCRouter({
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
  joinThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check if group exists and is active
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId, isActive: true },
      });

      if (!group) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Group not found or inactive",
        });
      }

      // Verify user exists and is active
      const user = await db.user.findUnique({
        where: { clerkUserId: input.userId },
      });

      if (!user || !user.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or inactive",
        });
      }

      // Generate display name (User model doesn't have firstName/lastName - uses Clerk)
      const userDisplayName = `User ${input.userId.slice(0, 8)}`;

      // Check if user is already a member
      const existingMember = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });

      if (existingMember) {
        if (existingMember.isActive) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Already a member of this group",
          });
        } else {
          // Reactivate membership
          await db.thinktankMember.update({
            where: { id: existingMember.id },
            data: { isActive: true, joinedAt: new Date() },
          });
        }
      } else {
        // Create new membership
        await db.thinktankMember.create({
          data: {
            groupId: input.groupId,
            userId: input.userId,
            role: "member",
          },
        });
      }

      // Update member count
      await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { increment: 1 } },
      });

      // Notify group admins about new member
      try {
        const admins = await db.thinktankMember.findMany({
          where: {
            groupId: input.groupId,
            role: { in: ["admin", "owner"] },
            isActive: true,
            userId: { not: input.userId },
          },
          select: { userId: true },
        });

        if (admins.length > 0) {
          await notificationHooks.onThinktankActivity({
            activityType: "member_joined",
            groupId: input.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: input.userId,
            actorUserName: userDisplayName,
            targetUserIds: admins.map((a) => a.userId),
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send join notifications:", e);
      }

      return { success: true, message: "Successfully joined group" };
    }),

  // Leave a ThinkTank group
  leaveThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Not a member of this group",
        });
      }

      // Can't leave if you're the owner and there are other members
      if (member.role === "owner") {
        const otherActiveMembers = await db.thinktankMember.count({
          where: {
            groupId: input.groupId,
            userId: { not: input.userId },
            isActive: true,
          },
        });

        if (otherActiveMembers > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot leave group as owner while other members exist. Transfer ownership first.",
          });
        }
      }

      // Deactivate membership
      await db.thinktankMember.update({
        where: { id: member.id },
        data: { isActive: false },
      });

      // Update member count
      const updatedGroup = await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { decrement: 1 } },
        select: { name: true, type: true },
      });

      // Notify group admins about member leaving
      try {
        const admins = await db.thinktankMember.findMany({
          where: {
            groupId: input.groupId,
            role: { in: ["admin", "owner"] },
            isActive: true,
            userId: { not: input.userId },
          },
          select: { userId: true },
        });

        const leavingUser = await db.user.findUnique({
          where: { clerkUserId: input.userId },
        });

        if (admins.length > 0 && leavingUser) {
          const leavingUserDisplayName = `User ${input.userId.slice(0, 8)}`;
          await notificationHooks.onThinktankActivity({
            activityType: "member_left",
            groupId: input.groupId,
            groupName: updatedGroup.name,
            groupType: updatedGroup.type as "public" | "private" | "invite_only",
            actorUserId: input.userId,
            actorUserName: leavingUserDisplayName,
            targetUserIds: admins.map((a) => a.userId),
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send leave notifications:", e);
      }

      return { success: true, message: "Successfully left group" };
    }),

  // Get ThinkTank messages

  // Send message to ThinkTank

  // Update a ThinkTank group

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
        role: z.enum(["admin", "member"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.thinktankMember.update({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
      });

      // Notify the user about their role change
      try {
        const group = await db.thinktankGroup.findUnique({
          where: { id: input.groupId },
          select: { name: true, type: true },
        });

        if (group) {
          await notificationHooks.onThinktankActivity({
            activityType: "role_changed",
            groupId: input.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: ctx.user?.clerkUserId || "system",
            targetUserId: input.userId,
            metadata: { newRole: input.role },
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send role change notification:", e);
      }

      return { success: true };
    }),

  removeMemberFromThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get group info before deletion for notification
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId },
        select: { name: true, type: true },
      });

      await db.thinktankMember.delete({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });

      // Decrement member count
      await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { decrement: 1 } },
      });

      // Notify the removed user
      if (group) {
        try {
          await notificationAPI.create({
            title: `Removed from ${group.name}`,
            message: "You have been removed from this ThinkTank group",
            userId: input.userId,
            category: "social",
            type: "warning",
            priority: "medium",
            href: "/messages/groups",
            source: "thinktank",
            actionable: false,
            metadata: {
              groupId: input.groupId,
              groupName: group.name,
              groupType: group.type,
              activityType: "member_removed",
            },
          });
        } catch (e) {
          console.warn("[ThinkTanks] Failed to send removal notification:", e);
        }
      }

      return { success: true };
    }),

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
