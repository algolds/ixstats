"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldPreset } from "~/lib/worldgen/v2/config";
import type { LandMaskLayers } from "~/lib/worldgen/land-mask";
import {
  clampControls,
  controlsForPreset,
  newWorldSeed,
  paramsFromControls,
  type WorldControls,
  type WorldSource,
} from "~/lib/worldgen/world-controls";
import {
  clearWorldRecipe,
  loadWorldRecipe,
  saveWorldRecipe,
} from "~/lib/worldgen/world-draft-recipe";
import type { WorldGenerator } from "~/hooks/useWorldGenerator";
import { useLatest } from "./useLatest";

interface UseWorldRecipeArgs {
  /** Where the recipe is kept: the realm's id, or the sandbox's */
  scope: string;
  /** The realm has borders to build on (a political layer) */
  hasRealmMap: boolean;
  /** Its layers have loaded, so a world can be fitted to them */
  realmMapReady: boolean;
  realmMapLayers: LandMaskLayers;
  generator: Pick<WorldGenerator, "generate" | "reset">;
}

/**
 * Runs `run` once `ready`, and again after a remount: the generator is disposed when the tab unmounts (and in
 * Strict Mode's trial unmount), so a run it was given must be asked for again.
 */
function useRunOnce(ready: boolean, run: () => void) {
  const ran = useRef(false);
  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    run();
  }, [ready, run]);
  useEffect(
    () => () => {
      ran.current = false;
    },
    []
  );
}

/**
 * The World tab's recipe: the controls and the seed, the draft kept in browser storage per realm, and the calls
 * that ask the generator for a world. A slider reports `setLive` while it is dragged and `apply` when it is
 * released; only `apply` (and the seed, source and preset changes) generate. A recipe found in storage is
 * generated again as soon as the realm's map is ready, so reopening the tab brings the preview back.
 */
export function useWorldRecipe({
  scope,
  hasRealmMap,
  realmMapReady,
  realmMapLayers,
  generator,
}: UseWorldRecipeArgs) {
  const [start] = useState(() => {
    const saved = loadWorldRecipe(scope);
    // A saved realm-map recipe is no use once the realm has no borders to build on
    const usable = saved && (saved.controls.source !== "realm-map" || hasRealmMap) ? saved : null;
    return {
      restored: usable !== null,
      controls: usable?.controls ?? controlsForPreset("earthlike"),
      seed: usable?.seed ?? newWorldSeed(),
    };
  });
  const [controls, setControls] = useState<WorldControls>(start.controls);
  const [seed, setSeed] = useState(start.seed);
  const latest = useLatest({ controls, seed, realmMapLayers, realmMapReady, scope });
  const { generate, reset } = generator;

  const run = useCallback(
    (next: WorldControls, nextSeed: number) => {
      const { realmMapLayers: layers, realmMapReady: ready, scope: key } = latest.current;
      // A world fitted to the realm's map waits for the map: the saved recipe runs once it has loaded
      if (next.source === "realm-map" && !ready) return;
      generate(
        paramsFromControls(next),
        nextSeed,
        next.source === "realm-map" ? { landMaskLayers: layers, keepBorders: true } : undefined
      );
      saveWorldRecipe(key, { seed: nextSeed, controls: next });
    },
    [generate, latest]
  );

  const restore = useCallback(
    () => run(latest.current.controls, latest.current.seed),
    [run, latest]
  );
  useRunOnce(start.restored && (start.controls.source !== "realm-map" || realmMapReady), restore);

  /** Change controls and make a new world */
  const apply = useCallback(
    (patch: Partial<WorldControls>) => {
      const next = clampControls({ ...latest.current.controls, ...patch });
      setControls(next);
      run(next, latest.current.seed);
    },
    [run, latest]
  );
  /** Change controls without generating: a slider mid-drag */
  const setLive = useCallback((patch: Partial<WorldControls>) => {
    setControls((current) => ({ ...current, ...patch }));
  }, []);

  const pickPreset = useCallback(
    (preset: WorldPreset) =>
      apply({
        ...controlsForPreset(preset),
        developmentLevel: latest.current.controls.developmentLevel,
      }),
    [apply, latest]
  );
  const pickSource = useCallback((source: WorldSource) => apply({ source }), [apply]);

  const commitSeed = useCallback(
    (next: number) => {
      setSeed(next);
      run(latest.current.controls, next);
    },
    [run, latest]
  );
  const reroll = useCallback(() => commitSeed(newWorldSeed()), [commitSeed]);
  const generateNow = useCallback(
    () => run(latest.current.controls, latest.current.seed),
    [run, latest]
  );

  /** Take the draft off the map and forget the recipe; the controls stay for the next one */
  const discard = useCallback(() => {
    reset();
    clearWorldRecipe(latest.current.scope);
  }, [reset, latest]);

  return {
    controls,
    seed,
    apply,
    setLive,
    pickPreset,
    pickSource,
    commitSeed,
    reroll,
    generateNow,
    discard,
  };
}
