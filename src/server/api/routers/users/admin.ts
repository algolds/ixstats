// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

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

export const usersAdminRouter = createTRPCRouter({
  // Get current user's profile using auth context (no input required)

  // Get current user's abilities and role permissions for CASL

  // Get user profile by ID (for admin use)

  // Get multiple user profiles by IDs (batch)

  // Link user to existing country

  // Create new country for user (LEGACY - Use countries.createCountry for new builder)

  // Unlink country from user

  // Get user's linked country with full details

  // Update user profile settings

  // Get user social data

  // Get active users/members for finding friends
  getActiveUsers: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        excludeUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get users with countries, ordered by recent activity (createdAt for now)
        const activeUsers = await ctx.db.user.findMany({
          where: {
            countryId: { not: null }, // Only users with countries
            ...(input.excludeUserId && {
              clerkUserId: { not: input.excludeUserId },
            }),
          },
          include: {
            country: {
              select: {
                id: true,
                name: true,
                leader: true,
                economicTier: true,
                currentTotalGdp: true,
                currentPopulation: true,
                flag: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });

        return activeUsers.map((user) => ({
          id: user.clerkUserId,
          countryId: user.countryId!,
          countryName: user.country?.name || "Unknown Country",
          leader: user.country?.leader || "Leader",
          economicTier: user.country?.economicTier || "Unknown",
          totalGdp: user.country?.currentTotalGdp || 0,
          population: user.country?.currentPopulation || 0,
          lastActive: user.updatedAt,
          joinedAt: user.createdAt,
          flag: user.country?.flag || null,
        }));
      } catch (error) {
        console.error("Error fetching active users:", error);
        return [];
      }
    }),

  // Get current user with role and permissions

  // Create user record if it doesn't exist and ensure roles exist

  // Setup database with roles and permissions
  setupDatabase: adminProcedure.mutation(async ({ ctx }) => {
    try {
      // Create basic permissions
      const permissions = [
        { name: "system.admin", displayName: "System Administration", category: "system" },
        { name: "users.manage", displayName: "Manage Users", category: "users" },
        { name: "content.manage", displayName: "Manage Content", category: "content" },
        { name: "countries.view", displayName: "View Countries", category: "countries" },
        { name: "countries.manage", displayName: "Manage Countries", category: "countries" },
        { name: "labs.access", displayName: "Access Labs", category: "labs" },
      ];

      for (const perm of permissions) {
        await ctx.db.permission.upsert({
          where: { name: perm.name },
          update: {},
          create: perm,
        });
      }

      // Create roles
      const ownerRole = await ctx.db.role.upsert({
        where: { name: "owner" },
        update: {},
        create: {
          name: "owner",
          displayName: "System Owner",
          description: "Full system access and control",
          level: 0,
          isSystem: true,
          isActive: true,
        },
      });

      const adminRole = await ctx.db.role.upsert({
        where: { name: "admin" },
        update: {},
        create: {
          name: "admin",
          displayName: "Administrator",
          description: "Administrative access",
          level: 10,
          isSystem: true,
          isActive: true,
        },
      });

      const userRole = await ctx.db.role.upsert({
        where: { name: "user" },
        update: {},
        create: {
          name: "user",
          displayName: "Member",
          description: "Standard user access",
          level: 100,
          isSystem: true,
          isActive: true,
        },
      });

      // Assign all permissions to owner role
      const allPermissions = await ctx.db.permission.findMany();
      for (const permission of allPermissions) {
        await ctx.db.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: ownerRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: ownerRole.id,
            permissionId: permission.id,
          },
        });
      }

      return {
        success: true,
        message: "Database setup completed",
        rolesCreated: 3,
        permissionsCreated: permissions.length,
      };
    } catch (error) {
      console.error("Error setting up database:", error);
      throw new Error(
        `Failed to setup database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }),

  // Get user's admin favorites
  getAdminFavorites: publicProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.auth?.userId) {
        return { favorites: [] };
      }

      const favorites = await ctx.db.adminFavorite.findMany({
        where: {
          userId: ctx.auth.userId,
          isActive: true,
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      });

      return { favorites };
    } catch (error) {
      console.error("Error fetching admin favorites:", error);
      // Return empty array instead of throwing to prevent UI breaks
      return { favorites: [] };
    }
  }),

  // Add admin panel to favorites
  addAdminFavorite: publicProcedure
    .input(
      z.object({
        panelType: z.string(),
        panelId: z.string(),
        displayName: z.string(),
        description: z.string().optional(),
        iconName: z.string().optional(),
        url: z.string(),
        category: z.string().default("general"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("=== addAdminFavorite mutation started ===");
      console.log("Auth context:", JSON.stringify(ctx.auth, null, 2));
      console.log("Input:", JSON.stringify(input, null, 2));

      try {
        if (!ctx.auth?.userId) {
          console.error("Authentication failed - no userId");
          throw new Error("Not authenticated");
        }

        console.log("Authentication successful for user:", ctx.auth.userId);

        // Check if favorite already exists
        console.log("Checking for existing favorite...");
        const existingFavorite = await ctx.db.adminFavorite.findFirst({
          where: {
            userId: ctx.auth.userId,
            panelId: input.panelId,
          },
        });
        console.log("Existing favorite:", existingFavorite);

        if (existingFavorite) {
          // Update existing favorite
          const favorite = await ctx.db.adminFavorite.update({
            where: { id: existingFavorite.id },
            data: {
              displayName: input.displayName,
              description: input.description,
              iconName: input.iconName,
              url: input.url,
              category: input.category,
              isActive: true,
            },
          });
          console.log("Updated existing favorite:", favorite);
          return { favorite, added: false };
        } else {
          // Get the next order number
          const lastFavorite = await ctx.db.adminFavorite.findFirst({
            where: { userId: ctx.auth.userId },
            orderBy: { order: "desc" },
          });

          const nextOrder = (lastFavorite?.order || 0) + 1;

          // Create new favorite
          const favorite = await ctx.db.adminFavorite.create({
            data: {
              userId: ctx.auth.userId,
              panelType: input.panelType,
              panelId: input.panelId,
              displayName: input.displayName,
              description: input.description,
              iconName: input.iconName,
              url: input.url,
              category: input.category,
              order: nextOrder,
            },
          });
          console.log("Created new favorite:", favorite);
          return { favorite, added: true };
        }
      } catch (error) {
        console.error("Error adding admin favorite:", error);
        throw new Error("Failed to add favorite");
      }
    }),

  // Remove admin panel from favorites
  removeAdminFavorite: publicProcedure
    .input(
      z.object({
        panelId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("Not authenticated");
        }

        await ctx.db.adminFavorite.updateMany({
          where: {
            userId: ctx.auth.userId,
            panelId: input.panelId,
          },
          data: {
            isActive: false,
          },
        });

        return { removed: true };
      } catch (error) {
        console.error("Error removing admin favorite:", error);
        throw new Error("Failed to remove favorite");
      }
    }),

  // Reorder admin favorites
  reorderAdminFavorites: publicProcedure
    .input(
      z.object({
        favoriteIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.auth?.userId) {
          throw new Error("Not authenticated");
        }

        // Update order for each favorite
        for (let i = 0; i < input.favoriteIds.length; i++) {
          await ctx.db.adminFavorite.updateMany({
            where: {
              id: input.favoriteIds[i],
              userId: ctx.auth.userId,
            },
            data: {
              order: i + 1,
            },
          });
        }

        return { reordered: true };
      } catch (error) {
        console.error("Error reordering admin favorites:", error);
        throw new Error("Failed to reorder favorites");
      }
    }),

  // Get user by Clerk ID with role (for admin use)

  // Get user's membership status

  // Update user's membership tier (for admin use)

  // ─── Wiki Preferences ────────────────────────────────────────────────
});
