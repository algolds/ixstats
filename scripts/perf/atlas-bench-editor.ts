/**
 * scripts/perf/atlas-bench-editor.ts - the border editor's acceptance measurements of `bun run perf:atlas`: the JS
 * cost of one frame of a vertex drag on Caphiria (gated on the 95th percentile after a warm-up; the slowest frame is
 * printed), and the size of the autosave payload after 50 drags. Both run the
 * pure functions the editor uses (`border-drag.ts`, `border-draft.ts`) on Ixnay's political layer from the database;
 * no React, no map.
 */
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import { collection, lineFeature, pointFeature } from "~/components/maps/editor/utils/map-helpers";
import { buildBorderDraft } from "~/lib/maps/border-draft";
import { calculateArea, getAllRings, type VertexRef } from "~/lib/maps/border-editor";
import { dragBorderVertex, startBorderDrag, type BorderDragStart } from "~/lib/maps/border-drag";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { atMost, info, median, percentile, type TargetResult } from "./atlas-bench-report";
import { client } from "./atlas-bench-client";

type Shape = Polygon | MultiPolygon;

const EDITED_FEATURE = "Caphiria";
const DRAG_FRAMES = 60;
const AUTOSAVE_DRAGS = 50;
/** The editor loads neighbours whose bounding box comes within this many degrees of the edited feature's. */
const NEIGHBOR_MARGIN_DEGREES = 1;
/** Pointer travel per frame, in degrees. */
const STEP_DEGREES = 0.001;
/** Autosave budget: 1 MB. */
const AUTOSAVE_LIMIT_KB = 1024;
const FRAME_LIMIT_MS = 4;
/** Frames before the measured ones: the first run of the drag path is the JIT compiling it, which a drag in the
 * editor pays once on its first frames and a mean over 60 frames hides. */
const WARMUP_FRAMES = 5;
/** The drag target is gated on this percentile of the frames after the warm-up, so one slow frame in twenty can
 * show; the slowest frame is printed beside it. */
const FRAME_PERCENTILE = 0.95;

interface PoliticalFeature {
  featureId: string;
  boundingBox: number[] | null;
  geometry: Shape;
}

async function loadPolitical(): Promise<PoliticalFeature[]> {
  return client.$queryRaw<PoliticalFeature[]>`
    SELECT "featureId", "boundingBox", geometry FROM map_layers
    WHERE "worldId" = ${DEFAULT_REALM_ID} AND "layerType" = 'political' AND "isActive"`;
}

/** The features whose bounding box lies within the margin of the edited feature's, by id. */
function neighborsOf(
  edited: PoliticalFeature,
  all: readonly PoliticalFeature[]
): Record<string, Shape> {
  const [west = 0, south = 0, east = 0, north = 0] = edited.boundingBox ?? [];
  const near = ([w = 0, s = 0, e = 0, n = 0]: number[]) =>
    w < east + NEIGHBOR_MARGIN_DEGREES &&
    e > west - NEIGHBOR_MARGIN_DEGREES &&
    s < north + NEIGHBOR_MARGIN_DEGREES &&
    n > south - NEIGHBOR_MARGIN_DEGREES;
  return Object.fromEntries(
    all
      .filter((f) => f.featureId !== edited.featureId && f.boundingBox && near(f.boundingBox))
      .map((f) => [f.featureId, f.geometry])
  );
}

/** A vertex of the feature's largest ring that a neighbour shares: the common drag, where the neighbour moves too. */
function sharedVertex(
  edited: PoliticalFeature,
  neighbors: Record<string, Shape>
): VertexRef | null {
  const rings = getAllRings(edited.geometry);
  const bySize = rings.map((_, i) => i).sort((a, b) => rings[b]!.length - rings[a]!.length);
  for (const ringIndex of bySize) {
    const ring = rings[ringIndex]!;
    for (let vertexIndex = 0; vertexIndex < ring.length; vertexIndex += 7) {
      const vertex = { ringIndex, vertexIndex, coord: ring[vertexIndex]! };
      const start = startBorderDrag(edited.featureId, edited.geometry, neighbors, vertex);
      if (start.partners.length > 0) return vertex;
    }
  }
  return null;
}

// --- What a frame costs ------------------------------------------------------------------------------------------

type Nested = number | Nested[];
const copyNested = (value: Nested): Nested =>
  typeof value === "number" ? value : value.map(copyNested);

/** MapLibre copies a source's GeoJSON on the main thread, then structured-clones it to post it to the worker. */
function serialize(fc: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.map((feature): Feature => ({
      type: "Feature",
      properties: { ...feature.properties },
      geometry: copyGeometry(feature.geometry),
    })),
  };
}

const copyGeometry = (geometry: Geometry): Geometry =>
  geometry.type === "GeometryCollection"
    ? geometry
    : ({ type: geometry.type, coordinates: copyNested(geometry.coordinates) } as Geometry);

