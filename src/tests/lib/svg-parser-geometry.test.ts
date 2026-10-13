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
import { createConfigFromCalibration, svgToWgs84 } from "~/lib/flags/svg-coordinate-config";

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

  describe("SVG pixel → WGS84 lat/lng conversion", () => {
    // Ground truth: lng = (x − 100) / 2, lat = (80 − y) / 2; the centres of three shapes
    const POINTS = [
      { svgX: 20, svgY: 20, lng: -40, lat: 30 },
      { svgX: 120, svgY: 60, lng: 10, lat: 10 },
      { svgX: 220, svgY: 140, lng: 60, lat: -30 },
    ];

    it("calibrates an affine transform from matched points", () => {
      const config = createConfigFromCalibration(360, 180, POINTS)!;

      expect(config.pixelsPerLng).toBeCloseTo(2, 9);
      expect(config.pixelsPerLat).toBeCloseTo(2, 9);
      expect(config.primeMeridianX).toBeCloseTo(100, 9);
      expect(config.equatorY).toBeCloseTo(80, 9);
      const [lng, lat] = svgToWgs84(300, 0, config);
      expect(lng).toBeCloseTo(100, 9);
      expect(lat).toBeCloseTo(40, 9);
    });

    it("needs two matched points", () => {
      expect(createConfigFromCalibration(360, 180, POINTS.slice(0, 1))).toBeNull();
    });
  });
});
