import { describe, it, expect } from "@jest/globals";
import { enrichMapDataset } from "./enrichment-pipeline";
import type { FeatureCollection } from "geojson";

describe("enrichment-pipeline", () => {
  it("enriches raw layers and country metadata into geo profiles, resources, and shared vertices", () => {
    const mockPolitical: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: "country_1", name: "Alpha", areaSqKm: 100000 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { id: "country_2", name: "Beta", areaSqKm: 80000 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [1, 0],
                [2, 0],
                [2, 1],
                [1, 1],
                [1, 0],
              ],
            ],
          },
        },
      ],
    };

    const layers = { political: mockPolitical };
    const countries = [
      { featureId: "country_1", name: "Alpha", areaSqKm: 100000, centroid: [0.5, 0.5] as [number, number] },
      { featureId: "country_2", name: "Beta", areaSqKm: 80000, centroid: [1.5, 0.5] as [number, number] },
    ];

    const result = enrichMapDataset(layers, countries, "test_realm");

    expect(result.geoProfiles.length).toBe(2);
    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.sharedVertices.length).toBeGreaterThan(0);
    expect(result.sharedVertices[0]).toHaveProperty("worldId", "test_realm");
  });
});
