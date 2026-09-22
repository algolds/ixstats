import { describe, expect, it } from "@jest/globals";
import {
  cubicBezier,
  quadraticBezier,
  adaptiveCubicSegments,
  adaptiveQuadSegments,
  pathCommandsToRings,
  type SvgPathCommand,
} from "~/lib/flags/svg/command-evaluator";
import {
  ringArea,
  calculateCentroid,
  calculateBoundingBox,
  calculateApproxArea,
} from "~/lib/flags/svg/topology-flattener";
import type { Position } from "geojson";

describe("SVG Geometry & Command Evaluator", () => {
  describe("Bezier curve math", () => {
    it("interpolates cubic bezier at endpoints and midpoint", () => {
      const [x0, y0] = [0, 0];
      const [x1, y1] = [0, 10];
      const [x2, y2] = [10, 10];
      const [x3, y3] = [10, 0];

      const start = cubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, 0);
      expect(start[0]).toBeCloseTo(0);
      expect(start[1]).toBeCloseTo(0);

      const mid = cubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, 0.5);
      expect(mid[0]).toBeCloseTo(5);
      expect(mid[1]).toBeCloseTo(7.5);

      const end = cubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, 1);
      expect(end[0]).toBeCloseTo(10);
      expect(end[1]).toBeCloseTo(0);
    });

    it("interpolates quadratic bezier accurately", () => {
      const [qx0, qy0] = [0, 0];
      const [qx1, qy1] = [5, 10];
      const [qx2, qy2] = [10, 0];

      const start = quadraticBezier(qx0, qy0, qx1, qy1, qx2, qy2, 0);
      expect(start[0]).toBeCloseTo(0);
      expect(start[1]).toBeCloseTo(0);

      const mid = quadraticBezier(qx0, qy0, qx1, qy1, qx2, qy2, 0.5);
      expect(mid[0]).toBeCloseTo(5);
      expect(mid[1]).toBeCloseTo(5);

      const end = quadraticBezier(qx0, qy0, qx1, qy1, qx2, qy2, 1);
      expect(end[0]).toBeCloseTo(10);
      expect(end[1]).toBeCloseTo(0);
    });

    it("adapts segment counts based on flatness", () => {
      // Perfectly straight line: should return minimal segment count
      const flatSegments = adaptiveCubicSegments(0, 0, 10, 0, 20, 0, 30, 0, 16);
      expect(flatSegments).toBeLessThanOrEqual(4);

      // High curvature: should return full max segments
      const curvedSegments = adaptiveCubicSegments(0, 0, 0, 50, 50, 50, 50, 0, 16);
      expect(curvedSegments).toBe(16);
    });
  });

  describe("Path Commands to Rings", () => {
    it("converts rectangular path commands into closed coordinate ring", () => {
      const commands: SvgPathCommand[] = [
        { code: "M", command: "moveto", x: 0, y: 0 },
        { code: "L", command: "lineto", x: 100, y: 0 },
        { code: "L", command: "lineto", x: 100, y: 50 },
        { code: "L", command: "lineto", x: 0, y: 50 },
        { code: "Z", command: "closepath" },
      ];

      const rings = pathCommandsToRings(commands, 8);
      expect(rings.length).toBe(1);
      const ring = rings[0]!;
      expect(ring.length).toBe(5); // 4 corners + closing point
      expect(ring[0]).toEqual([0, 0]);
      expect(ring[1]).toEqual([100, 0]);
      expect(ring[2]).toEqual([100, 50]);
      expect(ring[3]).toEqual([0, 50]);
      expect(ring[4]).toEqual([0, 0]);
    });

    it("flattens cubic bezier path segments into discrete vertices", () => {
      const commands: SvgPathCommand[] = [
        { code: "M", command: "moveto", x: 0, y: 0 },
        { code: "C", command: "curveto", x1: 0, y1: 50, x2: 50, y2: 50, x: 50, y: 0 },
        { code: "Z", command: "closepath" },
      ];

      const rings = pathCommandsToRings(commands, 8);
      expect(rings.length).toBe(1);
      const ring = rings[0]!;
      expect(ring.length).toBeGreaterThan(5);
      expect(ring[0]).toEqual([0, 0]);
      expect(ring[ring.length - 1]).toEqual([0, 0]);
    });
  });

  describe("Topology and Geometry Math", () => {
    const squareRing: Position[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];

    it("computes signed ring area correctly", () => {
      // Counter-clockwise square ring has positive area
      const ccwArea = ringArea([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ]);
      expect(Math.abs(ccwArea)).toBeCloseTo(100);
    });

    it("computes centroid correctly", () => {
      const centroid = calculateCentroid([squareRing]);
      expect(centroid[0]).toBeCloseTo(4.0); // (0+10+10+0+0)/5 = 4
      expect(centroid[1]).toBeCloseTo(4.0);
    });

    it("computes bounding box [minLng, minLat, maxLng, maxLat]", () => {
      const bbox = calculateBoundingBox([squareRing]);
      expect(bbox).toEqual([0, 0, 10, 10]);
    });

    it("approximates geographic area in sq km", () => {
      const area = calculateApproxArea([squareRing]);
      expect(area).toBeGreaterThan(0);
    });
  });
});
