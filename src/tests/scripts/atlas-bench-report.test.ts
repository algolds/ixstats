/**
 * @jest-environment node
 */
import { atMost, exitCode, info, percentile } from "../../../scripts/perf/atlas-bench-report";

describe("atMost", () => {
  it("passes at and under the limit and fails over it", () => {
    expect(atMost("a", 50, 50, "ms").pass).toBe(true);
    expect(atMost("a", 3.2, 50, "ms").pass).toBe(true);
    expect(atMost("a", 50.01, 50, "ms").pass).toBe(false);
  });

  it("never passes a value that was not measured", () => {
    expect(atMost("a", Number.NaN, 50, "ms").pass).toBe(false);
    expect(atMost("a", Number.POSITIVE_INFINITY, 50, "ms").pass).toBe(false);
  });
});
describe("percentile", () => {
  it("is the smallest value that at least p of the values are at or below (nearest rank)", () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(values, 0.95)).toBe(19);
    expect(percentile(values, 1)).toBe(20);
    expect(percentile(values, 0.5)).toBe(10);
    expect(percentile([5], 0.95)).toBe(5);
  });

  it("is not the maximum when one frame in twenty is slow", () => {
    const frames = [...Array.from({ length: 19 }, () => 1), 4.5];
    expect(percentile(frames, 0.95)).toBe(1);
    expect(Math.max(...frames)).toBe(4.5);
  });
});
describe("exitCode", () => {
  const pass = atMost("p", 1, 2, "ms");
  const fail = atMost("f", 3, 2, "ms");

  it("is 0 when every target passes", () => {
    expect(exitCode([pass, pass])).toBe(0);
  });

  it("is 1 when any target fails", () => {
    expect(exitCode([pass, fail, pass])).toBe(1);
  });

  it("is 1 when nothing was measured", () => {
    expect(exitCode([])).toBe(1);
  });

  it("is not decided by an informational line, however slow", () => {
    expect(exitCode([pass, info("slowest frame", 900, "ms")])).toBe(0);
    expect(exitCode([info("slowest frame", 1, "ms")])).toBe(1);
  });
});
