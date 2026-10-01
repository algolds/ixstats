// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

// ===========================
// Input Validation Schemas
// ===========================

// ===========================
// Security Router
// ===========================

export const securityDefenseRouter = createTRPCRouter({
  // ===========================
  // Defense Budget Endpoints
  // ===========================

  // Owner/privileged only (FORBIDDEN otherwise): budgets are private.
  getDefenseBudget: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        fiscalYear: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const year = input.fiscalYear ?? new Date().getFullYear();

      return ctx.db.defenseBudget.findFirst({
        where: {
          countryId: input.countryId,
          fiscalYear: year,
        },
      });
    }),
});
