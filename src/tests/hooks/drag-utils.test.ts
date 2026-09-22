import { describe, it, expect } from "@jest/globals";
import {
  exceedsHysteresis,
  detectAxis,
  axisLock,
  HYSTERESIS_PX,
  NUDGE_SMALL,
  NUDGE_LARGE,
  isKeyboardInputTarget,
} from "~/components/maps/editor/hooks/drag-utils";
import {
  buildNeighborGeometries,
  buildMidpointFeatures,
  calculateSnapTarget,
} from "~/components/maps/editor/hooks/vertex-edit-geometry";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { Polygon } from "geojson";

describe("drag-utils", () => {
  it("defines correct hysteresis and nudge constants", () => {
    expect(HYSTERESIS_PX).toBe(4);
    expect(NUDGE_SMALL).toBe(0.001);
    expect(NUDGE_LARGE).toBe(0.01);
  });

  describe("exceedsHysteresis", () => {
    it("returns false for displacements under threshold", () => {
      const start = { x: 100, y: 100 };
      expect(exceedsHysteresis(start, { x: 100, y: 100 })).toBe(false);
      expect(exceedsHysteresis(start, { x: 102, y: 100 })).toBe(false);
      expect(exceedsHysteresis(start, { x: 102, y: 102 })).toBe(false); // sqrt(8) ~ 2.82px < 4px
    });

    it("returns true for displacements at or above threshold", () => {
      const start = { x: 100, y: 100 };
      expect(exceedsHysteresis(start, { x: 104, y: 100 })).toBe(true); // exactly 4px
      expect(exceedsHysteresis(start, { x: 100, y: 105 })).toBe(true); // 5px
      expect(exceedsHysteresis(start, { x: 103, y: 103 })).toBe(true); // sqrt(18) ~ 4.24px >= 4px
    });
  });

  describe("detectAxis", () => {
    it("detects horizontal axis when dx dominates", () => {
      expect(detectAxis(20, 2)).toBe("h");
      expect(detectAxis(-30, 5)).toBe("h");
    });

    it("detects vertical axis when dy dominates", () => {
      expect(detectAxis(2, 20)).toBe("v");
      expect(detectAxis(4, -35)).toBe("v");
    });

    it("detects diagonal axis for roughly 45° angles", () => {
      expect(detectAxis(10, 10)).toBe("d");
      expect(detectAxis(-15, 15)).toBe("d");
      expect(detectAxis(20, 15)).toBe("d"); // ratio 0.75 > 0.414
    });
  });

  describe("axisLock", () => {
    const start: [number, number] = [10, 20];

    it("returns unconstrained coordinates when axis is null", () => {
      expect(axisLock(start, [15, 25], null)).toEqual([15, 25]);
    });

    it("locks to horizontal axis (keeps start latitude)", () => {
      expect(axisLock(start, [15, 25], "h")).toEqual([15, 20]);
    });

    it("locks to vertical axis (keeps start longitude)", () => {
      expect(axisLock(start, [15, 25], "v")).toEqual([10, 25]);
    });

    it("locks to 45° diagonal axis", () => {
      const locked = axisLock(start, [14, 26], "d"); // dLng=4, dLat=6, avg=5
      expect(locked).toEqual([15, 25]);
    });
  });

  describe("isKeyboardInputTarget", () => {
    it("returns false for null or undefined target", () => {
      expect(isKeyboardInputTarget(null)).toBe(false);
      expect(isKeyboardInputTarget(undefined as unknown as EventTarget)).toBe(false);
    });

    it("identifies input elements as input targets", () => {
      const input = document.createElement("input");
      expect(isKeyboardInputTarget(input)).toBe(true);

      const textarea = document.createElement("textarea");
      expect(isKeyboardInputTarget(textarea)).toBe(true);

      const select = document.createElement("select");
      expect(isKeyboardInputTarget(select)).toBe(true);
    });

    it("identifies contenteditable elements as input targets", () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "true");
      expect(isKeyboardInputTarget(div)).toBe(true);
    });

    it("returns false for standard canvas or non-input elements", () => {
      const canvas = document.createElement("canvas");
      expect(isKeyboardInputTarget(canvas)).toBe(false);

      const div = document.createElement("div");
      expect(isKeyboardInputTarget(div)).toBe(false);
    });
  });
});

describe("vertex-edit-geometry", () => {
  const samplePolygon: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  };

  describe("buildNeighborGeometries", () => {
    it("extracts other subdivision geometries while excluding editing feature and non-subdivisions", () => {
      const features: EditorFeature[] = [
        {
          id: "sub-1",
          name: "Editing Sub",
          type: "subdivision",
          geometry: samplePolygon,
          properties: {},
        },
        {
          id: "sub-2",
          name: "Neighbor Sub",
          type: "subdivision",
          geometry: samplePolygon,
          properties: {},
        },
        {
          id: "city-1",
          name: "City",
          type: "city",
          coordinates: [5, 5],
          properties: {},
        },
      ];

      const neighbors = buildNeighborGeometries(features, "sub-1");
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0]!.id).toBe("sub-2");
      expect(neighbors[0]!.geometry).toEqual(samplePolygon);
    });
  });

  describe("buildMidpointFeatures", () => {
    it("generates midpoints for polygon ring segments", () => {
      const midpoints = buildMidpointFeatures(samplePolygon);
      expect(midpoints).toHaveLength(4);
      expect(midpoints[0]!.geometry).toEqual({
        type: "Point",
        coordinates: [5, 0],
      });
      expect(midpoints[1]!.geometry).toEqual({
        type: "Point",
        coordinates: [10, 5],
      });
    });
  });

  describe("calculateSnapTarget", () => {
    it("returns target clamped to border when border is supplied", () => {
      const result = calculateSnapTarget({
        coords: [5, 5],
        snapEnabled: false,
        snapTolerance: 0.015,
        border: samplePolygon,
        features: [],
        editingFeatureId: "sub-1",
      });

      expect(result.target).toEqual([5, 5]);
      expect(result.didSnap).toBe(false);
    });
  });
});
