import { z } from "zod";
import { publicProcedure, protectedProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { normalizeFlagUrl } from "~/lib/flags/unified-flag-service";
import { isSystemOwner } from "~/lib/auth";
import { fetchWikiIntro } from "./utils";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";

export const identityProcedures = {
  getByIdBasic: rateLimitedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findFirst({
        where: {
          OR: [{ id: input.id }, { slug: input.id.toLowerCase() }, { name: input.id }],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          continent: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          landArea: true,
          populationDensity: true,
          geometry: true,
          centroid: true,
        },
      });

      if (!country) {
        return null;
      }

      return {
        id: country.id,
        name: country.name,
        slug: country.slug,
        flagUrl: normalizeFlagUrl(country.flag),
        continent: country.continent,
        currentPopulation: country.currentPopulation,
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentTotalGdp: country.currentTotalGdp,
        landArea: country.landArea,
        populationDensity: country.populationDensity,
        geometry: country.geometry,
        centroid: country.centroid,
      };
    }),

  // Lightweight check: is this country linked to a map feature (i.e. on the map)?
  // A country is "on the map" once geo-linking sets its centroid (see getCountryGeoProfile).
  // Selects only the small centroid array — never the heavy geometry blob.
  getMapLinkStatus: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, centroid: true },
      });
      return { isMapped: !!country?.centroid };
    }),

  updateNationalIdentity: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        officialName: z.string().optional(),
        motto: z.string().optional(),
        nationalAnthem: z.string().optional(),
        capitalCity: z.string().optional(),
        officialLanguages: z.string().optional(),
        currency: z.string().optional(),
        currencySymbol: z.string().optional(),
        demonym: z.string().optional(),
        governmentType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...updates } = input;

      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (
        !isSystemOwner(ctx.auth.userId) &&
        (!userProfile || userProfile.countryId !== countryId)
      ) {
        throw new Error("You do not have permission to edit this country.");
      }

      try {
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        const nationalIdentity = await ctx.db.nationalIdentity.upsert({
          where: { countryId },
          create: {
            countryId,
            ...filteredUpdates,
          },
          update: {
            ...filteredUpdates,
            updatedAt: new Date(),
          },
        });

        await invalidateCache(["countries."]);
        clearLayerCache("political");

        return nationalIdentity;
      } catch (error) {
        console.error("[Countries API] Failed to update national identity:", error);
        throw new Error(
          `Failed to update national identity: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  getWikiIntro: publicProcedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
    return fetchWikiIntro(input.name);
  }),
};
