// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { UserManagementService } from "~/lib/user-management-service";
import { globalCache } from "~/lib/advanced-cache-system";

// Temporary storage for user-country mappings until we fix the User model

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
          },
          select: {
            countryId: true,
          },
        });

        if (linkedAccount?.countryId && userRecord) {
          try {
            userRecord = (await ctx.db.user.update({
              where: { clerkUserId },
              data: {
                countryId: linkedAccount.countryId,
              },
              include: {
                country: countryArgs,
                role: true,
              },
            })) as any;

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

  // Get user profile by ID (for admin use)
  getProfileById: rateLimitedPublicProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID cannot be empty"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Validate input
        if (!input.userId || input.userId.trim() === "") {
          throw new Error("User ID is required and cannot be empty");
        }

        // Get user from DB
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.userId },
          include: { country: true },
        });
        if (!user || !user.countryId) {
          return {
            userId: input.userId,
            countryId: null,
            country: null,
            hasCompletedSetup: false,
          };
        }
        // Get country details
        const country = await ctx.db.country.findUnique({
          where: { id: user.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });
        return {
          userId: input.userId,
          countryId: country?.id || null,
          country: country,
          hasCompletedSetup: !!country,
        };
      } catch (error) {
        console.error("Error fetching user profile:", error);
        throw new Error("Failed to fetch user profile");
      }
    }),

  // Get multiple user profiles by IDs (batch)
  getProfilesByIds: rateLimitedPublicProcedure
    .input(
      z.object({
        userIds: z.array(z.string().min(1)).max(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const validIds = input.userIds.filter((id) => id.trim() !== "");
      if (validIds.length === 0) return [];

      const users = await ctx.db.user.findMany({
        where: { clerkUserId: { in: validIds } },
        include: {
          country: {
            select: { id: true, name: true, slug: true, flag: true },
          },
        },
      });

      const userMap = new Map(users.map((u) => [u.clerkUserId, u]));

      return validIds.map((userId) => {
        const user = userMap.get(userId);
        const country = user?.country
          ? {
              id: user.country.id,
              name: user.country.name,
              slug: user.country.slug,
              flagUrl: user.country.flag,
            }
          : null;
        return {
          userId,
          countryId: country?.id ?? null,
          country,
          hasCompletedSetup: !!country,
        };
      });
    }),

  // Link user to existing country

  // Create new country for user (LEGACY - Use countries.createCountry for new builder)

  // Unlink country from user

  // Get user's linked country with full details

  // Update user profile settings
  updateProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        settings: z.object({
          displayName: z.string().optional(),
          preferences: z.record(z.string(), z.unknown()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // For now, we'll store user preferences in a simple way
        // In a real implementation, you might have a UserProfile table
        console.log("Updating profile for user:", input.userId, "with settings:", input.settings);

        await globalCache.delete(`user_profile:${input.userId}`);

        return {
          success: true,
          message: "Profile updated successfully",
        };
      } catch (error) {
        console.error("Error updating profile:", error);
        throw new Error("Failed to update profile");
      }
    }),

  // Get user social data
  getSocialData: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get user's country and calculate influence based on country performance
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.userId },
          include: { country: true },
        });

        if (!user || !user.country) {
          return {
            achievements: 0,
            influence: 0,
            followingCountries: [],
            friends: [],
          };
        }

        // Calculate achievements based on country data
        const country = user.country;
        let achievements = 0;
        let influence = 0;

        // Achievement calculation
        if (country.economicTier === "Extravagant") achievements += 5;
        else if (country.economicTier === "Very Strong") achievements += 4;
        else if (country.economicTier === "Strong") achievements += 3;
        else if (country.economicTier === "Healthy") achievements += 2;
        else achievements += 1;

        if (country.currentPopulation && country.currentPopulation > 10000000) achievements += 3;
        else if (country.currentPopulation && country.currentPopulation > 5000000)
          achievements += 2;
        else achievements += 1;

        if (country.currentTotalGdp && country.currentTotalGdp > 1000000000000)
          achievements += 4; // 1T+
        else if (country.currentTotalGdp && country.currentTotalGdp > 100000000000)
          achievements += 3; // 100B+
        else if (country.currentTotalGdp && country.currentTotalGdp > 10000000000)
          achievements += 2; // 10B+
        else achievements += 1;

        // Influence calculation based on economic metrics
        const gdpPerCapitaScore = Math.min(40, (country.currentGdpPerCapita || 0) / 1000); // Max 40 points
        const totalGdpScore = Math.min(
          30,
          Math.log10((country.currentTotalGdp || 1) / 1000000000) * 10
        ); // Max 30 points
        const populationScore = Math.min(
          20,
          Math.log10((country.currentPopulation || 1) / 1000000) * 10
        ); // Max 20 points
        const growthScore = Math.min(10, (country.adjustedGdpGrowth || 0) * 1000); // Max 10 points

        influence = Math.round(gdpPerCapitaScore + totalGdpScore + populationScore + growthScore);
        influence = Math.max(0, Math.min(100, influence)); // Clamp to 0-100

        // Get following countries (for now, return empty array - could be expanded)
        const followingCountries: string[] = [];
        const friends: string[] = [];

        return {
          achievements,
          influence,
          followingCountries,
          friends,
        };
      } catch (error) {
        console.error("Error fetching social data:", error);
        return {
          achievements: 0,
          influence: 0,
          followingCountries: [],
          friends: [],
        };
      }
    }),

  // Get active users/members for finding friends

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

  // Create user record if it doesn't exist and ensure roles exist
  createUserRecord: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Check if auth context exists
      if (!ctx.auth?.userId) {
        return {
          user: null,
          created: false,
          error: "Not authenticated - no auth context",
        };
      }

      const userId = ctx.auth.userId;

      // Use centralized user management service
      const userService = new UserManagementService(ctx.db as any);
      const user = await userService.getOrCreateUser(userId);

      if (!user) {
        return {
          user: null,
          created: false,
          error: "Failed to create or retrieve user record",
        };
      }

      // Check if this was a new user creation by looking at the user's creation time
      const isNewUser = user.createdAt > new Date(Date.now() - 5000); // Created within last 5 seconds

      return {
        user,
        created: isNewUser,
        message: isNewUser ? "User created successfully" : "User already exists",
      };
    } catch (error) {
      console.error("Error creating user record:", error);
      return {
        user: null,
        created: false,
        error: `Failed to create user record: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }),

  // Setup database with roles and permissions

  // Get user's admin favorites

  // Add admin panel to favorites

  // Remove admin panel from favorites

  // Reorder admin favorites

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

  // Get user's membership status

  // Update user's membership tier (for admin use)

  // ─── Wiki Preferences ────────────────────────────────────────────────
});
