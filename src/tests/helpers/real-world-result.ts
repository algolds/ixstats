/**
 * A world made by the real generator, through the real worker runner, handed back the way `useWorldGenerator` holds
 * it (layers as JSON strings, the cells as a Float32Array). For tests that need a draft the generator really makes,
 * at a size jest can afford.
 */
import { createWorldRunner } from "~/lib/worldgen/worker/world-runner";
import type {
  WorldGenResult,
  WorldWorkerRequest,
  WorldWorkerResponse,
} from "~/lib/worldgen/worker/world-messages";

type ResultMessage = Extract<WorldWorkerResponse, { type: "result" }>;

export function realWorld(over: Partial<WorldWorkerRequest> = {}): WorldGenResult {
  let result: ResultMessage | null = null;
  const run = createWorldRunner((message) => {
    if (message.type === "result") result = message;
    if (message.type === "error") throw new Error(message.message);
  });
  run({ type: "generate", id: 1, params: { cellCount: 3000, plateCount: 8 }, seed: 7, ...over });
  if (!result) throw new Error("The generator made no world");
  const { seed, params, layers, slots, stats, cells, relief } = result as ResultMessage;
  return {
    seed,
    params,
    layers,
    slots,
    stats,
    cells: new Float32Array(cells),
    relief: { ...relief, rgba: new Uint8ClampedArray(relief.rgba) },
  };
}
