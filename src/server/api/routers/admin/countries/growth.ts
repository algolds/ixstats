/** Admin country growth: one country's growth fields, validated and audited (logic in ~/server/modules/countries). */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/cache";
import { countryGrowthSchema } from "~/lib/countries/country-growth";
import { updateCountryGrowth } from "~/server/modules/countries/countries.growth";

export const adminCountriesGrowthRouter = createTRPCRouter({
  /** Set any of populationGrowthRate, adjustedGdpGrowth, maxGdpGrowthRate and localGrowthFactor. */
  updateCountryGrowth: adminProcedure
    .input(z.object({ countryId: z.string().min(1).max(100), growth: countryGrowthSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await updateCountryGrowth(ctx.db, ctx.user, input);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      if (result.updated) await invalidateCache(["countries."]);
      return result;
    }),
});
