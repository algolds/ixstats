import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/auth";
import { assertCountryWriteAccess, getRoleName } from "~/server/shared/country-authorization";
import { maxThinkpagesAccountsPerUser } from "~/server/shared/thinkpages-config";
import {
  ensurePersonalAccount,
  findPersonalAccount,
  isPersonalAccount,
  PERSONAL_ACCOUNT_TYPE,
} from "./personal-account";

/** Recent public posts shown on a persona profile. */
const PROFILE_POST_LIMIT = 20;

const ADMIN_ROLE_NAMES = ["owner", "admin", "staff"];

/** Same admin definition as `adminProcedure`: system owner, admin-ish role, or role level <= 20. */
function isAdminCaller(ctx: {
  auth?: { userId?: string | null; sessionClaims?: unknown } | null;
  user?: unknown;
}) {
  const userId = ctx.auth?.userId;
  if (userId && isSystemOwner(userId)) return true;
  const roleName = getRoleName(ctx.user, ctx.auth?.sessionClaims);
  if (roleName && ADMIN_ROLE_NAMES.includes(roleName)) return true;
  const level = (ctx.user as { role?: { level?: number | null } } | null | undefined)?.role?.level;
  return typeof level === "number" && level <= 20;
}

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
  // `verified` is admin-controlled and intentionally not accepted on create.
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
  updateAccount: rateLimitedMutationProcedure
    .input(
      z.object({
        accountId: z.string(),
        // Admin-only: ignored/forbidden for regular users (see handler).
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

      // A personal persona is "you": it has no country, so it cannot become a country persona.
      if (
        input.accountType !== undefined &&
        isPersonalAccount(existingAccount) &&
        input.accountType !== existingAccount.accountType
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your personal account's type can't be changed",
        });
      }

      // Verification is an admin-granted badge: users cannot self-grant it.
      if (input.verified !== undefined && input.verified !== existingAccount.verified) {
        if (!isAdminCaller(ctx)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only administrators can change an account's verified status",
          });
        }
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
  createAccount: rateLimitedMutationProcedure
    .input(CreateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to create accounts",
        });
      }

      // Account limit per clerk user, set in Admin → ThinkPages (the personal persona does not count)
      const maxAccounts = await maxThinkpagesAccountsPerUser(db);
      const existingAccounts = await db.thinkpagesAccount.findMany({
        where: { clerkUserId, accountType: { not: PERSONAL_ACCOUNT_TYPE } },
      });

      if (existingAccounts.length >= maxAccounts) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You have reached the maximum of ${maxAccounts} ThinkPages accounts per user`,
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

      // The caller must own (or be an admin for) the country the persona is attached to
      await assertCountryWriteAccess(ctx, input.countryId);

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
          verified: false,
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

  // How many feed accounts one user may create (Admin → ThinkPages)
  getAccountLimit: publicProcedure.query(({ ctx }) => maxThinkpagesAccountsPerUser(ctx.db)),

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

  // The caller's personal persona ("post as yourself"), or null if they have not made one yet
  getMyPersonalAccount: protectedProcedure.query(async ({ ctx }) => {
    return findPersonalAccount(ctx.db, ctx.auth.userId);
  }),

  // Create (or return) the caller's personal persona: one per user, tied to no country
  ensurePersonalAccount: rateLimitedMutationProcedure
    .input(
      z
        .object({
          // Hints from the client (e.g. the IxnayID username); sanitized server-side.
          username: z.string().max(64).optional(),
          displayName: z.string().max(50).optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      return ensurePersonalAccount(ctx.db, ctx.auth.userId, input ?? {});
    }),

  // Public persona profile: real follower/following counts (counted from follow rows), recent posts
  getAccountProfile: publicProcedure
    .input(z.object({ username: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const viewerId = ctx.auth?.userId ?? null;

      const account = await db.thinkpagesAccount.findUnique({
        where: { username: input.username },
        select: {
          id: true,
          clerkUserId: true,
          username: true,
          displayName: true,
          bio: true,
          profileImageUrl: true,
          accountType: true,
          verified: true,
          isActive: true,
          createdAt: true,
          country: { select: { id: true, name: true, flag: true, slug: true } },
        },
      });
      if (!account || !account.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      const personal = viewerId ? await findPersonalAccount(db, viewerId) : null;
      const [followerCount, followingCount, postCount, viewerFollow, posts] = await Promise.all([
        db.thinkpagesFollow.count({ where: { followedAccountId: account.id } }),
        db.thinkpagesFollow.count({ where: { followerAccountId: account.id } }),
        db.thinkpagesPost.count({ where: { accountId: account.id, visibility: "public" } }),
        personal
          ? db.thinkpagesFollow.findUnique({
              where: {
                followerAccountId_followedAccountId: {
                  followerAccountId: personal.id,
                  followedAccountId: account.id,
                },
              },
              select: { id: true },
            })
          : Promise.resolve(null),
        db.thinkpagesPost.findMany({
          where: { accountId: account.id, visibility: "public" },
          orderBy: [{ pinned: "desc" }, { ixTimeTimestamp: "desc" }],
          take: PROFILE_POST_LIMIT,
          select: {
            id: true,
            content: true,
            postType: true,
            pinned: true,
            createdAt: true,
            ixTimeTimestamp: true,
            isAutoGenerated: true,
            // Counted from rows: the stored like/reply/repost counters are not kept up to date.
            _count: { select: { reactions: true, replies: true, reposts: true } },
          },
        }),
      ]);

      const { clerkUserId, isActive: _isActive, ...publicFields } = account;
      return {
        ...publicFields,
        followerCount,
        followingCount,
        postCount,
        isOwnAccount: !!viewerId && clerkUserId === viewerId,
        isFollowing: !!viewerFollow,
        posts: posts.map(({ isAutoGenerated, ixTimeTimestamp, createdAt, _count, ...post }) => ({
          ...post,
          reactionCount: _count.reactions,
          replyCount: _count.replies,
          repostCount: _count.reposts,
          timestamp: isAutoGenerated ? ixTimeTimestamp : createdAt,
        })),
      };
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
