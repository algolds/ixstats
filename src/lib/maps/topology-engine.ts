/**
 * Topology Engine — shared-edge cascading for subdivision vertex editing.
 *
 * Pure functions — no React, no database, no side effects.
 * Builds a spatial-hash index of polygon vertices so that dragging a shared
 * boundary vertex can cascade the move to all adjacent features in O(1).
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import { getAllRings } from "./border-editor";

// ── Types ──

export interface TopologyRef {
  featureId: string;
  ringIndex: number;
  vertexIndex: number;
}

/**
 * Spatial hash: quantized coordinate key → list of feature/ring/vertex refs
 * that share that coordinate.
 */
export type TopologyIndex = Map<string, TopologyRef[]>;

// ── Coordinate quantization ──

/**
 * Quantize a coordinate to 5 decimal places (~1.1 m precision) for
 * spatial-hash bucketing. Two coordinates that are within ~1.1 m of each
 * other will hash to the same key.
 */
export function vkey(coord: Position): string {
  return `${coord[0]!.toFixed(5)},${coord[1]!.toFixed(5)}`;
}

// ── Index building ──

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
      const len =
        ring.length > 0 &&
        ring[0]![0] === ring[ring.length - 1]![0] &&
        ring[0]![1] === ring[ring.length - 1]![1]
          ? ring.length - 1
          : ring.length;
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

// ── Cascade moves ──

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
  oldKey: string,
  newCoord: Position
): Map<string, Polygon | MultiPolygon> {
  const refs = index.get(oldKey);
  const updated = new Map<string, Polygon | MultiPolygon>();
  if (!refs || refs.length === 0) return updated;

  for (const ref of refs) {
    // Get or clone the geometry
    let geom = updated.get(ref.featureId);
    if (!geom) {
      const src = geometries.get(ref.featureId);
      if (!src) continue;
      geom = JSON.parse(JSON.stringify(src)) as Polygon | MultiPolygon;
    }

    const rings = getAllRings(geom);
    const ring = rings[ref.ringIndex];
    if (!ring || ref.vertexIndex >= ring.length) continue;

    // Move the vertex
    ring[ref.vertexIndex] = [newCoord[0]!, newCoord[1]!];

    // Maintain ring closure: if we moved vertex 0, also update the last vertex
    if (ref.vertexIndex === 0 && ring.length > 1) {
      // Check if the ring was closed (last === first before move)
      const origFirst = geometries.get(ref.featureId);
      if (origFirst) {
        const origRings = getAllRings(origFirst);
        const origRing = origRings[ref.ringIndex];
        if (origRing && origRing.length > 1) {
          const of = origRing[0]!;
          const ol = origRing[origRing.length - 1]!;
          if (of[0] === ol[0] && of[1] === ol[1]) {
            ring[ring.length - 1] = [newCoord[0]!, newCoord[1]!];
          }
        }
      }
    }
    // If we moved the last vertex and ring was closed, sync first vertex
    if (ref.vertexIndex === ring.length - 1 && ring.length > 1) {
      const origSrc = geometries.get(ref.featureId);
      if (origSrc) {
        const origRings = getAllRings(origSrc);
        const origRing = origRings[ref.ringIndex];
        if (origRing && origRing.length > 1) {
          const of2 = origRing[0]!;
          const ol2 = origRing[origRing.length - 1]!;
          if (of2[0] === ol2[0] && of2[1] === ol2[1]) {
            ring[0] = [newCoord[0]!, newCoord[1]!];
          }
        }
      }
    }

    updated.set(ref.featureId, geom);
  }

  // Update the index: migrate refs from oldKey to newKey
  const newKey = vkey(newCoord);
  if (oldKey !== newKey) {
    const movedRefs = index.get(oldKey) || [];
    index.delete(oldKey);
    const existing = index.get(newKey) || [];
    index.set(newKey, [...existing, ...movedRefs]);
  }

  return updated;
}
