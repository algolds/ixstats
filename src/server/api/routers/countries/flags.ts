import { z } from "zod";
import { createTRPCRouter, cachedStaticProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { resolveFlags, getAllCachedFlags } from "~/lib/server-flag-cache";

export const flagsProcedures = createTRPCRouter({
  resolveBatch: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()) }))
    .query(async ({ input }) => {
      return resolveFlags(input.countryNames);
    }),

  getAll: rateLimitedPublicProcedure
    .query(async () => {
      return getAllCachedFlags();
    }),
});
