/**
 * UPG v2 — polygon merge
 *
 * The merge matches vertices by quantised integer keys. The reference below is the earlier
 * implementation (vertices keyed by `toFixed(6)` strings); on a fixed world both must find the same
 * rings for every cell set the exporter merges. The merge differs from it in what it does with the
 * rings: it sorts them into shells and holes by orientation, cuts them at the latitude limit, and
 * marks where the region across a ring's edge changes.
 */

import type { Position } from "geojson";
import {
  coastCorners,
  groupRings,
  mergeCells,
  ringArea,
  RING_LATITUDE,
  type MergedPolygon,
  type MergedRing,
} from "~/lib/worldgen/v2/helpers/polygon-merge";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { createMesh } from "~/lib/worldgen/v2/mesh";
import type { WorldGraph } from "~/lib/worldgen/v2/types";
import { pointInRing, signedArea } from "~/tests/helpers/ring-geometry";

/** The string-keyed implementation this task replaced, kept verbatim as the oracle. */
function referenceGroups(graph: WorldGraph, cellIds: number[]): number[][] {
  if (cellIds.length === 0) return [];
  const cellSet = new Set(cellIds);
  const visited = new Set<number>();
  const groups: number[][] = [];
  for (const cell of cellIds) {
    if (visited.has(cell)) continue;
    const group: number[] = [];
    const queue = [cell];
    visited.add(cell);
    while (queue.length > 0) {
      const c = queue.pop()!;
      group.push(c);
      for (const nb of graph.cells.neighbors[c]!) {
        const wraps = Math.abs(graph.cells.p[nb * 2]! - graph.cells.p[c * 2]!) > 180;
        if (!wraps && !visited.has(nb) && cellSet.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function referenceSignedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[i + 1]!;
    area += (x1! - x0!) * (y1! + y0!);
  }
  return area / 2;
}

function referenceChain(edges: { p1: Position; p2: Position }[]): Position[][] {
  const adj = new Map<string, { target: Position; used: boolean }[]>();
  const key = (p: Position) => `${p[0]!.toFixed(6)},${p[1]!.toFixed(6)}`;
  for (const edge of edges) {
    const k = key(edge.p1);
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k)!.push({ target: edge.p2, used: false });
  }
  const rings: Position[][] = [];
  for (const edge of edges) {
    const startKey = key(edge.p1);
    const startEntries = adj.get(startKey);
    if (!startEntries) continue;
    const unusedEntry = startEntries.find((e) => !e.used);
    if (!unusedEntry) continue;
    const ring: Position[] = [edge.p1];
    unusedEntry.used = true;
    let current = unusedEntry.target;
    let safety = edges.length + 10;
    while (safety-- > 0) {
      ring.push(current);
      const currKey = key(current);
      if (currKey === startKey && ring.length > 2) {
        rings.push(ring);
        break;
      }
      const nextEntries = adj.get(currKey);
      if (!nextEntries) break;
      const nextEntry = nextEntries.find((e) => !e.used);
      if (!nextEntry) break;
      nextEntry.used = true;
      current = nextEntry.target;
    }
  }
  return rings;
}

function referenceMergeGroup(graph: WorldGraph, cellIds: number[]): Position[][] | null {
  if (cellIds.length === 0) return null;
  if (cellIds.length === 1) {
    const verts = graph.cells.vertices[cellIds[0]!]!;
    if (verts.length < 4) return null;
    return [verts.map(([x, y]) => [x, y] as Position)];
  }
  const directedEdges = new Map<string, { p1: Position; p2: Position }>();
  for (const cellId of cellIds) {
    const verts = graph.cells.vertices[cellId]!;
    if (verts.length < 3) continue;
    for (let i = 0; i < verts.length - 1; i++) {
      const [x0, y0] = verts[i]!;
      const [x1, y1] = verts[i + 1]!;
      const key = `${x0.toFixed(6)},${y0.toFixed(6)}->${x1.toFixed(6)},${y1.toFixed(6)}`;
      directedEdges.set(key, { p1: [x0, y0], p2: [x1, y1] });
    }
  }
  const boundaryEdges: { p1: Position; p2: Position }[] = [];
  for (const [key, edge] of directedEdges) {
    const [startStr, endStr] = key.split("->");
    if (!directedEdges.has(`${endStr}->${startStr}`)) boundaryEdges.push(edge);
  }
  if (boundaryEdges.length === 0) return null;
  const rings = referenceChain(boundaryEdges);
  if (rings.length === 0) return null;
  rings.sort((a, b) => Math.abs(referenceSignedArea(b)) - Math.abs(referenceSignedArea(a)));
  return rings;
}

/** The rings the reference finds, whichever polygon it puts them in. */
function referenceRings(graph: WorldGraph, cellIds: number[]): Position[][] {
  return referenceGroups(graph, cellIds).flatMap(
    (group) => referenceMergeGroup(graph, group) ?? []
  );
}

const ringsOf = (polygons: MergedPolygon[]): Position[][] =>
  polygons.flatMap((polygon) => polygon.map((ring) => ring.coordinates));

/** Rings in a fixed order: by their first vertex, then their length. */
function canonical(rings: Position[][]): Position[][] {
  return [...rings].sort(
    (a, b) => a[0]![0]! - b[0]![0]! || a[0]![1]! - b[0]![1]! || a.length - b.length
  );
}

function expectSameRings(actual: Position[][], expected: Position[][]) {
  const a = canonical(actual);
  const e = canonical(expected);
  expect(a.length).toBe(e.length);
  a.forEach((ring, r) => {
    const want = e[r]!;
    expect(ring.length).toBe(want.length);
    for (let i = 0; i < ring.length; i++) {
      expect(Math.abs(ring[i]![0]! - want[i]![0]!)).toBeLessThan(1e-6);
      expect(Math.abs(ring[i]![1]! - want[i]![1]!)).toBeLessThan(1e-6);
    }
  });
}

describe("v2/polygon-merge", () => {
  const world = generateWorld({ ...DEFAULT_PARAMS, seed: 42, cellCount: 12000 });
  const graph = world.graph!;
  const { cells } = graph;

  const cellsWhere = (pred: (i: number) => boolean) => {
    const out: number[] = [];
    for (let i = 0; i < cells.n; i++) if (pred(i)) out.push(i);
    return out;
  };

  /** The merge cuts the polar cells at the latitude limit, which the reference does not do. */
  const clear = (i: number) => cells.vertices[i]!.every(([, y]) => Math.abs(y) <= RING_LATITUDE);

  describe("parity with the string-keyed reference", () => {
    it("merges all land like the reference", () => {
      const land = cellsWhere((i) => cells.isLand[i] === 1 && clear(i));
      expect(land.length).toBeGreaterThan(500);
      expectSameRings(ringsOf(mergeCells(graph, land)), referenceRings(graph, land));
    });

    it("merges every continent, biome, elevation threshold and state like the reference", () => {
      const sets: number[][] = [];
      for (const f of graph.features) {
        if (f.type === "continent" || f.type === "island") {
          sets.push(cellsWhere((i) => cells.feature[i] === f.id && clear(i)));
        }
      }
      for (let biome = 0; biome < 12; biome++) {
        sets.push(cellsWhere((i) => cells.isLand[i] === 1 && cells.biome[i] === biome && clear(i)));
      }
      for (let z = 0; z < 9; z++) {
        sets.push(cellsWhere((i) => cells.isLand[i] === 1 && cells.elevZone[i]! >= z && clear(i)));
      }
      for (const s of graph.states)
        sets.push(cellsWhere((i) => cells.state[i] === s.id && clear(i)));
      sets.push(cellsWhere((i) => cells.isLand[i] === 1 && cells.lake[i]! > 0 && clear(i)));

      expect(sets.length).toBeGreaterThan(30);
      for (const set of sets) {
        expectSameRings(ringsOf(mergeCells(graph, set)), referenceRings(graph, set));
      }
    });

    it("merges the open ocean, which touches the seam, like the reference", () => {
      const ocean = cellsWhere((i) => cells.isLand[i] === 0 && clear(i));
      expectSameRings(ringsOf(mergeCells(graph, ocean)), referenceRings(graph, ocean));
    });

    it("handles a single cell, scattered cells and no cells like the reference", () => {
      const one = [cellsWhere(clear)[1000]!];
      expectSameRings(ringsOf(mergeCells(graph, one)), referenceRings(graph, one));
      const scattered = cellsWhere((i) => i % 97 === 0 && clear(i));
      expectSameRings(ringsOf(mergeCells(graph, scattered)), referenceRings(graph, scattered));
      expect(mergeCells(graph, [])).toEqual([]);
    });

    it("gives the same rings on a mesh built from the same seed twice", () => {
      const a = createMesh(5, 4000, 2);
      const b = createMesh(5, 4000, 2);
      const all = Array.from({ length: a.cells.n }, (_, i) => i);
      expect(mergeCells(a, all)).toEqual(mergeCells(b, all));
    });
  });

  describe("shells and holes", () => {
    /** Cell sets that reach the poles and the seam, where a group's cells need not form one piece. */
    const polarSets = () => {
      const sets = [
        cellsWhere((i) => cells.isLand[i] === 0),
        cellsWhere((i) => cells.isLand[i] === 1),
      ];
      for (const s of graph.states) sets.push(cellsWhere((i) => cells.state[i] === s.id));
      return sets;
    };

    const expectSound = (polygons: MergedPolygon[]) => {
      for (const [shell, ...holes] of polygons) {
        expect(signedArea(shell!.coordinates)).toBeGreaterThan(0);
        for (const { coordinates } of holes) {
          expect(signedArea(coordinates)).toBeLessThan(0);
          const [a, b] = coordinates;
          const [x, y] = [(a![0]! + b![0]!) / 2, (a![1]! + b![1]!) / 2];
          expect(pointInRing(shell!.coordinates, x, y)).toBe(true);
        }
      }
    };

    it("makes every counter-clockwise ring the shell of a polygon and every clockwise ring a hole inside one", () => {
      for (const set of polarSets()) expectSound(mergeCells(graph, set));
    });

    it("gives the pieces of a group that meet only at a pole polygons of their own", () => {
      const pieces = polarSets().map((set) => ({
        polygons: mergeCells(graph, set).length,
        groups: referenceGroups(graph, set).length,
      }));
      for (const { polygons, groups } of pieces) expect(polygons).toBeGreaterThanOrEqual(groups);
      expect(pieces.some(({ polygons, groups }) => polygons > groups)).toBe(true);
    });

    it("keeps the rings between the latitude limit and the opposite one", () => {
      for (const set of polarSets()) {
        for (const ring of ringsOf(mergeCells(graph, set))) {
          for (const [, lat] of ring) expect(Math.abs(lat!)).toBeLessThanOrEqual(RING_LATITUDE);
        }
      }
    });
  });

  describe("corners", () => {
    const key = (x: number, y: number) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)}`;
    const stateOf = (i: number) => cells.state[i]!;

    /** Regions around every vertex of the mesh: the labels of its cells, and the map's edges it lies on. */
    const around = new Map<string, Set<number>>();
    for (let i = 0; i < cells.n; i++) {
      for (const [x, y] of cells.vertices[i]!) {
        const regions = around.get(key(x, y)) ?? new Set<number>();
        regions.add(stateOf(i));
        if (x === -180) regions.add(-1);
        if (x === 180) regions.add(-2);
        if (y === -RING_LATITUDE) regions.add(-3);
        if (y === RING_LATITUDE) regions.add(-4);
        around.set(key(x, y), regions);
      }
    }

    it("marks a vertex of a ring as a corner exactly where three regions meet there", () => {
      let corners = 0;
      for (const state of graph.states) {
        // A state with cells at the poles would be cut short there, leaving cells of its own beyond its edge
        const set = cellsWhere((i) => stateOf(i) === state.id);
        if (!set.every(clear)) continue;
        for (const polygon of mergeCells(graph, set, stateOf)) {
          for (const { coordinates, corners: marked } of polygon) {
            coordinates.slice(0, -1).forEach(([x, y], v) => {
              const regions = around.get(key(x!, y!))!;
              expect({ state: state.id, v, corner: marked.includes(v) }).toEqual({
                state: state.id,
                v,
                corner: regions.size >= 3,
              });
            });
            corners += marked.length;
          }
        }
      }
      expect(corners).toBeGreaterThan(100);
    });

    it("finds no corners on a landmass clear of the map's edges when its neighbours are not told apart", () => {
      const island = graph.features.find(
        (f) =>
          f.type === "island" &&
          cellsWhere((i) => cells.feature[i] === f.id).every(
            (i) => clear(i) && Math.abs(cells.p[i * 2]!) < 170
          )
      )!;
      const set = cellsWhere((i) => cells.feature[i] === island.id);
      const rings = mergeCells(graph, set).flat();
      expect(rings.length).toBeGreaterThan(0);
      for (const ring of rings) expect(ring.corners).toEqual([]);
    });

    it("flags, as well, the vertices where a coast touches two regions or a region and a map edge", () => {
      // Water is region 0; land is its state, so a coast vertex is a corner where two states (or a state and
      // the map's edge) meet beside the water
      const regionOf = (i: number) => (cells.isLand[i] ? 1 + stateOf(i) : 0);
      const regions = new Map<string, { around: Set<number>; wet: boolean }>();
      for (let i = 0; i < cells.n; i++) {
        for (const [x, y] of cells.vertices[i]!.slice(0, -1)) {
          const here = regions.get(key(x, y)) ?? { around: new Set<number>(), wet: false };
          here.around.add(regionOf(i));
          here.wet ||= regionOf(i) === 0;
          if (x === -180) here.around.add(-1);
          if (x === 180) here.around.add(-2);
          regions.set(key(x, y), here);
        }
      }

      const land = cellsWhere((i) => cells.isLand[i] === 1 && clear(i));
      const flags = coastCorners(graph, regionOf);
      const plain = mergeCells(graph, land, stateOf).flat();
      const flagged = mergeCells(graph, land, stateOf, flags).flat();
      expect(flagged.length).toBe(plain.length);
      let extra = 0;
      flagged.forEach(({ coordinates, corners }, r) => {
        coordinates.slice(0, -1).forEach(([x, y], v) => {
          if (Math.abs(y!) > 80) return;
          const here = regions.get(key(x!, y!))!;
          const coastCorner = here.wet && here.around.size >= 3;
          expect({ r, v, corner: corners.includes(v) }).toEqual({
            r,
            v,
            corner: plain[r]!.corners.includes(v) || coastCorner,
          });
          if (coastCorner && !plain[r]!.corners.includes(v)) extra++;
        });
      });
      // A ring through a coastal vertex where the state changes beside the sea is a corner of the landmass too
      expect(extra).toBeGreaterThan(5);
    });
  });
});

describe("v2/polygon-merge groupRings", () => {
  const square = (x: number, y: number, size: number, clockwise = false): MergedRing => {
    const ring = [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ];
    return { coordinates: clockwise ? ring.reverse() : ring, corners: [] };
  };

  it("measures counter-clockwise rings positive and clockwise ones negative", () => {
    expect(ringArea(square(0, 0, 10).coordinates)).toBeCloseTo(100);
    expect(ringArea(square(0, 0, 10, true).coordinates)).toBeCloseTo(-100);
  });

  it("attaches a hole to the smallest shell that contains it", () => {
    const [big, small] = groupRings([
      square(0, 0, 100),
      square(20, 20, 30),
      square(30, 30, 5, true),
      square(5, 5, 5, true),
    ]);
    expect(big!.length).toBe(2);
    expect(small!.length).toBe(2);
    expect(big![1]!.coordinates[0]).toEqual([5, 5]);
    expect(small![1]!.coordinates[0]).toEqual([30, 30]);
  });

  it("leaves out a hole no shell contains, whether there is one shell or several", () => {
    const outside = square(500, 500, 5, true);
    expect(groupRings([square(0, 0, 10), outside]).map((p) => p.length)).toEqual([1]);
    expect(
      groupRings([square(0, 0, 10), square(50, 50, 10), outside]).map((p) => p.length)
    ).toEqual([1, 1]);
  });
});
