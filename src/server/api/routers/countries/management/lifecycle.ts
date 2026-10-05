import { z } from "zod";
import { rateLimitedMutationProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";

import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { evaluateThresholds } from "~/server/shared/intelligence-alert-thresholds";

export const managementLifecycleProcedures = {
  // General update mutation for country fields (used by editor)
  update: rateLimitedMutationProcedure
    .input(
      z
        .object({
          id: z.string(),
        })
        .passthrough()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      await assertCountryWriteAccess(ctx, id);

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      try {
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        const updatedCountry = await ctx.db.country.update({
          where: { id },
          data: {
            ...filteredUpdates,
            updatedAt: new Date(),
          },
        });

        await invalidateCache(["countries."]);
        clearLayerCache("political");

        let targetUserId = userProfile?.id;
        if (!targetUserId) {
          const countryOwner = await ctx.db.user.findFirst({
            where: { ownedCountries: { some: { id } } },
          });
          targetUserId = countryOwner?.id;
        }

        if (targetUserId) {
          try {
            await evaluateThresholds(ctx.db, id, targetUserId);
          } catch (e) {
            console.error("[Countries API] Error evaluating thresholds on country update:", e);
          }
        }

        return updatedCountry;
      } catch (error) {
        console.error("[Countries API] Failed to update country:", error);
        throw new Error(
          `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`,
          { cause: error }
        );
      }
    }),
};
