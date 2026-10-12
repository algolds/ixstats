/**
 * UPG v2 — polygon merge parity
 *
 * The merge matches vertices by quantised integer keys. The reference below is the previous
 * implementation (vertices keyed by `toFixed(6)` strings); on a fixed world both must produce the
 * same geometry for every cell set the exporter merges.
 */

import type { Position, Polygon, MultiPolygon } from "geojson";
import { mergeCellsToMultiPolygon } from "~/lib/worldgen/v2/helpers/polygon-merge";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { createMesh } from "~/lib/worldgen/v2/mesh";
import type { WorldGraph } from "~/lib/worldgen/v2/types";

type Geometry = Polygon | MultiPolygon;

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

function referenceMerge(graph: WorldGraph, cellIds: number[]): Geometry | null {
  const polygons: Position[][][] = [];
  for (const group of referenceGroups(graph, cellIds)) {
    const rings = referenceMergeGroup(graph, group);
    if (rings && rings.length > 0) polygons.push(rings);
  }
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0]! };
  return { type: "MultiPolygon", coordinates: polygons };
}

function expectSameGeometry(actual: Geometry | null, expected: Geometry | null) {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }
  expect(actual).not.toBeNull();
  expect(actual!.type).toBe(expected.type);
  const flat = (g: Geometry): Position[][][] =>
    g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const a = flat(actual!);
  const e = flat(expected);
  expect(a.length).toBe(e.length);
  a.forEach((polygon, p) => {
    expect(polygon.length).toBe(e[p]!.length);
    polygon.forEach((ring, r) => {
      const want = e[p]![r]!;
      expect(ring.length).toBe(want.length);
      for (let i = 0; i < ring.length; i++) {
        expect(Math.abs(ring[i]![0]! - want[i]![0]!)).toBeLessThan(1e-6);
        expect(Math.abs(ring[i]![1]! - want[i]![1]!)).toBeLessThan(1e-6);
      }
    });
  });
}

describe("v2/polygon-merge parity with the string-keyed reference", () => {
  const world = generateWorld({ ...DEFAULT_PARAMS, seed: 42, cellCount: 12000 });
  const graph = world.graph!;
  const { cells } = graph;

  const cellsWhere = (pred: (i: number) => boolean) => {
    const out: number[] = [];
    for (let i = 0; i < cells.n; i++) if (pred(i)) out.push(i);
    return out;
  };

  it("merges all land like the reference", () => {
    const land = cellsWhere((i) => cells.isLand[i] === 1);
    expect(land.length).toBeGreaterThan(500);
    expectSameGeometry(mergeCellsToMultiPolygon(graph, land), referenceMerge(graph, land));
  });

  it("merges every continent, biome, elevation threshold and state like the reference", () => {
    const sets: number[][] = [];
    for (const f of graph.features) {
      if (f.type === "continent" || f.type === "island") {
        sets.push(cellsWhere((i) => cells.feature[i] === f.id));
      }
    }
    for (let biome = 0; biome < 12; biome++) {
      sets.push(cellsWhere((i) => cells.isLand[i] === 1 && cells.biome[i] === biome));
    }
    for (let z = 0; z < 9; z++) {
      sets.push(cellsWhere((i) => cells.isLand[i] === 1 && cells.elevZone[i]! >= z));
    }
    for (const s of graph.states) sets.push(cellsWhere((i) => cells.state[i] === s.id));
    sets.push(cellsWhere((i) => cells.isLand[i] === 1 && cells.lake[i]! > 0));

    expect(sets.length).toBeGreaterThan(30);
    for (const set of sets) {
      expectSameGeometry(mergeCellsToMultiPolygon(graph, set), referenceMerge(graph, set));
    }
  });

  it("merges the open ocean, which touches the poles and the seam, like the reference", () => {
    const ocean = cellsWhere((i) => cells.isLand[i] === 0);
    expectSameGeometry(mergeCellsToMultiPolygon(graph, ocean), referenceMerge(graph, ocean));
  });

  it("handles a single cell, scattered cells and no cells like the reference", () => {
    const one = [cells.n >> 1];
    expectSameGeometry(mergeCellsToMultiPolygon(graph, one), referenceMerge(graph, one));
    const scattered = cellsWhere((i) => i % 97 === 0);
    expectSameGeometry(
      mergeCellsToMultiPolygon(graph, scattered),
      referenceMerge(graph, scattered)
    );
    expect(mergeCellsToMultiPolygon(graph, [])).toBeNull();
  });

  it("gives the same geometry on a mesh built from the same seed twice", () => {
    const a = createMesh(5, 4000, 2);
    const b = createMesh(5, 4000, 2);
    const all = Array.from({ length: a.cells.n }, (_, i) => i);
    expect(mergeCellsToMultiPolygon(a, all)).toEqual(mergeCellsToMultiPolygon(b, all));
  });
});
