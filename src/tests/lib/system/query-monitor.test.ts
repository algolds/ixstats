/** @jest-environment node */
import { describe, it, expect, afterEach } from "@jest/globals";
import { QueryPerformanceMonitor, type QueryMetrics } from "~/lib/system/query-monitor";

function metric(n: number, duration = 10): QueryMetrics {
  return { queryKey: `q${n}`, duration, success: true, timestamp: n };
}

describe("QueryPerformanceMonitor ring buffer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps the newest entries in oldest-to-newest order", () => {
    const monitor = new QueryPerformanceMonitor(3);
    [1, 2, 3, 4, 5].forEach((n) => monitor.recordQuery(metric(n)));

    expect(monitor.getMetrics().map((m) => m.queryKey)).toEqual(["q3", "q4", "q5"]);
    expect(monitor.getStats().totalQueries).toBe(3);
  });

  it("logs a slow query once and a fast query not at all", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const monitor = new QueryPerformanceMonitor(3);

    monitor.recordQuery(metric(1, 150));
    expect(warn).toHaveBeenCalledTimes(1);

    monitor.recordQuery(metric(2, 50));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("clearMetrics empties the buffer", () => {
    const monitor = new QueryPerformanceMonitor(3);
    [1, 2, 3, 4].forEach((n) => monitor.recordQuery(metric(n)));

    monitor.clearMetrics();

    expect(monitor.getMetrics()).toEqual([]);
    expect(monitor.getStats().totalQueries).toBe(0);
  });
});
