import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { validateNoXSS } from "~/lib/utils";
import { globalCache } from "~/lib/cache";

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

// Create schema - all required fields with defaults
const CreateAccountSchema = thinkpagesAccountBaseSchema;

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
