/** Atlas, World Studio: realm measures for calibration, a new realm from a world (Task 5). Site admins only. */
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { measureRealm } from "~/server/modules/maps/realm-calibration";

export const atlasStudioRouter = createTRPCRouter({
  /** A stored realm's land, relief, climate, nations and coastline for the Calibration tab; cached per map version. */
  realmMeasures: adminProcedure
    .input(z.object({ realm: z.string().trim().min(1).max(64) }))
    .query(({ ctx, input }) => measureRealm(ctx.db, input.realm)),
});
