/**
 * Tests for multi-modal pathfinding and intermodal hub detection.
 */

import {
  findMultiModalPath,
  detectIntermodalHubs,
  type MultiModalNode,
  type MultiModalSegment,
} from "~/lib/economy/multimodal-routing";

describe("multimodal-routing", () => {
  const mockNodes: MultiModalNode[] = [
    { id: "node-factory", lat: 45.0, lng: 10.0, name: "Inland Manufacturing Zone" },
    { id: "node-port", lat: 44.5, lng: 12.0, name: "Metropolitan Seaport", hubType: "port" },
    { id: "node-destination", lat: 42.0, lng: 18.0, name: "Overseas Import Terminal", hubType: "port" },
    { id: "node-airport", lat: 45.2, lng: 10.5, name: "Regional Airport", hubType: "airport" },
  ];

  const mockSegments: MultiModalSegment[] = [
    {
      id: "seg-rail-1",
      fromNodeId: "node-factory",
      toNodeId: "node-port",
      routeType: "freight_rail",
      distanceKm: 200,
    },
    {
      id: "seg-ship-1",
      fromNodeId: "node-port",
      toNodeId: "node-destination",
      routeType: "shipping_lane",
      distanceKm: 600,
    },
    {
      id: "seg-road-1",
      fromNodeId: "node-factory",
      toNodeId: "node-airport",
      routeType: "trunk",
      distanceKm: 40,
    },
    {
      id: "seg-air-1",
      fromNodeId: "node-airport",
      toNodeId: "node-destination",
      routeType: "air_corridor",
      distanceKm: 700,
    },
  ];

  it("finds multi-modal rail to maritime shipping path with automated transfer penalty", () => {
    const result = findMultiModalPath(mockNodes, mockSegments, {
      originNodeId: "node-factory",
      destinationNodeId: "node-destination",
      cargoWeightTons: 10_000,
      prioritize: "cost",
    });

    expect(result.found).toBe(true);
    expect(result.pathNodeIds).toEqual(["node-factory", "node-port", "node-destination"]);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].routeType).toBe("freight_rail");
    expect(result.steps[1].routeType).toBe("shipping_lane");

    // Intermodal transfer step at the seaport
    expect(result.transfers).toHaveLength(1);
    const transfer = result.transfers[0];
    expect(transfer.atNodeId).toBe("node-port");
    expect(transfer.fromFamily).toBe("rail");
    expect(transfer.toFamily).toBe("maritime");
    expect(transfer.hubType).toBe("port");
    expect(transfer.transferDelayHours).toBe(12.0);
    expect(transfer.transferCostBillion).toBe(0.003);

    // Total distance = 200 + 600
    expect(result.totalDistanceKm).toBe(800);
    // Total time includes 12h dwell time
    expect(result.totalTransitTimeHours).toBeGreaterThan(12.0);
  });

  it("chooses air freight when prioritizing time", () => {
    const result = findMultiModalPath(mockNodes, mockSegments, {
      originNodeId: "node-factory",
      destinationNodeId: "node-destination",
      cargoWeightTons: 500,
      prioritize: "time",
    });

    expect(result.found).toBe(true);
    // Air path: factory -> airport (road) -> destination (air)
    // 40km road (0.57h) + 6h airport transfer + 700km air (0.875h) ~ 7.45h
    // Maritime path: 200km rail (3h) + 12h port transfer + 600km sea (17.1h) ~ 32h
    expect(result.pathNodeIds).toEqual(["node-factory", "node-airport", "node-destination"]);
    expect(result.transfers[0].hubType).toBe("airport");
    expect(result.totalTransitTimeHours).toBeLessThan(10.0);
  });

  it("handles missing or disconnected routes gracefully", () => {
    const result = findMultiModalPath(mockNodes, mockSegments, {
      originNodeId: "node-factory",
      destinationNodeId: "node-nonexistent",
    });
    expect(result.found).toBe(false);
    expect(result.steps).toEqual([]);
    expect(result.transfers).toEqual([]);
  });

  it("detects intermodal hubs and categorizes modal connectivity", () => {
    const hubs = detectIntermodalHubs(mockNodes, mockSegments);
    const portHub = hubs.find((h) => h.nodeId === "node-port");
    expect(portHub).toBeDefined();
    expect(portHub?.isIntermodal).toBe(true);
    expect(portHub?.connectedFamilies).toContain("rail");
    expect(portHub?.connectedFamilies).toContain("maritime");

    const factoryHub = hubs.find((h) => h.nodeId === "node-factory");
    expect(factoryHub).toBeDefined();
    expect(factoryHub?.connectedFamilies).toContain("rail");
    expect(factoryHub?.connectedFamilies).toContain("road");
    expect(factoryHub?.isIntermodal).toBe(true);
  });
});
