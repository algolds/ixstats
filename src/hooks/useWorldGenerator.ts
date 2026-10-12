import { useCallback, useEffect, useRef, useState } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { DiagnosticKind } from "~/lib/worldgen/diagnostics";
import type { PngWidth } from "~/lib/worldgen/render-png";
import type { WorldGenParams } from "~/lib/worldgen/v2/types";
import type { DiagnosticResult, WorldWorkerFactory } from "~/lib/worldgen/worker/world-messages";
import {
  IDLE_VIEW,
  WorldGenSession,
  type WorldGenerateOptions,
  type WorldGenView,
} from "~/lib/worldgen/worker/world-gen-session";

export type { WorldGenStatus, WorldGenerateOptions } from "~/lib/worldgen/worker/world-gen-session";
export type {
  DiagnosticResult,
  WorldGenResult,
  WorldGenStage,
} from "~/lib/worldgen/worker/world-messages";
export type { DiagnosticKind, DiagnosticLegend } from "~/lib/worldgen/diagnostics";
export type { PngWidth } from "~/lib/worldgen/render-png";

export interface WorldGenerator extends WorldGenView {
  /**
   * Generate a world. Replaces any generation in flight (that worker is terminated); the last good `result`
   * stays until the new one lands. Not debounced: call it when a slider is released.
   */
  generate(params: Partial<WorldGenParams>, seed: number, options?: WorldGenerateOptions): void;
  /** Ends the generation in flight and goes back to the last good world (or idle). */
  cancel(): void;
  /**
   * Ends the generation in flight and forgets the last good world and the error: back to idle. The editor calls
   * this when the realm changes (or keys the component that holds the hook by realm), so one realm's world is
   * never previewed on another.
   */
  reset(): void;
  /**
   * A diagnostic layer of the world in `result`, drawn by the worker from its cached graph (no regeneration) and
   * cached there per kind until the next generate: straight RGBA in Web Mercator rows, with its legend as data.
   * Rejects while a generate runs or after the worker was replaced; ask again when `result` changes.
   */
  diagnostic(kind: DiagnosticKind): Promise<DiagnosticResult>;
  /** The nations' seeds of the world in `result`: a GeoJSON point at each capital. Rejects like `diagnostic`. */
  nationSeeds(): Promise<FeatureCollection<Point>>;
  /**
   * The world in `result` as an equirectangular PNG (ocean, land by height band, lakes, rivers, relief, and with
   * `politics` the fills and borders), drawn and encoded in the worker. Rejects like `diagnostic`; a generate that
   * replaces the worker mid-render loses it.
   */
  renderPng(width: PngWidth, politics: boolean): Promise<Blob>;
}

const noWorld = <T>(): Promise<T> => Promise.reject(new Error("There is no world to draw"));

/**
 * The world generator in a Web Worker. `createWorker` must be stable (a module-level function such as
 * `createWorldWorker`); jest tests pass a fake. The worker is started on the first `generate`, reused while idle so
 * its mesh cache survives slider changes, and terminated on unmount.
 */
export function useWorldGenerator(createWorker: WorldWorkerFactory): WorldGenerator {
  const [view, setView] = useState<WorldGenView>(IDLE_VIEW);
  const session = useRef<WorldGenSession | null>(null);
  // True until unmount. A strict-mode or Activity remount sets it again; a `generate` after unmount would
  // otherwise build a session no cleanup will ever dispose.
  const mounted = useRef(true);

  const generate = useCallback<WorldGenerator["generate"]>(
    (params, seed, options) => {
      if (!mounted.current) return;
      session.current ??= new WorldGenSession(createWorker, setView);
      session.current.generate(params, seed, options);
    },
    [createWorker]
  );
  const cancel = useCallback(() => session.current?.cancel(), []);
  const reset = useCallback(() => {
    session.current?.reset();
    // The session may be gone (Activity hid the host) while React kept the view
    setView(IDLE_VIEW);
  }, []);

  const diagnostic = useCallback<WorldGenerator["diagnostic"]>(
    (kind) => session.current?.diagnostic(kind) ?? noWorld(),
    []
  );
  const nationSeeds = useCallback<WorldGenerator["nationSeeds"]>(
    () => session.current?.nationSeeds() ?? noWorld(),
    []
  );
  const renderPng = useCallback<WorldGenerator["renderPng"]>(
    (width, politics) => session.current?.renderPng(width, politics) ?? noWorld(),
    []
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.current?.dispose();
      session.current = null;
    };
  }, []);

  return { ...view, generate, cancel, reset, diagnostic, nationSeeds, renderPng };
}
