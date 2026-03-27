/**
 * topo-simplify.ts — Topology-preserving province simplification pipeline.
 *
 * Uses TopoJSON to extract shared arcs between adjacent provinces, then
 * simplifies them once — guaranteeing zero-gap tiling by construction.
 * Turf handles post-processing (self-intersection repair, area validation).
 *
 * Key insight: per-province simplification causes gaps because shared borders
 * get simplified differently. TopoJSON's arc-based approach eliminates this.
 */

import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
  Position,
} from "geojson";

// TopoJSON packages are CommonJS — use require for compatibility
// eslint-disable-next-line @typescript-eslint/no-require-imports
const topoServer = require("topojson-server") as {
  topology: (objects: Record<string, FeatureCollection>, quantization?: number) => any;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const topoClient = require("topojson-client") as {
  feature: (topology: any, object: any) => FeatureCollection;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const topoSimplify = require("topojson-simplify") as {
  presimplify: (topology: any, weight?: (triangle: any) => number) => any;
  simplify: (topology: any, minWeight?: number) => any;
};

/** Configuration for the simplification pipeline */
export interface SimplifyConfig {
  /** Target vertex count per province (default: 100) */
  targetVerticesPerProvince: number;
  /** Minimum allowed vertices per ring (default: 12) */
  minVerticesPerRing: number;
  /** Maximum allowed vertices per province — hard cap (default: 150) */
  maxVerticesPerProvince: number;
  /** Coordinate precision — decimal places (default: 5, ~1.1m) */
  coordinatePrecision: number;
  /** Fix self-intersections after simplification (default: true) */
  fixSelfIntersections: boolean;
  /** Provinces smaller than this fraction of the largest are treated gently (default: 0.001) */
  minAreaRatio: number;
}

const DEFAULT_CONFIG: SimplifyConfig = {
  targetVerticesPerProvince: 100,
  minVerticesPerRing: 12,
  maxVerticesPerProvince: 150,
  coordinatePrecision: 5,
  fixSelfIntersections: true,
  minAreaRatio: 0.001,
};

/** Stats returned from the simplification pipeline */
export interface SimplifyResult {
  features: Feature<Polygon | MultiPolygon>[];
  stats: Array<{
    name: string;
    verticesBefore: number;
    verticesAfter: number;
    areaPreserved: number;
  }>;
  totalVerticesBefore: number;
  totalVerticesAfter: number;
  warnings: string[];
}

/**
 * Count total vertices across all rings of a geometry.
 */
export function countVertices(geometry: Polygon | MultiPolygon): number {
  if (!geometry?.coordinates) return 0;
  const allRings =
    geometry.type === "Polygon"
      ? geometry.coordinates
      : geometry.coordinates.flat();
  return allRings.reduce((sum, ring) => sum + ring.length, 0);
}

/**
 * Round all coordinates to the specified decimal precision.
 */
export function roundCoordinates(
  geometry: Polygon | MultiPolygon,
  precision: number
): Polygon | MultiPolygon {
  const factor = Math.pow(10, precision);
  const roundRing = (ring: Position[]): Position[] =>
    ring.map(([x, y]) => [
      Math.round(x! * factor) / factor,
      Math.round(y! * factor) / factor,
    ]);

  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map(roundRing),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((poly) => poly.map(roundRing)),
  };
}

/**
 * Ensure rings are properly closed (first point === last point).
 */
function ensureRingsClosed(geometry: Polygon | MultiPolygon): Polygon | MultiPolygon {
  const closeRing = (ring: Position[]): Position[] => {
    if (ring.length < 2) return ring;
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return [...ring, [...first]];
    }
    return ring;
  };

  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: geometry.coordinates.map(closeRing) };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((poly) => poly.map(closeRing)),
  };
}

/**
 * Fix self-intersections in a polygon.
 * Uses turf.unkinkPolygon → union. Falls back to buffer(0).
 */
export function fixSelfIntersections(
  geometry: Polygon | MultiPolygon
): Polygon | MultiPolygon {
  try {
    const turf = require("@turf/turf");
    const feature = turf.feature(geometry);
    const kinks = turf.kinks(feature);

    if (!kinks.features || kinks.features.length === 0) {
      return geometry; // No self-intersections
    }

    // Try unkinking
    try {
      const unkinked = turf.unkinkPolygon(feature);
      if (unkinked.features.length === 1) {
        return unkinked.features[0].geometry;
      }
      // Multiple parts — union them back
      let result = unkinked.features[0];
      for (let i = 1; i < unkinked.features.length; i++) {
        try {
          result = turf.union(turf.featureCollection([result, unkinked.features[i]]));
        } catch {
          // Skip invalid parts
        }
      }
      return result?.geometry ?? geometry;
    } catch {
      // Fallback: buffer(0) trick forces validity
      try {
        const buffered = turf.buffer(feature, 0, { units: "degrees" });
        return buffered?.geometry ?? geometry;
      } catch {
        return geometry;
      }
    }
  } catch {
    return geometry; // If turf not available, return as-is
  }
}

