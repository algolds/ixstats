import { describe, it, expect } from "@jest/globals";
import {
  calculateTAMI,
  calculateMaintenanceDegradation,
  calculateModalBreakdown,
  estimateIntercityTravelTimes,
  type RouteForMobility,
  type CityNode,
} from "~/lib/economy/national-mobility";

describe("National Mobility Engine", () => {
  describe("calculateTAMI (Transit Accessibility & Mobility Index)", () => {
    it("returns 0 and underdeveloped rating for empty networks", () => {
      const result = calculateTAMI({
        totalLengthKm: 0,
        landAreaKm2: 100_000,
        effectiveAverageSpeedKmh: 0,
        totalHubs: 0,
        cityCount: 10,
        operationalRouteTypes: [],
      });

      expect(result.tamiScore).toBe(0);
      expect(result.rating).toBe("underdeveloped");
    });

    it("calculates high score for dense high-speed multi-modal networks", () => {
      const result = calculateTAMI({
        totalLengthKm: 12_000,
        landAreaKm2: 80_000,
        effectiveAverageSpeedKmh: 180,
        baselineSpeedKmh: 80,
        totalHubs: 24,
        cityCount: 20,
        operationalRouteTypes: [
          "high_speed_rail",
          "motorway",
          "shipping_lane",
          "air_corridor",
          "fiber",
        ],
      });

      expect(result.tamiScore).toBeGreaterThanOrEqual(80);
      expect(result.rating).toBe("world_class");
      expect(result.densityScore).toBeGreaterThan(0);
      expect(result.velocityScore).toBeGreaterThan(0);
      expect(result.diversityScore).toBe(100);
    });

    it("evaluates intermediate developing transit networks accurately", () => {
      const result = calculateTAMI({
        totalLengthKm: 1_200,
        landAreaKm2: 60_000,
        effectiveAverageSpeedKmh: 65,
        baselineSpeedKmh: 80,
        totalHubs: 4,
        cityCount: 12,
        operationalRouteTypes: ["road", "trunk"],
      });

      expect(result.tamiScore).toBeGreaterThan(0);
      expect(result.tamiScore).toBeLessThan(60);
      expect(result.rating).toBe("developing");
    });
  });

  describe("calculateMaintenanceDegradation", () => {
    it("handles zero required maintenance as optimal", () => {
      const result = calculateMaintenanceDegradation({
        budgetedMaintenance: 0,
        requiredMaintenance: 0,
      });

      expect(result.condition).toBe("optimal");
      expect(result.speedDegradationFactor).toBe(1.0);
      expect(result.speedPenaltyPercent).toBe(0);
    });

    it("rates fully funded budgets as optimal with bonus", () => {
      const result = calculateMaintenanceDegradation({
        budgetedMaintenance: 1.2,
        requiredMaintenance: 1.0,
      });

      expect(result.condition).toBe("optimal");
      expect(result.speedDegradationFactor).toBe(1.0);
      expect(result.speedPenaltyPercent).toBe(0);
      expect(result.fundingRatio).toBe(1.2);
      expect(result.gdpModifierDelta).toBeGreaterThan(0);
    });

    it("rates 75% funded budgets as adequate with minor speed drag", () => {
      const result = calculateMaintenanceDegradation({
        budgetedMaintenance: 0.75,
        requiredMaintenance: 1.0,
      });

      expect(result.condition).toBe("adequate");
      expect(result.speedDegradationFactor).toBe(0.92);
      expect(result.speedPenaltyPercent).toBe(8);
    });

    it("rates 50% funded budgets as deteriorating with noticeable drag", () => {
      const result = calculateMaintenanceDegradation({
        budgetedMaintenance: 0.5,
        requiredMaintenance: 1.0,
      });

      expect(result.condition).toBe("deteriorating");
      expect(result.speedDegradationFactor).toBe(0.78);
      expect(result.speedPenaltyPercent).toBe(22);
      expect(result.gdpModifierDelta).toBeLessThan(0);
    });

    it("rates under 40% funding as failing with severe degradation", () => {
      const result = calculateMaintenanceDegradation({
        budgetedMaintenance: 0.2,
        requiredMaintenance: 1.0,
      });

      expect(result.condition).toBe("failing");
      expect(result.speedDegradationFactor).toBe(0.60);
      expect(result.speedPenaltyPercent).toBe(40);
      expect(result.gdpModifierDelta).toBeLessThan(-0.005);
    });
  });

  describe("calculateModalBreakdown", () => {
    it("aggregates routes and calculates weighted average speed", () => {
      const sampleRoutes: RouteForMobility[] = [
        {
          id: "r1",
          name: "Bullet Line",
          routeType: "high_speed_rail",
          lengthKm: 300,
          speedKmh: 300,
          status: "operational",
        },
        {
          id: "r2",
          name: "Coastal Motorway",
          routeType: "motorway",
          lengthKm: 300,
          speedKmh: 130,
          status: "operational",
        },
        {
          id: "r3",
          name: "Under Construction Spur",
          routeType: "rail",
          lengthKm: 200,
          speedKmh: 120,
          status: "under_construction",
        },
      ];

      const result = calculateModalBreakdown(sampleRoutes);

      expect(result.totalOperationalKm).toBe(600);
      // Average of 300km @ 300 and 300km @ 130 = 215 km/h
      expect(result.overallWeightedSpeedKmh).toBe(215);
      expect(result.fastestRoute?.name).toBe("Bullet Line");
      expect(result.modalGroups.high_speed_rail?.count).toBe(1);
      expect(result.modalGroups.motorway?.count).toBe(1);
      expect(result.modalGroups.rail).toBeUndefined(); // Under construction excluded
    });
  });

  describe("estimateIntercityTravelTimes", () => {
    it("returns empty array when fewer than 2 cities provided", () => {
      const cities: CityNode[] = [{ id: "c1", name: "Capital City" }];
      expect(estimateIntercityTravelTimes(cities, [])).toEqual([]);
    });

    it("estimates realistic travel times using HSR when present", () => {
      const cities: CityNode[] = [
        { id: "c1", name: "Capital", coordinates: [10.0, 50.0] },
        { id: "c2", name: "Metropolis", coordinates: [12.0, 50.0] }, // ~140 km away
      ];
      const routes: RouteForMobility[] = [
        {
          id: "r1",
          name: "Express HSR",
          routeType: "high_speed_rail",
          lengthKm: 200,
          status: "operational",
        },
      ];

      const links = estimateIntercityTravelTimes(cities, routes);
      expect(links.length).toBe(1);
      expect(links[0]?.originName).toBe("Capital");
      expect(links[0]?.destName).toBe("Metropolis");
      expect(links[0]?.mode).toBe("high_speed_rail");
      expect(links[0]?.totalMinutes).toBeLessThan(60); // 140km at 280 km/h is ~35 mins
    });
  });
});
