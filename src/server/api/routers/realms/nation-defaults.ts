/**
 * realms.nationDefaults: a realm's nation growth table and applying it to its unclaimed nations (site admins,
 * /admin/realms "Nations"). Logic lives in ~/server/modules/realms/realms.nation-defaults.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/cache";
import { nationGrowthTableSchema } from "~/lib/realms/nation-growth-defaults";
import {
  applyNationDefaults,
  getNationDefaults,
  previewNationDefaults,
  saveNationDefaults,
} from "~/server/modules/realms/realms.nation-defaults";
import { RealmRegionError } from "~/server/modules/realms/realms.region";

function defaultsError(error: Error): never {
  if (error instanceof RealmRegionError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

const realmId = z.string().min(1).max(100);

export const realmNationDefaultsRouter = createTRPCRouter({
  /** The realm's per-tier table, whether it is its own, IxStats's defaults, and its nation counts. */
  get: adminProcedure
    .input(z.object({ realmId }))
    .query(({ ctx, input }) =>
      getNationDefaults(ctx.db, ctx.user, input.realmId).catch(defaultsError)
    ),

  /** Store the realm's table; `null` returns it to IxStats's defaults. Audited. */
  save: adminProcedure
    .input(z.object({ realmId, table: nationGrowthTableSchema.nullable() }))
    .mutation(({ ctx, input }) => saveNationDefaults(ctx.db, ctx.user, input).catch(defaultsError)),

  /** Dry run: what applying the saved table would change on the realm's unclaimed nations. */
  preview: adminProcedure
    .input(z.object({ realmId }))
    .mutation(({ ctx, input }) =>
      previewNationDefaults(ctx.db, ctx.user, input.realmId).catch(defaultsError)
    ),

  /** Write the saved table to the realm's unclaimed nations (never a claimed one). Audited. */
  applyToUnclaimed: adminProcedure.input(z.object({ realmId })).mutation(async ({ ctx, input }) => {
    const result = await applyNationDefaults(ctx.db, ctx.user, input.realmId).catch(defaultsError);
    await invalidateCache(["countries."]);
    return result;
  }),
});
