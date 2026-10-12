/**
 * scripts/perf/atlas-bench-reshape.ts - the region-reshape acceptance measurement of `bun run perf:atlas`: how often
 * the overlap check runs while a region vertex is dragged, and after the drop. It mounts the real
 * `useSubdivisionVertexEdit` hook (with `useVertexEditPointer`) in jsdom on the subdivisions of the database's
 * largest country, over a fake map that records its listeners, drags a vertex a neighbouring region shares through
 * 10 moves, and counts the calls of `calculateOverlapGeoJson`.
 */
import { JSDOM } from "jsdom";
import { setTimeout as sleep } from "node:timers/promises";
import type { FeatureCollection, MultiPolygon, Point, Polygon, Position } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorFeature } from "~/hooks/map-editor/editor-types";
import { getAllRings } from "~/lib/maps/border-editor";
import { buildTopologyIndex, vkey } from "~/lib/maps/topology-engine";
import { exactly, median, type TargetResult } from "./atlas-bench-report";
import { client } from "./atlas-bench-client";

type Shape = Polygon | MultiPolygon;
/** The Bun test module, which the repo's typecheck has no types for: only `mock.module` is used, from here. */
const BUN_TEST = "bun:test";
interface BunMock {
  mock: { module(specifier: string, factory: () => object): void };
}
const MOVES = 10;
/** Pointer travel per move, in degrees, and in screen pixels (past the 4 px dead zone of a drag). */
const STEP_DEGREES = 0.0004;
const STEP_PIXELS = 10;

interface Region {
  id: string;
  name: string;
  geometry: Shape;
}

/** The subdivisions of the country that has the most of them. */
async function loadRegions(): Promise<Region[]> {
  return client.$queryRaw<Region[]>`
    SELECT id, name, geometry FROM subdivisions
    WHERE "countryId" = (SELECT "countryId" FROM subdivisions GROUP BY 1 ORDER BY count(*) DESC LIMIT 1)`;
}

const pointCount = (shape: Shape) => getAllRings(shape).reduce((sum, ring) => sum + ring.length, 0);

interface Grab {
  region: Region;
  ringIndex: number;
  vertexIndex: number;
  coord: Position;
}

/** A vertex of the biggest region that has one in common with another region (the cascade case). */
function sharedVertex(regions: Region[]): Grab | null {
  const index = buildTopologyIndex(regions);
  for (const region of [...regions].sort(
    (a, b) => pointCount(b.geometry) - pointCount(a.geometry)
  )) {
    const rings = getAllRings(region.geometry);
    for (const [ringIndex, ring] of rings.entries()) {
      for (const [vertexIndex, coord] of ring.entries()) {
        const sharers = index.get(vkey(coord)) ?? [];
        if (sharers.some((ref) => ref.featureId !== region.id)) {
          return { region, ringIndex, vertexIndex, coord };
        }
      }
    }
  }
  return null;
}

// --- The harness: a DOM, animation frames by hand, and a map that records its listeners --------------------------

interface FakeEvent {
  point?: { x: number; y: number };
  lngLat?: { lng: number; lat: number };
  originalEvent?: { shiftKey: boolean };
  preventDefault?: () => void;
  features?: Array<{ properties: { ringIndex: number; vertexIndex: number }; geometry: Point }>;
}
type Handler = (event: FakeEvent) => void;

function fakeMap() {
  const handlers = new Map<string, Handler[]>();
  const on = (type: string, layerOrHandler: string | Handler, handler?: Handler) => {
    const key = typeof layerOrHandler === "string" ? `${type}:${layerOrHandler}` : type;
    handlers.set(key, [...(handlers.get(key) ?? []), handler ?? (layerOrHandler as Handler)]);
  };
  const source = { setData: (_: FeatureCollection) => undefined, updateData: () => undefined };
  const canvas = document.createElement("canvas");
  const members: Record<string, object> = {
    on,
    getCanvas: () => canvas,
    getContainer: () => canvas,
    getSource: () => source,
    getLayer: () => undefined,
    dragPan: { enable: () => undefined, disable: () => undefined },
  };
  const map = new Proxy({} as MapLibreMap, {
    get: (_target, name: string) => members[name] ?? (() => undefined),
  });
  return {
    map,
    fire: (key: string, event: FakeEvent) => handlers.get(key)?.forEach((h) => h(event)),
  };
}

/** A requestAnimationFrame stepped by hand: `flush` runs every frame requested so far, and those they request. */
function manualFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      queue.set(next, callback);
      return next++;
    },
    cancelAnimationFrame: (id: number) => void queue.delete(id),
  });
  return () => {
    for (let pass = 0; pass < 3 && queue.size > 0; pass++) {
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((callback) => callback(0));
    }
  };
}

