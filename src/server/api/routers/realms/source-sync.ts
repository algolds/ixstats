/**
 * realms.sourceSync: a realm's source sync settings, dry runs, applied runs and run history (site admins and
 * the realm's founder), plus the public attribution line its map shows. Logic lives in
 * ~/server/modules/realms/realms.source-sync.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { nationOverrideSchema, organizationOverrideSchema, sourceKeySchema } from "~/lib/realms/sources/config";
import {
  getSourceSyncView,
  LIVE_RUN_DEPS,
  loadManagedRealm,
  loadSourcePreset,
  loadSourceSyncConfig,
  realmMapAttribution,
  runSourceSync,
  saveSourceSyncConfig,
  SourceSyncError,
  sourceSyncConfigInput,
  startSourceSyncApply,
} from "~/server/modules/realms/realms.source-sync";

function syncError(error: Error): never {
  if (error instanceof SourceSyncError) throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

const slug = z.string().min(1).max(100);

export const realmSourceSyncRouter = createTRPCRouter({
  /** The realm's sync config (null before one is saved), its last runs, and its nations for manual matches. */
  get: protectedProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => getSourceSyncView(ctx.db, ctx.user, input.slug).catch(syncError)),

  save: rateLimitedMutationProcedure
    .input(z.object({ slug, config: sourceSyncConfigInput }))
    .mutation(({ ctx, input }) =>
      saveSourceSyncConfig(ctx.db, ctx.user, input.slug, input.config).catch(syncError)
    ),

  /** Fill the realm's config from a preset; afterwards the config is the only source of truth. */
  loadPreset: rateLimitedMutationProcedure
    .input(z.object({ slug, presetId: z.string().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const realm = await loadManagedRealm(ctx.db, ctx.user, input.slug).catch(syncError);
      return loadSourcePreset(ctx.db, ctx.user, realm.id, input.presetId).catch(syncError);
    }),

  /**
   * One staff decision for a source nation or organisation, from the dry run's lists: exclude it, match it to a
   * country, pin fields, or (null) clear the decision. Other decisions are kept.
   */
  setOverride: rateLimitedMutationProcedure
    .input(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("nation"), slug, key: sourceKeySchema, override: nationOverrideSchema.nullable() }),
        z.object({
          kind: z.literal("organization"),
          slug,
          key: sourceKeySchema,
          override: organizationOverrideSchema.nullable(),
        }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      const realm = await loadManagedRealm(ctx.db, ctx.user, input.slug).catch(syncError);
      const config = await loadSourceSyncConfig(ctx.db, realm.id);
      if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: "Save a source first" });
      if (input.kind === "nation" && input.override?.countryId) {
        const country = await ctx.db.country.findUnique({
          where: { id: input.override.countryId },
          select: { realmId: true },
        });
        if (country?.realmId !== realm.id)
          throw new TRPCError({ code: "BAD_REQUEST", message: "That nation is not in this realm" });
      }
      const group = input.kind === "nation" ? "nations" : "organizations";
      const next = { ...config.overrides[group] } as Record<string, unknown>;
      if (input.override) next[input.key] = input.override;
      else delete next[input.key];
      await ctx.db.realmSourceSync.update({
        where: { realmId: realm.id },
        data: { overrides: { ...config.overrides, [group]: next }, updatedBy: ctx.user.clerkUserId },
      });
      return { success: true };
    }),

  /** Read the source and store the diff a run would make, without writing anything else. */
  dryRun: rateLimitedMutationProcedure.input(z.object({ slug })).mutation(async ({ ctx, input }) => {
    const realm = await loadManagedRealm(ctx.db, ctx.user, input.slug).catch(syncError);
    if (!(await loadSourceSyncConfig(ctx.db, realm.id)))
      throw new TRPCError({ code: "BAD_REQUEST", message: "Save a source first" });
    return runSourceSync(
      ctx.db,
      { realmId: realm.id, dryRun: true, triggeredBy: ctx.user.clerkUserId },
      LIVE_RUN_DEPS
    );
  }),

  /** Start an applied run in the background; follow it in the run history. */
  startApply: rateLimitedMutationProcedure.input(z.object({ slug })).mutation(async ({ ctx, input }) => {
    const realm = await loadManagedRealm(ctx.db, ctx.user, input.slug).catch(syncError);
    return startSourceSyncApply(ctx.db, realm.id, ctx.user.clerkUserId, LIVE_RUN_DEPS).catch(syncError);
  }),

  /** The credit line the realm's map shows for its borders (public), or null. */
  mapAttribution: publicProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => realmMapAttribution(ctx.db, input.slug)),
});
