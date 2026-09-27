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

export const securityBordersRouter = createTRPCRouter({
  // ===========================
  // Border Security Endpoints
  // ===========================

  getBorderSecurity: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      let borderSecurity = await ctx.db.borderSecurity.findUnique({
        where: { countryId: input.countryId },
        include: {
          neighborThreats: true,
        },
      });

      if (!borderSecurity) {
        borderSecurity = await ctx.db.borderSecurity.create({
          data: {
            countryId: input.countryId,
          },
          include: {
            neighborThreats: true,
          },
        });
      }

      return borderSecurity;
    }),
});
