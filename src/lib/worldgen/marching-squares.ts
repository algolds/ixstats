/**
 * High-Resolution Marching Squares Isoline Contour Generator
 *
 * Replaces coarse Voronoi cell aggregation with continuous 2D heightfield
 * spatial binning and Marching Squares isoline tracing.
 *
 * Produces smooth, razor-sharp, realistic topographic contours matching
 * real-world USGS DEM maps and IxWorld's cartographic standard with ZERO voxels.
 */

import type { FeatureCollection, Feature, Polygon, Position } from "geojson";
import type { PackedGraph } from "./types";
import { cellLng, cellLat } from "./voronoi-mesh";
import { ELEVATION_ZONES } from "~/lib/maps/elevation-config;

function round4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

/** Grid dimensions for high-density continuous heightfield interpolation (1-degree spatial resolution) */
const GRID_W = 360;
const GRID_H = 180;

const MIN_LNG = -180;
const MAX_LNG = 180;
const MIN_LAT = -84;
const MAX_LAT = 84;

// Spatial bin lookup (10-degree bins)
const BIN_SIZE = 10;
const binCols = Math.ceil(360 / BIN_SIZE);
const binRows = Math.ceil(180 / BIN_SIZE);

interface SpatialLookup {
  cellPositions: [number, number][];
  spatialBins: number[][][];
}

function buildSpatialLookup(graph: PackedGraph): SpatialLookup {
  const { cells } = graph;
  const n = cells.n;
  const cellPositions: [number, number][] = [];
  const spatialBins: number[][][] = Array.from({ length: binCols }, () =>
    Array.from({ length: binRows }, () => [])
  );

  for (let i = 0; i < n; i++) {
    const lng = cellLng(graph, i);
    const lat = cellLat(graph, i);
    cellPositions.push([lng, lat]);

    const bx = Math.max(0, Math.min(binCols - 1, Math.floor((lng + 180) / BIN_SIZE)));
    const by = Math.max(0, Math.min(binRows - 1, Math.floor((lat + 90) / BIN_SIZE)));
    spatialBins[bx]![by]!.push(i);
  }

  return { cellPositions, spatialBins };
}

function getNearestCell(lng: number, lat: number, lookup: SpatialLookup): number {
  const { cellPositions, spatialBins } = lookup;
  const bx = Math.max(0, Math.min(binCols - 1, Math.floor((lng + 180) / BIN_SIZE)));
  const by = Math.max(0, Math.min(binRows - 1, Math.floor((lat + 90) / BIN_SIZE)));

  let bestCell = 0;
  let minDistSq = Infinity;

  // Search neighboring 3x3 bins (expand to 5x5 for poles if needed)
  for (let dbx = -2; dbx <= 2; dbx++) {
    const cbx = bx + dbx;
    if (cbx < 0 || cbx >= binCols) continue;
    for (let dby = -2; dby <= 2; dby++) {
      const cby = by + dby;
      if (cby < 0 || cby >= binRows) continue;

      const bin = spatialBins[cbx]![cby]!;
      for (let k = 0; k < bin.length; k++) {
        const i = bin[k]!;
        const [clng, clat] = cellPositions[i]!;
        const dx = lng - clng;
        const dy = lat - clat;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          bestCell = i;
        }
      }
    }
  }

  return bestCell;
}

/**
 * Fast O(1) spatial binning continuous heightfield interpolation.
 */
