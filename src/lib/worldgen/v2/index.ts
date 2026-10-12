/**
 * UPG v2 — Unified Physical Geography Engine
 *
 * Main entry point and orchestrator for procedural realm world generation.
 * Runs all 8 steps in strict sequence, grouped into the stages of `stages.ts` (mesh, land, climate, nations, output):
 * 1. Voronoi Mesh (whole globe, antimeridian-stitched)
 * 2. Tectonic Plates Simulation
 * 3. Continents, Islands, Mountain Uplift & Hypsometric Elevation
 * 4. Coastline Refinement (fjords, peninsulas, archipelagos)
 * 5. Unified Hydrology & Climate Pass (8 sub-passes)
 * 6. Quality Gate (report-only)
 * 7. Natural-Border Political Overlay
 * 8. 7-Layer GeoJSON Export
 *
 * "Generate to fit" runs the same stages around a realm's own map: a land mask replaces the
 * grown continents (and fixes the coastline) and kept borders replace the generated countries.
 */

import type {
  WorldGenParams,
  GeneratedWorld,
  WorldGraph,
  WorldStats,
  ProgressCallback,
} from "./types";
import type { LandMask } from "../land-mask";
import { DEFAULT_PARAMS } from "./config";
import { createMesh, type MeshCache } from "./mesh";
import { generateTectonicPlates } from "./tectonics";
import { generateTerrain } from "./terrain";
import { refineCoastlines } from "./coastlines";
import { computeHydroClimate } from "./hydro-climate";
import { validateWorld } from "./quality-gate";
import { buildSlots, generatePolitics } from "./politics";
import { exportToGeoJSON } from "./export";
import { STAGE_ORDER, type StageCache, type StageId, type StageInputs } from "./stages";

export interface GenerateOptions {
  /** Land comes from this mask (a realm's own map); no continents are grown and the coast is kept */
  landMask?: LandMask;
  /** The realm keeps its borders: no countries are generated and there is no political layer */
  keepBorders?: boolean;
  /** Reuses the mesh of the previous run when seed, cell count and relaxation are unchanged */
  meshCache?: MeshCache;
}

/** A world from `generateWorldStaged`: where its run started, and the graph it was made on (always present). */
export type StagedWorld = GeneratedWorld & { restartedAt: StageId; graph: WorldGraph };

/** Cell centres packed as lng, lat, height (m) per cell. */
function packCells(graph: WorldGraph): Float32Array {
  const { cells } = graph;
  const packed = new Float32Array(cells.n * 3);
  for (let i = 0; i < cells.n; i++) {
    packed[i * 3] = cells.p[i * 2]!;
    packed[i * 3 + 1] = cells.p[i * 2 + 1]!;
    packed[i * 3 + 2] = cells.h[i]!;
  }
  return packed;
}

/** The graph a stage hands on, with the options it needs. */
interface RunContext {
  params: WorldGenParams;
  options: GenerateOptions;
  report: ProgressCallback;
}

function runLand(graph: WorldGraph, { params, options, report }: RunContext): void {
  // Tectonic plates
  report("tectonics", 18, "Simulating tectonic plate boundaries & velocities...");
  generateTectonicPlates(graph, params);
  report("tectonics", 28, `${graph.plates.length} tectonic plates generated`);

  // Terrain elevation
  report("terrain", 30, "Computing multi-fractal terrain elevation...");
  generateTerrain(graph, params, options.landMask);
  report("terrain", 42, "Elevation & mountain ridges calculated");

  // Coastline refinement
  report("coastlines", 45, "Refining fjords, peninsulas & archipelagos...");
  refineCoastlines(graph, params, options.landMask !== undefined);
  report("coastlines", 52, "Coastline geometry finalized");
}

function runClimate(graph: WorldGraph, { params, report }: RunContext): void {
  // Unified hydrology & climate
  report("hydro-climate", 55, "Computing wind, rain shadow, rivers & climate biomes...");
  computeHydroClimate(graph, params);
  report(
    "hydro-climate",
    72,
    `${graph.rivers.length} rivers, ${graph.features.filter((f) => f.type === "lake").length} lakes`
  );

  // Quality gate (report-only)
  report("quality", 75, "Auditing world quality against scientific standards...");
  const qualityReport = validateWorld(graph, params);
  report("quality", 82, `Quality Audit Score: ${qualityReport.compositeScore}%`);
}

/** Natural-border political overlay (the realm's own borders replace it when kept). */
function runNations(graph: WorldGraph, { params, options, report }: RunContext): void {
  if (options.keepBorders) {
    report("politics", 92, "Keeping the realm's borders");
    return;
  }
  report("politics", 85, "Generating cultures, settlements & natural-border countries...");
  generatePolitics(graph, params);
  report(
    "politics",
    92,
    `${graph.states.length} countries, ${graph.settlements.length} settlements`
  );
}