function installDom(): JSDOM {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const name of [
    "window",
    "document",
    "navigator",
    "MouseEvent",
    "KeyboardEvent",
    "HTMLElement",
    "Node",
  ] as const) {
    Reflect.defineProperty(globalThis, name, {
      value: dom.window[name],
      configurable: true,
      writable: true,
    });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  return dom;
}

/**
 * Replaces the overlap check with a counting, timing wrapper around the real one, before the hook loads. Bun makes the
 * original module's exports live views of the mock, so the real function is copied out first.
 */
async function countOverlapChecks() {
  const real = { ...(await import("~/components/maps/editor/utils/map-helpers")) };
  const { mock }: BunMock = await import(BUN_TEST);
  const calls: number[] = [];
  mock.module("~/components/maps/editor/utils/map-helpers", () => ({
    ...real,
    calculateOverlapGeoJson: (...args: Parameters<typeof real.calculateOverlapGeoJson>) => {
      const startedAt = performance.now();
      const result = real.calculateOverlapGeoJson(...args);
      calls.push(performance.now() - startedAt);
      return result;
    },
  }));
  return calls;
}

const asFeature = ({ id, name, geometry }: Region): EditorFeature => ({
  id,
  type: "subdivision",
  name,
  geometry,
  properties: {},
});

/** Region reshape: overlap checks while a vertex is dragged (must be none) and on the drop (one). */
export async function reshapeTargets(): Promise<TargetResult[]> {
  process.stderr.write(
    "region reshape: mounting the vertex edit hook on the largest country's regions\n"
  );
  const regions = await loadRegions();
  const grab = sharedVertex(regions);
  if (!grab) {
    const detail = "no region of the largest country shares a vertex with another";
    return [exactly("region reshape: overlap checks while dragging", Number.NaN, 0, "", detail)];
  }
  const dom = installDom();
  const flushFrames = manualFrames();
  const overlapMs = await countOverlapChecks();
  const { useSubdivisionVertexEdit } =
    await import("~/components/maps/editor/hooks/useSubdivisionVertexEdit");
  const { renderHook } = await import("@testing-library/react");
  const { map, fire } = fakeMap();
  const features = regions.map(asFeature);
  const mounted = renderHook(() =>
    useSubdivisionVertexEdit({
      map,
      isLoaded: true,
      mode: "edit-subdivision",
      selectedFeature: features.find((f) => f.id === grab.region.id) ?? null,
      features,
      countryGeometry: null,
      snapEnabled: false,
    })
  );
  const atEntry = overlapMs.length;
  fire("mousedown:editor-vedit-vertices-layer", {
    point: { x: 0, y: 0 },
    preventDefault: () => undefined,
    features: [
      {
        properties: { ringIndex: grab.ringIndex, vertexIndex: grab.vertexIndex },
        geometry: { type: "Point", coordinates: grab.coord },
      },
    ],
  });
  const frameMs: number[] = [];
  for (let move = 1; move <= MOVES; move++) {
    const startedAt = performance.now();
    fire("mousemove", {
      point: { x: STEP_PIXELS * (move + 1), y: 0 },
      lngLat: { lng: grab.coord[0]! + STEP_DEGREES * move, lat: grab.coord[1]! },
      originalEvent: { shiftKey: false },
    });
    flushFrames();
    frameMs.push(performance.now() - startedAt);
  }
  // The add-vertex handles follow on a 100 ms throttle: let it fire before counting
  await sleep(150);
  const duringDrag = overlapMs.length - atEntry;
  window.dispatchEvent(new dom.window.MouseEvent("mouseup"));
  const afterDrop = overlapMs.length - atEntry - duringDrag;
  mounted.unmount();
  const dropCheckMs = overlapMs.at(-1) ?? Number.NaN;
  const setting = `${regions.length} regions, ${pointCount(grab.region.geometry)} points in ${grab.region.name}`;
  return [
    exactly(
      `region reshape: overlap checks during a ${MOVES}-move drag`,
      // The count means something only if the wrapper is live: the session opening runs the check once
      atEntry > 0 ? duringDrag : Number.NaN,
      0,
      "",
      `${setting}; ${MOVES} drag frames median ${median(frameMs).toFixed(2)} / max ${Math.max(...frameMs).toFixed(2)} ms; the check is live: ${atEntry} ran when the edit session opened`
    ),
    exactly(
      "region reshape: overlap checks after mouse-up",
      afterDrop,
      1,
      "",
      `the one check on the drop took ${dropCheckMs.toFixed(1)} ms, against the regions sharing a vertex with the edited one`
    ),
  ];
}
