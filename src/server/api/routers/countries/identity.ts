import { z } from "zod";
import { publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { fetchWikiIntro } from "./utils";

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

  getWikiIntro: publicProcedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
    return fetchWikiIntro(input.name);
  }),
};
