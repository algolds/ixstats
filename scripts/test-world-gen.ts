/**
 * World Generator Diagnostics
 *
 * Generates worlds and outputs geometry quality metrics.
 * Compares against real IxWorld MapLayer data from DB.
 *
 * Usage: bunx tsx scripts/test-world-gen.ts
 */

import {
  generateWorld,
  PRESETS,
  DEFAULT_PARAMS,
  type WorldGenParams,
} from "../src/lib/procedural/world-generator";
import type {
  Feature,
  Polygon,
  MultiPolygon,
  LineString,
  Position,
  FeatureCollection,
} from "geojson";

// ─── Geometry Analysis Helpers ─────────────────────────────────

function getCoords(feature: Feature): Position[][] {
  const geom = feature.geometry;
  if (geom.type === "Polygon") return (geom as Polygon).coordinates;
  if (geom.type === "MultiPolygon") return (geom as MultiPolygon).coordinates.flat();
  if (geom.type === "LineString") return [(geom as LineString).coordinates];
  return [];
}

function ringVertexCount(ring: Position[]): number {
  // Exclude closing vertex (same as first)
  return ring.length > 0 &&
    ring[0]![0] === ring[ring.length - 1]![0] &&
    ring[0]![1] === ring[ring.length - 1]![1]
    ? ring.length - 1
    : ring.length;
}

function signedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  }
  return area / 2;
}

