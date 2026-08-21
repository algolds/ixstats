import { z } from "zod";
import {
  createTRPCRouter,
  cachedStaticProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { serverFlagResolver } from "~/lib/flags/server";

export const flagsProcedures = createTRPCRouter({
  resolveBatch: cachedStaticProcedure
    .input(
      z.object({
        countryNames: z.array(z.string()),
        fallbackPolicy: z.enum(["commons-only", "fictional-wiki"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const map = await serverFlagResolver.resolveBatch(input.countryNames, {
        fallbackPolicy: input.fallbackPolicy,
      });
      const result: Record<string, string | null> = {};
      for (const [name, res] of map.entries()) {
        result[name] = res.isPlaceholder ? null : res.flagUrl;
      }
      return result;
    }),

  getAll: rateLimitedPublicProcedure.query(async () => {
    return {};
  }),
});
