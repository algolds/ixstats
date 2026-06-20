// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";

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

export const usersPreferencesRouter = createTRPCRouter({
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

  // Get current user with role and permissions

  // Create user record if it doesn't exist and ensure roles exist

  // Setup database with roles and permissions

  // Get user's admin favorites

  // Add admin panel to favorites

  // Remove admin panel from favorites

  // Reorder admin favorites

  // Get user by Clerk ID with role (for admin use)

  // Get user's membership status

  // Update user's membership tier (for admin use)

  // ─── Wiki Preferences ────────────────────────────────────────────────

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    const prefs = await ctx.db.userPreferences.findUnique({ where: { userId } });
    return (
      prefs ?? {
        wikiAutoScan: true,
        wikiSourcePriority: "ixwiki",
        wikiDisplayMode: "inline",
      }
    );
  }),

  updateWikiPreferences: protectedProcedure
    .input(
      z.object({
        wikiAutoScan: z.boolean().optional(),
        wikiSourcePriority: z.enum(["ixwiki", "iiwiki", "both"]).optional(),
        wikiDisplayMode: z.enum(["inline", "sidebar", "hidden"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      return ctx.db.userPreferences.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    }),

  resolveWikiAuthor: rateLimitedPublicProcedure
    .input(z.object({ wikiUsername: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: { wikiUsername: input.wikiUsername },
        select: {
          wikiUsername: true,
          role: {
            select: {
              name: true,
              displayName: true,
            },
          },
          country: {
            select: {
              id: true,
              name: true,
              slug: true,
              flag: true,
              economicTier: true,
              leader: true,
              continent: true,
            },
          },
        },
      });
      if (!user) return null;
      return {
        wikiUsername: user.wikiUsername,
        role: user.role
          ? {
              name: user.role.name,
              displayName: user.role.displayName,
            }
          : null,
        country: user.country
          ? {
              id: user.country.id,
              name: user.country.name,
              slug: user.country.slug,
              flag: user.country.flag,
              economicTier: user.country.economicTier,
              leader: user.country.leader,
              continent: user.country.continent,
            }
          : null,
      };
    }),
});
