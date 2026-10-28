/**
 * Politics drift's jitter (stress test B-11) read the first character of the party id, and every cuid starts
 * with "c": every party lost 0.2 points every run, a bias, not noise. It now varies by party and by day and
 * averages out.
 */
import { driftJitter } from "~/lib/government/politics-drift-cron";

const DAY = 86_400_000;
const ids = ["cmvslxrrh00p5f9dslx0cauef", "cmvslxrzu00p8f9dsc6g7lo74", "cmqy0r80500q9rpohhh5cv1pc"];

describe("politics drift jitter", () => {
  it("is not the same for every party", () => {
    expect(new Set(ids.map((id) => driftJitter(id, 0))).size).toBeGreaterThan(1);
  });

  it("averages out over a year of runs and stays within ±0.3", () => {
    for (const id of ids) {
      const values = Array.from({ length: 365 }, (_, d) => driftJitter(id, d * DAY));
      for (const v of values) expect(Math.abs(v)).toBeLessThanOrEqual(0.3 + 1e-9);
      expect(Math.abs(values.reduce((s, v) => s + v, 0) / values.length)).toBeLessThan(0.05);
    }
  });
});
