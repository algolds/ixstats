import { describe, expect, it } from "@jest/globals";
import {
  pathCommandsToRings,
  type SvgPathCommand,
} from "~/lib/flags/svg/command-evaluator";
import { createConfigFromCalibration, svgToWgs84 } from "~/lib/flags/svg-coordinate-config";

describe("SVG Geometry & Command Evaluator", () => {
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
