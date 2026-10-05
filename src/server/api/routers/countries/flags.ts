import { z } from "zod";
import { createTRPCRouter, cachedStaticProcedure } from "~/server/api/trpc";
import { serverFlagResolver } from "~/lib/flags/server";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { realmScopeInput, realmWhere } from "~/server/api/trpc/realm-scope";

export const flagsProcedures = createTRPCRouter({
  resolveBatch: cachedStaticProcedure
    .input(
      realmScopeInput.extend({
        countryNames: z.array(z.string()),
        fallbackPolicy: z.enum(["commons-only", "fictional-wiki"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result: Record<string, string | null> = {};
      const missingNames: string[] = [];

      // 1. Check database for known country flags. Names are unique per realm only (AT-18).
      if (input.countryNames.length > 0) {
        const dbCountries = await ctx.db.country.findMany({
          where: {
            name: { in: input.countryNames },
            ...(await realmWhere(ctx, input.realm)),
          },
          select: {
            name: true,
            flag: true,
          },
        });

        const dbMap = new Map<string, string | null>();
        for (const c of dbCountries) {
          dbMap.set(c.name.toLowerCase(), c.flag);
          dbMap.set(c.name, c.flag);
        }

        for (const name of input.countryNames) {
          const dbFlag = dbMap.get(name) ?? dbMap.get(name.toLowerCase());
          const normalized = normalizeFlagUrl(dbFlag);
          if (normalized) {
            result[name] = normalized;
          } else {
            missingNames.push(name);
          }
        }
      }

      // 2. Delegate any unlinked or missing country flags to serverFlagResolver
      if (missingNames.length > 0) {
        const map = await serverFlagResolver.resolveBatch(missingNames, {
          fallbackPolicy: input.fallbackPolicy,
        });
        for (const [name, res] of map.entries()) {
          result[name] = res.isPlaceholder ? null : res.flagUrl;
        }
      }

      return result;
    }),
});
