/**
 * Border editor vertex drag - the geometry of one drag, kept out of React.
 *
 * A drag starts from the shapes as they were (`startBorderDrag`) and every pointer position is
 * answered from those same shapes (`dragBorderVertex`), so frames never accumulate and nothing
 * outside the touched rings is copied. Neighbour vertices that sit on the dragged one move with it.
 *
 * Pure functions - no React, no map.
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import { distanceDeg, getAllRings, type VertexRef } from "./border-editor";
import { cascadeMoveVertex, vkey, type TopologyRef } from "./topology-engine";

type Shape = Polygon | MultiPolygon;

/** A neighbour vertex this close to the dragged one is the same border point. */
const SHARED_VERTEX_DEGREES = 0.001;
/** The pointer snaps onto a neighbour's border vertex this close to it. */
const SNAP_TO_NEIGHBOR_DEGREES = 0.05;

export interface BorderDragStart {
  featureId: string;
  ringIndex: number;
  vertexIndex: number;
  /** Where the dragged vertex sat when the drag began. */
  at: Position;
  geometry: Shape;
  neighborGeometries: Record<string, Shape>;
  /** Neighbour vertices on the dragged one; they move with it. */
  partners: TopologyRef[];
  /** Every shape a move reads: the edited feature and its neighbours. */
  shapes: Map<string, Shape>;
}

/** What the map draws while the drag runs: the outline, the vertex and the edges around it. */
export interface BorderDragFrame {
  geometry: Shape;
  vertex: Position;
  /** One polyline per feature moved: the previous vertex, the dragged one, the next. */
  edges: Position[][];
}

export function startBorderDrag(
  featureId: string,
  geometry: Shape,
  neighborGeometries: Record<string, Shape>,
  vertex: VertexRef
): BorderDragStart {
  const at = getAllRings(geometry)[vertex.ringIndex]?.[vertex.vertexIndex] ?? vertex.coord;
  const shapes = new Map(Object.entries(neighborGeometries));
  shapes.set(featureId, geometry);
  return {
    featureId,
    ringIndex: vertex.ringIndex,
    vertexIndex: vertex.vertexIndex,
    at,
    geometry,
    neighborGeometries,
    shapes,
    partners: Object.entries(neighborGeometries).flatMap(([id, g]) =>
      getAllRings(g).flatMap((ring, ringIndex) =>
        ring.flatMap((c, vertexIndex) =>
          distanceDeg(c, at) < SHARED_VERTEX_DEGREES
            ? [{ featureId: id, ringIndex, vertexIndex }]
            : []
        )
      )
    ),
  };
}

/**
 * The nearest neighbour border vertex within snapping range, or the point itself. The vertices on
 * the dragged one are skipped: they are about to move, so they are not a place to land.
 */
function snapToNeighborVertex(point: Position, start: BorderDragStart): Position {
  let best: Position = point;
  let bestDist = Infinity;
  for (const shape of Object.values(start.neighborGeometries)) {
    for (const ring of getAllRings(shape)) {
      for (const coord of ring) {
        const dx = coord[0]! - point[0]!;
        const dy = coord[1]! - point[1]!;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SNAP_TO_NEIGHBOR_DEGREES && dist < bestDist) {
          if (distanceDeg(coord, start.at) < SHARED_VERTEX_DEGREES) continue;
          bestDist = dist;
          best = coord;
        }
      }
    }
  }
  return best === point ? point : [...best];
}

/** The vertex with its neighbours in the ring (a closed ring wraps), as a polyline. */
function polylineAround(shape: Shape, ringIndex: number, vertexIndex: number): Position[] {
  const ring = getAllRings(shape)[ringIndex];
  if (!ring || ring.length === 0) return [];
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const length =
    ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.length - 1 : ring.length;
  return [
    ring[(vertexIndex - 1 + length) % length]!,
    ring[vertexIndex]!,
    ring[(vertexIndex + 1) % length]!,
  ];
}

function edgesAround(
  start: BorderDragStart,
  geometry: Shape,
  moved: Record<string, Shape>
): Position[][] {
  const edges = [polylineAround(geometry, start.ringIndex, start.vertexIndex)];
  const seen = new Set<string>();
  for (const { featureId, ringIndex, vertexIndex } of start.partners) {
    const shape = moved[featureId];
    const polyline = shape && polylineAround(shape, ringIndex, vertexIndex);
    // A closed ring's first and closing vertex are the same point: draw it once
    const key = polyline && `${featureId}:${ringIndex}:${polyline.map((p) => p.join()).join(">")}`;
    if (!polyline || !key || seen.has(key)) continue;
    seen.add(key);
    edges.push(polyline);
  }
  return edges;
}

export interface BorderDragStep {
  /** Where the vertex landed, after snapping. */
  to: Position;
  /** The edited feature with the vertex moved. */
  geometry: Shape;
  /** The neighbours that moved with it, by feature id. */
  moved: Record<string, Shape>;
  frame: BorderDragFrame;
}

/** The drag with the pointer at `pointer`. */
export function dragBorderVertex(start: BorderDragStart, pointer: Position): BorderDragStep {
  const to = snapToNeighborVertex(pointer, start);
  const key = vkey(to);
  const self: TopologyRef = {
    featureId: start.featureId,
    ringIndex: start.ringIndex,
    vertexIndex: start.vertexIndex,
  };
  // The drag's vertices as a one-bucket index keyed where they move to
  const updated = cascadeMoveVertex(
    new Map([[key, [self, ...start.partners]]]),
    start.shapes,
    key,
    to
  );
  const geometry = updated.get(start.featureId) ?? start.geometry;
  updated.delete(start.featureId);
  const moved = Object.fromEntries(updated);
  return {
    to,
    geometry,
    moved,
    frame: { geometry, vertex: to, edges: edgesAround(start, geometry, moved) },
  };
}