function runOutput(
  graph: WorldGraph,
  context: RunContext,
  startedAt: number
): GeneratedWorld & { graph: WorldGraph } {
  const { params, options, report } = context;
  report("export", 95, "Exporting to 7-layer GeoJSON with spline smoothing...");
  const layers = exportToGeoJSON(graph, params, { political: !options.keepBorders });
  const slots = buildSlots(graph, params.developmentLevel);
  const cells = packCells(graph);
  report("export", 100, "Generation complete");

  const generationTimeMs = Math.round(performance.now() - startedAt);

  // Compute stats
  let landCellCount = 0;
  for (let i = 0; i < graph.cells.n; i++) {
    if (graph.cells.isLand[i]) landCellCount++;
  }

  const lakeCount = graph.features.filter((f) => f.type === "lake").length;
  const continentCount = graph.features.filter((f) => f.type === "continent").length;

  const stats: WorldStats = {
    landPercentage: Math.round((landCellCount / graph.cells.n) * 100),
    continentCount,
    countryCount: graph.states.length,
    riverCount: graph.rivers.length,
    lakeCount,
    watershedCount: graph.watersheds.length,
    altitudeZoneCount: layers.altitudes?.features.length ?? 0,
    climateZoneCount: layers.climate?.features.length ?? 0,
    icecapCount: layers.icecaps?.features.length ?? 0,
    biomeCount: new Set(Array.from(graph.cells.biome)).size,
    cultureCount: graph.cultures.length,
    cityCount: graph.settlements.length,
    plateCount: graph.plates.length,
    generationTimeMs,
    cellCount: graph.cells.n,
  };

  return {
    seed: params.seed,
    params,
    layers,
    slots,
    cells,
    stats,
    graph,
  };
}

/** The mesh stage: Voronoi mesh of the whole globe, antimeridian-stitched. */
function runMesh({ params, options, report }: RunContext): WorldGraph {
  report("mesh", 5, "Generating spatial Voronoi mesh...");
  const graph = options.meshCache
    ? options.meshCache.get(params.seed, params.cellCount, params.lloydIterations)
    : createMesh(params.seed, params.cellCount, params.lloydIterations);
  report("mesh", 15, `Mesh generated: ${graph.cells.n} cells`);
  return graph;
}

/** Runs the stages from `start` on; the cache (when there is one) supplies what the earlier stages made. */
function runStages(
  userParams: Partial<WorldGenParams>,
  onProgress: ProgressCallback | undefined,
  options: GenerateOptions,
  cache: StageCache | null
): { world: GeneratedWorld & { graph: WorldGraph }; restartedAt: StageId } {
  const params: WorldGenParams = { ...DEFAULT_PARAMS, ...userParams };
  const startedAt = performance.now();
  const context: RunContext = { params, options, report: onProgress ?? (() => {}) };
  const inputs: StageInputs = {
    params,
    landMask: options.landMask,
    keepBorders: options.keepBorders,
  };
  const start: StageId = cache ? cache.startFor(inputs) : "mesh";
  const runs = (stage: StageId) => STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(start);
  cache?.begin();

  // The cache exists whenever `start` is not the mesh
  const graph = start === "mesh" ? runMesh(context) : cache!.graphAt(start);
  if (start === "mesh") cache?.keepMesh(graph);
  if (runs("land")) {
    runLand(graph, context);
    cache?.keep("land", graph);
  }
  if (runs("climate")) {
    runClimate(graph, context);
    cache?.keep("climate", graph);
  }
  if (runs("nations")) runNations(graph, context);
  const world = runOutput(graph, context, startedAt);
  cache?.finish(graph, inputs);
  return { world, restartedAt: start };
}

/**
 * Generate a complete world using the Unified Physical Geography Engine (v2).
 *
 * @param userParams Generation parameters (merged with defaults)
 * @param onProgress Optional progress callback for UI
 * @param options Generate-to-fit inputs and the mesh cache
 * @returns Generated world with 7-layer GeoJSON output and internal WorldGraph
 */
export function generateWorld(
  userParams: Partial<WorldGenParams>,
  onProgress?: ProgressCallback,
  options: GenerateOptions = {}
): GeneratedWorld {
  return runStages(userParams, onProgress, options, null).world;
}

/**
 * `generateWorld` that starts at the first stage a changed parameter reaches and keeps what the stages before it
 * made in `options.cache`, so the next run can start part-way. The world is the one a full run makes, byte for byte.
 * A run that throws leaves the cache to start the next one at the mesh.
 */
export function generateWorldStaged(
  userParams: Partial<WorldGenParams>,
  onProgress: ProgressCallback | undefined,
  options: GenerateOptions & { cache: StageCache }
): StagedWorld {
  const { world, restartedAt } = runStages(userParams, onProgress, options, options.cache);
  return { ...world, restartedAt };
}

// Re-export core types
export type { WorldGenParams, GeneratedWorld, ProgressCallback } from "./types";
export { MeshCache } from "./mesh";
export { StageCache, planRestart, STAGE_FIELDS, type StageId, type StageInputs } from "./stages";
