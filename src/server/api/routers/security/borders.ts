// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import type { BorderSecurity, NeighborThreatAssessment } from "@prisma/client";

/** The BorderSecurity schema defaults, for a country with no row yet (never persisted). */
function defaultBorderSecurity(
  countryId: string
): BorderSecurity & { neighborThreats: NeighborThreatAssessment[] } {
  const now = new Date();
  return {
    id: `default-${countryId}`,
    countryId,
    overallSecurityLevel: 70,
    securityStatus: "moderate",
    borderIntegrity: 85,
    borderLength: null,
    landBorders: 0,
    maritimeBorders: 0,
    borderAgents: 0,
    checkpoints: 0,
    surveillanceSystems: 0,
    interceptionRate: 60,
    processingEfficiency: 70,
    illegalCrossings: 0,
    smugglingActivity: 20,
    traffickingRisk: 15,
    refugeePresure: 10,
    technologyLevel: 50,
    infrastructureQuality: 60,
    lastAssessed: now,
    createdAt: now,
    updatedAt: now,
    neighborThreats: [],
  };
}

// ===========================
// Input Validation Schemas
// ===========================

// ===========================
// Security Router
// ===========================

export const securityBordersRouter = createTRPCRouter({
  // ===========================
  // Border Security Endpoints
  // ===========================

  getBorderSecurity: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const borderSecurity = await ctx.db.borderSecurity.findUnique({
        where: { countryId: input.countryId },
        include: {
          neighborThreats: true,
        },
      });
      if (borderSecurity) return borderSecurity;

      // No row yet: show the schema defaults without creating one (a query must not write,
      // MC-13). Nothing records border data yet, so the
      // defaults are what the created row held.
      return defaultBorderSecurity(input.countryId);
    }),
});