function buildHeightfield(graph: PackedGraph, lookup: SpatialLookup): Float32Array {
  const grid = new Float32Array(GRID_W * GRID_H);
  const { cells } = graph;
  const { cellPositions, spatialBins } = lookup;

  const dLng = (MAX_LNG - MIN_LNG) / (GRID_W - 1);
  const dLat = (MAX_LAT - MIN_LAT) / (GRID_H - 1);

  for (let gy = 0; gy < GRID_H; gy++) {
    const lat = MIN_LAT + gy * dLat;
    const by = Math.max(0, Math.min(binRows - 1, Math.floor((lat + 90) / BIN_SIZE)));

    for (let gx = 0; gx < GRID_W; gx++) {
      const lng = MIN_LNG + gx * dLng;
      const bx = Math.max(0, Math.min(binCols - 1, Math.floor((lng + 180) / BIN_SIZE)));

      let sumW = 0;
      let sumH = 0;

      for (let dbx = -1; dbx <= 1; dbx++) {
        const cbx = bx + dbx;
        if (cbx < 0 || cbx >= binCols) continue;
        for (let dby = -1; dby <= 1; dby++) {
          const cby = by + dby;
          if (cby < 0 || cby >= binRows) continue;

          const bin = spatialBins[cbx]![cby]!;
          for (let k = 0; k < bin.length; k++) {
            const i = bin[k]!;
            const [clng, clat] = cellPositions[i]!;
            const ch = cells.h[i]!;
            const dx = lng - clng;
            const dy = lat - clat;
            const distSq = dx * dx + dy * dy;

            if (distSq < 0.0001) {
              sumH = ch;
              sumW = 1;
              break;
            }

            if (distSq < 225) {
              // 15-degree influence
              const w = 1 / (distSq + 0.1);
              sumW += w;
              sumH += ch * w;
            }
          }
        }
      }

      grid[gy * GRID_W + gx] = sumW > 0 ? sumH / sumW : 0;
    }
  }

  // Force grid borders to 0 (ocean/unclaimed) to guarantee closed Marching Squares loops
  for (let gx = 0; gx < GRID_W; gx++) {
    grid[0 * GRID_W + gx] = 0;
    grid[(GRID_H - 1) * GRID_W + gx] = 0;
  }
  for (let gy = 0; gy < GRID_H; gy++) {
    grid[gy * GRID_W + 0] = 0;
    grid[gy * GRID_W + (GRID_W - 1)] = 0;
  }

  return grid;
}

/**
 * Marching Squares isoline segment extraction for a single grid cell.
 */
function getMarchingSquaresSegments(
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  threshold: number,
  x: number,
  y: number,
  dx: number,
  dy: number
): [Position, Position][] {
  const b0 = v0 >= threshold ? 1 : 0;
  const b1 = v1 >= threshold ? 1 : 0;
  const b2 = v2 >= threshold ? 1 : 0;
  const b3 = v3 >= threshold ? 1 : 0;

  const caseIdx = (b0 << 3) | (b1 << 2) | (b2 << 1) | b3;
  if (caseIdx === 0 || caseIdx === 15) return [];

  // Linear interpolation along cell edges
  const top: Position = [MIN_LNG + (x + (threshold - v0) / (v1 - v0 || 1)) * dx, MIN_LAT + y * dy];
  const right: Position = [
    MIN_LNG + (x + 1) * dx,
    MIN_LAT + (y + (threshold - v1) / (v2 - v1 || 1)) * dy,
  ];
  const bottom: Position = [
    MIN_LNG + (x + (threshold - v3) / (v2 - v3 || 1)) * dx,
    MIN_LAT + (y + 1) * dy,
  ];
  const left: Position = [MIN_LNG + x * dx, MIN_LAT + (y + (threshold - v0) / (v3 - v0 || 1)) * dy];

  switch (caseIdx) {
    case 1:
    case 14:
      return [[left, bottom]];
    case 2:
    case 13:
      return [[bottom, right]];
    case 3:
    case 12:
      return [[left, right]];
    case 4:
    case 11:
      return [[top, right]];
    case 5:
      return [
        [top, left],
        [bottom, right],
      ];
    case 6:
    case 9:
      return [[top, bottom]];
    case 7:
    case 8:
      return [[left, top]];
    case 10:
      return [
        [top, right],
        [left, bottom],
      ];
    default:
      return [];
  }
}

/**
 * 2-pass Chaikin corner smoothing for organic isoline rings.
 */
function smoothIsolineRing(ring: Position[], iterations = 2): Position[] {
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
    if (next.length > 0) {
      next.push([next[0]![0], next[0]![1]]);
    }
    pts = next;
  }

  return pts;
}

