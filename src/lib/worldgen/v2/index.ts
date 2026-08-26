/**
 * UPG v2 — Unified Physical Geography Engine
 *
 * Main entry point and orchestrator for procedural realm world generation.
 * Runs all 8 stages in strict sequence:
 * 1. Voronoi Mesh (50K+ cells)
 * 2. Tectonic Plates Simulation
 * 3. Terrain Elevation & Mountain Uplift
 * 4. Coastline Refinement (fjords, peninsulas, archipelagos)
 * 5. Unified Hydrology & Climate Pass (8 sub-passes)
 * 6. Quality Gate & Automated In-Place Repair
 * 7. Natural-Border Political Overlay
 * 8. 7-Layer GeoJSON Export
 */

import type {
  WorldGenParams,
  GeneratedWorld,
  WorldStats,
  ProgressCallback,
} from "./types";
import { DEFAULT_PARAMS } from "./config";
import { createMesh } from "./mesh";
import { generateTectonicPlates } from "./tectonics";
import { generateTerrain } from "./terrain";
import { refineCoastlines } from "./coastlines";
import { computeHydroClimate } from "./hydro-climate";
import { validateAndRepair } from "./quality-gate";
import { generatePolitics } from "./politics";
import { exportToGeoJSON } from "./export";

/**
 * Generate a complete world using the Unified Physical Geography Engine (v2).
 *
 * @param userParams Generation parameters (merged with defaults)
 * @param onProgress Optional progress callback for UI
 * @returns Generated world with 7-layer GeoJSON output and internal WorldGraph
 */
export function generateWorld(
  userParams: Partial<WorldGenParams>,
  onProgress?: ProgressCallback
): GeneratedWorld {
  const params: WorldGenParams = { ...DEFAULT_PARAMS, ...userParams };
  const t0 = performance.now();
  const report = onProgress ?? (() => {});

  // ── Stage 1: Voronoi Mesh (50K+) ──
  report("mesh", 5, "Generating spatial Voronoi mesh...");
  const graph = createMesh(params.seed, params.cellCount, params.lloydIterations);
  report("mesh", 15, `Mesh generated: ${graph.cells.n} cells`);

  // ── Stage 2: Tectonic Plates ──
  report("tectonics", 18, "Simulating tectonic plate boundaries & velocities...");
  generateTectonicPlates(graph, params);
  report("tectonics", 28, `${graph.plates.length} tectonic plates generated`);

  // ── Stage 3: Terrain Elevation ──
  report("terrain", 30, "Computing multi-fractal terrain elevation...");
  generateTerrain(graph, params);
  report("terrain", 42, "Elevation & mountain ridges calculated");

  // ── Stage 4: Coastline Refinement ──
  report("coastlines", 45, "Refining fjords, peninsulas & archipelagos...");
  refineCoastlines(graph, params);
  report("coastlines", 52, "Coastline geometry finalized");

  // ── Stage 5: Unified Hydrology & Climate ──
  report("hydro-climate", 55, "Computing wind, rain shadow, rivers & climate biomes...");
  computeHydroClimate(graph, params);
  report(
    "hydro-climate",
    72,
    `${graph.rivers.length} rivers, ${graph.features.filter((f) => f.type === "lake").length} lakes`
  );

  // ── Stage 6: Quality Gate & Repair ──
  report("quality", 75, "Auditing world quality against scientific standards...");
  const qualityReport = validateAndRepair(graph, params);
  report(
    "quality",
    82,
    `Quality Audit Score: ${qualityReport.compositeScore}% (${qualityReport.totalRepairs} repairs)`
  );

  // ── Stage 7: Natural-Border Political Overlay ──
  report("politics", 85, "Generating cultures, settlements & natural-border countries...");
  generatePolitics(graph, params);
  report(
    "politics",
    92,
    `${graph.states.length} countries, ${graph.settlements.length} settlements`
  );

  // ── Stage 8: GeoJSON Export ──
  report("export", 95, "Exporting to 7-layer GeoJSON with Chaikin smoothing...");
  const layers = exportToGeoJSON(graph);
  report("export", 100, "Generation complete");

  const generationTimeMs = Math.round(performance.now() - t0);

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
    stats,
    graph,
  };
}

// Re-export core types
export type {
  WorldGraph,
  WorldGenParams,
  GeneratedWorld,
  WorldStats,
  ProgressCallback,
} from "./types";
