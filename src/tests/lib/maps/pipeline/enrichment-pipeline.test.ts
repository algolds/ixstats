import { describe, it, expect } from "@jest/globals";
import { enrichMapDataset } from "~/lib/maps/pipeline/enrichment-pipeline";
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
      {
        featureId: "country_1",
        name: "Alpha",
        areaSqKm: 100000,
        centroid: [0.5, 0.5] as [number, number],
      },
      {
        featureId: "country_2",
        name: "Beta",
        areaSqKm: 80000,
        centroid: [1.5, 0.5] as [number, number],
      },
    ];

    const result = enrichMapDataset(layers, countries, "test_realm");

    expect(result.geoProfiles.length).toBe(2);
    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.sharedVertices.length).toBeGreaterThan(0);
    expect(result.sharedVertices[0]).toHaveProperty("worldId", "test_realm");
  });
});


import { generateWorld } from "~/lib/worldgen/engine";
import { normalizeAzgaarGraph } from "~/lib/maps/pipeline/azgaar-normalizer";
import { evaluateWorldAccuracy, auditWorldGenerationBatch } from "~/lib/maps/pipeline/accuracy-normalizer";
import { synthesizeHybridVectorWorld } from "~/lib/maps/pipeline/vector-synthesis";
import { auditGeographicalAccuracy } from "~/lib/maps/pipeline/geographical-accuracy-analyzer";

describe("accuracy-normalizer", () => {
  it("evaluates a single world generation against IxWorld & IRL targets", () => {
    const world = generateWorld({ seed: 12345, cellCount: 500, useIxWorldTemplate: true });
    const scoreCard = evaluateWorldAccuracy(world);

    expect(scoreCard.seed).toBe(12345);
    expect(scoreCard.overallScore).toBeGreaterThanOrEqual(70);
    expect(scoreCard.metrics.landPercentage.passed).toBe(true);
  });

  it("runs a batch audit of 10 seeds and verifies pass rate >= 80%", () => {
    const seeds = [1001, 2002, 3003, 4004, 5005, 6006, 7007, 8008, 9009, 11111];

    const audit = auditWorldGenerationBatch(
      (seed) =>
        generateWorld({
          seed,
          cellCount: 600,
          countryCountRange: [8, 15],
          useIxWorldTemplate: true,
        }),
      seeds
    );

    expect(audit.totalTested).toBe(10);
    expect(audit.averageScore).toBeGreaterThanOrEqual(75);
    expect(audit.passRatePercent).toBeGreaterThanOrEqual(80);
  });
});

describe("azgaar-normalizer", () => {
  it("converts a generated world graph into normalized GeoJSON layers and country entities", () => {
    const world = generateWorld({ seed: 42, cellCount: 500 });
    const normalized = normalizeAzgaarGraph(world.graph, 42);

    expect(normalized.metadata.seed).toBe(42);
    expect(normalized.layers.political).toBeDefined();
    expect(normalized.layers.altitudes).toBeDefined();
    expect(normalized.layers.rivers).toBeDefined();
    expect(normalized.countries.length).toBeGreaterThan(0);
    expect(normalized.countries[0]).toHaveProperty("featureId");
    expect(normalized.countries[0]).toHaveProperty("name");
    expect(normalized.countries[0]).toHaveProperty("areaSqKm");
  });
});

describe("Vector Synthesis Engine", () => {
  it("synthesizes valid RFC 7946 GeoJSON collections across random seeds", () => {
    const world = synthesizeHybridVectorWorld(12345);

    expect(world).toHaveProperty("background");
    expect(world).toHaveProperty("altitudes");
    expect(world).toHaveProperty("rivers");
    expect(world).toHaveProperty("lakes");

    expect(world.background.features.length).toBeGreaterThan(0);
    expect(world.altitudes.features.length).toBeGreaterThan(0);
    expect(world.rivers.features.length).toBeGreaterThan(0);
    expect(world.lakes.features.length).toBeGreaterThan(0);

    for (const feat of world.altitudes.features) {
      expect(typeof feat.id).toBe("number");
      expect(feat.geometry.type).toMatch(/Polygon|MultiPolygon/);
    }

    for (const feat of world.rivers.features) {
      expect(typeof feat.id).toBe("number");
      expect(feat.geometry.type).toBe("LineString");
    }
  });
});

describe("Scientific & Earth-Like Geographical Accuracy Audit Suite (85%+ High-Bar)", () => {
  it("enforces composite scientific accuracy >= 85% across 10 random world seeds", () => {
    const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 12345];

    for (const seed of seeds) {
      const world = generateWorld({ seed, cellCount: 1500 });
      const normalized = normalizeAzgaarGraph(world.graph, seed);

      const report = auditGeographicalAccuracy(world.graph, normalized.layers);

      expect(report.compositeScore).toBeGreaterThanOrEqual(85);
      expect(report.passesThreshold).toBe(true);

      expect(report.metrics.earthLikeCompatibilityScore).toBeGreaterThanOrEqual(75);
      expect(report.metrics.hydrologicalFlowScore).toBeGreaterThanOrEqual(85);
      expect(report.metrics.hypsometricCurveScore).toBeGreaterThanOrEqual(85);
      expect(report.metrics.vectorSmoothnessScore).toBeGreaterThanOrEqual(80);
    }
  });
});
