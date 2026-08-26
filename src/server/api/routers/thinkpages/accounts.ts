import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { validateNoXSS } from "~/lib/utils";
import { globalCache } from "~/lib/cache";

const _invalidateFeeds = async () => {
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

const _hydratePostDates = (post: any) => {
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

const _SearchUnsplashImagesSchema = z.object({
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
const _pollInclude = {
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
const _UpdateAccountSchema = thinkpagesAccountBaseSchema.partial();

const _CreatePostSchema = z.object({
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

const _AddReactionSchema = z.object({
  postId: z.string(),
  accountId: z.string(), // ThinkpagesAccount ID for reactions
  reactionType: z.union([
    z.enum(["like", "laugh", "angry", "sad", "fire", "thumbsup", "thumbsdown"]),
    z.string().startsWith("discord:"), // Support Discord emoji reactions like "discord:ixnay"
  ]),
});

const _GetFeedSchema = z.object({
  countryId: z.string().optional(), // Feed filtered by country
  hashtag: z.string().optional(),
  filter: z.enum(["recent", "trending", "hot"]).default("recent"),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export const thinkpagesAccountsRouter = createTRPCRouter({
  // Search Unsplash images

  // Fetch Discord Channel Topic (Easter Egg)

  // Search Wiki Commons images

  // Calculate trending topics

  // Search users globally for ThinkTanks/ThinkShare

  // Update ThinkPages Feed Account
  updateAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        verified: z.boolean().optional(),
        profileImageUrl: z.string().url().or(z.literal("")).optional().nullable(),
        postingFrequency: z.enum(["active", "moderate", "low"]).optional(),
        politicalLean: z.enum(["left", "center", "right"]).optional(),
        personality: z.enum(["serious", "casual", "satirical"]).optional(),
        isActive: z.boolean().optional(),
        accountType: z.enum(["government", "media", "citizen"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to update accounts",
        });
      }

      // Verify the account belongs to the current user
      const existingAccount = await db.thinkpagesAccount.findUnique({
        where: { id: input.accountId },
      });

      if (!existingAccount || existingAccount.clerkUserId !== clerkUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this account",
        });
      }

      const account = await db.thinkpagesAccount.update({
        where: { id: input.accountId },
        data: {
          verified: input.verified,
          postingFrequency: input.postingFrequency,
          politicalLean: input.politicalLean,
          personality: input.personality,
          profileImageUrl: input.profileImageUrl === "" ? null : input.profileImageUrl,
          isActive: input.isActive,
          accountType: input.accountType,
        },
      });

      return account;
    }),
  // Username availability check for ThinkPages Feed Accounts
  checkUsernameAvailability: publicProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check if username is already taken in ThinkpagesAccount table
      const existingAccount = await db.thinkpagesAccount.findUnique({
        where: { username: input.username },
      });

      return { isAvailable: !existingAccount };
    }),

  // Generate random profile picture
  generateProfilePicture: publicProcedure.mutation(async () => {
    // Return first placeholder image (deterministic, not random)
    const placeholderImage = "https://via.placeholder.com/150/4F46E5/FFFFFF?text=User";
    return { imageUrl: placeholderImage };
  }),

  // Create ThinkPages Feed Account - For Feed only (not ThinkTanks/ThinkShare)
  createAccount: protectedProcedure.input(CreateAccountSchema).mutation(async ({ ctx, input }) => {
    const { db } = ctx;
    const clerkUserId = ctx.auth?.userId;

    if (!clerkUserId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to create accounts",
      });
    }

    // Check account limit - 25 accounts per clerk user
    const existingAccounts = await db.thinkpagesAccount.findMany({
      where: { clerkUserId },
    });

    if (existingAccounts.length >= 25) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You have reached the maximum of 25 ThinkPages accounts per user",
      });
    }

    // Check username availability
    const existingUsername = await db.thinkpagesAccount.findUnique({
      where: { username: input.username },
    });

    if (existingUsername) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Username is already taken",
      });
    }

    // Verify country exists
    const country = await db.country.findUnique({
      where: { id: input.countryId },
    });

    if (!country) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Country not found",
      });
    }

    // Check account type limit for this country
    const existingCountryAccounts = existingAccounts.filter(
      (a) => a.countryId === input.countryId && a.isActive
    );

    const typeCounts = {
      citizen: existingCountryAccounts.filter((a) => a.accountType === "citizen").length,
      government: existingCountryAccounts.filter((a) => a.accountType === "government").length,
      media: existingCountryAccounts.filter((a) => a.accountType === "media").length,
    };

    const maxLimits = {
      citizen: 17,
      government: 5,
      media: 10,
    };

    const requestedType = input.accountType as keyof typeof maxLimits;
    if (requestedType in maxLimits && typeCounts[requestedType] >= maxLimits[requestedType]) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `You have reached the maximum of ${maxLimits[requestedType]} ${requestedType} accounts for this country`,
      });
    }

    // Create the account
    const lastNameVal = input.lastName || "";
    const displayName = lastNameVal ? `${input.firstName} ${lastNameVal}` : input.firstName;
    const account = await db.thinkpagesAccount.create({
      data: {
        clerkUserId,
        countryId: input.countryId,
        accountType: input.accountType,
        username: input.username,
        displayName,
        firstName: input.firstName,
        lastName: lastNameVal,
        bio: input.bio || "",
        verified: input.verified,
        postingFrequency: input.postingFrequency,
        politicalLean: input.politicalLean,
        personality: input.personality,
        profileImageUrl: input.profileImageUrl || null,
      },
    });

    return account;
  }),

  // Get ThinkPages Feed Accounts by Country - For Feed only
  getAccountsByCountry: publicProcedure
    .input(z.object({ countryId: z.string().optional().default("") }).default({ countryId: "" }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      if (!input.countryId || input.countryId.trim() === "") {
        return [];
      }

      const accounts = await db.thinkpagesAccount.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        orderBy: [{ verified: "desc" }, { followerCount: "desc" }, { createdAt: "asc" }],
      });

      return accounts;
    }),

  // Search ThinkPages accounts globally
  searchAccounts: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      if (!input.query) return [];

      const accounts = await db.thinkpagesAccount.findMany({
        where: {
          isActive: true,
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { displayName: { contains: input.query, mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: [{ verified: "desc" }, { followerCount: "desc" }],
      });

      return accounts;
    }),

  // Get current user's ThinkPages accounts
  getMyAccounts: protectedProcedure.query(async ({ ctx }) => {
    const { db, auth } = ctx;

    const accounts = await db.thinkpagesAccount.findMany({
      where: {
        clerkUserId: auth.userId,
        isActive: true,
      },
      orderBy: [{ verified: "desc" }, { followerCount: "desc" }, { createdAt: "asc" }],
    });

    return accounts;
  }),

  // Get Account Counts by Type - For Feed only
  getAccountCountsByType: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db, auth } = ctx;
      const clerkUserId = auth?.userId;

      if (!clerkUserId) {
        return {
          citizen: 0,
          government: 0,
          media: 0,
          organization: 0,
        };
      }

      const accounts = await db.thinkpagesAccount.findMany({
        where: {
          countryId: input.countryId,
          clerkUserId,
          isActive: true,
        },
        select: { accountType: true },
      });

      const counts = {
        citizen: accounts.filter((a) => a.accountType === "citizen").length,
        government: accounts.filter((a) => a.accountType === "government").length,
        media: accounts.filter((a) => a.accountType === "media").length,
        organization: 0, // Not used currently
      };

      return counts;
    }),

  // Post creation

  // Update post content (edit post)

  // Delete post (soft delete)

  // Add reaction to post

  // Remove reaction

  // Get feed

  // Get trending topics

  // Get account details

  // Get Thinkpages account by Clerk User ID
  getThinkpagesAccountByUserId: publicProcedure
    .input(z.object({ clerkUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const account = await db.user.findFirst({
        where: { clerkUserId: input.clerkUserId },
        include: {
          country: true,
        },
      });

      return account;
    }),

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
