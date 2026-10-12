/**
 * The World tab's draft recipe: the seed and the controls (the source and the preset among them) kept in browser
 * storage per realm, so reopening the tab restores the controls and regenerates the preview. Nothing is kept on the
 * server. Storage can be missing, full or blocked, and can hold anything a past build or a person put there, so
 * every access is guarded and a recipe that does not parse is as good as none.
 */

import { z } from "zod";
import { ATLAS_ENGINE_VERSION } from "~/lib/buildVersion";
import { clampControls, type WorldControls } from "./world-controls";

export interface WorldRecipe {
  seed: number;
  controls: WorldControls;
}

const KEY_PREFIX = "ixworld-world-recipe:";

/**
 * The shape of a stored recipe. A recipe also carries the Atlas engine it was made for: another engine makes another
 * world from the same seed. Version 2 names its preset and elevation profile by the preset's slug, which may be any
 * published preset; version 1 named one of the three built-ins by id, and those ids are the built-ins' slugs, so a
 * version 1 recipe is read as it stands and saved as version 2. A slug no published preset has is Earth-like once the
 * presets are known (`withKnownPresets`).
 */
export const WORLD_RECIPE_VERSION = 2;
const LEGACY_RECIPE_VERSION = 1;

/** The storage key of a realm's recipe (`scope` is its id, or "sandbox" for the admin studio). */
export const worldRecipeKey = (scope: string) => `${KEY_PREFIX}${scope}`;

const slug = z.string().min(1).max(64);

const controlsSchema = z.object({
  source: z.enum(["preset", "realm-map"]),
  preset: slug,
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
  hypsometry: slug,
  rivers: z.number(),
  lakes: z.number(),
  coastComplexity: z.number(),
});

const recipeSchema = z.object({
  version: z.union([z.literal(WORLD_RECIPE_VERSION), z.literal(LEGACY_RECIPE_VERSION)]),
  engine: z.literal(ATLAS_ENGINE_VERSION),
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

/**
 * The realm's saved recipe, with its numbers pulled inside the slider limits; null when there is none. A recipe
 * that is corrupt, from before versions or made for another format or engine is dropped, not kept to fail again.
 */
export function loadWorldRecipe(scope: string): WorldRecipe | null {
  try {
    const raw = storage()?.getItem(worldRecipeKey(scope));
    if (!raw) return null;
    const parsed = parse(raw);
    if (!parsed) clearWorldRecipe(scope);
    return parsed;
  } catch {
    return null;
  }
}

function parse(raw: string): WorldRecipe | null {
  try {
    const result = recipeSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    return { seed: result.data.seed, controls: clampControls(result.data.controls) };
  } catch {
    return null;
  }
}

export function saveWorldRecipe(scope: string, recipe: WorldRecipe): void {
  try {
    const stored = { version: WORLD_RECIPE_VERSION, engine: ATLAS_ENGINE_VERSION, ...recipe };
    storage()?.setItem(worldRecipeKey(scope), JSON.stringify(stored));
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

// The job in flight

/**
 * The world check or apply that was running when the tab last looked, kept per realm so a tab that was left or
 * reloaded mid-apply can pick the job up again: it is polled to its end and the draft is taken off the map once the
 * world is applied. Kept apart from the recipe (saving a recipe must not lose it, and discarding a draft does not
 * end a job).
 */
export interface WorldJobRef {
  /** The check (the dry run) that was queued for the draft */
  checkJobId: string;
  /** The apply of that check, once confirmed */
  applyJobId: string | null;
  /** `draftKey` of the world that was sent: tells whether the draft on the map is that world */
  draftKey: string;
}

const JOB_KEY_PREFIX = "ixworld-world-job:";

export const worldJobKey = (scope: string) => `${JOB_KEY_PREFIX}${scope}`;

const jobId = z.string().min(1).max(64);
const jobSchema = z.object({
  checkJobId: jobId,
  applyJobId: jobId.nullable(),
  draftKey: z.string().max(10_000),
});

/** The realm's job in flight; null when there is none, or what is stored is not a job (it is dropped). */
export function loadWorldJob(scope: string): WorldJobRef | null {
  try {
    const raw = storage()?.getItem(worldJobKey(scope));
    if (!raw) return null;
    const result = jobSchema.safeParse(JSON.parse(raw));
    if (result.success) return result.data;
    clearWorldJob(scope);
    return null;
  } catch {
    clearWorldJob(scope);
    return null;
  }
}

export function saveWorldJob(scope: string, job: WorldJobRef): void {
  try {
    storage()?.setItem(worldJobKey(scope), JSON.stringify(job));
  } catch {
    // Storage is full or blocked: the job is followed for as long as the tab stays on the World tab
  }
}

export function clearWorldJob(scope: string): void {
  try {
    storage()?.removeItem(worldJobKey(scope));
  } catch {
    // Nothing to forget where nothing can be kept
  }
}
