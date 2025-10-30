/**
 * Custom Types Router
 *
 * Handles custom government types and field values for autocomplete functionality
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const customTypesRouter = createTRPCRouter({
  // ==================== Custom Government Types ====================

  /**
   * Get user's custom government types
   */
  getUserCustomGovernmentTypes: protectedProcedure.query(async ({ ctx }) => {
    const customTypes = await ctx.db.customGovernmentType.findMany({
      where: {
        userId: ctx.user.id,
      },
      orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }],
    });

    return customTypes;
  }),

  /**
   * Create or increment usage count for a custom government type
   */
  upsertCustomGovernmentType: protectedProcedure
    .input(
      z.object({
        customTypeName: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Try to find existing custom type for this user
      const existing = await ctx.db.customGovernmentType.findUnique({
        where: {
          userId_customTypeName: {
            userId: ctx.user.id,
            customTypeName: input.customTypeName,
          },
        },
      });

      if (existing) {
        // Update existing: increment usage count and update lastUsedAt
        return ctx.db.customGovernmentType.update({
          where: {
            id: existing.id,
          },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      } else {
        // Create new custom type
        return ctx.db.customGovernmentType.create({
          data: {
            userId: ctx.user.id,
            customTypeName: input.customTypeName,
            usageCount: 1,
            lastUsedAt: new Date(),
          },
        });
      }
    }),

  // ==================== Custom Field Values (Autocomplete) ====================

  /**
   * Get autocomplete suggestions for a field
   * Returns both global (common) values and user-specific values
   */
  getFieldSuggestions: protectedProcedure
    .input(
      z.object({
        fieldName: z.string(),
        limit: z.number().min(1).max(50).default(10),
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { fieldName, limit, searchQuery } = input;

      // Build where clause
      const where: any = {
        fieldName,
      };

      // Add search filter if provided
      if (searchQuery && searchQuery.length > 0) {
        where.value = {
          contains: searchQuery,
          mode: "insensitive" as const,
        };
      }

      // Get global (common) values
      const globalValues = await ctx.db.customFieldValue.findMany({
        where: {
          ...where,
          isGlobal: true,
        },
        orderBy: {
          usageCount: "desc",
        },
        take: Math.floor(limit / 2), // Half the limit for global values
      });

      // Get user's custom values
      const userValues = await ctx.db.customFieldValue.findMany({
        where: {
          ...where,
          userId: ctx.user.id,
        },
        orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }],
        take: Math.ceil(limit / 2), // Other half for user values
      });

      return {
        global: globalValues,
        user: userValues,
      };
    }),

  /**
   * Save a custom field value (creates or increments usage)
   */
  upsertFieldValue: protectedProcedure
    .input(
      z.object({
        fieldName: z.string().min(1).max(100),
        value: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { fieldName, value } = input;

      // Try to find existing value for this user and field
      const existing = await ctx.db.customFieldValue.findUnique({
        where: {
          fieldName_value_userId: {
            fieldName,
            value,
            userId: ctx.user.id,
          },
        },
      });

      if (existing) {
        // Update existing: increment usage count and update lastUsedAt
        return ctx.db.customFieldValue.update({
          where: {
            id: existing.id,
          },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      } else {
        // Create new custom value
        return ctx.db.customFieldValue.create({
          data: {
            fieldName,
            value,
            userId: ctx.user.id,
            usageCount: 1,
            lastUsedAt: new Date(),
          },
        });
      }
    }),

  /**
   * Get all unique field values for a specific field (for debugging/admin)
   */
  getAllFieldValues: protectedProcedure
    .input(
      z.object({
        fieldName: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.customFieldValue.findMany({
        where: {
          fieldName: input.fieldName,
          OR: [{ isGlobal: true }, { userId: ctx.user.id }],
        },
        orderBy: {
          usageCount: "desc",
        },
      });
    }),
});
