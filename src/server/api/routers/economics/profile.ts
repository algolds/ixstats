// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { notificationHooks } from "~/lib/notifications/hooks";

const economicsProfileRouter = createTRPCRouter({
  // ==================== ECONOMIC PROFILE ====================
  // Schema fields: gdpGrowthVolatility, economicComplexity, innovationIndex, competitivenessRank,
  // easeOfDoingBusiness, corruptionIndex, sectorBreakdown, exportsGDPPercent, importsGDPPercent, tradeBalance

  updateEconomicProfile: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        gdpGrowthVolatility: z.number().optional(),
        economicComplexity: z.number().optional(),
        innovationIndex: z.number().optional(),
        competitivenessRank: z.number().int().optional(),
        easeOfDoingBusiness: z.number().int().optional(),
        corruptionIndex: z.number().optional(),
        sectorBreakdown: z.string().optional(),
        exportsGDPPercent: z.number().optional(),
        importsGDPPercent: z.number().optional(),
        tradeBalance: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...data } = input;

      await assertCountryWriteAccess(ctx, countryId);

      // Get previous values for comparison
      const previous = await ctx.db.economicProfile.findUnique({
        where: { countryId },
      });

      const result = await ctx.db.economicProfile.upsert({
        where: { countryId },
        update: data,
        create: { countryId, ...data },
      });

      // Notify about economic vitality changes
      try {
        if (
          previous &&
          data.economicComplexity !== undefined &&
          previous.economicComplexity !== null
        ) {
          const change = Math.abs(data.economicComplexity - previous.economicComplexity);
          if (change > 10) {
            await notificationHooks.onVitalityScoreChange({
              countryId,
              userId: ctx.user?.id,
              dimension: "economic",
              currentScore: data.economicComplexity,
              previousScore: previous.economicComplexity,
              threshold: 10,
            });
          }
        }
      } catch (error) {
        console.error("[Economics] Failed to send notification:", error);
      }

      return result;
    }),
});

export { economicsProfileRouter };
