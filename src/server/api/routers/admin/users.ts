// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { TRPCError } from "@trpc/server";

import { invalidateCache } from "~/lib/trpc-cache";
import { globalCache } from "~/lib/advanced-cache-system";

export const adminUsersRouter = createTRPCRouter({
  // Internal calculation formulas management
  // Get global statistics for SDI interface

  // Get stash statistics (real DB values)

  // Get ThinkPages statistics (real DB values)

  // Get system status

  // Get bot status with health check

  // Get system configuration (includes all economic control parameters)

  // Save system configuration (all economic control parameters)

  // Set custom time via bot or local override

  // Bot control operations

  // Get calculation logs

  // Analyze import file

  // Import roster data

  // Sync epoch time with imported data

  // Force recalculation of all countries

  // Get system health

  // --- Clerk User-Country Mapping Endpoints ---
  // Note: User procedures are commented out until User model is properly configured

  // Sync with Discord bot

  // === ADMIN USER/COUNTRY MANAGEMENT ENDPOINTS ===

  // List all users and their claimed countries
  listUsersWithCountries: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      include: { country: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      membershipTier: u.membershipTier || "basic",
      country: u.country ? { id: u.country.id, name: u.country.name } : null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }),

  // List all countries and their assigned users
  listCountriesWithUsers: adminProcedure.query(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      include: { users: true },
      orderBy: { name: "asc" },
    });
    return countries.map((c) => ({
      id: c.id,
      name: c.name,
      user:
        c.users && c.users.length > 0
          ? { id: c.users[0].id, clerkUserId: c.users[0].clerkUserId }
          : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }),

  // Assign a user to a country (admin override)
  assignUserToCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const isSystemOwnerUser = isSystemOwner(input.userId);

      if (isSystemOwnerUser) {
        // For system owners, allow multiple users to access the same country
        // Just link the user without unlinking others
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: input.countryId },
          create: { clerkUserId: input.userId, countryId: input.countryId },
        });
      } else {
        // For regular users, maintain the original behavior (one user per country)
        // Unlink any user currently assigned to this country
        await ctx.db.user.updateMany({
          where: { countryId: input.countryId },
          data: { countryId: null },
        });
        // Unlink this user from any country they currently claim
        await ctx.db.user.updateMany({
          where: { clerkUserId: input.userId },
          data: { countryId: null },
        });
        // Link user to country
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { countryId: input.countryId },
          create: { clerkUserId: input.userId, countryId: input.countryId },
        });
      }

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Unassign a user from a country (admin override)
  unassignUserFromCountry: adminProcedure
    .input(z.object({ userId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.updateMany({
        where: { clerkUserId: input.userId, countryId: input.countryId },
        data: { countryId: null },
      });

      await globalCache.delete(`user_profile:${input.userId}`);
      await invalidateCache(["countries."]);

      return { success: true };
    }),

  // Get navigation settings (wiki/cards/labs visibility)
  getNavigationSettings: publicProcedure.query(async ({ ctx }) => {
    try {
      const settings = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "showWikiTab",
              "showCardsTab",
              "showLabsTab",
              "showIntelligenceTab",
              "showDefenseTab",
              "showMapsTab",
              "showForumTab",
              "showHelpTab",
            ],
          },
        },
      });

      const settingsMap = settings.reduce(
        (acc, setting) => {
          acc[setting.key] = setting.value === "true";
          return acc;
        },
        {} as Record<string, boolean>
      );

      return {
        showWikiTab: settingsMap.showWikiTab ?? true,
        showCardsTab: settingsMap.showCardsTab ?? true,
        showLabsTab: settingsMap.showLabsTab ?? true,
        showIntelligenceTab: settingsMap.showIntelligenceTab ?? false,
        showDefenseTab: settingsMap.showDefenseTab ?? false,
        showMapsTab: settingsMap.showMapsTab ?? true,
        showForumTab: settingsMap.showForumTab ?? true,
        showHelpTab: settingsMap.showHelpTab ?? true,
      };
    } catch (error) {
      console.error("Failed to get navigation settings:", error);
      return {
        showWikiTab: true,
        showCardsTab: true,
        showLabsTab: true,
        showIntelligenceTab: false,
        showDefenseTab: false,
        showMapsTab: true,
        showForumTab: true,
        showHelpTab: true,
      };
    }
  }),

  // Update navigation settings (wiki/cards/labs visibility)
  updateNavigationSettings: adminProcedure
    .input(
      z.object({
        showWikiTab: z.boolean(),
        showCardsTab: z.boolean(),
        showLabsTab: z.boolean(),
        showIntelligenceTab: z.boolean(),
        showDefenseTab: z.boolean(),
        showMapsTab: z.boolean(),
        showForumTab: z.boolean(),
        showHelpTab: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const configUpdates = [
          { key: "showWikiTab", value: input.showWikiTab.toString() },
          { key: "showCardsTab", value: input.showCardsTab.toString() },
          { key: "showLabsTab", value: input.showLabsTab.toString() },
          { key: "showIntelligenceTab", value: input.showIntelligenceTab.toString() },
          { key: "showDefenseTab", value: input.showDefenseTab.toString() },
          { key: "showMapsTab", value: input.showMapsTab.toString() },
          { key: "showForumTab", value: input.showForumTab.toString() },
          { key: "showHelpTab", value: input.showHelpTab.toString() },
        ];

        // Batch upserts using transaction for better performance (avoids N+1 pattern)
        await ctx.db.$transaction(
          configUpdates.map((config) =>
            ctx.db.systemConfig.upsert({
              where: { key: config.key },
              update: { value: config.value, updatedAt: new Date() },
              create: {
                key: config.key,
                value: config.value,
                description: `Navigation tab visibility setting for ${config.key}`,
              },
            })
          )
        );

        return { success: true, message: "Navigation settings updated successfully" };
      } catch (error) {
        console.error("Failed to update navigation settings:", error);
        throw new Error("Failed to update navigation settings");
      }
    }),

  // ============================================================================
  // GOD MODE - DIRECT COUNTRY DATA MANIPULATION
  // ============================================================================

  // ============================================================================
  // DIPLOMATIC OPTIONS MANAGEMENT
  // ============================================================================

  // ============================================================================
  // PHASE 2: COUNTRY GRID & UPCOMING EVENTS
  // ============================================================================

  // ============================================================================
  // STORYTELLER / WORLD EVENTS
  // ============================================================================

  // Event Chains

  // ─── Wiki Link Management ──────────────────────────────────────────

  // Invite user and pre-seed nation reservation in publicMetadata (Clerk waitlist integration)
  inviteUserToBypassWaitlist: adminProcedure
    .input(
      z.object({
        emailAddress: z.string().email(),
        reservedNationName: z.string().min(1),
        role: z.enum(["admin", "user", "owner"]).optional().default("user"),
      })
    )
    .mutation(async ({ input }) => {
      const hasClerkKeys = Boolean(
        process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      );

      if (!hasClerkKeys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Clerk is not configured. Invitations cannot be created.",
        });
      }

      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const client = await clerkClient();

        await client.invitations.createInvitation({
          emailAddress: input.emailAddress,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign-up`,
          publicMetadata: {
            reservedNationName: input.reservedNationName,
            isVip: true,
            role: input.role,
          },
          ignoreExisting: true,
        });

        console.log(
          `[Admin Clerk Invite] Successfully created invitation for ${input.emailAddress} with nation ${input.reservedNationName}`
        );

        return {
          success: true,
          message: `Invitation successfully sent to ${input.emailAddress}`,
        };
      } catch (error) {
        console.error("[Admin Clerk Invite] Failed to create invitation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to invite user via Clerk.",
        });
      }
    }),
});

// getWikiDbPool is now imported from "~/lib/wiki-bridge"
