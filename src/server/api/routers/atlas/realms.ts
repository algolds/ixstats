/** Atlas, Realm map overview, one realm's figures, refresh caches (Task 6). Site admins only. */
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { atlasRealmId, realmOverview } from "~/server/modules/maps/atlas-overview";
import { latestAtlasImport } from "~/server/modules/maps/atlas-jobs";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { atlasError } from "./errors";

const realm = z.string().trim().min(1).max(64);

export const atlasRealmsRouter = createTRPCRouter({
  /** Every realm's figures and flags, in a fixed number of queries. */
  overview: adminProcedure.query(({ ctx }) => realmOverview(ctx.db)),

  /** One realm (id or slug): its figures, feature counts per layer and its latest import. Its jobs are `jobs.list`. */
  get: adminProcedure.input(z.object({ realm })).query(async ({ ctx, input }) => {
    const { realms, partial, layerCounts } = await realmOverview(ctx.db, {
      match: input.realm,
    }).catch(atlasError);
    const row = realms[0]!;
    return {
      realm: row,
      partial,
      layerCounts: layerCounts[row.id] ?? {},
      latestImport: await latestAtlasImport(ctx.db, row.id),
    };
  }),

  /** Drop the realm's map caches and bump its map version; answers the new version. */
  refresh: adminProcedure.input(z.object({ realm })).mutation(async ({ ctx, input }) => {
    const realmId = await atlasRealmId(ctx.db, input.realm);
    if (!realmId) throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });
    return { mapVersion: await invalidateRealmMap(ctx.db, realmId) };
  }),
});