/**
 * Chain line segments into closed rings.
 */
function chainSegments(segments: [Position, Position][]): Position[][] {
  const unused = [...segments];
  const rings: Position[][] = [];

  while (unused.length > 0) {
    const startSeg = unused.pop()!;
    const ring: Position[] = [startSeg[0], startSeg[1]];

    let added = true;
    while (added) {
      added = false;
      const tail = ring[ring.length - 1]!;

      for (let i = unused.length - 1; i >= 0; i--) {
        const [p0, p1] = unused[i]!;

        const d0 = Math.hypot(tail[0] - p0[0], tail[1] - p0[1]);
        const d1 = Math.hypot(tail[0] - p1[0], tail[1] - p1[1]);

        if (d0 < 0.05) {
          ring.push(p1);
          unused.splice(i, 1);
          added = true;
          break;
        } else if (d1 < 0.05) {
          ring.push(p0);
          unused.splice(i, 1);
          added = true;
          break;
        }
      }
    }

    if (ring.length >= 4) {
      const rounded = ring.map(([lng, lat]) => [round4(lng), round4(lat)] as Position);
      if (
        rounded[0]![0] !== rounded[rounded.length - 1]![0] ||
        rounded[0]![1] !== rounded[rounded.length - 1]![1]
      ) {
        rounded.push([rounded[0]![0], rounded[0]![1]]);
      }
      rings.push(smoothIsolineRing(rounded, 2));
    }
  }

  return rings;
}

/**
 * Generate smooth Marching Squares landmass background at shoreline threshold h >= 51.
 */
export function generateMarchingSquaresBackground(graph: PackedGraph): FeatureCollection {
  const lookup = buildSpatialLookup(graph);
  const grid = buildHeightfield(graph, lookup);
  const dx = (MAX_LNG - MIN_LNG) / (GRID_W - 1);
  const dy = (MAX_LAT - MIN_LAT) / (GRID_H - 1);

  const segments: [Position, Position][] = [];

  for (let gy = 0; gy < GRID_H - 1; gy++) {
    for (let gx = 0; gx < GRID_W - 1; gx++) {
      const v0 = grid[gy * GRID_W + gx]!;
      const v1 = grid[gy * GRID_W + (gx + 1)]!;
      const v2 = grid[(gy + 1) * GRID_W + (gx + 1)]!;
      const v3 = grid[(gy + 1) * GRID_W + gx]!;

      const segs = getMarchingSquaresSegments(v0, v1, v2, v3, 51, gx, gy, dx, dy);
      segments.push(...segs);
    }
  }

  const rings = chainSegments(segments);
  return {
    type: "FeatureCollection",
    features: rings.map((ring, idx) => ({
      type: "Feature",
      id: idx + 1,
      geometry: { type: "Polygon", coordinates: [ring] } as Polygon,
      properties: { id: `landmass_${idx}`, fill: "#e8e5da", _fillColor: "#e8e5da" },
    })),
  };
}

/**
 * Generate smooth Marching Squares elevation contours for all 9 elevation zones with ZERO voxels.
 */
