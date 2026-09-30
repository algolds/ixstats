import { describe, it, expect } from "@jest/globals";
import {
  calculateRouteTravelTime,
  formatTravelDuration,
  resolveRouteBaseSpeed,
  getSpeedPresets,
  isInstantaneousRoute,
  KMH_PER_KNOT,
  type LngLat,
} from "~/lib/economy/travel-time";
import { bearing, distanceKm } from "~/lib/maps/geo-math";

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

    it("computes segment bearings, including across the antimeridian", () => {
      expect(bearing([0, 0], [0, 10])).toBeCloseTo(0, 6);
      expect(bearing([0, 0], [10, 0])).toBeCloseTo(90, 6);
      expect(bearing([0, 10], [0, 0])).toBeCloseTo(180, 6);
      expect(bearing([179.5, 0], [-179.5, 0])).toBeCloseTo(90, 6);
      expect(bearing([-179.5, 0], [179.5, 0])).toBeCloseTo(270, 6);
    });

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

    it("applies following, beam and head seas inside a wind belt", () => {
      // Mid-Odoneru, 23–25°N: NE Trade Winds, no modelled current.
      const following = sail([
        [-30, 25],
        [-32, 23],
      ]); // heading ~SW, with the wind
      const head = sail([
        [-32, 23],
        [-30, 25],
      ]); // heading ~NE, into the wind
      const beam = sail([
        [-30, 23],
        [-32, 25],
      ]); // heading ~NW, across the wind

      expect(following.sea?.averageSpeedKmh).toBeCloseTo(30 + 1.25 * KMH_PER_KNOT, 3);
      expect(head.sea?.averageSpeedKmh).toBeCloseTo(30 - 1.75 * KMH_PER_KNOT, 3);
      expect(beam.sea?.averageSpeedKmh).toBeCloseTo(30 - 0.75 * KMH_PER_KNOT, 3);
      expect(following.sea?.largestEffect).toMatchObject({ name: "NE Trade Winds", kind: "wind" });
    });

    it("reports the system with the largest net effect", () => {
      // NE-bound through the Dolong box inside the NE Trades: current assist < head-sea drag.
      const result = sail([
        [91, 20],
        [99, 29],
      ]);
      expect(result.sea?.largestEffect).toMatchObject({ name: "NE Trade Winds", kind: "wind" });
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

    it("matches the plain model where no current or wind applies", () => {
      // 32°N in the Odoneru: horse latitudes, no modelled current.
      const path: LngLat[] = [
        [-40, 32],
        [-30, 32],
      ];
      const lengthKm = distanceKm(path[0]!, path[1]!);
      const withModel = calculateRouteTravelTime({
        lengthKm,
        routeType: "shipping_lane",
        seaPath: path,
      });
      const plain = calculateRouteTravelTime({ lengthKm, routeType: "shipping_lane" });

      expect(withModel.sea?.largestEffect).toBeNull();
      expect(withModel.sea?.averageSpeedKmh).toBeCloseTo(30, 6);
      expect(withModel.totalMinutes).toBe(plain.totalMinutes);
    });

    it("leaves non-sea routes and path-less sea routes unchanged", () => {
      const highway = {
        lengthKm: 300,
        speedKmh: 100,
        routeType: "highway",
        terrainDifficulty: 0.4,
        stopsCount: 3,
      };
      const highwayWithPath = calculateRouteTravelTime({ ...highway, seaPath: DOLONG_NORTH });
      expect(highwayWithPath).toEqual(calculateRouteTravelTime(highway));
      expect("sea" in highwayWithPath).toBe(false);

      const canal = calculateRouteTravelTime({
        lengthKm: 120,
        routeType: "canal",
        seaPath: DOLONG_NORTH,
      });
      expect("sea" in canal).toBe(false);
      expect(canal.effectiveSpeedKmh).toBe(15);

      const noPath = calculateRouteTravelTime({ lengthKm: 600, routeType: "shipping_lane" });
      expect("sea" in noPath).toBe(false);
      expect(noPath.effectiveSpeedKmh).toBe(30);
      expect(noPath.totalMinutes).toBe(1220); // 600 km / 30 km/h = 1200 min + 20 min docking

      const onePoint = calculateRouteTravelTime({
        lengthKm: 600,
        routeType: "shipping_lane",
        seaPath: [[95, 30]],
      });
      expect(onePoint).toEqual(noPath);
    });
  });
});
