/** Atlas, World Studio: realm measures for calibration, applying a world to any realm, a new realm from one. Site admins only. */
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { atlasError } from "./errors";
import { isIxnaySlug } from "~/lib/realms/realm-ids";
import { REALM_SLUG_PATTERN } from "~/lib/realms/realm-slug";
import { measureRealm } from "~/server/modules/maps/realm-calibration";
import { adminWorldStatus } from "~/server/modules/maps/world-import.status";
import { createRealmFromWorld } from "~/server/modules/realms/realms.create-from-world";

const realmRef = z.string().trim().min(1).max(64);

export const atlasStudioRouter = createTRPCRouter({
  /** A stored realm's land, relief, climate, nations and coastline for the Calibration tab; cached per map version. */
  realmMeasures: adminProcedure
    .input(z.object({ realm: realmRef }))
    .query(({ ctx, input }) => measureRealm(ctx.db, input.realm)),

  /**
   * `realms.map.worldStatus` for a site admin, open to Ixnay: the realm's status, claim counts and whether its relief
   * step failed. Ixnay, and any realm with `layers: true` (the admin layer choice), is never locked by claims, since
   * only physical layers are written; an archived realm is.
   */
  applyStatus: adminProcedure
    .input(z.object({ realm: realmRef, layers: z.boolean().optional() }))
    .query(({ ctx, input }) =>
      adminWorldStatus(ctx.db, input.realm, { layers: input.layers }).catch(atlasError)
    ),

  /**
   * A draft, unlisted realm owned by the calling admin, with its forum categories. The client then uploads the world
   * and checks and applies it onto the realm (a preset source); the admin hands the realm over later.
   */
  createRealm: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        slug: z
          .string()
          .regex(REALM_SLUG_PATTERN, "2-40 lower-case letters, digits or hyphens (not mine)")
          .refine((slug) => !isIxnaySlug(slug), "That slug names Ixnay"),
      })
    )
    .mutation(({ ctx, input }) => createRealmFromWorld(ctx.db, ctx.user, input).catch(atlasError)),
});
