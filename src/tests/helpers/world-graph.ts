/** A small world's graph from the real generator, made once per size and shared by the tests that only read it. */
import { generateWorldStaged, StageCache } from "~/lib/worldgen/v2";
import type { WorldGraph } from "~/lib/worldgen/v2/types";

const made = new Map<number, WorldGraph>();

export function worldGraph(cellCount = 6000): WorldGraph {
  let graph = made.get(cellCount);
  if (!graph) {
    graph = generateWorldStaged({ cellCount, plateCount: 8 }, undefined, {
      cache: new StageCache(),
    }).graph;
    made.set(cellCount, graph);
  }
  return graph;
}
