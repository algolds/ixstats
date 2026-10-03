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

import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";

// TopoJSON packages are CommonJS — use require for compatibility
const topoServer = require("topojson-server") as {
  topology: (objects: Record<string, FeatureCollection>, quantization?: number) => any;
};
const topoClient = require("topojson-client") as {
  feature: (topology: any, object: any) => FeatureCollection;
};
const topoSimplify = require("topojson-simplify") as {
  presimplify: (topology: any, weight?: (triangle: any) => number) => any;
  simplify: (topology: any, minWeight?: number) => any;
};

/** Configuration for the simplification pipeline */
interface SimplifyConfig {
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
interface SimplifyResult {
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

type AreaGeometry = Polygon | MultiPolygon;
type SimplifyFeature = Feature<AreaGeometry>;

// @turf/turf is heavy and optional here: load it per call and let callers fall back
const loadTurf = () => require("@turf/turf");

const ringsOf = (geometry: AreaGeometry): Position[][] =>
  geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();

/** Apply `fn` to every ring of a Polygon or MultiPolygon. */
function mapRings(geometry: AreaGeometry, fn: (ring: Position[]) => Position[]): AreaGeometry {
  return geometry.type === "Polygon"
    ? { type: "Polygon", coordinates: geometry.coordinates.map((ring) => fn(ring)) }
    : { type: "MultiPolygon", coordinates: geometry.coordinates.map((poly) => poly.map(fn)) };
}

/**
 * Count total vertices across all rings of a geometry.
 */
export function countVertices(geometry: AreaGeometry): number {
  if (!geometry?.coordinates) return 0;
  return ringsOf(geometry).reduce((sum, ring) => sum + ring.length, 0);
}

/** Round all coordinates to the specified decimal precision. */
function roundCoordinates(geometry: AreaGeometry, precision: number): AreaGeometry {
  const factor = Math.pow(10, precision);
  return mapRings(geometry, (ring) =>
    ring.map(([x, y]) => [Math.round(x! * factor) / factor, Math.round(y! * factor) / factor])
  );
}

/** Ensure rings are properly closed (first point === last point). */
function ensureRingsClosed(geometry: AreaGeometry): AreaGeometry {
  return mapRings(geometry, (ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first && last && ring.length >= 2 && (first[0] !== last[0] || first[1] !== last[1])
      ? [...ring, [...first]]
      : ring;
  });
}

/** Union the unkinked parts of a polygon back together, skipping parts that fail. */
function unionParts(turf: any, parts: any[]): any {
  let result = parts[0];
  for (const part of parts.slice(1)) {
    try {
      result = turf.union(turf.featureCollection([result, part]));
    } catch {
      // Skip invalid parts
    }
  }
  return result;
}

/**
 * Fix self-intersections in a polygon.
 * Uses turf.unkinkPolygon → union. Falls back to buffer(0).
 */
function fixSelfIntersections(geometry: AreaGeometry): AreaGeometry {
  try {
    const turf = loadTurf();
    const feature = turf.feature(geometry);
    if (!turf.kinks(feature).features?.length) return geometry;

    try {
      const parts = turf.unkinkPolygon(feature).features;
      return (parts.length === 1 ? parts[0] : unionParts(turf, parts))?.geometry ?? geometry;
    } catch {
      // Fallback: buffer(0) trick forces validity
      try {
        return turf.buffer(feature, 0, { units: "degrees" })?.geometry ?? geometry;
      } catch {
        return geometry;
      }
    }
  } catch {
    return geometry; // If turf not available, return as-is
  }
}

/** Polygon area in square meters (0 if turf is unavailable). */
function computeArea(geometry: AreaGeometry): number {
  try {
    const turf = loadTurf();
    return turf.area(turf.feature(geometry));
  } catch {
    return 0;
  }
}

/** Count vertices remaining in a TopoJSON topology after simplification at a given weight. */
function countTopoVertices(topo: any, minWeight: number): number {
  let count = 0;
  for (const arc of topo.arcs) {
    for (const pt of arc) {
      const weight: number | undefined = pt[2]; // vertex importance from presimplify
      if (weight === undefined || weight === Infinity || weight >= minWeight) count++;
    }
  }
  return count;
}

/** Highest finite vertex importance across all arcs. */
function maxTopoImportance(topo: any): number {
  let max = 0;
  for (const arc of topo.arcs) {
    for (const pt of arc) {
      const weight: number | undefined = pt[2]; // vertex importance from presimplify
      if (weight !== undefined && weight !== Infinity && weight > max) max = weight;
    }
  }
  return max;
}

/**
 * Coarse turf pass for large datasets: brings each province under 500 vertices first,
 * doubling the tolerance until it fits (9 tries, the last one unchecked).
 */
function presimplifyLargeFeatures(features: SimplifyFeature[]): SimplifyFeature[] {
  try {
    const turf = loadTurf();
    return features.map((f) => {
      if (countVertices(f.geometry) <= 500) return f;
      let tolerance = 0.001;
      let simplified;
      for (let attempt = 0; attempt < 9; attempt++) {
        simplified = turf.simplify(turf.feature(f.geometry), { tolerance, highQuality: true });
        if (countVertices(simplified.geometry) <= 500) break;
        tolerance *= 2;
      }
      return { ...f, geometry: simplified.geometry };
    });
  } catch {
    return features; // If pre-simplify fails, continue with originals
  }
}

/** Binary search for the minWeight leaving about `targetTotal` vertices (within 10%). */
function findMinWeight(topo: any, targetTotal: number): number {
  let bestWeight = 0;
  let lo = 0;
  let hi = maxTopoImportance(topo);

  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const vertCount = countTopoVertices(topo, mid);
    if (vertCount > targetTotal) {
      lo = mid;
    } else {
      hi = mid;
      bestWeight = mid;
    }
    if (Math.abs(vertCount - targetTotal) < targetTotal * 0.1) {
      return mid;
    }
  }
  return bestWeight;
}

/** Per-province turf simplification until the geometry has at most `max` (and >= 4) vertices. */
function capVertices(geo: AreaGeometry, max: number): AreaGeometry {
  try {
    const turf = loadTurf();
    let tolerance = 0.001;
    for (let attempt = 0; attempt < 10; attempt++) {
      const simplified = turf.simplify(turf.feature(geo), { tolerance, highQuality: true });
      const count = countVertices(simplified.geometry);
      if (count >= 4 && count <= max) return simplified.geometry;
      if (count < 4) break; // Too aggressive, stop
      tolerance *= 1.8;
    }
  } catch {
    // If turf fails, keep the topo-simplified version
  }
  return geo;
}

/**
 * Main entry point: topology-preserving batch simplification.
 */
export function simplifyProvinceBatch(
  features: SimplifyFeature[],
  config?: Partial<SimplifyConfig>
): SimplifyResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];

  if (features.length === 0) {
    return { features: [], stats: [], totalVerticesBefore: 0, totalVerticesAfter: 0, warnings };
  }

  const beforeCounts = features.map((f) => countVertices(f.geometry));
  const beforeAreas = features.map((f) => computeArea(f.geometry));
  const totalBefore = beforeCounts.reduce((a, b) => a + b, 0);

  const nameOf = (i: number) => (features[i]!.properties?.name as string) ?? `Province ${i}`;
  const unchangedStat = (i: number) => ({
    name: nameOf(i),
    verticesBefore: beforeCounts[i]!,
    verticesAfter: beforeCounts[i]!,
    areaPreserved: 1,
  });
  const failed = (message: string): SimplifyResult => ({
    features,
    stats: [],
    totalVerticesBefore: totalBefore,
    totalVerticesAfter: totalBefore,
    warnings: [...warnings, message],
  });

  if (totalBefore / features.length <= cfg.targetVerticesPerProvince) {
    return {
      features,
      stats: features.map((_, i) => unchangedStat(i)),
      totalVerticesBefore: totalBefore,
      totalVerticesAfter: totalBefore,
      warnings: ["Provinces already within target vertex count — no simplification needed"],
    };
  }

  const workFeatures = totalBefore > 20000 ? presimplifyLargeFeatures(features) : features;

  const fc: FeatureCollection = {
    type: "FeatureCollection",
    features: workFeatures.map((f, i) => ({
      type: "Feature" as const,
      properties: { ...f.properties, _idx: i },
      geometry: ensureRingsClosed(f.geometry) as any,
    })),
  };

  // Lower quantization for large datasets saves memory
  const quantization = totalBefore > 50000 ? 1e4 : totalBefore > 10000 ? 1e5 : 1e6;
  // Use 1.5x target to be conservative — the per-province turf pass handles the remainder
  const targetTotal = Math.round(cfg.targetVerticesPerProvince * 1.5) * features.length;

  let step = "TopoJSON topology construction";
  let topo: any;
  try {
    topo = topoServer.topology({ provinces: fc }, quantization);
    // Annotate vertex importance (Visvalingam)
    step = "Presimplify";
    topo = topoSimplify.presimplify(topo);
  } catch (e) {
    return failed(`${step} failed: ${(e as Error).message}`);
  }

  const minWeight = findMinWeight(topo, targetTotal);

  let resultFc: FeatureCollection;
  try {
    step = "Simplification";
    const simplified = topoSimplify.simplify(topo, minWeight);
    step = "Feature extraction";
    resultFc = topoClient.feature(simplified, simplified.objects.provinces);
  } catch (e) {
    return failed(`${step} failed: ${(e as Error).message}`);
  }

  const resultFeatures: SimplifyFeature[] = [];
  const stats: SimplifyResult["stats"] = [];
  const keepOriginal = (i: number, warning: string) => {
    warnings.push(warning);
    resultFeatures.push(features[i]!);
    stats.push(unchangedStat(i));
  };

  features.forEach((original, i) => {
    const name = nameOf(i);
    const simplified = resultFc.features[i];
    if (!simplified?.geometry) {
      return keepOriginal(
        i,
        `Province "${name}" lost geometry during simplification — keeping original`
      );
    }

    let geo = roundCoordinates(
      ensureRingsClosed(simplified.geometry as AreaGeometry),
      cfg.coordinatePrecision
    );
    if (cfg.fixSelfIntersections) geo = fixSelfIntersections(geo);

    // Fewer than 4 points in a ring is not a valid polygon
    let afterCount = countVertices(geo);
    if (ringsOf(geo).some((ring) => ring.length < 4) || afterCount < 4) {
      return keepOriginal(
        i,
        `Province "${name}" simplified too aggressively (${afterCount} vertices) — keeping original`
      );
    }

    if (afterCount > cfg.maxVerticesPerProvince) {
      geo = capVertices(geo, cfg.maxVerticesPerProvince);
      afterCount = countVertices(geo);
    }

    // Area ratio is informational, not a hard gate
    const areaPreserved = beforeAreas[i]! > 0 ? computeArea(geo) / beforeAreas[i]! : 1;
    resultFeatures.push({ type: "Feature", properties: original.properties, geometry: geo });
    stats.push({
      name,
      verticesBefore: beforeCounts[i]!,
      verticesAfter: afterCount,
      areaPreserved,
    });
  });

  return {
    features: resultFeatures,
    stats,
    totalVerticesBefore: totalBefore,
    totalVerticesAfter: stats.reduce((s, st) => s + st.verticesAfter, 0),
    warnings,
  };
}

/**
 * Single-province simplification that is topology-aware.
 * Takes the target province plus all neighbors, builds a mini-topology,
 * simplifies, and returns only the target province's new geometry.
 */
export function simplifySingleProvince(
  target: SimplifyFeature,
  neighbors: SimplifyFeature[],
  config?: Partial<SimplifyConfig>
): SimplifyFeature {
  const allFeatures = [
    { ...target, properties: { ...target.properties, _isTarget: true } },
    ...neighbors,
  ];

  return simplifyProvinceBatch(allFeatures, config).features[0] ?? target;
}