/** Convex hull via Graham scan */
function convexHull(points: Position[]): Position[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const cross = (o: Position, a: Position, b: Position) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: Position[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }

  const upper: Position[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Convexity ratio: polygon area / convex hull area. 1.0 = perfectly convex */
function convexityRatio(ring: Position[]): number {
  const polyArea = Math.abs(signedArea(ring));
  if (polyArea < 1e-10) return 1;

  const hull = convexHull(ring.slice(0, -1)); // Exclude closing vertex
  hull.push(hull[0]!);
  const hullArea = Math.abs(signedArea(hull));

  if (hullArea < 1e-10) return 1;
  return Math.min(1, polyArea / hullArea);
}

/** Check if a ring has self-intersections (simplified check via winding) */
function hasSelfIntersection(ring: Position[]): boolean {
  // Quick check: does the signed area calculation encounter sign changes?
  let positiveSegments = 0;
  let negativeSegments = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const j = (i + 1) % ring.length;
    const cross = ring[i]![0] * ring[j]![1] - ring[j]![0] * ring[i]![1];
    if (cross > 0) positiveSegments++;
    else if (cross < 0) negativeSegments++;
  }
  // If both positive and negative, likely self-intersecting
  return (
    positiveSegments > 0 &&
    negativeSegments > 0 &&
    Math.min(positiveSegments, negativeSegments) > ring.length * 0.3
  );
}

// ─── Analysis Functions ────────────────────────────────────────

interface LayerStats {
  featureCount: number;
  vertexStats: { min: number; max: number; avg: number; total: number };
  convexityStats: { min: number; max: number; avg: number };
  selfIntersections: number;
}

function analyzeLayer(fc: FeatureCollection | undefined): LayerStats | null {
  if (!fc || fc.features.length === 0) return null;

  const vertexCounts: number[] = [];
  const convexityRatios: number[] = [];
  let selfIntersections = 0;

  for (const feature of fc.features) {
    const coordSets = getCoords(feature);
    for (const ring of coordSets) {
      const vc = ringVertexCount(ring);
      vertexCounts.push(vc);

      if (ring.length >= 4) {
        convexityRatios.push(convexityRatio(ring));
        if (hasSelfIntersection(ring)) selfIntersections++;
      }
    }
  }

  if (vertexCounts.length === 0) return null;

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const minArr = (arr: number[]) => Math.min(...arr);
  const maxArr = (arr: number[]) => Math.max(...arr);

  return {
    featureCount: fc.features.length,
    vertexStats: {
      min: minArr(vertexCounts),
      max: maxArr(vertexCounts),
      avg: Math.round(sum(vertexCounts) / vertexCounts.length),
      total: sum(vertexCounts),
    },
    convexityStats:
      convexityRatios.length > 0
        ? {
            min: Number(minArr(convexityRatios).toFixed(3)),
            max: Number(maxArr(convexityRatios).toFixed(3)),
            avg: Number((sum(convexityRatios) / convexityRatios.length).toFixed(3)),
          }
        : { min: 0, max: 0, avg: 0 },
    selfIntersections,
  };
}

function formatStats(name: string, stats: LayerStats | null): string {
  if (!stats) return `  ${name}: (empty)`;
  return [
    `  ${name}: ${stats.featureCount} features`,
    `    vertices: min=${stats.vertexStats.min} max=${stats.vertexStats.max} avg=${stats.vertexStats.avg} total=${stats.vertexStats.total}`,
    `    convexity: min=${stats.convexityStats.min} max=${stats.convexityStats.max} avg=${stats.convexityStats.avg} (1.0=convex, <0.8=concave/realistic)`,
    `    self-intersections: ${stats.selfIntersections}`,
  ].join("\n");
}

// ─── Main ──────────────────────────────────────────────────────

function runTest(name: string, params: WorldGenParams) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Generating: ${name}`);
  console.log(
    `  seed=${params.seed} continents=${params.continentCount} countries=${params.countryCountRange} res=${params.gridResolution}`
  );
  console.log(`  similarity=${params.similarity ?? 0}`);

  const result = generateWorld(params);

  console.log(`\n  Generation time: ${result.stats.generationTimeMs.toFixed(0)}ms`);
  console.log(`  Land: ${(result.stats.landPercentage * 100).toFixed(1)}%`);
  console.log(`  Countries: ${result.stats.countryCount}`);
  console.log(`  Gini: ${result.stats.areaGini.toFixed(3)}`);
  console.log(`  Landlocked: ${(result.stats.landlockedRatio * 100).toFixed(1)}%`);
  console.log(`  Profile similarity: ${result.stats.profileSimilarity?.toFixed(3) ?? "N/A"}`);
  if (result.stats.warnings.length > 0) {
    console.log(`  Warnings: ${result.stats.warnings.join(", ")}`);
  }

  console.log(`\n  Layer Analysis:`);
  for (const [layerName, fc] of Object.entries(result.layers)) {
    console.log(formatStats(layerName, analyzeLayer(fc)));
  }

  // Area coverage check for altitude layer
  const altitudes = result.layers.altitudes;
  if (altitudes) {
    let totalAltArea = 0;
    for (const feature of altitudes.features) {
      const coords = getCoords(feature);
      for (const ring of coords) {
        totalAltArea += Math.abs(signedArea(ring));
      }
    }
    // Compare to political area
    const political = result.layers.political;
    let totalPolArea = 0;
    if (political) {
      for (const feature of political.features) {
        const coords = getCoords(feature);
        for (const ring of coords) {
          totalPolArea += Math.abs(signedArea(ring));
        }
      }
    }
    if (totalPolArea > 0) {
      console.log(
        `\n  Altitude coverage: ${((totalAltArea / totalPolArea) * 100).toFixed(1)}% of political area`
      );
    }
  }

  return result;
}

// ─── Run Tests ─────────────────────────────────────────────────

console.log("World Generator Geometry Diagnostics");
console.log("====================================\n");

// Test 1: IxWorld preset
const ixWorldParams: WorldGenParams = {
  ...DEFAULT_PARAMS,
  ...PRESETS.IxWorld,
  seed: 42,
};
runTest("IxWorld Preset (seed=42)", ixWorldParams);

// Test 2: Earth-like preset
const earthParams: WorldGenParams = {
  ...DEFAULT_PARAMS,
  ...PRESETS["Earth-like"]!,
  seed: 12345,
};
runTest("Earth-like Preset (seed=12345)", earthParams);

// Test 3: Small/fast world
const smallParams: WorldGenParams = {
  ...DEFAULT_PARAMS,
  seed: 99,
  gridResolution: 256,
  similarity: 0.8,
  profileName: "IxWorld",
};
runTest("Small IxWorld (256 res, seed=99)", smallParams);

console.log("\n" + "=".repeat(60));
console.log("IXWORLD REFERENCE TARGETS:");
console.log("  Layer       | Count | Avg Verts | Convexity");
console.log("  political   |   185 |       506 |     0.616");
console.log("  altitudes   |  4068 |        38 |     0.785");
console.log("  climate     |   632 |       173 |     0.765");
console.log("  rivers      |  1041 |       130 |       N/A");
console.log("  lakes       |   350 |        20 |     0.708");
console.log("  icecaps     |    12 |       625 |     0.730");
console.log("");
console.log("KEY METRICS TO WATCH:");
console.log("  - Convexity avg near 1.0 = BAD (convex blobs, no concavity)");
console.log("  - Convexity avg 0.5-0.8 = GOOD (realistic concave shapes)");
console.log("  - Self-intersections > 0 = BAD (broken geometry)");
console.log("  - Altitude coverage > 95% = GOOD (no gaps in terrain)");
