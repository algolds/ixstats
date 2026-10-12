/**
 * The generator's stages and the cache that lets a run start part-way.
 *
 * A change to a parameter restarts the run at the first stage that reads it; the stages before it come from the
 * cache. Every stage seeds its own random streams from `seed + offset` and writes only what is listed below, so a
 * restarted run is identical to a full run (pinned by `stages.test.ts`).
 *
 * Snapshots are copies of the arrays the later stages write, at most one per stage: the climate stage rewrites
 * `h`, `isLand` and `elevZone`, so the land snapshot and the climate snapshot each hold their own. The nations
 * state is the finished graph, which the output stage only reads, so it needs no copy and is never handed out
 * to be written.
 */

import type { LandMask } from "../land-mask";
import {
  createEmptyWorldGraph,
  type MeshGeometry,
  type WorldGenParams,
  type WorldGraph,
} from "./types";

export type StageId = "mesh" | "land" | "climate" | "nations" | "output";

export const STAGE_ORDER: readonly StageId[] = ["mesh", "land", "climate", "nations", "output"];

/**
 * The parameters each stage reads. A parameter is listed under every stage that reads it, and `planRestart` takes
 * the first; `developmentLevel` is read only after export (`buildSlots`), so it belongs to the output stage.
 */
export const STAGE_FIELDS: Record<StageId, ReadonlyArray<keyof WorldGenParams>> = {
  mesh: ["seed", "cellCount", "lloydIterations"],
  land: [
    "seed",
    "plateCount",
    "continentCount",
    "continentLatitudeRange",
    "continentSizeVariance",
    "islandShare",
    "polarLand",
    "oceanPercentage",
    "terrainRoughness",
    "coastlineComplexity",
    "hypsometry",
  ],
  climate: [
    "temperatureOffset",
    "precipitationScale",
    "riverDensity",
    "lakeCoverage",
    "hasRivers",
    "hasLakes",
  ],
  nations: ["seed", "countryCountRange", "useMarkovNaming"],
  output: ["hasIcecaps", "developmentLevel"],
};

/** What a run was made from. The land mask is compared by identity: the caller keeps one object per map. */
export interface StageInputs {
  params: WorldGenParams;
  landMask?: LandMask;
  keepBorders?: boolean;
}

type ParamValue = WorldGenParams[keyof WorldGenParams];

/** Equal values, arrays by element and `polarLand` by its two flags, whatever order its keys were written in. */
function sameValue(a: ParamValue, b: ParamValue): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])
    );
  }
  return a.north === b.north && a.south === b.south;
}

function changesStage(stage: StageId, prev: StageInputs, next: StageInputs): boolean {
  if (STAGE_FIELDS[stage].some((field) => !sameValue(prev.params[field], next.params[field]))) {
    return true;
  }
  if (stage === "land") return prev.landMask !== next.landMask;
  if (stage === "nations") return !!prev.keepBorders !== !!next.keepBorders;
  return false;
}

/**
 * The first stage the change from `prev` to `next` reaches. No previous run starts at the mesh; nothing changed
 * starts at the output, the cheapest stage, because the finished world is not kept as a result.
 */
export function planRestart(prev: StageInputs | null, next: StageInputs): StageId {
  if (prev === null) return "mesh";
  return STAGE_ORDER.find((stage) => changesStage(stage, prev, next)) ?? "output";
}

type Cells = WorldGraph["cells"];
type CellArray = Float32Array | Uint8Array | Uint16Array | Int32Array;
type CellArrayKey = {
  [K in keyof Cells]: Cells[K] extends CellArray ? K : never;
}[keyof Cells];

/** Written by tectonics, terrain and coastlines (17 bytes a cell). */
const LAND_ARRAYS: readonly CellArrayKey[] = [
  "plate",
  "plateDist",
  "h",
  "elevZone",
  "coastDist",
  "isLand",
  "isMountainRidge",
  "feature",
];

/** Written by the hydro-climate pass (39 bytes a cell), which also rewrites `h`, `isLand` and `elevZone`. */
const CLIMATE_ARRAYS: readonly CellArrayKey[] = [
  "downstream",
  "flux",
  "river",
  "watershed",
  "lake",
  "temp",
  "prec",
  "windDir",
  "windSpeed",
  "oceanCurrentInfluence",
  "aridity",
  "biome",
];

