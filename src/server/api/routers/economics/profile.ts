// src/server/api/routers/economics.ts
// FIXED: Core economic data management router matching Prisma schema exactly
// SECURITY: All mutation endpoints validate country ownership

import { z } from "zod";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { notificationHooks } from "~/lib/notifications/hooks";

const score = z.number().min(0).max(100);
const rank = z.number().int().min(1).max(1000);
const tradeShare = z.number().min(0).max(500);

const economicsProfileRouter = createTRPCRouter({
  // ==================== ECONOMIC PROFILE ====================
  // Schema fields: gdpGrowthVolatility, economicComplexity, innovationIndex, competitivenessRank,
  // easeOfDoingBusiness, corruptionIndex, sectorBreakdown, exportsGDPPercent, importsGDPPercent, tradeBalance

  updateEconomicProfile: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        // Scores are 0-100 and ranks 1-1000; trade shares may pass 100% of GDP (entrepots) but not 500%.
        gdpGrowthVolatility: score.optional(),
        economicComplexity: score.optional(),
        innovationIndex: score.optional(),
        competitivenessRank: rank.optional(),
        easeOfDoingBusiness: rank.optional(),
        corruptionIndex: score.optional(),
        sectorBreakdown: z.string().max(10_000).optional(),
        exportsGDPPercent: tradeShare.optional(),
        importsGDPPercent: tradeShare.optional(),
        tradeBalance: z.number().min(-1e17).max(1e17).optional(),
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
