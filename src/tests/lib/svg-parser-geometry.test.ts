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
import type { FeatureCollection, Position } from "geojson";
import { DOMParser } from "@xmldom/xmldom";
import { IXEARTH_SVG_CONFIG, svgToWgs84, wgs84ToSvg } from "~/lib/flags/svg-coordinate-config";
import { readViewBox, resolveCoordinateConfig } from "~/lib/flags/svg/coordinate-calibration";

function svgRootOf(markup: string) {
  return new DOMParser().parseFromString(markup, "image/svg+xml").documentElement!;
}

function pointFeatures(points: Array<[string, number, number]>): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map(([id, lng, lat]) => ({
      type: "Feature",
      properties: { id },
      geometry: { type: "Point", coordinates: [lng, lat] },
    })),
  };
}

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
    // Open squares (no Z) so each path's endpoint centroid is its exact centre.
    const CALIBRATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180">
      <path id="a" d="M10 10 L30 10 L30 30 L10 30"/>
      <path id="b" d="M110 50 L130 50 L130 70 L110 70"/>
      <path id="c" d="M210 130 L230 130 L230 150 L210 150"/>
      <path id="unmatched" d="M300 10 L320 10 L320 30 L300 30"/>
    </svg>`;

    it("applies the IxEarth affine transform (lng = 0.04392139x − 153.9062, lat = −0.04392143y + 110.1222)", () => {
      const [lng0, lat0] = svgToWgs84(0, 0);
      expect(lng0).toBeCloseTo(-153.9062, 6);
      expect(lat0).toBeCloseTo(110.1222, 6);

      const [lng, lat] = svgToWgs84(10000, 5000);
      expect(lng).toBeCloseTo(0.04392139 * 10000 - 153.9062, 6);
      expect(lat).toBeCloseTo(-0.04392143 * 5000 + 110.1222, 6);

      const [pmLng, eqLat] = svgToWgs84(
        IXEARTH_SVG_CONFIG.primeMeridianX,
        IXEARTH_SVG_CONFIG.equatorY
      );
      expect(pmLng).toBeCloseTo(0, 9);
      expect(eqLat).toBeCloseTo(0, 9);
    });

    it("round-trips pixel → lat/lng → pixel", () => {
      const [lng, lat] = svgToWgs84(12345.5, 6789.25);
      const [x, y] = wgs84ToSvg(lng, lat);
      expect(x).toBeCloseTo(12345.5, 6);
      expect(y).toBeCloseTo(6789.25, 6);
    });

    it("reads the viewBox size and falls back to the base config without one", () => {
      const log: string[] = [];
      expect(readViewBox(svgRootOf(CALIBRATION_SVG), IXEARTH_SVG_CONFIG, log)).toEqual({
        width: 360,
        height: 180,
      });
      expect(log).toEqual(["SVG viewBox: 360 × 180"]);

      const bare = svgRootOf(`<svg xmlns="http://www.w3.org/2000/svg"/>`);
      expect(readViewBox(bare, IXEARTH_SVG_CONFIG, [])).toEqual({
        width: IXEARTH_SVG_CONFIG.viewBoxWidth,
        height: IXEARTH_SVG_CONFIG.viewBoxHeight,
      });
    });

    it("calibrates from reference features matched by id", () => {
      // Ground truth: lng = (x − 100) / 2, lat = (80 − y) / 2
      const reference = pointFeatures([
        ["a", -40, 30],
        ["b", 10, 10],
        ["c", 60, -30],
      ]);
      const log: string[] = [];
      const config = resolveCoordinateConfig(
        svgRootOf(CALIBRATION_SVG),
        { width: 360, height: 180 },
        IXEARTH_SVG_CONFIG,
        reference,
        log
      );

      expect(config.pixelsPerLng).toBeCloseTo(2, 9);
      expect(config.pixelsPerLat).toBeCloseTo(2, 9);
      expect(config.primeMeridianX).toBeCloseTo(100, 9);
      expect(config.equatorY).toBeCloseTo(80, 9);
      expect(log).toEqual(["Calibrated from 3 matched features (scale: 0.500000 deg/px)"]);

      const [lng, lat] = svgToWgs84(300, 0, config);
      expect(lng).toBeCloseTo(100, 9);
      expect(lat).toBeCloseTo(40, 9);
    });

    it("falls back to whole-world bounds when fewer than two features match", () => {
      const log: string[] = [];
      const config = resolveCoordinateConfig(
        svgRootOf(CALIBRATION_SVG),
        { width: 360, height: 180 },
        IXEARTH_SVG_CONFIG,
        pointFeatures([["a", -40, 30]]),
        log
      );

      expect(log).toEqual([
        "Calibration failed (1 matches found, need 2+). Falling back to bounds mapping.",
        "Mapping viewBox (360×180) to WGS84 bounds (lat range: ±90.0°)",
      ]);
      expect(svgToWgs84(0, 0, config)).toEqual([-180, 90]);
      expect(svgToWgs84(180, 90, config)).toEqual([0, 0]);
      expect(svgToWgs84(360, 180, config)).toEqual([180, -90]);
    });

    it("keeps the aspect ratio when a wide viewBox maps to the world bounds", () => {
      const log: string[] = [];
      const config = resolveCoordinateConfig(
        svgRootOf(CALIBRATION_SVG),
        { width: 720, height: 180 },
        IXEARTH_SVG_CONFIG,
        undefined,
        log
      );

      expect(config.pixelsPerLng).toBe(2);
      expect(config.pixelsPerLat).toBe(2);
      expect(log).toEqual(["Mapping viewBox (720×180) to WGS84 bounds (lat range: ±45.0°)"]);
      expect(svgToWgs84(0, 0, config)).toEqual([-180, 45]);
      expect(svgToWgs84(720, 180, config)).toEqual([180, -45]);
    });

    it("returns the base config unchanged for a zero-area viewBox", () => {
      const log: string[] = [];
      const config = resolveCoordinateConfig(
        svgRootOf(CALIBRATION_SVG),
        { width: 0, height: 180 },
        IXEARTH_SVG_CONFIG,
        pointFeatures([
          ["a", -40, 30],
          ["b", 10, 10],
        ]),
        log
      );
      expect(config).toBe(IXEARTH_SVG_CONFIG);
      expect(log).toEqual([]);
    });
  });
});
