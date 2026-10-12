"use client";

import { useCallback, useEffect, useRef } from "react";
import type { WorldGenerator } from "~/hooks/useWorldGenerator";
import type { StudioFit } from "~/hooks/useStudioFit";
import type { StudioParams } from "~/lib/worldgen/studio-fields";

interface UseStudioGenerationArgs {
  generator: Pick<WorldGenerator, "generate" | "state">;
  params: StudioParams;
  seed: number;
  /** The world is fitted to a realm's map */
  fitting: boolean;
  fit: StudioFit;
}

/**
 * Asks the generator for a world whenever the committed parameters, the seed or the map it is fitted to change. The
 * rail commits on release, so this runs once per release and not per drag tick; the worker restarts from the first
 * stage the change touches by itself. A world fitted to a realm waits until that realm's layers have settled, and is
 * made again when the realm's map version moves; the layers go to the worker once per `maskKey`.
 *
 * `stale` says the world on the map is not the one the recipe now asks for (a run is on, failed, or not yet asked);
 * `regenerate` asks again (Retry).
 */
export function useStudioGeneration({
  generator,
  params,
  seed,
  fitting,
  fit,
}: UseStudioGenerationArgs) {
  const { generate, state } = generator;
  const ready = !fitting || fit.state === "ready";
  const maskKey = fitting ? fit.maskKey : undefined;
  const key = ready ? `${seed}|${maskKey ?? ""}|${JSON.stringify(params)}` : null;
  // What the last request was for. A ref: the generator's view moves with every run and renders this
  const asked = useRef<string | null>(null);
  const layers = useRef(fit.landMaskLayers);
  const latest = useRef({ params, seed, fitting });

  useEffect(() => {
    layers.current = fit.landMaskLayers;
    latest.current = { params, seed, fitting };
  });

  const run = useCallback(() => {
    const { params: p, seed: s, fitting: fitted } = latest.current;
    generate(
      p,
      s,
      fitted
        ? {
            landMaskLayers: layers.current,
            ...(maskKey === undefined ? {} : { maskKey }),
            keepBorders: true,
          }
        : undefined
    );
  }, [generate, maskKey]);

  useEffect(() => {
    if (key === null) return;
    asked.current = key;
    run();
  }, [key, run]);

  const stale = key === null || asked.current !== key || state !== "ready";
  return { stale, regenerate: run };
}
