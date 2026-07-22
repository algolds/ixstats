/**
 * IxWorld Continental Base Template
 *
 * Provides spatial sampling of IxEarth's canonical landmass shapes
 * (Caphiria/Central Continent, Seredyne/Western Reach, Oristano/Southern Archipelago,
 * Tarsas/Northern Mass) to serve as a high-fidelity base template for world generation.
 */

import type { PackedGraph } from "./types";
import { cellLng, cellLat } from "./voronoi-mesh";

export interface PolygonRing {
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  center: [number, number];
  points: [number, number][];
}

/**
 * Major continental landmass outlines matching IxWorld's canonical geography.
 */
export const IXWORLD_CONTINENTS: PolygonRing[] = [
  // 1. Central Continent (Caphiria / Pelameris)
  {
    bounds: [-60, -45, 45, 45],
    center: [-7, 0],
    points: [
      [-50, -35],
      [-55, -15],
      [-40, 10],
      [-25, 30],
      [0, 42],
      [25, 38],
      [42, 20],
      [35, -10],
      [20, -38],
      [-15, -42],
      [-38, -40],
    ],
  },
  // 2. Western Continent / Island Chain (Seredyne / Westlands)
  {
    bounds: [-150, -30, -75, 40],
    center: [-110, 5],
    points: [
      [-140, -20],
      [-145, 10],
      [-130, 35],
      [-105, 38],
      [-85, 20],
      [-80, -10],
      [-100, -28],
      [-125, -25],
    ],
  },
  // 3. Southern Archipelago & Continent (Oristano / Southern Basin)
  {
    bounds: [50, -60, 160, -5],
    center: [105, -32],
    points: [
      [60, -55],
      [55, -30],
      [80, -10],
      [115, -8],
      [150, -25],
      [155, -50],
      [125, -58],
      [90, -56],
    ],
  },
  // 4. Northern Continent (Tarsas / Frostlands)
  {
    bounds: [-100, 40, 90, 75],
    center: [-5, 58],
    points: [
      [-95, 48],
      [-90, 68],
      [-40, 74],
      [10, 75],
      [65, 68],
      [85, 52],
      [50, 42],
      [0, 45],
      [-50, 44],
    ],
  },
];

/**
 * Sample IxWorld continental landmass template for all cells in the Voronoi graph.
 * Returns a Uint8Array of baseline elevations (0-255) for heightmap blending.
 */
export function sampleIxWorldTemplate(graph: PackedGraph): Uint8Array {
  const n = graph.cells.n;
  const template = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const lng = cellLng(graph, i);
    const lat = cellLat(graph, i);

    let maxVal = 0;

    for (const cont of IXWORLD_CONTINENTS) {
      // Bounding box fast-prune
      const [minLng, minLat, maxLng, maxLat] = cont.bounds;
      if (lng < minLng - 10 || lng > maxLng + 10 || lat < minLat - 10 || lat > maxLat + 10) {
        continue;
      }

      // Check distance to continent center & polygon ring
      const dx = lng - cont.center[0];
      const dy = lat - cont.center[1];
      const distSq = dx * dx + dy * dy;

      if (pointInPolygon([lng, lat], cont.points)) {
        // Inside continent -> high land elevation base (130-180)
        const centerFactor = Math.max(0, 1 - Math.sqrt(distSq) / 45);
        const val = Math.round(120 + centerFactor * 60);
        if (val > maxVal) maxVal = val;
      } else {
        // Near coast -> fast falloff to ocean (under 50 threshold)
        const distToBoundary = distanceToPolygon([lng, lat], cont.points);
        if (distToBoundary < 3) {
          const falloff = 1 - distToBoundary / 3;
          const val = Math.round(falloff * 40);
          if (val > maxVal) maxVal = val;
        }
      }
    }

    template[i] = maxVal;
  }

  return template;
}

/**
 * Point in polygon raycasting test.
 */
function pointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
  const x = pt[0],
    y = pt[1];
  let inside = false;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![0],
      yi = poly[i]![1];
    const xj = poly[j]![0],
      yj = poly[j]![1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Distance from point to polygon boundary.
 */
function distanceToPolygon(pt: [number, number], poly: [number, number][]): number {
  let minDist = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p1 = poly[i]!;
    const p2 = poly[j]!;
    const d = distToSegment(pt, p1, p2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function distToSegment(p: [number, number], v: [number, number], w: [number, number]): number {
  const l2 = (w[0] - v[0]) ** 2 + (w[1] - v[1]) ** 2;
  if (l2 === 0) return Math.hypot(p[0] - v[0], p[1] - v[1]);
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (v[0] + t * (w[0] - v[0])), p[1] - (v[1] + t * (w[1] - v[1])));
}
