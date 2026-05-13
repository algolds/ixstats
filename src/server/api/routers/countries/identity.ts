import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { fetchWikiIntro } from "./utils";

export const identityProcedures = {
  getByIdBasic: rateLimitedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findFirst({
        where: {
          OR: [
            { id: input.id },
            { slug: input.id.toLowerCase() },
            { name: input.id },
          ],
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
        },
      });

      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Country with identifier ${input.id} not found`,
        });
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
      };
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

        return nationalIdentity;
      } catch (error) {
        console.error("[Countries API] Failed to update national identity:", error);
        throw new Error(
          `Failed to update national identity: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  getWikiIntro: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return fetchWikiIntro(input.name);
    }),
};
