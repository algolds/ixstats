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
  /** Every layer of its map has settled (arrived, or come back empty), so a world can be fitted to them */
  realmMapReady: boolean;
  /** The layers a world is fitted to */
  realmMapLayers: LandMaskLayers;
  /**
   * Names the content of `realmMapLayers`: the realm's map version, which changes when the map does and not when
   * the layers are only read again. The layers' own identity says nothing (a hook may hand back new objects with the
   * same content), so a world is fitted again by this and never by that.
   */
  realmMapVersion: number | undefined;
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

/** What the latest world was asked for: to tell whether the draft still matches the controls and the map. */
interface LastRun {
  controls: WorldControls;
  seed: number;
  mapVersion: number | undefined;
}

/**
 * The World tab's recipe: the controls and the seed, the draft kept in browser storage per realm, and the calls
 * that ask the generator for a world. A slider reports `setLive` while it is dragged and `apply` when it is
 * released; only `apply` (and the seed, source and preset changes) generate. A recipe found in storage is
 * generated again as soon as the realm's map is ready, so reopening the tab brings the preview back, and a world
 * fitted to the realm's map is generated again when that map changes. `stale` says the draft is not the world the
 * controls, the seed and the map now ask for.
 */
export function useWorldRecipe({
  scope,
  hasRealmMap,
  realmMapReady,
  realmMapLayers,
  realmMapVersion,
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
  // A ref, not state: every run also moves the generator's view (or the controls), which renders this
  const lastRun = useRef<LastRun | null>(null);
  // The draft was taken away (discarded, or its world applied): the saved recipe is not brought back on mount
  const discarded = useRef(false);
  const latest = useLatest({
    controls,
    seed,
    realmMapLayers,
    realmMapVersion,
    realmMapReady,
    scope,
  });
  const { generate, reset } = generator;

  const run = useCallback(
    (next: WorldControls, nextSeed: number) => {
      const {
        realmMapLayers: layers,
        realmMapVersion: mapVersion,
        realmMapReady: ready,
        scope: key,
      } = latest.current;
      // A world fitted to the realm's map waits for the map: the saved recipe runs once it has loaded
      if (next.source === "realm-map" && !ready) return;
      discarded.current = false;
      generate(
        paramsFromControls(next),
        nextSeed,
        next.source === "realm-map" ? { landMaskLayers: layers, keepBorders: true } : undefined
      );
      saveWorldRecipe(key, { seed: nextSeed, controls: next });
      lastRun.current = { controls: next, seed: nextSeed, mapVersion };
    },
    [generate, latest]
  );

  /** Make the world the controls and seed now ask for */
  const generateNow = useCallback(
    () => run(latest.current.controls, latest.current.seed),
    [run, latest]
  );
  // A world applied while the tab was away discards the draft before this runs: it is not brought back then
  const restore = useCallback(() => {
    if (!discarded.current) generateNow();
  }, [generateNow]);
  useRunOnce(start.restored && (start.controls.source !== "realm-map" || realmMapReady), restore);

  // The realm's map changed under a world fitted to it (an edit, or a version that has just loaded): fit it again
  const fitsMap = controls.source === "realm-map";
  const ran = lastRun.current;
  const mapMoved = !!ran && ran.mapVersion !== realmMapVersion;
  useEffect(() => {
    if (fitsMap && realmMapReady && mapMoved) generateNow();
  }, [fitsMap, realmMapReady, mapMoved, generateNow]);

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

  /** Take the draft off the map and forget the recipe; the controls stay for the next one */
  const discard = useCallback(() => {
    reset();
    discarded.current = true;
    clearWorldRecipe(latest.current.scope);
    // Nothing left to keep fitted to the map
    lastRun.current = null;
  }, [reset, latest]);

  const stale =
    ran === null ||
    ran.controls !== controls ||
    ran.seed !== seed ||
    (fitsMap && (!realmMapReady || ran.mapVersion !== realmMapVersion));

  return {
    controls,
    seed,
    stale,
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
