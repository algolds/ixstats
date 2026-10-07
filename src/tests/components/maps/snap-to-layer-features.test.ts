import type { FeatureCollection, Position } from "geojson";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { distanceDeg, projectPointToSegment } from "~/lib/maps/planar";

const buildSpy = jest.fn();
jest.mock("~/lib/maps/segment-grid", () => {
  const actual = jest.requireActual("~/lib/maps/segment-grid");
  return {
    ...actual,
    buildSegmentGrid: (...args: unknown[]) => {
      buildSpy();
      return actual.buildSegmentGrid(...args);
    },
  };
});

import { snapToLayerFeatures } from "~/components/maps/editor/utils/map-helpers";

const ORDER = ["rivers", "lakes", "background", "altitudes", "climate"];

/** Today's algorithm: every segment of every visible snap layer, in layer then feature order. */
function reference(p: Position, layers: MapLayerData[], visible: Set<string>, tol: number) {
  let best: Position = p;
  let bestDist = Infinity;
  for (const type of ORDER) {
    if (!visible.has(type)) continue;
    for (const f of layers.find((l) => l.type === type)?.data.features ?? []) {
      const g = f.geometry as { type: string; coordinates: Position[] | Position[][] };
      const runs = (g.type === "LineString" ? [g.coordinates] : g.coordinates) as Position[][];
      for (const run of runs) {
        for (let i = 0; i < run.length - 1; i++) {
          const proj = projectPointToSegment(p, run[i]!, run[i + 1]!);
          const d = distanceDeg(p, proj);
          if (d < bestDist && d <= tol) [bestDist, best] = [d, proj];
        }
      }
    }
  }
  return best;
}

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

/** A layer of random wiggly lines (or closed rings for polygon layers). */
function layer(type: string, seed: number, polygons: boolean): MapLayerData {
  const rand = rng(seed);
  const fc: FeatureCollection = { type: "FeatureCollection", features: [] };
  for (let f = 0; f < 25; f++) {
    const run: Position[] = [[rand() * 4, rand() * 4]];
    for (let i = 0; i < 15; i++) {
      const [x, y] = run[run.length - 1]!;
      run.push([x! + (rand() - 0.5) * 0.1, y! + (rand() - 0.5) * 0.1]);
    }
    if (polygons) run.push(run[0]!);
    fc.features.push({
      type: "Feature",
      properties: {},
      geometry: polygons
        ? { type: "Polygon", coordinates: [run] }
        : { type: "LineString", coordinates: run },
    });
  }
  return { type: type as MapLayerData["type"], data: fc, visible: true };
}

describe("snapToLayerFeatures", () => {
  const layers = [
    layer("rivers", 1, false),
    layer("lakes", 2, true),
    layer("altitudes", 3, true),
    layer("climate", 4, true),
  ];

  it("snaps exactly as a scan of every visible layer does, layer order and all", () => {
    const rand = rng(9);
    for (const visible of [
      new Set(ORDER),
      new Set(["lakes", "climate"]),
      new Set(["rivers"]),
      new Set<string>(),
    ]) {
      for (let i = 0; i < 400; i++) {
        const p: Position = [rand() * 4.2 - 0.1, rand() * 4.2 - 0.1];
        expect(snapToLayerFeatures(p as [number, number], layers, visible, 0.02)).toEqual(
          reference(p, layers, visible, 0.02)
        );
      }
    }
  });

  it("indexes each layer's data once, not on every move", () => {
    const fresh = [layer("rivers", 11, false), layer("altitudes", 12, true)];
    buildSpy.mockClear();
    const visible = new Set(ORDER);
    for (let i = 0; i < 50; i++) snapToLayerFeatures([1 + i * 0.01, 1], fresh, visible, 0.02);
    expect(buildSpy).toHaveBeenCalledTimes(2);
  });
});
