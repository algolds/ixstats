// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * QUICK ACTIONS ROUTER
 *
 * Integrated system for managing:
 * - Cabinet meetings with government official sync
 * - Policy creation with economic effect tracking
 * - Activity scheduling with IxTime integration
 * - Government officials management
 * - Meeting agendas with tagging and categorization
 */

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

export const quickActionsOfficialsRouter = createTRPCRouter({
  // ==========================================================================
  // GOVERNMENT OFFICIALS
  // ==========================================================================

  /**
   * Get all government officials for a country
   */
  getOfficials: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        governmentStructureId: z.string().optional(),
        departmentId: z.string().optional(),
        role: z.string().optional(),
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      // First get the government structure for the country
      let governmentStructureId = input.governmentStructureId;

      if (!governmentStructureId) {
        const govStructure = await ctx.db.governmentStructure.findUnique({
          where: { countryId: input.countryId },
          select: { id: true },
        });
        governmentStructureId = govStructure?.id;
      }

      if (!governmentStructureId) {
        return [];
      }

      const officials = await ctx.db.governmentOfficial.findMany({
        where: {
          governmentStructureId,
          ...(input.departmentId && { departmentId: input.departmentId }),
          ...(input.role && { role: input.role }),
          ...(input.activeOnly && { isActive: true }),
        },
        include: {
          department: {
            select: {
              name: true,
              shortName: true,
              category: true,
            },
          },
        },
        orderBy: [{ priority: "desc" }, { appointedDate: "desc" }],
      });

      return officials.map((official) => ({
        ...official,
        responsibilities: official.responsibilities ? JSON.parse(official.responsibilities) : [],
      }));
    }),
});
