import { describe, it, expect } from "@jest/globals";
import {
  calculateRouteTravelTime,
  formatTravelDuration,
  resolveRouteBaseSpeed,
  getSpeedPresets,
  isInstantaneousRoute,
} from "~/lib/economy/travel-time";

describe("Travel Time Engine", () => {
  describe("resolveRouteBaseSpeed", () => {
    it("prioritizes explicit speedKmh", () => {
      const speed = resolveRouteBaseSpeed("rail", 160, { speed_kmh: 120 });
      expect(speed).toBe(160);
    });

    it("supports options object syntax", () => {
      const speed = resolveRouteBaseSpeed({
        routeType: "rail",
        speedKmh: 160,
        properties: { speed_kmh: 120 },
      });
      expect(speed).toBe(160);
    });

    it("falls back to legacy properties.speed_kmh if speedKmh is absent", () => {
      const speed = resolveRouteBaseSpeed("rail", undefined, { speed_kmh: 140 });
      expect(speed).toBe(140);
    });

    it("parses string properties.speed_kmh correctly", () => {
      const speed = resolveRouteBaseSpeed({
        routeType: "rail",
        properties: { speed_kmh: "135" },
      });
      expect(speed).toBe(135);
    });

    it("falls back to default route type speed if neither is provided", () => {
      const speed = resolveRouteBaseSpeed("high_speed_rail");
      expect(speed).toBe(300);
    });

    it("falls back to 80 km/h for unknown route types", () => {
      const speed = resolveRouteBaseSpeed("custom_hyperloop");
      expect(speed).toBe(80);
    });
  });

  describe("formatTravelDuration", () => {
    it("formats sub-minute duration as 0m or rounded minutes", () => {
      expect(formatTravelDuration(0)).toBe("0m");
      expect(formatTravelDuration(42)).toBe("42m");
      expect(formatTravelDuration(59)).toBe("59m");
    });

    it("formats standard multi-hour durations", () => {
      expect(formatTravelDuration(60)).toBe("1h");
      expect(formatTravelDuration(125)).toBe("2h 05m");
      expect(formatTravelDuration(360)).toBe("6h");
    });

    it("formats multi-day durations", () => {
      expect(formatTravelDuration(1440)).toBe("1d");
      expect(formatTravelDuration(1500)).toBe("1d 01h");
      expect(formatTravelDuration(2880)).toBe("2d");
    });
  });

  describe("calculateRouteTravelTime", () => {
    it("handles instantaneous networks (fiber, power_grid)", () => {
      const result = calculateRouteTravelTime({
        lengthKm: 1200,
        routeType: "fiber",
      });
      expect(result.isInstantaneous).toBe(true);
      expect(result.formattedTime).toBe("< 1ms");
      expect(result.totalMinutes).toBe(0);
    });

    it("calculates basic travel time without terrain drag or dwell stops", () => {
      // 300 km at 100 km/h = 3 hours = 180 minutes
      const result = calculateRouteTravelTime({
        lengthKm: 300,
        speedKmh: 100,
        routeType: "highway",
        terrainDifficulty: 0,
        stopsCount: 2,
      });

      expect(result.effectiveSpeedKmh).toBe(100);
      expect(result.terrainPenaltyPercent).toBe(0);
      expect(result.terrainDragFactor).toBe(1);
      expect(result.dwellTimeMinutes).toBe(0);
      expect(result.totalMinutes).toBe(180);
      expect(result.formattedTime).toBe("3h");
    });

    it("applies terrain difficulty degradation", () => {
      // 100 km/h with 1.0 terrain difficulty -> 25% drag -> 75 km/h
      const result = calculateRouteTravelTime({
        lengthKm: 150,
        speedKmh: 100,
        routeType: "road",
        terrainDifficulty: 1.0,
      });

      expect(result.effectiveSpeedKmh).toBe(75);
      expect(result.terrainPenaltyPercent).toBe(25);
      expect(result.terrainDragFactor).toBe(0.75);
      // 150 km / 75 km/h = 2.0 hrs = 120 min
      expect(result.totalMinutes).toBe(120);
      expect(result.formattedTime).toBe("2h");
    });

    it("adds intermediate stop dwell time for railways", () => {
      // 4 stops = 2 endpoints + 2 intermediate stops -> 2 * 5m = 10m dwell
      // 300 km at 300 km/h = 60 min cruising + 10m dwell = 70 min = 1h 10m
      const result = calculateRouteTravelTime({
        lengthKm: 300,
        speedKmh: 300,
        routeType: "high_speed_rail",
        stopsCount: 4,
      });

      expect(result.dwellTimeMinutes).toBe(10);
      expect(result.totalMinutes).toBe(70);
      expect(result.formattedTime).toBe("1h 10m");
    });

    it("includes departure/arrival overhead for air corridors", () => {
      // 850 km at 850 km/h = 60m + 45m airport terminal overhead = 105m = 1h 45m
      const result = calculateRouteTravelTime({
        lengthKm: 850,
        speedKmh: 850,
        routeType: "air_corridor",
      });

      expect(result.dwellTimeMinutes).toBe(45);
      expect(result.totalMinutes).toBe(105);
      expect(result.formattedTime).toBe("1h 45m");
    });

    it("handles zero or negative distance gracefully", () => {
      const result = calculateRouteTravelTime({
        lengthKm: 0,
        speedKmh: 100,
        routeType: "road",
      });

      expect(result.totalMinutes).toBe(0);
      expect(result.formattedTime).toBe("0m");
    });
  });

  describe("getSpeedPresets", () => {
    it("returns presets for recognized types", () => {
      const presets = getSpeedPresets("high_speed_rail");
      expect(presets.length).toBeGreaterThan(0);
      expect(presets.some((p) => p.speed === 300)).toBe(true);
    });

    it("returns empty array for unknown types", () => {
      expect(getSpeedPresets("unknown")).toEqual([]);
      expect(getSpeedPresets(null)).toEqual([]);
    });
  });

  describe("isInstantaneousRoute", () => {
    it("identifies power_grid and fiber correctly", () => {
      expect(isInstantaneousRoute("fiber")).toBe(true);
      expect(isInstantaneousRoute("power_grid")).toBe(true);
      expect(isInstantaneousRoute("rail")).toBe(false);
      expect(isInstantaneousRoute(null)).toBe(false);
    });
  });
});
