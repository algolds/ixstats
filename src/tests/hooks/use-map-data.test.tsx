import { act, renderHook } from "@testing-library/react";

/** The getWorldMap inputs of the per-layer queries the hook last asked for. */
let mockLayerQueries: unknown[] = [];

jest.mock("~/trpc/react", () => ({
  api: {
    useQueries: (
      queries: (t: { geoCore: { getWorldMapPacked: (input: unknown) => unknown } }) => unknown[],
      opts?: { combine?: (results: Array<{ data?: unknown }>) => unknown }
    ) => {
      mockLayerQueries = queries({ geoCore: { getWorldMapPacked: (input) => input } });
      return opts?.combine ? opts.combine([]) : [];
    },
    users: { getProfile: { useQuery: () => ({ data: undefined }) } },
  },
}));
jest.mock("~/lib/maps/map-idb-cache", () => ({
  getCachedMapLayers: () => Promise.resolve(null),
}));

import { useMapData } from "~/hooks/useMapData";

describe("useMapData (map editor layers)", () => {
  it("switching a layer on adds one request for that layer and keeps the others' keys", () => {
    const { result } = renderHook(() => useMapData(["background", "political"], "eurth"));
    const before = [...mockLayerQueries];

    act(() => result.current.toggleLayer("climate"));

    expect(mockLayerQueries).toEqual([...before, { layers: ["climate"], realm: "eurth" }]);
    expect(before).toContainEqual({ layers: ["political"], realm: "eurth" });
  });

  it("holds back the tiled layers' GeoJSON until the editor has painted, listing them for visibility", () => {
    const layers = ["background", "altitudes", "rivers", "lakes", "political"] as const;
    const { result, rerender } = renderHook(
      ({ defer }: { defer: boolean }) => useMapData([...layers], "eurth", { deferTiled: defer }),
      { initialProps: { defer: true } }
    );
    const asked = () => (mockLayerQueries as Array<{ layers: string[] }>).map((q) => q.layers[0]);
    expect(asked()).not.toEqual(expect.arrayContaining(["altitudes"]));
    expect(asked()).not.toEqual(expect.arrayContaining(["rivers"]));
    expect(asked()).toEqual(expect.arrayContaining(["political", "background"]));

    const altitudes = result.current.mapLayers.find((l) => l.type === "altitudes");
    expect(altitudes).toMatchObject({ visible: true, data: { features: [] } });

    rerender({ defer: false });
    expect(asked()).toEqual(expect.arrayContaining(["altitudes", "rivers", "lakes"]));
  });
});
