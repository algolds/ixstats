import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * National Identity Router
 *
 * Handles CRUD operations for national identity data including:
 * - Autosave functionality with debouncing
 * - Upsert operations (create or update)
 * - Ownership validation
 * - Field-level updates
 */

const nationalIdentitySchema = z.object({
  countryName: z.string().optional(),
  officialName: z.string().optional(),
  governmentType: z.string().optional(),
  motto: z.string().optional(),
  mottoNative: z.string().optional(),
  capitalCity: z.string().optional(),
  largestCity: z.string().optional(),
  demonym: z.string().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  officialLanguages: z.string().optional(),
  nationalLanguage: z.string().optional(),
  nationalAnthem: z.string().optional(),
  nationalReligion: z.string().optional(),
  nationalDay: z.string().optional(),
  callingCode: z.string().optional(),
  internetTLD: z.string().optional(),
  drivingSide: z.string().optional(),
  timeZone: z.string().optional(),
  isoCode: z.string().optional(),
  coordinatesLatitude: z.string().optional(),
  coordinatesLongitude: z.string().optional(),
  emergencyNumber: z.string().optional(),
  postalCodeFormat: z.string().optional(),
  nationalSport: z.string().optional(),
  weekStartDay: z.string().optional(),
});

export const nationalIdentityRouter = createTRPCRouter({
  /**
   * Autosave national identity data with debouncing
   * Used by the builder for real-time persistence
   */
  autosave: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: nationalIdentitySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new Error("You do not have permission to edit this country.");
      }

      try {
        // Filter out undefined values
        const filteredData = Object.fromEntries(
          Object.entries(input.data).filter(([_, value]) => value !== undefined)
        );

        // Upsert the national identity record
        const result = await ctx.db.nationalIdentity.upsert({
          where: { countryId: input.countryId },
          update: {
            ...filteredData,
            updatedAt: new Date(),
          },
          create: {
            countryId: input.countryId,
            ...filteredData,
          },
        });

        return {
          success: true,
          data: result,
          message: "National identity autosaved successfully",
        };
      } catch (error) {
        console.error("[NationalIdentity API] Autosave failed:", error);
        throw new Error(
          `Failed to autosave national identity: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Update national identity data
   * Used by the editor for manual saves
   */
  update: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: nationalIdentitySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new Error("You do not have permission to edit this country.");
      }

      try {
        // Filter out undefined values
        const filteredData = Object.fromEntries(
          Object.entries(input.data).filter(([_, value]) => value !== undefined)
        );

        // Update the national identity record
        const result = await ctx.db.nationalIdentity.update({
          where: { countryId: input.countryId },
          data: {
            ...filteredData,
            updatedAt: new Date(),
          },
        });

        return {
          success: true,
          data: result,
          message: "National identity updated successfully",
        };
      } catch (error) {
        console.error("[NationalIdentity API] Update failed:", error);
        throw new Error(
          `Failed to update national identity: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Get national identity data for a country
   */
  getByCountryId: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new Error("You do not have permission to view this country.");
      }

      try {
        const result = await ctx.db.nationalIdentity.findUnique({
          where: { countryId: input.countryId },
        });

        return result;
      } catch (error) {
        console.error("[NationalIdentity API] Get failed:", error);
        throw new Error(
          `Failed to get national identity: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Create national identity data for a new country
   */
  create: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: nationalIdentitySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new Error("You do not have permission to edit this country.");
      }

      try {
        // Filter out undefined values
        const filteredData = Object.fromEntries(
          Object.entries(input.data).filter(([_, value]) => value !== undefined)
        );

        // Create the national identity record
        const result = await ctx.db.nationalIdentity.create({
          data: {
            countryId: input.countryId,
            ...filteredData,
          },
        });

        return {
          success: true,
          data: result,
          message: "National identity created successfully",
        };
      } catch (error) {
        console.error("[NationalIdentity API] Create failed:", error);
        throw new Error(
          `Failed to create national identity: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),
});