export function generateMarchingSquaresAltitudes(graph: PackedGraph): FeatureCollection {
  const lookup = buildSpatialLookup(graph);
  const grid = buildHeightfield(graph, lookup);
  const dx = (MAX_LNG - MIN_LNG) / (GRID_W - 1);
  const dy = (MAX_LAT - MIN_LAT) / (GRID_H - 1);

  const features: Feature[] = [];
  let featureIdCounter = 500;

  const zoneThresholds = [52, 75, 98, 121, 144, 167, 190, 213, 236];

  for (let z = 0; z < zoneThresholds.length; z++) {
    const threshold = zoneThresholds[z]!;
    const zoneConfig = ELEVATION_ZONES[z];
    if (!zoneConfig) continue;

    const segments: [Position, Position][] = [];

    for (let gy = 0; gy < GRID_H - 1; gy++) {
      for (let gx = 0; gx < GRID_W - 1; gx++) {
        const v0 = grid[gy * GRID_W + gx]!;
        const v1 = grid[gy * GRID_W + (gx + 1)]!;
        const v2 = grid[(gy + 1) * GRID_W + (gx + 1)]!;
        const v3 = grid[(gy + 1) * GRID_W + gx]!;

        const segs = getMarchingSquaresSegments(v0, v1, v2, v3, threshold, gx, gy, dx, dy);
        segments.push(...segs);
      }
    }

    const rings = chainSegments(segments);
    if (rings.length === 0) continue;

    const color = zoneConfig.color.slice(0, 7);

    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri]!;
      featureIdCounter++;

      features.push({
        type: "Feature",
        id: featureIdCounter,
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        } as Polygon,
        properties: {
          id: `contour_${z}_${ri}`,
          featureId: `contour_${z}_${ri}`,
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

/**
 * Generate smooth Marching Squares political state territory claim overlays linked to heightfield topography with ZERO voxels.
 */
export function generateMarchingSquaresPolitical(graph: PackedGraph): FeatureCollection {
  const lookup = buildSpatialLookup(graph);
  const grid = buildHeightfield(graph, lookup);
  const dx = (MAX_LNG - MIN_LNG) / (GRID_W - 1);
  const dy = (MAX_LAT - MIN_LAT) / (GRID_H - 1);

  const { states, cells } = graph;
  const numStates = states.length;
  if (numStates <= 1) return { type: "FeatureCollection", features: [] };

  const STATE_COLORS = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#06b6d4",
    "#84cc16",
  ];

  // 1. Build a continuous state ID grid by looking up the nearest cell's state ID
  const gridState = new Uint16Array(GRID_W * GRID_H);
  const dLng = (MAX_LNG - MIN_LNG) / (GRID_W - 1);
  const dLat = (MAX_LAT - MIN_LAT) / (GRID_H - 1);

  for (let gy = 0; gy < GRID_H; gy++) {
    const lat = MIN_LAT + gy * dLat;
    for (let gx = 0; gx < GRID_W; gx++) {
      const lng = MIN_LNG + gx * dLng;
      const h = grid[gy * GRID_W + gx]!;

      if (h < 51) {
        gridState[gy * GRID_W + gx] = 0; // Ocean
        continue;
      }

      const nearestCell = getNearestCell(lng, lat, lookup);
      gridState[gy * GRID_W + gx] = cells.state[nearestCell] ?? 0;
    }
  }

  const features: Feature[] = [];

  // 2. For each state, trace the boundary of its claimed grid cells
  for (let s = 1; s < numStates; s++) {
    const state = states[s]!;
    const color = state.color || STATE_COLORS[(s - 1) % STATE_COLORS.length]!;

    // Create a binary scalar field: 1.0 inside this state's land territory, 0.0 outside
    const sGrid = new Float32Array(GRID_W * GRID_H);
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      sGrid[i] = gridState[i] === state.id ? 1.0 : 0.0;
    }

    const segments: [Position, Position][] = [];
    for (let gy = 0; gy < GRID_H - 1; gy++) {
      for (let gx = 0; gx < GRID_W - 1; gx++) {
        const v0 = sGrid[gy * GRID_W + gx]!;
        const v1 = sGrid[gy * GRID_W + (gx + 1)]!;
        const v2 = sGrid[(gy + 1) * GRID_W + (gx + 1)]!;
        const v3 = sGrid[(gy + 1) * GRID_W + gx]!;

        const segs = getMarchingSquaresSegments(v0, v1, v2, v3, 0.5, gx, gy, dx, dy);
        segments.push(...segs);
      }
    }

    const rings = chainSegments(segments);
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri]!;
      features.push({
        type: "Feature",
        id: s * 100 + ri,
        geometry: { type: "Polygon", coordinates: [ring] } as Polygon,
        properties: {
          id: `state_${state.id || s}_${ri}`,
          featureId: `state_${state.id || s}_${ri}`,
          name: state.name || `Nation ${s}`,
          fill: color,
          _fillColor: color,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}
