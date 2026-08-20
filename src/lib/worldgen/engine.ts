/**
 * World Generation Engine — Orchestrator
 *
 * Runs the Azgaar-style pipeline in strict order:
 * Voronoi mesh → Template → Heightmap → Features → Rivers →
 * Climate → Cultures → Settlements → States → Validate → Export
 *
 * Output: 7-layer GeoJSON compatible with IxWorldMap renderer.
 */

import type {
  WorldGenParams,
  GeneratedWorld,
  WorldStats,
  ProgressCallback,
  PackedGraph,
} from "./types";
import { DEFAULT_PARAMS } from "./types";
import { createVoronoiMesh, isLand } from "./voronoi-mesh";
import { generateHeightmap } from "./heightmap";
import { classifyFeatures } from "./features";
import { generateRivers } from "./rivers";
import { computeClimate } from "./climate";
import { generateCultures } from "./cultures";
import { placeSettlements } from "./settlements";
import { generateStates } from "./states";
import { validateAndRepair } from "./validate";
import { exportToGeoJSON } from "./export-geojson";
import { sampleIxWorldTemplate } from "./ixworld-template";

import { generateWorld as generateWorldV2 } from "./v2";

// ──────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────

/**
 * Generate a complete world using the Unified Physical Geography Engine (v2).
 *
 * @param userParams Generation parameters (merged with defaults)
 * @param onProgress Optional progress callback for UI
 * @returns Generated world with 7-layer GeoJSON output
 */
export function generateWorld(
  userParams: Partial<WorldGenParams>,
  onProgress?: ProgressCallback
): GeneratedWorld {
  const params: WorldGenParams = { ...DEFAULT_PARAMS, ...userParams };

  if (params.useV2Engine !== false) {
    const v2World = generateWorldV2(params, onProgress as any);
    return v2World as unknown as GeneratedWorld;
  }

  const t0 = performance.now();
  const report = onProgress ?? (() => {});

  // ── Stage 1: Voronoi mesh ──
  report("mesh", 5, "Generating Voronoi mesh...");
  const graph = createVoronoiMesh(params.seed, params.cellCount, 2);
  report("mesh", 10, `Mesh: ${graph.cells.n} cells`);

  // ── Stage 2: IxWorld template (optional) ──
  let template: Uint8Array | null = null;
  if (params.useIxWorldTemplate) {
    report("template", 15, "Sampling IxWorld base template...");
    template = sampleIxWorldTemplate(graph);
    report("template", 17, "IxWorld base template sampled");
  }

  // ── Stage 3: Heightmap ──
  report("heightmap", 18, "Generating terrain...");
  generateHeightmap(graph, params, template);
  report("heightmap", 30, "Terrain complete");

  // ── Stage 4: Features (flood-fill) ──
  report("features", 32, "Classifying land/water...");
  classifyFeatures(graph);
  const landCount = countLand(graph);
  const lakeCount = graph.features.filter((f) => f.type === "lake").length;
  report("features", 38, `${landCount} land cells, ${lakeCount} lakes`);

  // ── Stage 5: Rivers ──
  if (params.hasRivers) {
    report("rivers", 40, "Generating rivers...");
    generateRivers(graph, params);
    report("rivers", 55, `${graph.rivers.length} rivers`);
  }

  // ── Stage 6: Climate ──
  report("climate", 57, "Computing climate...");
  computeClimate(graph, params);
  report("climate", 65, "Climate zones assigned");

  // ── Stage 7: Cultures ──
  report("cultures", 67, "Generating cultures...");
  generateCultures(graph, params);
  report("cultures", 72, `${graph.cultures.length} cultures`);

  // ── Stage 8: Settlements ──
  report("settlements", 74, "Placing settlements...");
  placeSettlements(graph, params);
  report("settlements", 80, `${graph.burgs.length} settlements`);

  // ── Stage 9: States/Countries ──
  report("states", 82, "Generating countries...");
  generateStates(graph, params);
  report("states", 90, `${graph.states.length} countries`);

  // ── Stage 10: Validate + Repair ──
  report("validate", 92, "Validating...");
  const validation = validateAndRepair(graph);
  if (validation.repairs.length > 0) {
    report("validate", 94, `Repaired: ${validation.repairs.join(", ")}`);
  }

  // ── Stage 11: Export to GeoJSON ──
  report("export", 95, "Exporting to GeoJSON...");
  const layers = exportToGeoJSON(graph);
  report("export", 100, "Generation complete");

  const generationTimeMs = performance.now() - t0;

  // Compute stats
  const stats: WorldStats = {
    landPercentage: Math.round((landCount / graph.cells.n) * 100),
    countryCount: graph.states.length,
    riverCount: graph.rivers.length,
    lakeCount,
    altitudeZoneCount: layers.altitudes?.features.length ?? 0,
    climateZoneCount: layers.climate?.features.length ?? 0,
    icecapCount: layers.icecaps?.features.length ?? 0,
    biomeCount: new Set(Array.from(graph.cells.b)).size,
    cultureCount: graph.cultures.length,
    cityCount: graph.burgs.length,
    generationTimeMs: Math.round(generationTimeMs),
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

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function countLand(graph: PackedGraph): number {
  let count = 0;
  for (let i = 0; i < graph.cells.n; i++) {
    if (isLand(graph, i)) count++;
  }
  return count;
}
