import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

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
});
