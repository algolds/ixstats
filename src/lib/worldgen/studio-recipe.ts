/**
 * World Studio's draft recipe: the seed, the parameters, the chosen preset and the source, kept in browser storage per
 * admin (`studio:<clerkUserId>`) so reopening the Studio brings the work back. Nothing is kept on the server. Storage
 * can be missing, full or blocked, and can hold anything a past build or a person put there, so every access is
 * guarded and a recipe that does not parse, or was made by another format or engine, is dropped.
 */

import { z } from "zod";
import { ATLAS_ENGINE_VERSION } from "~/lib/buildVersion";
import { WORLD_PARAM_SHAPE } from "~/lib/maps/import/world-bundle";
import type { StudioParams } from "./studio-fields";

export const STUDIO_RECIPE_VERSION = 1;

/** Where the world comes from: a preset's parameters alone, or around a realm's own map. */
export type StudioMode = "preset" | "fit";

export interface StudioRecipe {
  seed: number;
  /** Slug of the preset the parameters started from (what "reset" goes back to) */
  preset: string;
  mode: StudioMode;
  /** Slug of the realm a world is fitted to; null until one is chosen */
  fitRealm: string | null;
  params: StudioParams;
}

export const studioRecipeKey = (userId: string) => `studio:${userId}`;

const slug = z.string().min(1).max(64);

const paramsSchema: z.ZodType<StudioParams> = z.object(WORLD_PARAM_SHAPE).omit({ seed: true });

const recipeSchema = z.object({
  version: z.literal(STUDIO_RECIPE_VERSION),
  engine: z.literal(ATLAS_ENGINE_VERSION),
  seed: z.number().int().min(1).max(2_147_483_647),
  preset: slug,
  mode: z.enum(["preset", "fit"]),
  fitRealm: slug.nullable(),
  params: paramsSchema,
});

/** The storage, or null where the browser has none or refuses it (reading the getter can throw). */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The admin's saved recipe, or null when there is none; one that cannot be used is removed. */
export function loadStudioRecipe(userId: string): StudioRecipe | null {
  try {
    const raw = storage()?.getItem(studioRecipeKey(userId));
    if (!raw) return null;
    const parsed = parse(raw);
    if (!parsed) clearStudioRecipe(userId);
    return parsed;
  } catch {
    return null;
  }
}

function parse(raw: string): StudioRecipe | null {
  try {
    const result = recipeSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    const { seed, preset, mode, fitRealm, params } = result.data;
    return { seed, preset, mode, fitRealm, params };
  } catch {
    return null;
  }
}

export function saveStudioRecipe(userId: string, recipe: StudioRecipe): void {
  try {
    const stored = { version: STUDIO_RECIPE_VERSION, engine: ATLAS_ENGINE_VERSION, ...recipe };
    storage()?.setItem(studioRecipeKey(userId), JSON.stringify(stored));
  } catch {
    // Storage is full or blocked: the recipe lasts as long as the tab does
  }
}

export function clearStudioRecipe(userId: string): void {
  try {
    storage()?.removeItem(studioRecipeKey(userId));
  } catch {
    // Nothing to forget where nothing can be kept
  }
}
