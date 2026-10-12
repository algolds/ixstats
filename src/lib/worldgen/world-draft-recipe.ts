/**
 * The World tab's draft recipe: the seed and the controls (the source and the preset among them) kept in browser
 * storage per realm, so reopening the tab restores the controls and regenerates the preview. Nothing is kept on the
 * server. Storage can be missing, full or blocked, and can hold anything a past build or a person put there, so
 * every access is guarded and a recipe that does not parse is as good as none.
 */

import { z } from "zod";
import { clampControls, WORLD_PRESET_IDS, type WorldControls } from "./world-controls";

export interface WorldRecipe {
  seed: number;
  controls: WorldControls;
}

const KEY_PREFIX = "ixworld-world-recipe:";

/** The storage key of a realm's recipe (`scope` is its id, or "sandbox" for the admin studio). */
export const worldRecipeKey = (scope: string) => `${KEY_PREFIX}${scope}`;

const controlsSchema = z.object({
  source: z.enum(["preset", "realm-map"]),
  preset: z.enum(WORLD_PRESET_IDS),
  continents: z.number(),
  landShare: z.number(),
  nations: z.number(),
  temperature: z.number(),
  rainfall: z.number(),
  developmentLevel: z.enum(["developing", "industrial", "modern"]),
  latitudeBand: z.tuple([z.number(), z.number()]),
  sizeSpread: z.number(),
  islands: z.number(),
  polarNorth: z.boolean(),
  polarSouth: z.boolean(),
  hypsometry: z.enum(WORLD_PRESET_IDS),
  rivers: z.number(),
  lakes: z.number(),
  coastComplexity: z.number(),
});

const recipeSchema = z.object({
  seed: z.number().int().min(1).max(2_147_483_647),
  controls: controlsSchema,
});

/** The storage, or null where the browser has none or refuses it (reading the getter can throw). */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The realm's saved recipe, with its numbers pulled inside the slider limits; null when there is none or it is unusable. */
export function loadWorldRecipe(scope: string): WorldRecipe | null {
  try {
    const raw = storage()?.getItem(worldRecipeKey(scope));
    if (!raw) return null;
    const parsed = recipeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { seed: parsed.data.seed, controls: clampControls(parsed.data.controls) };
  } catch {
    return null;
  }
}

export function saveWorldRecipe(scope: string, recipe: WorldRecipe): void {
  try {
    storage()?.setItem(worldRecipeKey(scope), JSON.stringify(recipe));
  } catch {
    // Storage is full or blocked: the recipe lasts as long as the tab does
  }
}

export function clearWorldRecipe(scope: string): void {
  try {
    storage()?.removeItem(worldRecipeKey(scope));
  } catch {
    // Nothing to forget where nothing can be kept
  }
}
