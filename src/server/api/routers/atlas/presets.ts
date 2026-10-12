/**
 * Atlas, World presets: drafts, publishing and versions. Site admins only; the logic is in
 * ~/server/modules/maps/world-presets.ts. Founders read the published presets through `realms.map.worldPresets`.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { worldPresetParamsSchema } from "~/lib/maps/import/world-bundle";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  createWorldPreset,
  listWorldPresets,
  listWorldPresetVersions,
  publishWorldPreset,
  renameWorldPreset,
  reorderWorldPresets,
  resetWorldPresetToFactory,
  restoreWorldPresetVersion,
  saveWorldPresetDraft,
  setWorldPresetArchived,
  WorldPresetError,
} from "~/server/modules/maps/world-presets";

function presetError(error: Error): never {
  if (error instanceof WorldPresetError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

const slug = z.string().min(1).max(64);
const name = z.string().trim().min(1).max(60);
const description = z.string().trim().max(300);
const note = z.string().trim().max(200).optional();

export const atlasPresetsRouter = createTRPCRouter({
  /** Every preset in order with its published version and draft; archived ones only with `includeArchived`. */
  list: adminProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) => listWorldPresets(ctx.db, input)),

  /** A new preset, last in order, as an unpublished draft (optionally from a recipe). */
  create: adminProcedure
    .input(
      z.object({
        name,
        description: description.optional(),
        params: worldPresetParamsSchema.optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      createWorldPreset(ctx.db, ctx.user.clerkUserId, input).catch(presetError)
    ),

  /** The name and, when given, the description; the slug stays, since saved recipes hold it. */
  rename: adminProcedure
    .input(z.object({ slug, name, description: description.optional() }))
    .mutation(({ ctx, input }) =>
      renameWorldPreset(ctx.db, input.slug, input.name, input.description).catch(presetError)
    ),

  /** The presets in the given order (archived ones not listed follow). Returns every preset, archived included. */
  reorder: adminProcedure
    .input(z.object({ slugs: z.array(slug).min(1).max(200) }))
    .mutation(({ ctx, input }) => reorderWorldPresets(ctx.db, input.slugs).catch(presetError)),

  /** Archives a preset, or brings it back with `archived: false`. A built-in cannot be archived. */
  archive: adminProcedure
    .input(z.object({ slug, archived: z.boolean().default(true) }))
    .mutation(({ ctx, input }) =>
      setWorldPresetArchived(ctx.db, input.slug, input.archived).catch(presetError)
    ),

  /** Writes the draft: the recipe, without a seed (a `seed` key is rejected). */
  saveDraft: adminProcedure
    .input(z.object({ slug, params: worldPresetParamsSchema, note }))
    .mutation(({ ctx, input }) =>
      saveWorldPresetDraft(
        ctx.db,
        ctx.user.clerkUserId,
        input.slug,
        input.params,
        input.note
      ).catch(presetError)
    ),

  /** Makes the draft the published version founders get. */
  publish: adminProcedure
    .input(z.object({ slug, note }))
    .mutation(({ ctx, input }) =>
      publishWorldPreset(ctx.db, input.slug, input.note).catch(presetError)
    ),

  /** The published versions, newest first. */
  versions: adminProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => listWorldPresetVersions(ctx.db, input.slug).catch(presetError)),

  /** A new draft from a published version. */
  restore: adminProcedure
    .input(z.object({ slug, versionId: z.string().min(1).max(64) }))
    .mutation(({ ctx, input }) =>
      restoreWorldPresetVersion(ctx.db, ctx.user.clerkUserId, input.slug, input.versionId).catch(
        presetError
      )
    ),

  /** A new draft from the factory values in code (the built-ins only). */
  resetToFactory: adminProcedure
    .input(z.object({ slug }))
    .mutation(({ ctx, input }) =>
      resetWorldPresetToFactory(ctx.db, ctx.user.clerkUserId, input.slug).catch(presetError)
    ),
});
