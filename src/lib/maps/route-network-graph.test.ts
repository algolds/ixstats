import { buildRouteNetworkGraph } from "./route-network-graph";

const hubA = { id: "a", name: "Alpha", coordinates: [0, 0] as [number, number] };
const hubB = { id: "b", name: "Beta", coordinates: [2, 2] as [number, number] };

describe("buildRouteNetworkGraph", () => {
  it("makes a node per placed hub", () => {
    const { nodes } = buildRouteNetworkGraph([], [hubA, hubB]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("connects a route's endpoints to nearest hubs", () => {
    const route = {
      geometry: {
        coordinates: [
          [0, 0],
          [2, 2],
        ],
      },
      properties: { id: "r1", routeType: "rail" },
    };
    const { edges } = buildRouteNetworkGraph([route], [hubA, hubB]);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.source).toBe("a");
    expect(edges[0]!.target).toBe("b");
  });

  it("skips a route with no hub near an endpoint", () => {
    const route = {
      geometry: {
        coordinates: [
          [0, 0],
          [50, 50],
        ],
      },
      properties: { id: "r2", routeType: "rail" },
    };
    const { edges } = buildRouteNetworkGraph([route], [hubA, hubB]);
    expect(edges).toHaveLength(0);
  });

  it("returns empty graph when no hubs have coordinates", () => {
    expect(buildRouteNetworkGraph([], [])).toEqual({ nodes: [], edges: [] });
  });
});
