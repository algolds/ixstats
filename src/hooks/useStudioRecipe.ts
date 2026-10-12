"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { newWorldSeed } from "~/lib/worldgen/world-controls";
import {
  cloneParams,
  isNoChange,
  paramsForPreset,
  pickParams,
  type StudioKey,
  type StudioParams,
} from "~/lib/worldgen/studio-fields";
import { findStudioPreset, type StudioPreset } from "~/lib/worldgen/studio-presets";
import {
  loadStudioRecipe,
  saveStudioRecipe,
  type StudioMode,
  type StudioRecipe,
} from "~/lib/worldgen/studio-recipe";
import { FALLBACK_PRESET_SLUG } from "~/lib/worldgen/world-presets";

interface UseStudioRecipeArgs {
  /** The admin's Clerk id: the recipe is kept under it */
  userId: string;
  presets: readonly StudioPreset[];
  /** `?fit=<realm slug>`: start fitted to that realm */
  fitParam: string | null;
}

/** The recipe a fresh start makes: Earth-like (or the first preset there is) and a new seed. */
function freshRecipe(presets: readonly StudioPreset[]): StudioRecipe {
  const preset = findStudioPreset(presets, FALLBACK_PRESET_SLUG);
  return {
    seed: newWorldSeed(),
    preset: preset?.slug ?? FALLBACK_PRESET_SLUG,
    mode: "preset",
    fitRealm: null,
    params: paramsForPreset(preset?.params ?? {}),
  };
}

/** The saved recipe if there is one, with a preset that is gone (archived, deleted) replaced by Earth-like. */
function startRecipe(args: UseStudioRecipeArgs): StudioRecipe {
  const saved = loadStudioRecipe(args.userId);
  const base = saved ?? freshRecipe(args.presets);
  const preset = findStudioPreset(args.presets, base.preset)?.slug ?? base.preset;
  const withPreset = { ...base, preset };
  return args.fitParam ? { ...withPreset, mode: "fit", fitRealm: args.fitParam } : withPreset;
}

interface StudioRecipeApi {
  seed: number;
  /** The parameters now asked for; a new object on every change, the same one while nothing changes */
  params: StudioParams;
  /** The slug of the preset the parameters started from */
  presetSlug: string;
  /** The values of that preset (its draft if it has one): what each control resets to */
  presetParams: StudioParams;
  mode: StudioMode;
  fitRealm: string | null;
  /** Commit a change (a slider released, a switch flipped): the world is made again */
  setParams: (patch: Partial<StudioParams>) => void;
  /** Put `keys` back to the preset's values */
  resetFields: (keys: readonly StudioKey[]) => void;
  setSeed: (seed: number) => void;
  reroll: () => void;
  /** Start from a preset: its values replace the parameters */
  pickPreset: (slug: string) => void;
  setMode: (mode: StudioMode) => void;
  setFitRealm: (slug: string) => void;
}

/**
 * World Studio's recipe: the parameters, the seed, the preset they started from and the source, kept in browser
 * storage under the admin's id. Every change is a commit (the rail commits on release), and a change that leaves the
 * parameters as they were makes no new object, so it asks for no new world.
 */
export function useStudioRecipe(args: UseStudioRecipeArgs): StudioRecipeApi {
  const { userId, presets } = args;
  const [recipe, setRecipe] = useState<StudioRecipe>(() => startRecipe(args));

  useEffect(() => {
    saveStudioRecipe(userId, recipe);
  }, [userId, recipe]);

  const presetParams = useMemo(
    () => paramsForPreset(findStudioPreset(presets, recipe.preset)?.params ?? {}),
    [presets, recipe.preset]
  );

  const setParams = useCallback((patch: Partial<StudioParams>) => {
    setRecipe((current) =>
      isNoChange(current.params, patch)
        ? current
        : { ...current, params: { ...cloneParams(current.params), ...patch } }
    );
  }, []);
  const resetFields = useCallback(
    (keys: readonly StudioKey[]) => setParams(pickParams(presetParams, keys)),
    [setParams, presetParams]
  );
  const setSeed = useCallback(
    (seed: number) => setRecipe((c) => (c.seed === seed ? c : { ...c, seed })),
    []
  );
  const reroll = useCallback(() => setRecipe((c) => ({ ...c, seed: newWorldSeed() })), []);
  const pickPreset = useCallback(
    (slug: string) => {
      const preset = presets.find((candidate) => candidate.slug === slug);
      if (preset)
        setRecipe((c) => ({ ...c, preset: slug, params: paramsForPreset(preset.params) }));
    },
    [presets]
  );
  const setMode = useCallback(
    (mode: StudioMode) => setRecipe((c) => (c.mode === mode ? c : { ...c, mode })),
    []
  );
  const setFitRealm = useCallback(
    (fitRealm: string) => setRecipe((c) => (c.fitRealm === fitRealm ? c : { ...c, fitRealm })),
    []
  );

  return {
    seed: recipe.seed,
    params: recipe.params,
    presetSlug: recipe.preset,
    presetParams,
    mode: recipe.mode,
    fitRealm: recipe.fitRealm,
    setParams,
    resetFields,
    setSeed,
    reroll,
    pickPreset,
    setMode,
    setFitRealm,
  };
}
