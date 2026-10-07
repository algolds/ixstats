import type { Position } from "geojson";
import { buildSegmentGrid, nearestSegmentPoint } from "~/lib/maps/segment-grid";
import { distanceDeg, projectPointToSegment } from "~/lib/maps/planar";

/** The full scan the grid replaces: first strictly-nearest projection within tolerance, in run order. */
function bruteForce(runs: Position[][], p: Position, tolerance: number) {
  let best: { point: Position; dist: number } | null = null;
  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const proj = projectPointToSegment(p, run[i]!, run[i + 1]!);
      const d = distanceDeg(p, proj);
      if (d <= tolerance && (!best || d < best.dist)) best = { point: proj, dist: d };
    }
  }
  return best;
}

/** Deterministic pseudo-random numbers, so a failure reproduces. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("segment grid", () => {
  it("finds exactly what a full scan finds, for short and cell-spanning segments", () => {
    const rand = rng(42);
    const runs: Position[][] = [];
    for (let r = 0; r < 60; r++) {
      const run: Position[] = [[rand() * 20 - 10, rand() * 20 - 10]];
      const long = r % 10 === 0; // some segments span many cells
      for (let i = 0; i < 12; i++) {
        const [x, y] = run[run.length - 1]!;
        const step = long ? 4 : 0.05;
        run.push([x! + (rand() - 0.5) * step, y! + (rand() - 0.5) * step]);
      }
      runs.push(run);
    }
    const grid = buildSegmentGrid(runs);

    for (const tolerance of [0.005, 0.015, 0.4]) {
      for (let i = 0; i < 800; i++) {
        const p: Position = [rand() * 22 - 11, rand() * 22 - 11];
        const expected = bruteForce(runs, p, tolerance);
        const got = nearestSegmentPoint(grid, p, tolerance);
        expect(got?.point ?? null).toEqual(expected?.point ?? null);
      }
    }
  });

  it("still finds a segment too large to file per cell", () => {
    const runs: Position[][] = [
      [
        [-170, -80],
        [170, 80],
      ],
    ];
    const p: Position = [10.003, 4.71];
    expect(nearestSegmentPoint(buildSegmentGrid(runs), p, 0.015)?.point).toEqual(
      bruteForce(runs, p, 0.015)?.point
    );
    expect(bruteForce(runs, p, 0.015)).not.toBeNull();
  });

  it("keeps the first of two equally near segments, as the scan does", () => {
    const runs: Position[][] = [
      [
        [0, 1],
        [2, 1],
      ],
      [
        [0, -1],
        [2, -1],
      ],
    ];
    expect(nearestSegmentPoint(buildSegmentGrid(runs), [1, 0], 1)?.point).toEqual([1, 1]);
  });

  it("finds nothing outside the tolerance, and handles an empty grid", () => {
    const runs: Position[][] = [
      [
        [0, 0],
        [1, 0],
      ],
    ];
    expect(nearestSegmentPoint(buildSegmentGrid(runs), [0.5, 0.2], 0.1)).toBeNull();
    expect(nearestSegmentPoint(buildSegmentGrid([]), [0, 0], 1)).toBeNull();
  });
});
