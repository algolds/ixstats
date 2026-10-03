/**
 * Topology Engine — shared-edge cascading for subdivision vertex editing.
 *
 * Pure functions — no React, no database, no side effects.
 * Builds a spatial-hash index of polygon vertices so that dragging a shared
 * boundary vertex can cascade the move to all adjacent features in O(1).
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import { getAllRings } from "./border-editor";

type VertexKey = string & { readonly __brand: "VertexKey" };

export interface TopologyRef {
  featureId: string;
  ringIndex: number;
  vertexIndex: number;
}

/**
 * Spatial hash: quantized coordinate key → list of feature/ring/vertex refs
 * that share that coordinate.
 */
export type TopologyIndex = Map<VertexKey, TopologyRef[]>;

/**
 * Quantize a coordinate to given decimal places (~1.1 m precision at 5 decimals) for
 * spatial-hash bucketing.
 */
function toVertexKey(coord: Position, precision = 5): VertexKey {
  return `${coord[0]!.toFixed(precision)},${coord[1]!.toFixed(precision)}` as VertexKey;
}

export function vkey(coord: Position): VertexKey {
  return toVertexKey(coord, 5);
}

/** Whether the last vertex of a non-empty ring repeats the first. */
function endsMatch(ring: Position[]): boolean {
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] === last[0] && first[1] === last[1];
}

/**
 * Build a spatial-hash topology index from a set of polygon features.
 * Every vertex in every ring of every feature is hashed; shared vertices
 * (same quantized coordinate) appear in the same bucket with refs to each
 * owning feature.
 *
 * The closing vertex of each ring (which duplicates the first vertex) is
 * skipped — ring closure is handled by `cascadeMoveVertex`.
 */
export function buildTopologyIndex(
  features: Array<{ id: string; geometry: Polygon | MultiPolygon }>
): TopologyIndex {
  const index: TopologyIndex = new Map();

  for (const feat of features) {
    const rings = getAllRings(feat.geometry);
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri]!;
      // Skip the closing vertex (same as ring[0])
      const len = ring.length > 0 && endsMatch(ring) ? ring.length - 1 : ring.length;
      for (let vi = 0; vi < len; vi++) {
        const key = vkey(ring[vi]!);
        let bucket = index.get(key);
        if (!bucket) {
          bucket = [];
          index.set(key, bucket);
        }
        bucket.push({ featureId: feat.id, ringIndex: ri, vertexIndex: vi });
      }
    }
  }

  return index;
}

/**
 * Given a topology index, move every vertex that shares the `oldKey`
 * coordinate to `newCoord`. Returns a map of featureId → updated geometry
 * for every feature that was modified (including the primary feature).
 *
 * **Mutates the index** to keep it in sync (moves refs from oldKey to newKey).
 * Callers should hold a single index ref per editing session.
 */
export function cascadeMoveVertex(
  index: TopologyIndex,
  geometries: Map<string, Polygon | MultiPolygon>,
  oldKey: VertexKey | string,
  newCoord: Position
): Map<string, Polygon | MultiPolygon> {
  const vKey = oldKey as VertexKey;
  const refs = index.get(vKey);
  const updated = new Map<string, Polygon | MultiPolygon>();
  if (!refs || refs.length === 0) return updated;

  const moved = (): Position => [newCoord[0]!, newCoord[1]!];

  for (const ref of refs) {
    // Get or clone the geometry
    const original = geometries.get(ref.featureId);
    const geom =
      updated.get(ref.featureId) ??
      (original && (structuredClone(original) as Polygon | MultiPolygon));
    if (!geom) continue;

    const ring = getAllRings(geom)[ref.ringIndex];
    if (!ring || ref.vertexIndex >= ring.length) continue;

    ring[ref.vertexIndex] = moved();

    // Keep a closed ring closed: moving the first vertex moves the last, and vice versa
    const originalRing = original && getAllRings(original)[ref.ringIndex];
    if (originalRing && originalRing.length > 1 && endsMatch(originalRing) && ring.length > 1) {
      if (ref.vertexIndex === 0) ring[ring.length - 1] = moved();
      if (ref.vertexIndex === ring.length - 1) ring[0] = moved();
    }

    updated.set(ref.featureId, geom);
  }

  // Migrate refs from the old key to the new one
  const newKey = vkey(newCoord);
  if (vKey !== newKey) {
    index.delete(vKey);
    index.set(newKey, [...(index.get(newKey) || []), ...refs]);
  }

  return updated;
}
