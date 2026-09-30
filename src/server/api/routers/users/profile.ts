// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
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

export const usersProfileRouter = createTRPCRouter({
  // Get current user's profile using auth context (no input required)
  getProfile: rateLimitedPublicProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        return {
          userId: null,
          countryId: null,
          country: null,
          role: null,
          membershipTier: "basic",
          createdAt: new Date(),
          hasCompletedSetup: false,
        };
      }

      const clerkUserId = ctx.auth.userId;
      const cacheKey = `user_profile:${clerkUserId}`;
      const cached = await globalCache.get<any>(cacheKey);
      if (cached) {
        return hydrateProfileDates(cached);
      }

      // Re-use user from context when available to avoid duplicate queries
      let userRecord: any = null;

      const countryArgs = {
        include: {
          storytellerEffects: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      } as const;

      if (!userRecord) {
        userRecord = (await ctx.db.user.findUnique({
          where: { clerkUserId },
          include: {
            country: countryArgs,
            role: true,
          },
        })) as any;
      }

      // Auto-create user record if missing (handles first-time logins)
      if (!userRecord) {
        const userService = new UserManagementService(ctx.db as any);
        userRecord = await userService.getOrCreateUser(clerkUserId);
      }

      // Attempt to hydrate country details when we have an ID but no relation loaded
      let countryRecord = userRecord?.country ?? null;

      if (userRecord?.countryId && !countryRecord) {
        countryRecord = await ctx.db.country.findUnique({
          where: { id: userRecord.countryId },
          include: countryArgs.include,
        });
      }

      // Fallback: detect existing country link via ThinkPages accounts or other records
      if (!userRecord?.countryId || !countryRecord) {
        const linkedAccount = await ctx.db.thinkpagesAccount.findFirst({
          where: {
            clerkUserId,
            isActive: true,
            // A personal persona has no country; skip it when looking for a linked nation.
            countryId: { not: null },
          },
          select: {
            countryId: true,
          },
        });

        if (linkedAccount?.countryId && userRecord) {
          const linkedCountryId = linkedAccount.countryId;
          const current = userRecord;
          const userId: string = current.id;
          try {
            // A ThinkPages account never grants ownership: only re-point the user at a nation they
            // already own. Anything else (unowned, or someone else's) is skipped silently.
            userRecord = await ctx.db.$transaction(async (tx) => {
              const linked = await tx.country.findUnique({
                where: { id: linkedCountryId },
                select: { ownerUserId: true },
              });
              if (linked?.ownerUserId !== userId) return current;
              await pointActiveNation(tx, userId, linkedCountryId);
              return tx.user.findUnique({
                where: { id: userId },
                include: {
                  country: countryArgs,
                  role: true,
                },
              });
            });

            countryRecord = userRecord?.country ?? null;
          } catch (linkError) {
            console.error("Failed to reconcile user country link:", linkError);
          }
        }
      }

      // If we still don't have country details, attempt to load with storytellerEffects for completeness
      if (!countryRecord && userRecord?.countryId) {
        countryRecord = await ctx.db.country.findUnique({
          where: { id: userRecord.countryId },
          include: countryArgs.include,
        });
      }

      const profile = {
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

      await globalCache.set(cacheKey, profile, { ttl: 30 });

      return profile;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return {
        userId: null,
        countryId: null,
        country: null,
        role: null,
        membershipTier: "basic",
        createdAt: new Date(),
        hasCompletedSetup: false,
      };
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

      if (!userId) {
        return { user: null };
      }

      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: {
                    select: { id: true, name: true, description: true },
                  },
                },
              },
            },
          },
          country: {
            select: {
              id: true,
              name: true,
              economicTier: true,
            },
          },
        },
      });

      if (!user) {
        return { user: null };
      }

      // Transform role data to include permissions array
      const transformedRole = user.role
        ? {
            ...user.role,
            permissions: user.role.rolePermissions.map((rp) => rp.permission),
          }
        : null;

      return {
        user: {
          ...user,
          role: transformedRole,
        },
      };
    } catch (error) {
      console.error("Error fetching current user with role:", error);
      return { user: null };
    }
  }),

  // Get user by Clerk ID with role (for admin use)
  getUserWithRole: publicProcedure
    .input(
      z.object({
        clerkUserId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.clerkUserId },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: {
                      select: { id: true, name: true, description: true },
                    },
                  },
                },
              },
            },
            country: {
              select: { id: true, name: true, economicTier: true },
            },
          },
        });

        if (!user) {
          return { user: null };
        }

        // Transform role data to include permissions array
        const transformedRole = user.role
          ? {
              ...user.role,
              permissions: user.role.rolePermissions.map((rp) => rp.permission),
            }
          : null;

        return {
          user: {
            ...user,
            role: transformedRole,
          },
        };
      } catch (error) {
        console.error("Error fetching user with role:", error);
        return { user: null };
      }
    }),
});
