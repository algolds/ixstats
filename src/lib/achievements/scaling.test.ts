import { percentileOf, RARITY_PERCENTILE, SCALE_METRIC_BY_ID } from "./scaling";

describe("percentileOf", () => {
  const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100 ascending

  it("returns a low value for low percentiles and a high value for high ones", () => {
    expect(percentileOf(sorted, 25)).toBeLessThan(percentileOf(sorted, 90));
    expect(percentileOf(sorted, 50)).toBe(51);
    expect(percentileOf(sorted, 98)).toBe(99);
  });

  it("is monotonic across the rarity percentiles", () => {
    const pcts = [25, 50, 75, 90, 98];
    const vals = pcts.map((p) => percentileOf(sorted, p));
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]!);
  });

  it("treats an empty distribution as unattainable", () => {
    expect(percentileOf([], 50)).toBe(Infinity);
  });
});

describe("scale config integrity", () => {
  it("maps every rarity to a percentile and every scale id to a metric", () => {
    for (const pct of Object.values(RARITY_PERCENTILE)) expect(pct).toBeGreaterThan(0);
    for (const metric of Object.values(SCALE_METRIC_BY_ID)) expect(metric).toMatch(/^current/);
  });
});
