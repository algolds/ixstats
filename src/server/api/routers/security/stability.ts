// Internal stability. Security events are gone: nothing ever wrote SecurityEvent rows, and the
// threats a nation faces are derived on read from conflicts, hostile actions and crises
// (`~/lib/military/threat-picture`).

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { computeInternalStability } from "~/lib/statecraft/stability-store";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";

// ===========================
// Input Validation Schemas
// ===========================

// ===========================
// Security Router
// ===========================

export const securityStabilityRouter = createTRPCRouter({
  // ===========================
  // Internal Stability Endpoints
  // ===========================

  // Crime and stability metrics are the owner's only: others get `metrics: null`.
  getInternalStability: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // The formula plus the stored row's event (issue/directive) deltas, computed without
      // writing (MC-13); the stat-progression job and the issue path persist it.
      const metrics = await computeInternalStability(ctx.db, input.countryId);

      if (!metrics) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      if (!(await hasCountryWriteAccess(ctx, input.countryId))) return { metrics: null };
      return { metrics };
    }),
});
