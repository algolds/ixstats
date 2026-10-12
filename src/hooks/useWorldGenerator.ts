import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldGenParams } from "~/lib/worldgen/v2/types";
import type { WorldWorkerFactory } from "~/lib/worldgen/worker/world-messages";
import {
  IDLE_VIEW,
  WorldGenSession,
  type WorldGenerateOptions,
  type WorldGenView,
} from "~/lib/worldgen/worker/world-gen-session";

export type { WorldGenStatus, WorldGenerateOptions } from "~/lib/worldgen/worker/world-gen-session";
export type { WorldGenResult, WorldGenStage } from "~/lib/worldgen/worker/world-messages";

export interface WorldGenerator extends WorldGenView {
  /**
   * Generate a world. Replaces any generation in flight (that worker is terminated); the last good `result`
   * stays until the new one lands. Not debounced: call it when a slider is released.
   */
  generate(params: Partial<WorldGenParams>, seed: number, options?: WorldGenerateOptions): void;
  /** Ends the generation in flight and goes back to the last good world (or idle). */
  cancel(): void;
}

/**
 * The world generator in a Web Worker. `createWorker` must be stable (a module-level function such as
 * `createWorldWorker`); jest tests pass a fake. The worker is started on the first `generate`, reused while idle so
 * its mesh cache survives slider changes, and terminated on unmount.
 */
export function useWorldGenerator(createWorker: WorldWorkerFactory): WorldGenerator {
  const [view, setView] = useState<WorldGenView>(IDLE_VIEW);
  const session = useRef<WorldGenSession | null>(null);

  const generate = useCallback<WorldGenerator["generate"]>(
    (params, seed, options) => {
      session.current ??= new WorldGenSession(createWorker, setView);
      session.current.generate(params, seed, options);
    },
    [createWorker]
  );
  const cancel = useCallback(() => session.current?.cancel(), []);

  useEffect(
    () => () => {
      session.current?.dispose();
      session.current = null;
    },
    []
  );

  return { ...view, generate, cancel };
}
