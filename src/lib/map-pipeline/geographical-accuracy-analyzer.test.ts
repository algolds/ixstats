import { generateWorld } from "../worldgen/engine";
import { normalizeAzgaarGraph } from "./azgaar-normalizer";
import { auditGeographicalAccuracy } from "./geographical-accuracy-analyzer";

describe("Scientific & Earth-Like Geographical Accuracy Audit Suite (85%+ High-Bar)", () => {
  it("enforces composite scientific accuracy >= 85% across 10 random world seeds", () => {
    const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 12345];

    for (const seed of seeds) {
      const world = generateWorld({ seed, cellCount: 1500 });
      const normalized = normalizeAzgaarGraph(world.graph, seed);

      const report = auditGeographicalAccuracy(world.graph, normalized.layers);

      expect(report.compositeScore).toBeGreaterThanOrEqual(85);
      expect(report.passesThreshold).toBe(true);

      // Verify Earth-like compatibility metrics
      expect(report.metrics.earthLikeCompatibilityScore).toBeGreaterThanOrEqual(75);
      expect(report.metrics.hydrologicalFlowScore).toBeGreaterThanOrEqual(85);
      expect(report.metrics.hypsometricCurveScore).toBeGreaterThanOrEqual(85);
      expect(report.metrics.vectorSmoothnessScore).toBeGreaterThanOrEqual(80);
    }
  });
});
