import { describe, it, expect } from "@jest/globals";
import {
  calculateRouteTravelTime,
  resolveRouteBaseSpeed,
  KMH_PER_KNOT,
  type LngLat,
} from "~/lib/economy/travel-time";
import { distanceKm } from "~/lib/maps/geo-math";

describe("Travel Time Engine", () => {
  describe("resolveRouteBaseSpeed", () => {
    it("falls back to 80 km/h for unknown route types", () => {
      const speed = resolveRouteBaseSpeed("custom_hyperloop");
      expect(speed).toBe(80);
    });
  });
  describe("calculateRouteTravelTime", () => {
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
  });
  describe("sea current & wind model", () => {
    // shipping_lane defaults to 30 km/h still-water speed.
    const sail = (seaPath: LngLat[], speedKmh?: number) =>
      calculateRouteTravelTime({
        lengthKm: distanceKm(seaPath[0]!, seaPath[seaPath.length - 1]!),
        routeType: "shipping_lane",
        speedKmh,
        seaPath,
      });

    // 95°E between 30.5°N and 34.5°N: inside the Dolong Warm Current, in the calm horse latitudes.
    const DOLONG_NORTH: LngLat[] = [
      [95, 30.5],
      [95, 34.5],
    ];
    const DOLONG_SOUTH: LngLat[] = [...DOLONG_NORTH].reverse();
    it("speeds up a ship riding a current and slows it against the current", () => {
      const assist = KMH_PER_KNOT * 2.0;
      const north = sail(DOLONG_NORTH);
      const south = sail(DOLONG_SOUTH);

      expect(north.sea?.averageSpeedKmh).toBeCloseTo(30 + assist, 3);
      expect(south.sea?.averageSpeedKmh).toBeCloseTo(30 - assist, 3);
      expect(north.effectiveSpeedKmh).toBe(33.7);
      expect(south.effectiveSpeedKmh).toBe(26.3);
      expect(north.totalMinutes).toBeLessThan(south.totalMinutes);

      expect(north.sea?.largestEffect).toMatchObject({
        name: "Dolong Warm Current",
        kind: "current",
      });
      expect(north.sea?.largestEffect?.averageChangeKmh).toBeCloseTo(assist, 3);
      expect(south.sea?.largestEffect?.averageChangeKmh).toBeCloseTo(-assist, 3);
    });
    it("handles a segment that crosses the antimeridian", () => {
      // 20°S, heading ~NW across 180°: SE Trade Winds blow toward the NW, so following seas.
      const path: LngLat[] = [
        [-179.5, -20],
        [179.5, -19],
      ];
      const result = sail(path);

      expect(result.sea?.distanceKm).toBeCloseTo(distanceKm(path[0]!, path[1]!), 6);
      expect(result.sea?.distanceKm).toBeLessThan(200);
      expect(result.sea?.averageSpeedKmh).toBeCloseTo(30 + 1.25 * KMH_PER_KNOT, 3);
      expect(result.sea?.largestEffect?.name).toBe("SE Trade Winds");
      expect(result.totalMinutes).toBeGreaterThan(0);
      expect(Number.isFinite(result.totalMinutes)).toBe(true);
    });

    it("never lets a head current stop or reverse a slow ship", () => {
      const result = sail(DOLONG_SOUTH, 2);
      expect(result.sea?.averageSpeedKmh).toBeCloseTo(1, 6);
      expect(result.totalMinutes).toBeGreaterThan(0);
      expect(Number.isFinite(result.totalMinutes)).toBe(true);
    });

    it("falls back to the plain model when the path has bad coordinates", () => {
      const result = calculateRouteTravelTime({
        lengthKm: 600,
        routeType: "shipping_lane",
        seaPath: [
          [95, Number.NaN],
          [95, 34],
        ],
      });
      expect("sea" in result).toBe(false);
      expect(result.totalMinutes).toBe(1220);
    });
  });
});
