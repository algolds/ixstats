import { z } from "zod";
import { publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { countryRefWhere, pickCountryRef } from "./utils";

export const identityProcedures = {
  getByIdBasic: rateLimitedPublicProcedure
    .input(z.object({ id: z.string(), ...realmScopeInput.shape }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.country.findMany({
        where: countryRefWhere(input.id, await viewerRealmId(ctx, input.realm)),
        take: 3,
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
      const country = pickCountryRef(rows, input.id);

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
};