/**
 * One drag frame as the editor does it (`useBorderDrag.handleVertexDrag` and `useBorderEditorLayers`): move the
 * vertex and its shared partners, the live area, the border-drag overlay (vertex and its edges), the outline's
 * source data, each copied and posted to a worker the way `setData` does.
 */
function dragFrame(start: BorderDragStart, pointer: Position): void {
  const { geometry, frame } = dragBorderVertex(start, pointer);
  calculateArea(geometry);
  const overlay = collection([
    pointFeature(frame.vertex),
    ...frame.edges.map((edge) => lineFeature(edge)),
  ]);
  const outline = collection([{ type: "Feature", geometry, properties: {} }]);
  structuredClone(serialize(overlay));
  structuredClone(serialize(outline));
}

const pointerAt = (vertex: Position, step: number): Position => [
  vertex[0]! + STEP_DEGREES * step,
  vertex[1]!,
];

/** Wall time of each of `DRAG_FRAMES` frames of a drag from the shared vertex. */
function timeDrag(start: BorderDragStart): number[] {
  const times: number[] = [];
  for (let frame = 1; frame <= DRAG_FRAMES; frame++) {
    const startedAt = performance.now();
    dragFrame(start, pointerAt(start.at, frame));
    times.push(performance.now() - startedAt);
  }
  return times;
}

// --- Autosave after 50 drags -------------------------------------------------------------------------------------

/** Fifty separate drags of the shared vertex, each from where the last left the shapes; the draft autosave stores. */
function draftAfterDrags(
  edited: PoliticalFeature,
  neighbors: Record<string, Shape>,
  vertex: VertexRef
): string {
  let geometry = edited.geometry;
  let current = { ...neighbors };
  for (let drag = 1; drag <= AUTOSAVE_DRAGS; drag++) {
    const at = getAllRings(geometry)[vertex.ringIndex]![vertex.vertexIndex]!;
    const start = startBorderDrag(edited.featureId, geometry, current, { ...vertex, coord: at });
    const step = dragBorderVertex(start, pointerAt(vertex.coord, drag));
    geometry = step.geometry;
    current = { ...current, ...step.moved };
  }
  const dirtyNeighbors = Object.fromEntries(
    Object.entries(current).filter(([id, shape]) => shape !== neighbors[id])
  );
  return JSON.stringify(
    buildBorderDraft({ featureId: edited.featureId, geometry, dirtyNeighbors, savedAt: Date.now() })
  );
}

/** Caphiria's drag frame cost and its autosave payload after 50 drags. */
export async function borderEditorTargets(): Promise<TargetResult[]> {
  process.stderr.write("border editor: drag frames and autosave payload on Caphiria\n");
  const all = await loadPolitical();
  const edited = all.find((f) => f.featureId === EDITED_FEATURE);
  const neighbors = edited ? neighborsOf(edited, all) : {};
  const vertex = edited ? sharedVertex(edited, neighbors) : null;
  if (!edited || !vertex) {
    const detail = `no ${EDITED_FEATURE} feature, or no vertex a neighbour shares, in Ixnay's political layer`;
    return [
      atMost(
        "border editor: JS per drag frame, p95 (Caphiria)",
        Number.NaN,
        FRAME_LIMIT_MS,
        "ms",
        detail
      ),
      atMost("border editor: autosave payload", Number.NaN, AUTOSAVE_LIMIT_KB, "KB", detail),
    ];
  }
  const grabbedAt = performance.now();
  const start = startBorderDrag(edited.featureId, edited.geometry, neighbors, vertex);
  const grabMs = performance.now() - grabbedAt;
  const times = timeDrag(start);
  const measured = times.slice(WARMUP_FRAMES);
  const mean = measured.reduce((sum, time) => sum + time, 0) / measured.length;
  const payloadKb = Buffer.byteLength(draftAfterDrags(edited, neighbors, vertex)) / 1024;
  const points = getAllRings(edited.geometry).reduce((sum, ring) => sum + ring.length, 0);
  const slowest = Math.max(...times);
  return [
    atMost(
      "border editor: JS per drag frame, p95 (Caphiria)",
      percentile(measured, FRAME_PERCENTILE),
      FRAME_LIMIT_MS,
      "ms",
      `p95 of ${measured.length} frames after ${WARMUP_FRAMES} warm-up frames (mean ${mean.toFixed(2)}, median ${median(measured).toFixed(2)} ms); ${points} points, ${Object.keys(neighbors).length} neighbours, ${start.partners.length} moving with the vertex`
    ),
    info(
      "border editor: slowest drag frame (Caphiria)",
      slowest,
      "ms",
      `frame ${times.indexOf(slowest) + 1} of ${DRAG_FRAMES} (the warm-up frames included); grabbing the vertex (startBorderDrag) took ${grabMs.toFixed(2)} ms`
    ),
    atMost(
      `border editor: autosave payload after ${AUTOSAVE_DRAGS} drags`,
      payloadKb,
      AUTOSAVE_LIMIT_KB,
      "KB",
      "featureId, geometry, dirtyNeighbors, savedAt (border-draft.ts); the undo stack is not stored"
    ),
  ];
}
