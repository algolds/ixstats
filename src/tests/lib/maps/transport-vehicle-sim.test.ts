import {
  generateVehicleTrips,
  getVehiclePositionAtTime,
  calculateEconomicTrafficCoefficient,
  calculateNetworkAverageEconomicCoefficient,
  featuresToSegments,
  type TransportSegmentInput,
} from "~/lib/maps/transport-vehicle-sim";

describe("transport-vehicle-sim", () => {
  const mockSegment: TransportSegmentInput = {
    id: "seg-101",
    routeType: "high_speed_rail",
    status: "operational",
    geometry: {
      type: "LineString",
      coordinates: [
        [0.0, 0.0],
        [1.0, 0.0],
        [2.0, 0.0],
      ],
    },
    speedKmh: 300,
    lengthKm: 222,
  };

  it("generates trips for operational segments", () => {
    const trips = generateVehicleTrips([mockSegment], 0.5, 120);
    expect(trips.length).toBeGreaterThanOrEqual(1);

    const trip = trips[0]!;
    expect(trip.segmentId).toBe("seg-101");
    expect(trip.routeType).toBe("high_speed_rail");
    expect(trip.path).toEqual(mockSegment.geometry.coordinates);
    expect(trip.timestamps.length).toBe(mockSegment.geometry.coordinates.length);
  });

  it("ignores non-operational segments", () => {
    const plannedSegment: TransportSegmentInput = {
      ...mockSegment,
      id: "seg-planned",
      status: "planned",
    };
    const trips = generateVehicleTrips([plannedSegment]);
    expect(trips).toHaveLength(0);
  });

  it("interpolates vehicle position along the path", () => {
    const trips = generateVehicleTrips([mockSegment], 0.5, 120);
    const trip = trips[0]!;

    const pos0 = getVehiclePositionAtTime(trip, trip.timestamps[0]!);
    expect(pos0).toBeDefined();
    expect(pos0![0]).toBeCloseTo(0.0, 1);
    expect(pos0![1]).toBeCloseTo(0.0, 1);
  });

  describe("calculateEconomicTrafficCoefficient", () => {
    it("returns neutral 1.0 when economic metrics are missing", () => {
      expect(calculateEconomicTrafficCoefficient()).toBe(1.0);
      expect(calculateEconomicTrafficCoefficient({ totalGdp: null })).toBe(1.0);
    });

    it("scales up for high-GDP superpower economies", () => {
      const coeff = calculateEconomicTrafficCoefficient({
        totalGdp: 15_000,
        economicTier: "Tier 1",
        gdpPerCapita: 70_000,
        isInternational: true,
      });
      expect(coeff).toBe(2.5); // clamped at max 2.5
    });

    it("scales down for emerging / developing economies", () => {
      const coeff = calculateEconomicTrafficCoefficient({
        totalGdp: 30,
        economicTier: "Tier 5 (Emerging)",
        gdpPerCapita: 3_000,
      });
      expect(coeff).toBeLessThan(0.5);
      expect(coeff).toBeGreaterThanOrEqual(0.25); // clamped at min 0.25
    });

    it("gives trade boost to international corridors", () => {
      const domestic = calculateEconomicTrafficCoefficient({
        totalGdp: 500,
        economicTier: "Tier 3",
        isInternational: false,
      });
      const international = calculateEconomicTrafficCoefficient({
        totalGdp: 500,
        economicTier: "Tier 3",
        isInternational: true,
      });
      expect(international).toBeGreaterThan(domestic);
    });
  });

  describe("real-economy vehicle density scaling", () => {
    it("generates more vehicle trips on high-GDP trade corridors than low-GDP routes", () => {
      const highGdpSeg: TransportSegmentInput = {
        ...mockSegment,
        id: "seg-high",
        totalGdp: 5_000,
        economicTier: "Tier 1",
        isInternational: true,
      };

      const lowGdpSeg: TransportSegmentInput = {
        ...mockSegment,
        id: "seg-low",
        totalGdp: 20,
        economicTier: "Tier 5",
        isInternational: false,
      };

      const highTrips = generateVehicleTrips([highGdpSeg], 0.5, 120);
      const lowTrips = generateVehicleTrips([lowGdpSeg], 0.5, 120);

      expect(highTrips.length).toBeGreaterThan(lowTrips.length);
      expect(highTrips[0]!.economicCoeff).toBeGreaterThan(lowTrips[0]!.economicCoeff!);
    });

    it("calculates network average economic coefficient", () => {
      const segs: TransportSegmentInput[] = [
        { ...mockSegment, totalGdp: 500, economicTier: "Tier 3" },
        { ...mockSegment, totalGdp: 500, economicTier: "Tier 3" },
      ];
      const avg = calculateNetworkAverageEconomicCoefficient(segs);
      expect(avg).toBeCloseTo(1.0, 1);
    });
  });

  describe("featuresToSegments", () => {
    it("converts GeoJSON LineString features and captures economic properties", () => {
      const mockGeoJSON = {
        type: "FeatureCollection",
        features: [
          {
            id: "route-1",
            properties: {
              routeType: "air_corridor",
              status: "operational",
              speedKmh: 800,
              totalGdp: 2_400,
              gdpPerCapita: 55_000,
              economicTier: "Tier 2",
              isInternational: true,
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [-73.935242, 40.73061],
                [-0.1276, 51.5072],
              ],
            },
          },
        ],
      };

      const segments = featuresToSegments(mockGeoJSON);
      expect(segments).toHaveLength(1);
      expect(segments[0]!.id).toBe("route-1");
      expect(segments[0]!.routeType).toBe("air_corridor");
      expect(segments[0]!.speedKmh).toBe(800);
      expect(segments[0]!.totalGdp).toBe(2_400);
      expect(segments[0]!.economicTier).toBe("Tier 2");
      expect(segments[0]!.isInternational).toBe(true);
      expect(segments[0]!.geometry.coordinates).toHaveLength(2);
    });

    it("handles empty feature collection gracefully", () => {
      expect(featuresToSegments({ type: "FeatureCollection", features: [] })).toEqual([]);
    });
  });
});

