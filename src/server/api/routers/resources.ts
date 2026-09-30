/**
 * Resources Router — Geographic resource management.
 *
 * Manages procedurally generated resources (fisheries, forests, minerals,
 * oil/gas, freshwater, agricultural) derived from country geography.
 * Resources are placed based on climate zones, elevation, and hydrology.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const resourcesRouter = createTRPCRouter({
  /** Get all resources for a country */
  getCountryResources: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.geographicResource.findMany({
        where: { countryId: input.countryId },
        orderBy: { resourceType: "asc" },
      });
    }),
});
