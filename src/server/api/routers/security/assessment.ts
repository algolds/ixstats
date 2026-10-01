// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";
import { redactMilitaryBranchBudget } from "~/lib/country/public-record";

// ===========================
// Input Validation Schemas
// ===========================

// ===========================
// Security Router
// ===========================

export const securityAssessmentRouter = createTRPCRouter({
  // ===========================
  // Security Assessment Endpoints
  // ===========================

  getSecurityAssessment: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      let assessment = await ctx.db.securityAssessment.findUnique({
        where: { countryId: input.countryId },
      });

      if (!assessment) {
        // Create default assessment
        assessment = await ctx.db.securityAssessment.create({
          data: {
            countryId: input.countryId,
            overallSecurityScore: 60,
            securityLevel: "moderate",
            securityTrend: "stable",
            militaryStrength: 60,
            internalStability: 60,
            borderSecurity: 60,
            cybersecurity: 50,
            counterTerrorism: 55,
            militaryReadiness: 65,
            emergencyResponse: 60,
            disasterPreparedness: 55,
          },
        });
      }

      // Get related data
      const [internalStability, borderSecurity, activeThreats, militaryBranches] =
        await Promise.all([
          ctx.db.internalStabilityMetrics.findUnique({
            where: { countryId: input.countryId },
          }),
          ctx.db.borderSecurity.findUnique({
            where: { countryId: input.countryId },
            include: { neighborThreats: true },
          }),
          ctx.db.securityThreat.findMany({
            where: {
              countryId: input.countryId,
              isActive: true,
            },
          }),
          ctx.db.militaryBranch.findMany({
            where: {
              countryId: input.countryId,
              isActive: true,
            },
          }),
        ]);

      // Branch budgets and the resources allocated to threats are the owner's only.
      if (await hasCountryWriteAccess(ctx, input.countryId)) {
        return {
          ...assessment,
          internalStability,
          borderSecurity,
          activeThreats,
          militaryBranches,
        };
      }
      return {
        ...assessment,
        internalStability,
        borderSecurity,
        activeThreats: activeThreats.map(
          ({ resourcesAllocated: _resourcesAllocated, ...threat }) => threat
        ),
        militaryBranches: militaryBranches.map(redactMilitaryBranchBudget),
      };
    }),
});
