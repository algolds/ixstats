/**
 * Shared Vertex Builder
 *
 * Analyzes all political MapLayer features and identifies vertices
 * shared between 2+ countries (border points). Creates SharedVertex
 * records for synchronized border editing.
 *
 * Runs automatically on map data import/seeding.
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import { getAllRings } from "./border-editor";
import { distanceDeg } from "./planar";
import { type TopologyRef } from "./topology-engine";

type FeatureVertexRef = TopologyRef;

export interface SharedVertexData {
  lng: number;
  lat: number;
  featureRefs: FeatureVertexRef[];
}

interface Vertex {
  ref: FeatureVertexRef;
  coord: Position;
}

/** Tolerance in degrees for matching vertices (~111m at equator) */
const DEFAULT_TOLERANCE = 0.001;

/** Ring length without the closing duplicate vertex. */
function openRingLength(ring: Position[]): number {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length > 1 && first![0] === last![0] && first![1] === last![1]
    ? ring.length - 1
    : ring.length;
}

/**
 * Build shared vertex index from political features.
 * Groups vertices within tolerance and identifies those shared by 2+ features.
 */
export function buildSharedVertexIndex(
  features: Array<{
    featureId: string;
    geometry: Polygon | MultiPolygon;
  }>,
  tolerance: number = DEFAULT_TOLERANCE
): SharedVertexData[] {
  const vertices: Vertex[] = features.flatMap(({ featureId, geometry }) =>
    getAllRings(geometry).flatMap((ring, ringIndex) =>
      ring
        .slice(0, openRingLength(ring))
        .map((coord, vertexIndex) => ({ ref: { featureId, ringIndex, vertexIndex }, coord }))
    )
  );

  // Spatial hash grid for efficient proximity search
  const gridSize = tolerance * 2;
  const cellKey = (gx: number, gy: number) => `${gx},${gy}`;
  const cellOf = ([lng, lat]: Position): [number, number] => [
    Math.floor(lng / gridSize),
    Math.floor(lat / gridSize),
  ];
  const grid = new Map<string, Vertex[]>();
  for (const vertex of vertices) {
    const key = cellKey(...cellOf(vertex.coord));
    const cell = grid.get(key) ?? [];
    cell.push(vertex);
    grid.set(key, cell);
  }

  /** Vertices in the 3x3 block of grid cells around `coord`. */
  const candidatesNear = (coord: Position): Vertex[] => {
    const [gx, gy] = cellOf(coord);
    return [-1, 0, 1].flatMap((dx) =>
      [-1, 0, 1].flatMap((dy) => grid.get(cellKey(gx + dx, gy + dy)) ?? [])
    );
  };

  const processed = new Set<Vertex>();
  const sharedVertices: SharedVertexData[] = [];

  for (const vertex of vertices) {
    if (processed.has(vertex)) continue;
    processed.add(vertex);

    const matches = [vertex];
    for (const cand of candidatesNear(vertex.coord)) {
      if (cand.ref.featureId === vertex.ref.featureId || processed.has(cand)) continue;
      if (distanceDeg(vertex.coord, cand.coord) <= tolerance) {
        matches.push(cand);
        processed.add(cand);
      }
    }

    // Only save if shared by 2+ different features
    if (new Set(matches.map((m) => m.ref.featureId)).size >= 2) {
      const mean = (axis: 0 | 1) =>
        Math.round(
          (matches.reduce((sum, m) => sum + m.coord[axis]!, 0) / matches.length) * 100000
        ) / 100000;
      sharedVertices.push({ lng: mean(0), lat: mean(1), featureRefs: matches.map((m) => m.ref) });
    }
  }

  return sharedVertices;
}

/**
 * Moves a shared vertex across all referenced geometries to a new position.
 */
export function moveSharedVertex<T extends Polygon | MultiPolygon>(
  target: SharedVertexData,
  to: Position,
  features: Map<string, T>
): Map<string, T> {
  const updated = new Map<string, T>();

  for (const [id, geom] of features.entries()) {
    const cloned = structuredClone(geom) as T;
    updated.set(id, cloned);
  }

  for (const ref of target.featureRefs) {
    const geom = updated.get(ref.featureId);
    if (!geom) continue;

    if (geom.type === "Polygon") {
      const ring = geom.coordinates[ref.ringIndex];
      if (ring && ring[ref.vertexIndex]) {
        ring[ref.vertexIndex] = [to[0], to[1]];
        // If it was the first vertex, also update closing vertex if closed
        if (ref.vertexIndex === 0 && ring.length > 1) {
          ring[ring.length - 1] = [to[0], to[1]];
        }
      }
    }
  }

  return updated;
}