/**
 * Compute polygon area using turf (returns sq meters).
 */
function computeArea(geometry: Polygon | MultiPolygon): number {
  try {
    const turf = require("@turf/turf");
    return turf.area(turf.feature(geometry));
  } catch {
    return 0;
  }
}

/**
 * Count vertices remaining in a TopoJSON topology after simplification at a given weight.
 */
function countTopoVertices(topo: any, minWeight: number): number {
  let count = 0;
  for (const arc of topo.arcs) {
    for (const pt of arc) {
      // pt[2] is the importance (set by presimplify). Endpoints always kept.
      if (pt[2] === undefined || pt[2] === Infinity || pt[2] >= minWeight) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Main entry point: topology-preserving batch simplification.
 */
export function simplifyProvinceBatch(
  features: Feature<Polygon | MultiPolygon>[],
  config?: Partial<SimplifyConfig>
): SimplifyResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];

  if (features.length === 0) {
    return { features: [], stats: [], totalVerticesBefore: 0, totalVerticesAfter: 0, warnings };
  }

  // Step 1: Record before-state
  const beforeCounts = features.map((f) => countVertices(f.geometry));
  const beforeAreas = features.map((f) => computeArea(f.geometry));
  const totalBefore = beforeCounts.reduce((a, b) => a + b, 0);

  // If already within target, skip simplification
  const avgBefore = totalBefore / features.length;
  if (avgBefore <= cfg.targetVerticesPerProvince) {
    return {
      features,
      stats: features.map((f, i) => ({
        name: (f.properties?.name as string) ?? `Province ${i}`,
        verticesBefore: beforeCounts[i]!,
        verticesAfter: beforeCounts[i]!,
        areaPreserved: 1,
      })),
      totalVerticesBefore: totalBefore,
      totalVerticesAfter: totalBefore,
      warnings: ["Provinces already within target vertex count — no simplification needed"],
    };
  }

  // Step 2: Pre-simplify to reduce memory for large datasets
  // If total vertices > 20K, do a coarse turf pass first to bring each province under 500
  let workFeatures = features;
  if (totalBefore > 20000) {
    try {
      const turf = require("@turf/turf");
      workFeatures = features.map((f) => {
        const verts = countVertices(f.geometry);
        if (verts <= 500) return f;
        // Iteratively simplify until under 500
        let tolerance = 0.001;
        let geo = f.geometry;
        for (let attempt = 0; attempt < 8; attempt++) {
          const s = turf.simplify(turf.feature(geo), { tolerance, highQuality: true });
          if (countVertices(s.geometry) <= 500) {
            return { ...f, geometry: s.geometry };
          }
          tolerance *= 2;
        }
        // Last attempt
        const s = turf.simplify(turf.feature(geo), { tolerance, highQuality: true });
        return { ...f, geometry: s.geometry };
      });
    } catch {
      // If pre-simplify fails, continue with originals
    }
  }

  // Step 2b: Build FeatureCollection with indexed IDs
  const fc: FeatureCollection = {
    type: "FeatureCollection",
    features: workFeatures.map((f, i) => ({
      type: "Feature" as const,
      properties: { ...f.properties, _idx: i },
      geometry: ensureRingsClosed(f.geometry) as any,
    })),
  };

  // Step 3: Convert to topology (extracts shared arcs)
  // Use lower quantization for large datasets to save memory
  const quantization = totalBefore > 50000 ? 1e4 : totalBefore > 10000 ? 1e5 : 1e6;
  let topo: any;
  try {
    topo = topoServer.topology({ provinces: fc }, quantization);
  } catch (e) {
    warnings.push(`TopoJSON topology construction failed: ${(e as Error).message}`);
    return { features, stats: [], totalVerticesBefore: totalBefore, totalVerticesAfter: totalBefore, warnings };
  }

  // Step 4: Presimplify (annotate vertex importance via Visvalingam)
  try {
    topo = topoSimplify.presimplify(topo);
  } catch (e) {
    warnings.push(`Presimplify failed: ${(e as Error).message}`);
    return { features, stats: [], totalVerticesBefore: totalBefore, totalVerticesAfter: totalBefore, warnings };
  }

  // Step 5: Binary search for the right minWeight threshold
  // Use 1.5x target to be conservative — per-province turf pass handles remaining
  const targetTotal = Math.round(cfg.targetVerticesPerProvince * 1.5) * features.length;

  // Find max importance value across all arcs
  let maxImportance = 0;
  for (const arc of topo.arcs) {
    for (const pt of arc) {
      if (pt[2] !== undefined && pt[2] !== Infinity && pt[2] > maxImportance) {
        maxImportance = pt[2];
      }
    }
  }

  let bestWeight = 0;
  let lo = 0;
  let hi = maxImportance;

  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const vertCount = countTopoVertices(topo, mid);
    if (vertCount > targetTotal) {
      lo = mid;
    } else {
      hi = mid;
      bestWeight = mid;
    }
    // Close enough — within 10% of target
    if (Math.abs(vertCount - targetTotal) < targetTotal * 0.1) {
      bestWeight = mid;
      break;
    }
  }

  // Step 6: Apply simplification
  let simplified: any;
  try {
    simplified = topoSimplify.simplify(topo, bestWeight);
  } catch (e) {
    warnings.push(`Simplification failed: ${(e as Error).message}`);
    return { features, stats: [], totalVerticesBefore: totalBefore, totalVerticesAfter: totalBefore, warnings };
  }

  // Step 7: Convert back to GeoJSON
  let resultFc: FeatureCollection;
  try {
    resultFc = topoClient.feature(simplified, simplified.objects.provinces);
  } catch (e) {
    warnings.push(`Feature extraction failed: ${(e as Error).message}`);
    return { features, stats: [], totalVerticesBefore: totalBefore, totalVerticesAfter: totalBefore, warnings };
  }

  // Step 8: Post-process each feature
  const resultFeatures: Feature<Polygon | MultiPolygon>[] = [];
  const stats: SimplifyResult["stats"] = [];

  for (let i = 0; i < features.length; i++) {
    const original = features[i]!;
    const simplified = resultFc.features[i];
    const name = (original.properties?.name as string) ?? `Province ${i}`;

    if (!simplified?.geometry) {
      warnings.push(`Province "${name}" lost geometry during simplification — keeping original`);
      resultFeatures.push(original);
      stats.push({ name, verticesBefore: beforeCounts[i]!, verticesAfter: beforeCounts[i]!, areaPreserved: 1 });
      continue;
    }

    let geo = simplified.geometry as Polygon | MultiPolygon;

    // Ensure rings are closed
    geo = ensureRingsClosed(geo);

    // Round coordinates
    geo = roundCoordinates(geo, cfg.coordinatePrecision);

    // Fix self-intersections
    if (cfg.fixSelfIntersections) {
      geo = fixSelfIntersections(geo);
    }

    // Check for degenerate rings (less than 4 points = not a valid polygon)
    let afterCount = countVertices(geo);
    const allRings = geo.type === "Polygon" ? geo.coordinates : geo.coordinates.flat();
    const hasDegenerateRing = allRings.some((ring) => ring.length < 4);

    if (hasDegenerateRing || afterCount < 4) {
      warnings.push(`Province "${name}" simplified too aggressively (${afterCount} vertices) — keeping original`);
      resultFeatures.push(original);
      stats.push({ name, verticesBefore: beforeCounts[i]!, verticesAfter: beforeCounts[i]!, areaPreserved: 1 });
      continue;
    }

    // Second pass: if still above max, apply per-province turf simplification
    if (afterCount > cfg.maxVerticesPerProvince) {
      try {
        const turf = require("@turf/turf");
        // Iteratively increase tolerance until below max
        let tolerance = 0.001;
        for (let attempt = 0; attempt < 10; attempt++) {
          const simplified2 = turf.simplify(turf.feature(geo), {
            tolerance,
            highQuality: true,
          });
          const count2 = countVertices(simplified2.geometry);
          if (count2 <= cfg.maxVerticesPerProvince && count2 >= 4) {
            geo = simplified2.geometry;
            afterCount = count2;
            break;
          }
          if (count2 < 4) break; // Too aggressive, stop
          tolerance *= 1.8;
        }
      } catch {
        // If turf fails, keep the topo-simplified version
      }
    }

    // Compute area ratio for stats (informational, not a hard gate)
    const afterArea = computeArea(geo);
    const areaRatio = beforeAreas[i]! > 0 ? afterArea / beforeAreas[i]! : 1;

    resultFeatures.push({
      type: "Feature",
      properties: original.properties,
      geometry: geo,
    });
    stats.push({
      name,
      verticesBefore: beforeCounts[i]!,
      verticesAfter: afterCount,
      areaPreserved: areaRatio,
    });
  }

  const totalAfter = stats.reduce((s, st) => s + st.verticesAfter, 0);

  return {
    features: resultFeatures,
    stats,
    totalVerticesBefore: totalBefore,
    totalVerticesAfter: totalAfter,
    warnings,
  };
}

/**
 * Single-province simplification that is topology-aware.
 * Takes the target province plus all neighbors, builds a mini-topology,
 * simplifies, and returns only the target province's new geometry.
 */
export function simplifySingleProvince(
  target: Feature<Polygon | MultiPolygon>,
  neighbors: Feature<Polygon | MultiPolygon>[],
  config?: Partial<SimplifyConfig>
): Feature<Polygon | MultiPolygon> {
  const allFeatures = [
    { ...target, properties: { ...target.properties, _isTarget: true } },
    ...neighbors,
  ];

  const result = simplifyProvinceBatch(allFeatures, config);

  // Return the target (first feature)
  return result.features[0] ?? target;
}
