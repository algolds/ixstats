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

export interface FeatureVertexRef {
  featureId: string;
  ringIndex: number;
  vertexIndex: number;
}

export interface SharedVertexData {
  lng: number;
  lat: number;
  featureRefs: FeatureVertexRef[];
}

/** Tolerance in degrees for matching vertices (~111m at equator) */
const DEFAULT_TOLERANCE = 0.001;

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
  // Spatial hash grid for efficient proximity search
  const gridSize = tolerance * 2;
  const grid = new Map<string, FeatureVertexRef[]>();

  function gridKey(lng: number, lat: number): string {
    const gx = Math.floor(lng / gridSize);
    const gy = Math.floor(lat / gridSize);
    return `${gx},${gy}`;
  }

  // Extract all vertices and insert into spatial hash
  for (const feature of features) {
    const rings = getAllRings(feature.geometry);
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri]!;
      // Skip ring-closing duplicate
      const len =
        ring.length > 1 &&
        ring[0]![0] === ring[ring.length - 1]![0] &&
        ring[0]![1] === ring[ring.length - 1]![1]
          ? ring.length - 1
          : ring.length;

      for (let vi = 0; vi < len; vi++) {
        const coord = ring[vi]!;
        const key = gridKey(coord[0], coord[1]);
        const ref: FeatureVertexRef = {
          featureId: feature.featureId,
          ringIndex: ri,
          vertexIndex: vi,
        };

        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(ref);
      }
    }
  }

  // Now group vertices within tolerance across features
  const featureCoords = new Map<string, Map<string, Position>>();
  for (const feature of features) {
    const coordMap = new Map<string, Position>();
    const rings = getAllRings(feature.geometry);
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri]!;
      const len =
        ring.length > 1 &&
        ring[0]![0] === ring[ring.length - 1]![0] &&
        ring[0]![1] === ring[ring.length - 1]![1]
          ? ring.length - 1
          : ring.length;
      for (let vi = 0; vi < len; vi++) {
        coordMap.set(`${ri}-${vi}`, ring[vi]!);
      }
    }
    featureCoords.set(feature.featureId, coordMap);
  }

  // Group matching vertices
  const processed = new Set<string>();
  const sharedVertices: SharedVertexData[] = [];

  for (const feature of features) {
    const coords = featureCoords.get(feature.featureId)!;
    for (const [refKey, coord] of coords) {
      const globalKey = `${feature.featureId}:${refKey}`;
      if (processed.has(globalKey)) continue;

      const [riStr, viStr] = refKey.split("-");
      const group: FeatureVertexRef[] = [
        {
          featureId: feature.featureId,
          ringIndex: parseInt(riStr!, 10),
          vertexIndex: parseInt(viStr!, 10),
        },
      ];
      processed.add(globalKey);

      // Search all other features for matching vertices
      for (const otherFeature of features) {
        if (otherFeature.featureId === feature.featureId) continue;
        const otherCoords = featureCoords.get(otherFeature.featureId)!;

        for (const [otherRefKey, otherCoord] of otherCoords) {
          const otherGlobalKey = `${otherFeature.featureId}:${otherRefKey}`;
          if (processed.has(otherGlobalKey)) continue;

          const dist = Math.sqrt(
            Math.pow(coord[0] - otherCoord[0], 2) +
              Math.pow(coord[1] - otherCoord[1], 2)
          );

          if (dist <= tolerance) {
            const [oRi, oVi] = otherRefKey.split("-");
            group.push({
              featureId: otherFeature.featureId,
              ringIndex: parseInt(oRi!, 10),
              vertexIndex: parseInt(oVi!, 10),
            });
            processed.add(otherGlobalKey);
          }
        }
      }

      // Only record if shared by 2+ features
      if (group.length >= 2) {
        // Use the first vertex's coordinate as the canonical position
        sharedVertices.push({
          lng: coord[0],
          lat: coord[1],
          featureRefs: group,
        });
      }
    }
  }

  return sharedVertices;
}

/**
 * Move a shared vertex, returning updated geometries for ALL affected features.
 */
export function moveSharedVertex(
  sharedVertex: SharedVertexData,
  to: Position,
  featureGeometries: Map<string, Polygon | MultiPolygon>
): Map<string, Polygon | MultiPolygon> {
  const updated = new Map<string, Polygon | MultiPolygon>();

  for (const ref of sharedVertex.featureRefs) {
    const geometry = featureGeometries.get(ref.featureId);
    if (!geometry) continue;

    const rings = getAllRings(geometry).map((r) => [...r.map((c) => [...c] as Position)]);
    const ring = rings[ref.ringIndex];
    if (!ring) continue;

    ring[ref.vertexIndex] = [...to];

    // Update ring closure if needed
    if (
      ref.vertexIndex === 0 &&
      ring.length > 1 &&
      ring[0]![0] === ring[ring.length - 1]![0] &&
      ring[0]![1] === ring[ring.length - 1]![1]
    ) {
      ring[ring.length - 1] = [...to];
    }

    // Rebuild geometry preserving type
    if (geometry.type === "Polygon") {
      updated.set(ref.featureId, { type: "Polygon", coordinates: rings });
    } else {
      // Reconstruct MultiPolygon
      const result: Position[][][] = [];
      let ringIdx = 0;
      for (const polygon of geometry.coordinates) {
        const polyRings: Position[][] = [];
        for (let r = 0; r < polygon.length; r++) {
          if (ringIdx < rings.length) {
            polyRings.push(rings[ringIdx]!);
            ringIdx++;
          }
        }
        if (polyRings.length > 0) result.push(polyRings);
      }
      updated.set(ref.featureId, {
        type: "MultiPolygon",
        coordinates: result,
      });
    }
  }

  return updated;
}
