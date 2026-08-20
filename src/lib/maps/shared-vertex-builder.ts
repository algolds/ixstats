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
import { toVertexKey, type TopologyRef, type VertexKey } from "./topology-engine";

export type FeatureVertexRef = TopologyRef;

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
    const coordMap = featureCoords.get(feature.featureId)!;
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
        const refKey = `${feature.featureId}:${ri}:${vi}`;
        if (processed.has(refKey)) continue;

        const coord = coordMap.get(`${ri}-${vi}`)!;
        const matchedRefs: FeatureVertexRef[] = [
          { featureId: feature.featureId, ringIndex: ri, vertexIndex: vi },
        ];
        processed.add(refKey);

        // Search neighboring grid cells
        const gx = Math.floor(coord[0] / gridSize);
        const gy = Math.floor(coord[1] / gridSize);

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const neighborKey = `${gx + dx},${gy + dy}`;
            const candidates = grid.get(neighborKey) || [];

            for (const cand of candidates) {
              if (cand.featureId === feature.featureId) continue;
              const candKey = `${cand.featureId}:${cand.ringIndex}:${cand.vertexIndex}`;
              if (processed.has(candKey)) continue;

              const candCoords = featureCoords.get(cand.featureId);
              if (!candCoords) continue;
              const candCoord = candCoords.get(
                `${cand.ringIndex}-${cand.vertexIndex}`
              );
              if (!candCoord) continue;

              const dLng = coord[0] - candCoord[0];
              const dLat = coord[1] - candCoord[1];
              const dist = Math.sqrt(dLng * dLng + dLat * dLat);

              if (dist <= tolerance) {
                matchedRefs.push(cand);
                processed.add(candKey);
              }
            }
          }
        }

        // Only save if shared by 2+ different features
        const uniqueFeatures = new Set(matchedRefs.map((r) => r.featureId));
        if (uniqueFeatures.size >= 2) {
          // Average the coordinates of matched vertices
          let avgLng = 0;
          let avgLat = 0;
          for (const ref of matchedRefs) {
            const c = featureCoords
              .get(ref.featureId)!
              .get(`${ref.ringIndex}-${ref.vertexIndex}`)!;
            avgLng += c[0];
            avgLat += c[1];
          }
          avgLng /= matchedRefs.length;
          avgLat /= matchedRefs.length;

          sharedVertices.push({
            lng: Math.round(avgLng * 100000) / 100000,
            lat: Math.round(avgLat * 100000) / 100000,
            featureRefs: matchedRefs,
          });
        }
      }
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
    const cloned = JSON.parse(JSON.stringify(geom)) as T;
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

