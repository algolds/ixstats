import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { UserManagementService } from "~/lib/auth";
import { globalCache } from "~/lib/cache";
import { pointActiveNation } from "~/server/modules/realms";

function hydrateProfileDates(profile: any) {
  if (!profile) return profile;
  if (profile.createdAt) {
    profile.createdAt = new Date(profile.createdAt);
  }
  if (profile.country) {
    const c = profile.country;
    if (c.baselineDate) c.baselineDate = new Date(c.baselineDate);
    if (c.lastCalculated) c.lastCalculated = new Date(c.lastCalculated);
    if (c.createdAt) c.createdAt = new Date(c.createdAt);
    if (c.updatedAt) c.updatedAt = new Date(c.updatedAt);
    if (Array.isArray(c.storytellerEffects)) {
      c.storytellerEffects = c.storytellerEffects.map((e: any) => ({
        ...e,
        ixTimeTimestamp: e.ixTimeTimestamp ? new Date(e.ixTimeTimestamp) : undefined,
      }));
    }
  }
  return profile;
}

const COUNTRY_ARGS = {
  include: {
    storytellerEffects: {
      where: { isActive: true },
      orderBy: { ixTimeTimestamp: "desc" },
    },
  },
} as const;

const anonymousProfile = () => ({
  userId: null,
  countryId: null,
  country: null,
  role: null,
  membershipTier: "basic",
  createdAt: new Date(),
  hasCompletedSetup: false,
});

const loadCountry = (db: PrismaClient, id: string) =>
  db.country.findUnique({ where: { id }, include: COUNTRY_ARGS.include });

/** The user with country and role; created on first sign-in. */
async function loadUserRecord(db: PrismaClient, clerkUserId: string) {
  const found: any = await db.user.findUnique({
    where: { clerkUserId },
    include: { country: COUNTRY_ARGS, role: true },
  });
  return found ?? (await new UserManagementService(db as any).getOrCreateUser(clerkUserId));
}

/**
 * Re-points the user at the nation their ThinkPages persona is linked to — only a nation they
 * already own (a persona never grants ownership; anything else is skipped silently).
 */
async function reconcileLinkedCountry(db: PrismaClient, clerkUserId: string, current: any) {
  const linkedAccount = await db.thinkpagesAccount.findFirst({
    where: {
      clerkUserId,
      isActive: true,
      // A personal persona has no country; skip it when looking for a linked nation.
      countryId: { not: null },
    },
    select: { countryId: true },
  });
  if (!linkedAccount?.countryId) return null;

  const linkedCountryId = linkedAccount.countryId;
  const userId: string = current.id;
  try {
    const userRecord: any = await db.$transaction(async (tx) => {
      const linked = await tx.country.findUnique({
        where: { id: linkedCountryId },
        select: { ownerUserId: true },
      });
      if (linked?.ownerUserId !== userId) return current;
      await pointActiveNation(tx, userId, linkedCountryId);
      return tx.user.findUnique({
        where: { id: userId },
        include: { country: COUNTRY_ARGS, role: true },
      });
    });
    return { userRecord, countryRecord: userRecord?.country ?? null };
  } catch (linkError) {
    console.error("Failed to reconcile user country link:", linkError);
    return null;
  }
}

function profileOf(clerkUserId: string, userRecord: any, countryRecord: any) {
  return {
    userId: clerkUserId,
    countryId: countryRecord?.id ?? null,
    country: countryRecord,
    role: userRecord?.role ?? null,
    membershipTier: userRecord?.membershipTier ?? "basic",
    createdAt: userRecord?.createdAt ?? new Date(),
    wikiUsername: userRecord?.wikiUsername ?? null,
    forumUsername: userRecord?.forumUsername ?? null,
    hasCompletedSetup: Boolean(countryRecord),
  };
}

async function buildProfile(db: PrismaClient, clerkUserId: string) {
  let userRecord: any = await loadUserRecord(db, clerkUserId);

  // Hydrate country details when we have an ID but no relation loaded
  let countryRecord = userRecord?.country ?? null;
  if (userRecord?.countryId && !countryRecord) {
    countryRecord = await loadCountry(db, userRecord.countryId);
  }

  // Fallback: detect an existing country link via ThinkPages accounts
  if ((!userRecord?.countryId || !countryRecord) && userRecord) {
    const reconciled = await reconcileLinkedCountry(db, clerkUserId, userRecord);
    if (reconciled) ({ userRecord, countryRecord } = reconciled);
  }

  // Still no country details: load with storytellerEffects for completeness
  if (!countryRecord && userRecord?.countryId) {
    countryRecord = await loadCountry(db, userRecord.countryId);
  }

  return profileOf(clerkUserId, userRecord, countryRecord);
}

/** The user with role (carrying a flat permissions array) and a brief country, or null. */
async function findUserWithRole(db: PrismaClient, clerkUserId: string) {
  const user = await db.user.findUnique({
    where: { clerkUserId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: { select: { id: true, name: true, description: true } } },
          },
        },
      },
      country: { select: { id: true, name: true, economicTier: true } },
    },
  });
  if (!user) return null;
  return {
    ...user,
    role: user.role
      ? { ...user.role, permissions: user.role.rolePermissions.map((rp) => rp.permission) }
      : null,
  };
}

export const usersProfileRouter = createTRPCRouter({
  // Get current user's profile using auth context (no input required)
  getProfile: rateLimitedPublicProcedure.query(async ({ ctx }) => {
    try {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) return anonymousProfile();

      const cacheKey = `user_profile:${clerkUserId}`;
      const cached = await globalCache.get<any>(cacheKey);
      if (cached) return hydrateProfileDates(cached);

      const profile = await buildProfile(ctx.db, clerkUserId);
      await globalCache.set(cacheKey, profile, { ttl: 30 });
      return profile;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return anonymousProfile();
    }
  }),

  // Get current user's abilities and role permissions for CASL
  getCurrentUserAbilities: rateLimitedPublicProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        return {
          role: "guest",
          permissions: [],
          membershipTier: "basic",
          unlockedTools: [],
        };
      }

      const clerkUserId = ctx.auth.userId;

      // Fetch user from DB with roles and nested permissions
      const userRecord = await ctx.db.user.findUnique({
        where: { clerkUserId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      const permissions = userRecord?.role?.rolePermissions?.map((rp) => rp.permission.name) ?? [];

      return {
        role: userRecord?.role?.name ?? "user",
        permissions,
        membershipTier: userRecord?.membershipTier ?? "basic",
        unlockedTools: ["basic_calculator"], // Can be extended dynamically in the future
      };
    } catch (error) {
      console.error("Error fetching user abilities:", error);
      return {
        role: "guest",
        permissions: [],
        membershipTier: "basic",
        unlockedTools: [],
      };
    }
  }),

  // Get current user with role and permissions
  getCurrentUserWithRole: publicProcedure.query(async ({ ctx }) => {
    try {
      const { userId } = ctx.auth as { userId?: string };
      return { user: userId ? await findUserWithRole(ctx.db, userId) : null };
    } catch (error) {
      console.error("Error fetching current user with role:", error);
      return { user: null };
    }
  }),

  // Get user by Clerk ID with role (for admin use)
  getUserWithRole: publicProcedure
    .input(z.object({ clerkUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return { user: await findUserWithRole(ctx.db, input.clerkUserId) };
      } catch (error) {
        console.error("Error fetching user with role:", error);
        return { user: null };
      }
    }),
});
