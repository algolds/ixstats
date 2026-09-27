// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

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

  getDefenseBudget: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        fiscalYear: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const year = input.fiscalYear ?? new Date().getFullYear();

      return ctx.db.defenseBudget.findFirst({
        where: {
          countryId: input.countryId,
          fiscalYear: year,
        },
      });
    }),
});
