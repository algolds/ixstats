import { describe, it, expect } from "@jest/globals";
import { generateWorld } from "../worldgen/engine";
import { evaluateWorldAccuracy, auditWorldGenerationBatch } from "./accuracy-normalizer";

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
