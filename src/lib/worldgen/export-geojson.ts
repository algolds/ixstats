/**
 * GeoJSON Export — Convert Voronoi cell mesh to 7-layer GeoJSON
 *
 * Merges adjacent cells with the same attribute into polygons.
 * Output format matches IxWorldMap.tsx renderer contract exactly:
 * - Fill layers: features with _fillColor property
 * - Political: _id, _displayName, _fillColor, _areaSqKm, _centroidLng, _centroidLat
 * - Rivers: LineString features with fill color
 */

import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
  LineString,
  Position,
} from "geojson";
import type { PackedGraph } from "./types";
import { isLand, cellLng, cellLat, cellAreaKm2 } from "./voronoi-mesh";
import { ELEVATION_ZONES } from "~/lib/maps/elevation-config";

// ──────────────────────────────────────────────
// Main Export
// ──────────────────────────────────────────────

export interface ExportedLayers {
  background: FeatureCollection;
  altitudes: FeatureCollection;
  climate: FeatureCollection;
  political: FeatureCollection;
  rivers: FeatureCollection;
  lakes: FeatureCollection;
  icecaps: FeatureCollection;
}

/**
 * Export the PackedGraph to 7-layer GeoJSON matching IxWorldMap format.
 */
export function exportToGeoJSON(graph: PackedGraph): Record<string, FeatureCollection> {
  const layers: Record<string, FeatureCollection> = {};

  // Background: continuous landmass base polygon
  layers.background = exportBackground(graph);

  // Altitudes: continuous 9-zone isoline contours
  layers.altitudes = exportAltitudes(graph);

  // Climate: cells grouped by biome type
  layers.climate = exportClimate(graph);

  // Political: country territory claim overlays
  layers.political = exportPolitical(graph);

  // Rivers: LineString per river
  layers.rivers = exportRivers(graph);

  // Lakes: merged lake feature cells
  layers.lakes = exportLakes(graph);

  // Icecaps: not generated
  layers.icecaps = { type: "FeatureCollection", features: [] };

  return layers;
}

// ──────────────────────────────────────────────
// Layer Exporters
// ──────────────────────────────────────────────

function exportBackground(graph: PackedGraph): FeatureCollection {
  // Collect all land cell polygons into a single feature
  const landCells: number[] = [];
  for (let i = 0; i < graph.cells.n; i++) {
    if (isLand(graph, i)) landCells.push(i);
  }

  if (landCells.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  // Use the merged polygon approach — but for background, just emit one large MultiPolygon
  const polygons = mergeCellsToPolygons(graph, landCells);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 1,
        geometry:
          polygons.length === 1
            ? ({ type: "Polygon", coordinates: polygons[0]! } as Polygon)
            : ({ type: "MultiPolygon", coordinates: polygons } as MultiPolygon),
        properties: {
          id: "landmass",
          featureId: "landmass",
          fill: "#e8e5da",
          _fillColor: "#e8e5da",
        },
      },
    ],
  };
}

