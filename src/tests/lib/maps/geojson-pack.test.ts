import type { FeatureCollection } from "geojson";
import { packFeatureCollection, unpackLayers } from "~/lib/maps/geojson-pack";

const fc: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { _id: "a" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-179.9871, 12.5],
              [-179.5, 12.75],
              [-179.5, 13.0001],
              [-179.9871, 12.5],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { _id: "b" },
      geometry: {
        type: "LineString",
        coordinates: [
          [10.12, -5.5],
          [10.13, -5.49],
        ],
      },
    },
    {
      type: "Feature",
      properties: { _id: "c" },
      geometry: { type: "Point", coordinates: [1.23456, 2.34567] },
    },
    { type: "Feature", properties: { _id: "d" }, geometry: null as never },
  ],
};

describe("geojson-pack", () => {
  it("round-trips every geometry type at the packed precision", () => {
    const { political } = unpackLayers({ political: packFeatureCollection(fc, 4) });
    expect(political).toEqual(fc);
  });

  it("stores lines as integer deltas, which is what makes it smaller", () => {
    const packed = packFeatureCollection(fc, 2);
    expect(packed.features[1]!.geometry).toEqual({
      type: "LineString",
      coordinates: [1012, -550, 1, 1],
    });
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(fc).length);
  });

  it("rounds to the precision without drifting along a line", () => {
    const line: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: Array.from({ length: 50 }, (_, i) => [i * 0.00449, 0]),
          },
        },
      ],
    };
    const { l } = unpackLayers({ l: packFeatureCollection(line, 2) });
    const coords = (l!.features[0]!.geometry as { coordinates: number[][] }).coordinates;
    expect(coords[49]![0]).toBeCloseTo(0.22, 10);
  });

  it("passes plain GeoJSON (the IndexedDB placeholder) through unchanged", () => {
    expect(unpackLayers({ political: fc }).political).toBe(fc);
  });

  it("decodes each packed layer once, so unchanged layers keep their identity", () => {
    const packed = packFeatureCollection(fc, 4);
    const first = unpackLayers({ political: packed });
    const second = unpackLayers({ political: packed, other: packFeatureCollection(fc, 2) });
    expect(second.political).toBe(first.political);
  });
});