/** Everything the stages write, as the finished graph holds it (the nations stage adds culture and state). */
const NATIONS_ARRAYS: readonly CellArrayKey[] = [
  ...LAND_ARRAYS,
  ...CLIMATE_ARRAYS,
  "culture",
  "state",
];

/** The graph after the land stage or after the climate stage. */
interface GraphSnapshot {
  arrays: Array<[CellArrayKey, CellArray]>;
  /** Not written after the land stage, so shared */
  plates: WorldGraph["plates"];
  /** A copy of the list: the climate pass appends lakes to it */
  features: WorldGraph["features"];
  /** Replaced, never edited, by the climate pass */
  rivers: WorldGraph["rivers"];
  watersheds: WorldGraph["watersheds"];
}

function takeSnapshot(graph: WorldGraph, keys: readonly CellArrayKey[]): GraphSnapshot {
  return {
    arrays: keys.map((key) => [key, graph.cells[key].slice()]),
    plates: graph.plates,
    features: [...graph.features],
    rivers: graph.rivers,
    watersheds: graph.watersheds,
  };
}

/** A new graph on `geometry` holding `snapshot`; the snapshot's own arrays are copied, never handed out. */
function restoreSnapshot(geometry: MeshGeometry, snapshot: GraphSnapshot): WorldGraph {
  const graph = createEmptyWorldGraph(geometry.p.length / 2, geometry);
  for (const [key, array] of snapshot.arrays) graph.cells[key].set(array);
  graph.plates = snapshot.plates;
  graph.features = [...snapshot.features];
  graph.rivers = snapshot.rivers;
  graph.watersheds = snapshot.watersheds;
  return graph;
}

const bytesOf = (snapshot: GraphSnapshot | null): number =>
  snapshot?.arrays.reduce((sum, [, array]) => sum + array.byteLength, 0) ?? 0;

/** The stages a snapshot is kept for; the mesh is the shared geometry and the output has none. */
type SnapshotStage = "land" | "climate";

export class StageCache {
  private inputs: StageInputs | null = null;
  private geometry: MeshGeometry | null = null;
  private land: GraphSnapshot | null = null;
  private climate: GraphSnapshot | null = null;
  private finished: WorldGraph | null = null;

  /** The last finished graph: the nations state, which is also what the output stage exports. Read only. */
  get graph(): WorldGraph | null {
    return this.finished;
  }

  /** Whether the next run can start part-way: false for a first run and after a run that failed half way. */
  get ready(): boolean {
    return !!(this.inputs && this.geometry && this.land && this.climate && this.finished);
  }

  /** The stage `next` starts at; the mesh when the cache cannot serve a later one. */
  startFor(next: StageInputs): StageId {
    return this.ready ? planRestart(this.inputs, next) : "mesh";
  }

  /** Marks the cache unusable until `finish`: a run that throws leaves snapshots from different inputs. */
  begin(): void {
    this.inputs = null;
  }

  /** The graph a run starting at `stage` continues from. */
  graphAt(stage: Exclude<StageId, "mesh">): WorldGraph {
    const { geometry, land, climate, finished } = this;
    if (!geometry || !land || !climate || !finished) throw new Error("The stage cache is empty");
    if (stage === "output") return finished;
    if (stage === "land") return createEmptyWorldGraph(geometry.p.length / 2, geometry);
    return restoreSnapshot(geometry, stage === "climate" ? land : climate);
  }

  keepMesh(graph: WorldGraph): void {
    const { cells } = graph;
    this.geometry = {
      p: cells.p,
      neighbors: cells.neighbors,
      vertices: cells.vertices,
      boundary: cells.boundary,
    };
  }

  keep(stage: SnapshotStage, graph: WorldGraph): void {
    if (stage === "land") this.land = takeSnapshot(graph, LAND_ARRAYS);
    else this.climate = takeSnapshot(graph, [...LAND_ARRAYS, ...CLIMATE_ARRAYS]);
  }

  finish(graph: WorldGraph, inputs: StageInputs): void {
    this.finished = graph;
    this.inputs = inputs;
  }

  /** Bytes of cell arrays held per stage; the nations state is the finished graph's attribute arrays. */
  bytesHeld(): Record<SnapshotStage | "nations", number> {
    const finished = this.finished;
    const nations = finished
      ? NATIONS_ARRAYS.reduce((sum, key) => sum + finished.cells[key].byteLength, 0)
      : 0;
    return { land: bytesOf(this.land), climate: bytesOf(this.climate), nations };
  }
}