function exportAltitudes(graph: PackedGraph): FeatureCollection {
  const features: Feature[] = [];
  const { cells } = graph;

  // Process elevation zones 0 to 8 using cumulative nested isoline thresholding (elevZone >= z)
  for (let z = 0; z < ELEVATION_ZONES.length; z++) {
    const zoneConfig = ELEVATION_ZONES[z];
    if (!zoneConfig) continue;

    // Cumulative thresholding: collect all cells at or above elevation zone z
    const cumulativeCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (isLand(graph, i) && cells.elevZone[i]! >= z) {
        cumulativeCells.push(i);
      }
    }

    if (cumulativeCells.length === 0) continue;

    const color = zoneConfig.color.slice(0, 7);
    const groups = findContiguousGroups(graph, cumulativeCells);

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]!;
      if (group.length < 2) continue;

      const polygons = mergeCellsToPolygons(graph, group);
      if (polygons.length === 0) continue;

      const id = `zone_${z}_${gi}`;
      features.push({
        type: "Feature",
        id: z * 1000 + gi + 100,
        geometry:
          polygons.length === 1
            ? ({ type: "Polygon", coordinates: polygons[0]! } as Polygon)
            : ({ type: "MultiPolygon", coordinates: polygons } as MultiPolygon),
        properties: {
          id,
          featureId: id,
          fill: color,
          _fillColor: color,
          zoneName: zoneConfig.zoneName,
          zoneId: zoneConfig.zoneId,
          elevationMin: zoneConfig.elevationMin,
          elevationMax: zoneConfig.elevationMax,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function exportClimate(graph: PackedGraph): FeatureCollection {
  const features: Feature[] = [];
  const { cells } = graph;

  // Import climate colors (lazy — avoid circular deps)
  const CLIMATE_COLORS: Record<number, string> = {
    0: "#006400",
    1: "#228B22",
    2: "#C2B280",
    3: "#EDC9AF",
    4: "#2E8B57",
    5: "#CC7722",
    6: "#355E3B",
    7: "#4682B4",
    8: "#355E3B",
    9: "#A8B8C8",
    10: "#F0F8FF",
    11: "#8B7D6B",
  };
  const CLIMATE_NAMES: Record<number, string> = {
    0: "Ar",
    1: "Aw",
    2: "Bs",
    3: "Bw",
    4: "Cf",
    5: "Cs",
    6: "Do",
    7: "Dc",
    8: "E",
    9: "Ft",
    10: "Fi",
    11: "H",
  };

  // Group land cells by biome
  const biomeGroups = new Map<number, number[]>();
  for (let i = 0; i < cells.n; i++) {
    if (!isLand(graph, i)) continue;
    const b = cells.b[i]!;
    if (!biomeGroups.has(b)) biomeGroups.set(b, []);
    biomeGroups.get(b)!.push(i);
  }

  for (const [biome, biomeCells] of biomeGroups) {
    const color = CLIMATE_COLORS[biome] ?? "#888888";
    const name = CLIMATE_NAMES[biome] ?? `Biome${biome}`;

    const groups = findContiguousGroups(graph, biomeCells);

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]!;
      if (group.length < 2) continue;

      const polygons = mergeCellsToPolygons(graph, group);
      if (polygons.length === 0) continue;

      const id = `climate_${name}_${gi}`;
      features.push({
        type: "Feature",
        id: biome * 1000 + gi,
        geometry:
          polygons.length === 1
            ? ({ type: "Polygon", coordinates: polygons[0]! } as Polygon)
            : ({ type: "MultiPolygon", coordinates: polygons } as MultiPolygon),
        properties: {
          id,
          featureId: id,
          fill: color,
          _fillColor: color,
          climateName: name,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function exportPolitical(graph: PackedGraph): FeatureCollection {
  const features: Feature[] = [];
  const { cells } = graph;

  for (const state of graph.states) {
    if (!state || !state.id) continue;
    // Collect cells for this state
    const stateCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.state[i] === state.id) stateCells.push(i);
    }
    if (stateCells.length === 0) continue;

    const polygons = mergeCellsToPolygons(graph, stateCells);
    if (polygons.length === 0) continue;

    // Compute centroid
    let clng = 0,
      clat = 0;
    for (const ci of stateCells) {
      clng += cellLng(graph, ci);
      clat += cellLat(graph, ci);
    }
    clng /= stateCells.length;
    clat /= stateCells.length;

    // Compute area
    let area = 0;
    for (const ci of stateCells) area += cellAreaKm2(graph, ci);

    const fillColor = state.color || "#3b82f6";

    features.push({
      type: "Feature",
      id: state.id,
      geometry:
        polygons.length === 1
          ? ({ type: "Polygon", coordinates: polygons[0]! } as Polygon)
          : ({ type: "MultiPolygon", coordinates: polygons } as MultiPolygon),
      properties: {
        id: state.name,
        featureId: state.name,
        fill: fillColor,
        _id: state.name,
        _displayName: state.name,
        _fillColor: fillColor,
        _areaSqKm: Math.round(area),
        _centroidLng: Math.round(clng * 1000) / 1000,
        _centroidLat: Math.round(clat * 1000) / 1000,
        _continent: state.continent || "Unknown",
      },
    });
  }

  return { type: "FeatureCollection", features };
}

function exportRivers(graph: PackedGraph): FeatureCollection {
  const features: Feature[] = [];
  const strokeColor = "#7cb5d2";

  for (const river of graph.rivers) {
    if (!river || !river.id || !river.cells || river.cells.length < 2) continue;

    // Convert cell path to coordinates
    const coordinates: Position[] = river.cells.map((ci) => [
      cellLng(graph, ci),
      cellLat(graph, ci),
    ]);

    features.push({
      type: "Feature",
      id: river.id,
      geometry: { type: "LineString", coordinates } as LineString,
      properties: {
        id: `river-${river.id}`,
        featureId: `river-${river.id}`,
        displayName: river.name,
        fill: strokeColor,
        type: "river",
      },
    });
  }

  return { type: "FeatureCollection", features };
}

function exportLakes(graph: PackedGraph): FeatureCollection {
  const features: Feature[] = [];
  const lakeColor = "#7cb5d2";

  for (const feature of graph.features) {
    if (!feature || feature.type !== "lake") continue;

    // Collect cells for this lake
    const lakeCells: number[] = [];
    for (let i = 0; i < graph.cells.n; i++) {
      if (graph.cells.f[i] === feature.id) lakeCells.push(i);
    }
    if (lakeCells.length === 0) continue;

    let polygons = mergeCellsToPolygons(graph, lakeCells);
    if (polygons.length === 0) {
      polygons = lakeCells.map((ci) => {
        const verts = graph.cells.vertices[ci]!;
        return [verts.map(([x, y]) => [round4(x), round4(y)] as Position)];
      });
    }

    features.push({
      type: "Feature",
      id: feature.id,
      geometry:
        polygons.length === 1
          ? ({ type: "Polygon", coordinates: polygons[0]! } as Polygon)
          : ({ type: "MultiPolygon", coordinates: polygons } as MultiPolygon),
      properties: {
        id: `lake-${feature.id}`,
        featureId: `lake-${feature.id}`,
        displayName: feature.name || "Lake",
        fill: lakeColor,
        _fillColor: lakeColor,
        type: "lake",
      },
    });
  }

  return { type: "FeatureCollection", features };
}

// oxlint-disable-next-line typescript/no-unused-vars
function exportIcecaps(graph: PackedGraph): FeatureCollection {
  const features: Feature[] = [];

  // Ice cap cells: biome = 10 (Fi = Ice Cap) or temp < -20 at high latitude
  const iceCells: number[] = [];
  for (let i = 0; i < graph.cells.n; i++) {
    if (
      graph.cells.b[i] === 10 || // Fi biome
      (graph.cells.temp[i]! < -20 && Math.abs(cellLat(graph, i)) > 60)
    ) {
      iceCells.push(i);
    }
  }

  if (iceCells.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  // Group into contiguous clusters (north pole vs south pole)
  const groups = findContiguousGroups(graph, iceCells);

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]!;
    if (group.length < 2) continue;

    const polygons = mergeCellsToPolygons(graph, group);
    if (polygons.length === 0) continue;

    features.push({
      type: "Feature",
      id: `icecap-${gi}`,
      geometry:
        polygons.length === 1
          ? ({ type: "Polygon", coordinates: polygons[0]! } as Polygon)
          : ({ type: "MultiPolygon", coordinates: polygons } as MultiPolygon),
      properties: {
        id: `icecap-${gi}`,
        featureId: `icecap-${gi}`,
        fill: "#f0f4f8",
        _fillColor: "#f0f4f8",
        displayName: gi === 0 ? "North Polar Ice Cap" : "South Polar Ice Cap",
      },
    });
  }

  return { type: "FeatureCollection", features };
}

// ──────────────────────────────────────────────
// Cell Merging Utilities
// ──────────────────────────────────────────────

/**
 * Find contiguous groups of cells within a cell set.
 * Uses BFS on the Voronoi adjacency graph.
 */
function findContiguousGroups(graph: PackedGraph, cellSet: number[]): number[][] {
  const inSet = new Set(cellSet);
  const visited = new Set<number>();
  const groups: number[][] = [];

  for (const start of cellSet) {
    if (visited.has(start)) continue;

    const group: number[] = [];
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const cell = queue.pop()!;
      group.push(cell);

      for (const nb of graph.cells.neighbors[cell]!) {
        if (inSet.has(nb) && !visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Merge a set of Voronoi cells into polygon coordinate arrays.
 *
 * Algorithm: Collect all cell edges. Remove internal edges (shared between
 * two cells in the set). Remaining edges form boundary ring(s).
 *
 * Returns array of polygon coordinate rings (each ring = Position[]).
 */
function mergeCellsToPolygons(graph: PackedGraph, cellSet: number[]): Position[][][] {
  // oxlint-disable-next-line typescript/no-unused-vars
  const inSet = new Set(cellSet);

  // For each cell, emit its polygon edges. Track which edges are shared.
  // An edge is identified by its two vertex coordinates (sorted).
  const edgeMap = new Map<string, { pts: [Position, Position]; count: number }>();

  for (const ci of cellSet) {
    const verts = graph.cells.vertices[ci]!;
    if (!verts || verts.length < 3) continue;

    const numVerts = verts.length;
    for (let vi = 0; vi < numVerts; vi++) {
      const a = verts[vi]!;
      const b = verts[(vi + 1) % numVerts]!;
      const key = edgeKey(a, b);

      const existing = edgeMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        edgeMap.set(key, { pts: [a, b], count: 1 });
      }
    }
  }

  // Boundary edges = edges that appear exactly once (not shared between two cells in the set)
  const boundaryEdges: [Position, Position][] = [];
  for (const { pts, count } of edgeMap.values()) {
    if (count === 1) {
      boundaryEdges.push(pts);
    }
  }

  if (boundaryEdges.length === 0) {
    // Fallback: just use individual cell polygons
    return cellSet.slice(0, 1).map((ci) => {
      const verts = graph.cells.vertices[ci]!;
      return [verts.map(([x, y]) => [round4(x), round4(y)] as Position)];
    });
  }

  // Chain boundary edges into closed rings, subdivide, perturb with multi-octave noise, and smooth organically
  const rings = chainEdgesIntoRings(boundaryEdges);
  const smoothedRings = rings.map((r) => fractalizeAndSmoothRing(r, 42));

  // Each ring becomes one polygon
  return smoothedRings.map((ring) => [ring]);
}

/**
 * High-Density Vector Fractalization & Organic Smoothing Engine.
 * Replaces coarse Voronoi sausage blobs with intricate, sharp, realistic vector geography.
 */
function fractalizeAndSmoothRing(ring: Position[], seed = 42): Position[] {
  if (ring.length < 4) return ring;

  // 1. Subdivide coarse cell edges to inject high-density vector detail
  const subdivided: Position[] = [];
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const p0 = ring[i]!;
    const p1 = ring[i + 1]!;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);

    subdivided.push(p0);

    // Subdivide to ensure high-resolution curve points (1 point per 0.15 degrees)
    const steps = Math.max(8, Math.min(24, Math.floor(len / 0.15)));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      subdivided.push([p0[0] + dx * t, p0[1] + dy * t]);
    }
  }
  subdivided.push(subdivided[0]!);

  // 2. Multi-octave harmonic noise perturbation for natural crags & fjords
  const perturbed: Position[] = [];
  const sn = subdivided.length - 1;
  for (let i = 0; i < sn; i++) {
    const [x, y] = subdivided[i]!;

    const n1 = Math.sin(x * 0.25 + seed) * Math.cos(y * 0.25 + seed * 0.7) * 0.35;
    const n2 = Math.sin(x * 0.75 - seed * 1.3) * Math.cos(y * 0.75 + seed * 2.1) * 0.15;
    const n3 = Math.sin(x * 1.8 + seed * 0.4) * Math.cos(y * 1.8 - seed * 1.5) * 0.06;

    const dx = round4(x + n1 + n2 + n3);
    const dy = round4(y + (n1 - n2 + n3) * 0.7);

    const clampedX = Math.max(-179.8, Math.min(179.8, dx));
    const clampedY = Math.max(-83.8, Math.min(83.8, dy));
    perturbed.push([clampedX, clampedY]);
  }
  perturbed.push([perturbed[0]![0], perturbed[0]![1]]);

  // 3. 3-pass Chaikin spline smoothing for ultra-fluid, continuous, voxel-free vector isolines
  return smoothRing(perturbed, 3);
}

/**
 * Chaikin's Corner Smoothing algorithm for organic coastline & border curves.
 */
function smoothRing(ring: Position[], iterations = 3): Position[] {
  if (ring.length < 4) return ring;
  let pts = ring;
  for (let it = 0; it < iterations; it++) {
    const next: Position[] = [];
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      const q: Position = [
        round4(0.75 * p0[0] + 0.25 * p1[0]),
        round4(0.75 * p0[1] + 0.25 * p1[1]),
      ];
      const r: Position = [
        round4(0.25 * p0[0] + 0.75 * p1[0]),
        round4(0.25 * p0[1] + 0.75 * p1[1]),
      ];
      next.push(q, r);
    }
    next.push(next[0]!); // close ring
    pts = next;
  }
  return pts;
}

/**
 * Chain disconnected edges into closed rings.
 */
function chainEdgesIntoRings(edges: [Position, Position][]): Position[][] {
  if (edges.length === 0) return [];

  // Build adjacency: endpoint → list of edges
  const adj = new Map<string, Array<{ other: Position; idx: number }>>();
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i]!;
    const ka = ptKey(a);
    const kb = ptKey(b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push({ other: b, idx: i });
    adj.get(kb)!.push({ other: a, idx: i });
  }

  const used = new Uint8Array(edges.length);
  const rings: Position[][] = [];

  for (let startIdx = 0; startIdx < edges.length; startIdx++) {
    if (used[startIdx]) continue;

    const ring: Position[] = [];
    const [startA, startB] = edges[startIdx]!;
    used[startIdx] = 1;
    ring.push(startA);
    let current = startB;
    ring.push(current);

    // Follow the chain
    for (let safety = 0; safety < edges.length + 10; safety++) {
      const key = ptKey(current);
      const options = adj.get(key);
      if (!options) break;

      let found = false;
      for (const opt of options) {
        if (!used[opt.idx]) {
          used[opt.idx] = 1;
          current = opt.other;
          ring.push(current);
          found = true;
          break;
        }
      }

      if (!found) break;

      // Check if we've closed the ring
      if (ptDist(current, ring[0]!) < 0.001) break;
    }

    // Ensure ring is closed
    if (ring.length >= 3) {
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      if (ptDist(first, last) > 0.001) {
        ring.push(first);
      }
      rings.push(ring);
    }
  }

  return rings;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function edgeKey(a: Position | [number, number], b: Position | [number, number]): string {
  const ax = round4(a[0]!),
    ay = round4(a[1]!);
  const bx = round4(b[0]!),
    by = round4(b[1]!);
  // Sort so edge A-B and B-A have the same key
  if (ax < bx || (ax === bx && ay < by)) {
    return `${ax},${ay}|${bx},${by}`;
  }
  return `${bx},${by}|${ax},${ay}`;
}

function ptKey(p: Position | [number, number]): string {
  return `${round4(p[0]!)},${round4(p[1]!)}`;
}

function ptDist(a: Position | [number, number], b: Position | [number, number]): number {
  const dx = a[0]! - b[0]!;
  const dy = a[1]! - b[1]!;
  return Math.sqrt(dx * dx + dy * dy);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
