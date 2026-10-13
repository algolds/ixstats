"use client";

import { useCallback, useMemo, useState } from "react";
import { useStudioDiagnostics } from "~/hooks/useStudioDiagnostics";
import { useStudioFit } from "~/hooks/useStudioFit";
import { useStudioGeneration } from "~/hooks/useStudioGeneration";
import { useStudioMap, type StudioProjection } from "~/hooks/useStudioMap";
import { useStudioRecipe } from "~/hooks/useStudioRecipe";
import { useStudioSource } from "~/hooks/useStudioSource";
import { useWorldGenerator } from "~/hooks/useWorldGenerator";
import { useWorldPreview, type WorldOverlays } from "~/hooks/useWorldPreview";
import type { DraftLayerKey } from "~/lib/maps/world-draft-layers";
import type { StudioPreset } from "~/lib/worldgen/studio-presets";
import type { WorldWorkerFactory } from "~/lib/worldgen/worker/world-messages";
import {
  StudioProvider,
  type StudioContextValue,
  type StudioGenerator,
  type StudioRealm,
} from "./StudioContext";
import { StudioInspector } from "./StudioInspector";
import { StudioRail } from "./StudioRail";
import { StudioTopBar } from "./StudioTopBar";

export interface StudioWorkspaceProps {
  /** The admin's Clerk id: the recipe is kept under it */
  userId: string;
  presets: readonly StudioPreset[];
  presetsFallback: boolean;
  realms: readonly StudioRealm[];
  realmsState: StudioContextValue["realmsState"];
  /** `?fit=<realm slug>`: start fitted to that realm */
  fitParam: string | null;
  /** Starts the generator's worker; tests pass a fake */
  createWorker: WorldWorkerFactory;
}

/**
 * The Studio once its presets are in: the recipe, the generator, the map and the draft preview, wired together and
 * handed to the rail, the map and the inspector as one `StudioContext`.
 */
export function StudioWorkspace({
  userId,
  presets,
  presetsFallback,
  realms,
  realmsState,
  fitParam,
  createWorker,
}: StudioWorkspaceProps) {
  const recipe = useStudioRecipe({ userId, presets, fitParam, persist: !presetsFallback });
  const worldGenerator = useWorldGenerator(createWorker);
  const fitting = recipe.mode === "fit";
  const fit = useStudioFit(fitting ? recipe.fitRealm : null);
  const { stale, regenerate } = useStudioGeneration({
    generator: worldGenerator,
    params: recipe.params,
    seed: recipe.seed,
    fitting,
    fit,
  });
  const diagnostics = useStudioDiagnostics(worldGenerator);
  const [projection, setProjection] = useState<StudioProjection>("globe");
  const { containerRef, map } = useStudioMap(projection);

  // Ice caps are drawn from the start, climate zones only when asked
  const [visible, setVisible] = useState<Partial<Record<DraftLayerKey, boolean>>>({
    icecaps: true,
  });
  const setLayerVisible = useCallback(
    (key: DraftLayerKey, on: boolean) => setVisible((current) => ({ ...current, [key]: on })),
    []
  );
  const overlays = useMemo<WorldOverlays>(
    () => ({ visible, diagnostic: diagnostics.image, seeds: diagnostics.seeds }),
    [visible, diagnostics.image, diagnostics.seeds]
  );
  useWorldPreview(map, worldGenerator.result, overlays);

  const { source, setSource } = useStudioSource(recipe);

  // The hook hands back a new object on every render; the tabs get one that changes only when something in it does
  const { state, stage, pct, message, error, result } = worldGenerator;
  const { diagnostic, nationSeeds, measure, renderPng } = worldGenerator;
  const generator = useMemo<StudioGenerator>(
    () => ({
      state,
      stage,
      pct,
      message,
      error,
      result,
      diagnostic,
      nationSeeds,
      measure,
      renderPng,
    }),
    [state, stage, pct, message, error, result, diagnostic, nationSeeds, measure, renderPng]
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      params: recipe.params,
      setParams: recipe.setParams,
      resetFields: recipe.resetFields,
      seed: recipe.seed,
      setSeed: recipe.setSeed,
      reroll: recipe.reroll,
      presets,
      presetsFallback,
      presetSlug: recipe.presetSlug,
      presetParams: recipe.presetParams,
      pickPreset: recipe.pickPreset,
      source,
      setSource,
      realms,
      realmsState,
      fit,
      generator,
      stale,
      regenerate,
      map,
      projection,
      setProjection,
      visible,
      setLayerVisible,
      diagnostics,
    }),
    [
      recipe.params,
      recipe.setParams,
      recipe.resetFields,
      recipe.seed,
      recipe.setSeed,
      recipe.reroll,
      recipe.presetSlug,
      recipe.presetParams,
      recipe.pickPreset,
      presets,
      presetsFallback,
      source,
      setSource,
      realms,
      realmsState,
      fit,
      generator,
      stale,
      regenerate,
      map,
      projection,
      visible,
      setLayerVisible,
      diagnostics,
    ]
  );

  return (
    <StudioProvider value={value}>
      <div className="flex h-full min-h-0 flex-col">
        <StudioTopBar />
        {presetsFallback && (
          <p role="status" className="text-label-secondary text-footnote px-4 pt-2">
            The saved presets could not be read, so the built-in ones stand in. Reload to try again.
          </p>
        )}
        <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)_22rem] gap-2 p-2">
          <StudioRail />
          <div className="rounded-card relative min-h-0 overflow-hidden">
            <div
              ref={containerRef}
              className="absolute inset-0 h-full w-full"
              data-testid="studio-map"
            />
            {map === null && (
              <p className="text-label-secondary text-footnote pointer-events-none absolute inset-0 flex items-center justify-center">
                Loading the map.
              </p>
            )}
          </div>
          <StudioInspector />
        </div>
      </div>
    </StudioProvider>
  );
}
