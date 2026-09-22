import {
  generateTransportNetwork,
  generateTransportNetworkWithSegments,
  type CityNode,
  type GenerationInput,
} from "~/lib/economy/transport-generator";

describe("transport-generator with network segments", () => {
  const cities: CityNode[] = [
    {
      id: "city-1",
      name: "Metropolis",
      coordinates: [10.0, 50.0],
      population: 4_000_000,
      isCapital: true,
      isCoastal: false,
    },
    {
      id: "city-2",
      name: "Harbor Town",
      coordinates: [10.5, 50.8],
      population: 1_200_000,
      isCapital: false,
      isCoastal: true,
    },
    {
      id: "city-3",
      name: "Mountain View",
      coordinates: [11.2, 50.2],
      population: 350_000,
      isCapital: false,
      isCoastal: false,
    },
  ];

  const input: GenerationInput = {
    cities,
    countryBbox: [9.5, 49.5, 11.5, 51.5],
  };

  it("generates legacy point-to-point routes with sub-types", () => {
    const routes = generateTransportNetwork(input, ["motorway", "high_speed_rail"]);
    expect(routes.length).toBeGreaterThanOrEqual(2);

    const types = routes.map((r) => r.routeType);
    expect(types.some((t) => t === "motorway" || t === "high_speed_rail")).toBe(true);
  });

  it("generates network segments and shared nodes", () => {
    const network = generateTransportNetworkWithSegments(input, ["motorway", "high_speed_rail"]);
    expect(network.nodes.length).toBeGreaterThanOrEqual(2);
    expect(network.segments.length).toBeGreaterThanOrEqual(2);
    expect(network.routes.length).toBe(network.segments.length);

    // Verify all segment endpoints correspond to valid node IDs
    const nodeIds = new Set(network.nodes.map((n) => n.id));
    for (const segment of network.segments) {
      expect(nodeIds.has(segment.fromNodeId)).toBe(true);
      expect(nodeIds.has(segment.toNodeId)).toBe(true);
      expect(segment.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    }
  });
});
