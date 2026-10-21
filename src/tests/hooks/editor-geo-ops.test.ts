/**
 * Unit tests for the map editor's pure geometry helpers (scatter, snap, interior
 * point, empty-region detection) and the GeoJSON import/export transforms.
 */

import type { Polygon } from "geojson";
import {
  featuresToGeoJSON,
  planGeoJSONImport
} from "~/hooks/map-editor/editor-geo-ops";
import type { EditorFeature } from "~/hooks/map-editor/editor-types";

const square: Polygon = {
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

// A "C" shape whose vertex centroid falls outside the polygon.
const region = (
  id: string,
  geometry: Polygon,
  props: Record<string, unknown> = {}
): EditorFeature => ({
  id,
  type: "subdivision",
  name: `Region ${id}`,
  geometry,
  properties: props as EditorFeature["properties"],
});

const city = (
  id: string,
  coordinates: [number, number],
  props: Record<string, unknown> = {}
): EditorFeature => ({
  id,
  type: "city",
  name: `City ${id}`,
  coordinates,
  properties: props as EditorFeature["properties"],
});
describe("GeoJSON export / import", () => {
  it("round-trips an export into an import plan", () => {
    const fc = featuresToGeoJSON([city("c1", [1, 2]), region("r1", square)]);
    const plan = planGeoJSONImport(fc);
    expect(plan.skipped).toBe(0);
    expect(plan.features.map((f) => f.kind)).toEqual(["city", "subdivision"]);
    expect(plan.features[0]!.name).toBe("City c1");
  });

  it("maps POIs, names from common keys, and skips lines", () => {
    const plan = planGeoJSONImport({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [3, 4] },
          properties: { NAME: "Fort", category: "military" },
        },
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          properties: {},
        },
        { type: "Feature", geometry: null, properties: {} },
      ],
    });
    expect(plan.features).toHaveLength(1);
    expect(plan.features[0]).toMatchObject({ kind: "poi", name: "Fort" });
    expect(plan.skipped).toBe(2);
  });

  it("accepts a bare geometry", () => {
    expect(planGeoJSONImport(square).features[0]?.kind).toBe("subdivision");
  });
});
