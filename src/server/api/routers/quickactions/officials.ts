// src/server/api/routers/quickactions.ts
// Comprehensive Quick Actions tRPC router with government integration, IxTime sync, and economic system integration

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";
import { resolveStructureCountryId } from "~/server/shared/country-resource-owner";

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
   * A country's government officials (a bounded page). Contact details are the owning
   * government's: email and phone are null for everyone else.
   */
  getOfficials: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        governmentStructureId: z.string().optional(),
        departmentId: z.string().optional(),
        role: z.string().optional(),
        activeOnly: z.boolean().default(true),
        limit: z.number().int().min(1).max(200).default(100),
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
        take: input.limit,
      });

      // Owner access is judged on the structure's own country, not the countryId the caller named.
      const ownerCountryId = input.governmentStructureId
        ? await resolveStructureCountryId(ctx.db, governmentStructureId)
        : input.countryId;
      const isOwner = !!ownerCountryId && (await hasCountryWriteAccess(ctx, ownerCountryId));

      return officials.map((official) => ({
        ...official,
        ...(isOwner ? {} : { email: null, phone: null }),
        responsibilities: official.responsibilities ? JSON.parse(official.responsibilities) : [],
      }));
    }),
});
