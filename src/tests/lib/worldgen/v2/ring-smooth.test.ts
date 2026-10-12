/**
 * UPG v2 — ring smoothing
 *
 * Rings are smoothed chain by chain between their corners, so a border two rings share comes out the
 * same on both sides, and a spline never throws a ring across itself.
 */

import type { Position } from "geojson";
import { catmullRomSmoothChain } from "~/lib/worldgen/v2/helpers/chaikin";
import { smoothRing } from "~/lib/worldgen/v2/helpers/ring-smooth";
import { RING_LATITUDE, type MergedRing } from "~/lib/worldgen/v2/helpers/polygon-merge";
import { ringFault, selfIntersections } from "~/tests/helpers/ring-geometry";

type Point = [number, number];

const key = (p: readonly number[]) => `${p[0]},${p[1]}`;

describe("v2/chaikin spline chain", () => {
  const zigzag: Point[] = [
    [0, 0],
    [10, 0.5],
    [10.05, 0.4],
    [20, 0],
    [20.02, 3],
    [30, 2],
  ];

  it("passes through every control point and keeps the ends of the chain", () => {
    const smoothed = catmullRomSmoothChain(zigzag, 2);
    expect(smoothed.length).toBe((zigzag.length - 1) * 4 + 1);
    expect(smoothed[0]).toEqual(zigzag[0]);
    expect(smoothed.at(-1)).toEqual(zigzag.at(-1));
    const kept = new Set(smoothed.map(key));
    for (const p of zigzag) expect(kept.has(key(p))).toBe(true);
  });

  it("gives the same curve whichever way the chain is read", () => {
    const forward = catmullRomSmoothChain(zigzag, 2);
    const backward = catmullRomSmoothChain([...zigzag].reverse(), 2);
    expect(backward).toEqual([...forward].reverse());
  });

  it("does not loop where a short segment sits between long ones", () => {
    const ring: Point[] = [...zigzag, [30, -5], [0, -5], [0, 0]];
    expect(selfIntersections(ring)).toBe(0);
    expect(selfIntersections(catmullRomSmoothChain(ring, 3))).toBe(0);
  });

  it("holds new points inside the bounds, an inset back from the edge they would cross", () => {
    // A chain along an edge that turns sharply up: the curve would sag below the edge
    const chain: Point[] = [
      [0, 0],
      [5, 0],
      [5.1, 2],
      [10, 0],
    ];
    const bounds = { minX: -10, maxX: 20, minY: 0, maxY: 10, inset: 0.05 };
    expect(Math.min(...catmullRomSmoothChain(chain, 3).map((p) => p[1]))).toBeLessThan(0);
    const held = catmullRomSmoothChain(chain, 3, bounds);
    expect(Math.min(...held.map((p) => p[1]))).toBeGreaterThanOrEqual(0);
    // Points on the edge itself, the control points among them, stay where they are
    expect(held.filter((p) => p[1] === 0).length).toBeGreaterThanOrEqual(2);
  });
});

describe("v2/ring-smooth", () => {
  const ring = (coordinates: Position[], corners: number[]): MergedRing => ({
    coordinates,
    corners,
  });

  describe("a border shared by two rings", () => {
    // Two squares side by side along a zigzag border from (10, 0) to (11, 3), both counter-clockwise
    const left = ring(
      [
        [0, 0],
        [10, 0],
        [11, 1],
        [10, 2],
        [11, 3],
        [0, 3],
        [0, 0],
      ],
      [1, 4]
    );
    const right = ring(
      [
        [10, 0],
        [20, 0],
        [20, 3],
        [11, 3],
        [10, 2],
        [11, 1],
        [10, 0],
      ],
      [0, 3]
    );

    it("comes out the same on both sides", () => {
      const a = smoothRing(left, 2).map(key);
      const b = new Set(smoothRing(right, 2).map(key));
      const shared = new Set(a.filter((k) => b.has(k)));
      // Three segments, 4 points each, and the end
      expect(shared.size).toBe(13);
    });

    it("keeps the corners where the border meets the rest of each ring", () => {
      const near = (points: Point[], [x, y]: Position) =>
        points.some((p) => Math.hypot(p[0] - x!, p[1] - y!) < 0.01);
      const a = smoothRing(left, 2);
      for (const corner of [
        [10, 0],
        [11, 3],
      ] as Position[])
        expect(near(a, corner)).toBe(true);
    });
  });

  it("smooths a ring without corners the same from any starting vertex and either direction", () => {
    const square: Position[] = [
      [0, 0],
      [4, 0],
      [5, 3],
      [3, 5],
      [-1, 3],
      [0, 0],
    ];
    const open = square.slice(0, -1);
    const closed = (points: Position[]) => [...points, points[0]!];
    const rotated = closed([...open.slice(2), ...open.slice(0, 2)]);
    const reversed = closed([...open].reverse());

    const base = smoothRing(ring(square, []), 2).map(key).sort();
    expect(smoothRing(ring(rotated, []), 2).map(key).sort()).toEqual(base);
    expect(smoothRing(ring(reversed, []), 2).map(key).sort()).toEqual(base);
  });

  it("keeps a border that leaves an edge chain at a shallow angle from sagging across it", () => {
    // The low border runs along the latitude limit; the next leaves its end at 3 degrees, then climbs steeply
    const limit = -RING_LATITUDE;
    const wedge = ring(
      [
        [-100, limit],
        [-90, limit],
        [-95, -84.7],
        [-95.5, -80],
        [-100.5, -80],
        [-100, limit],
      ],
      [0, 1]
    );
    const smoothed = smoothRing(wedge, 2);
    expect(ringFault({ type: "Polygon", coordinates: [smoothed] })).toBeNull();
    expect(Math.min(...smoothed.map((p) => p[1]))).toBeGreaterThan(limit - 0.005);
  });

  it("drops the tip of a spike that rounding has squeezed flat onto its own line", () => {
    // A wedge against the latitude limit: its low border runs along the limit and the other leaves it at 6 degrees
    const limit = -RING_LATITUDE;
    const wedge = ring(
      [
        [-93.67272, -84.64902],
        [-96.5993, limit],
        [-93.21768, limit],
        [-93.03319, limit],
        [-87.76835, limit],
        [-81.41067, limit],
        [-77.38055, limit],
        [-77.56287, -84.4356],
        [-81.30017, -84.66517],
        [-84.05301, -81.39217],
        [-87.61208, -82.9037],
        [-91.55396, -77.30426],
        [-94.41635, -79.44494],
        [-93.67272, -84.64902],
      ],
      [1, 6, 11, 12]
    );
    const smoothed = smoothRing(wedge, 2);
    expect(ringFault({ type: "Polygon", coordinates: [smoothed] })).toBeNull();
  });
});
