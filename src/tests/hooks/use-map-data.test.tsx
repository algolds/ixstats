import { act, renderHook } from "@testing-library/react";

type LayerCall = { layers: string[]; realm?: string; bucket?: number };

/** What the hook last asked useMapLayerData for. */
let mockLayerCall: LayerCall = { layers: [] };
let mockPacked: Record<string, unknown> | undefined;

jest.mock("~/hooks/useMapLayerData", () => ({
  useMapLayerData: (call: LayerCall) => {
    mockLayerCall = call;
    return { packed: mockPacked, error: null, isPending: false };
  },
}));
jest.mock("~/trpc/react", () => ({ api: {} }));

import { useMapData } from "~/hooks/useMapData";

const packedSquare = (id: string) => ({
  type: "FeatureCollection",
  packed: 4,
  features: [
    {
      type: "Feature",
      properties: { _id: id },
      geometry: {
        type: "Polygon",
        coordinates: [[0, 0, 10000, 0, 0, 10000, -10000, 0, 0, -10000]],
      },
    },
  ],
});

beforeEach(() => {
  mockLayerCall = { layers: [] };
  mockPacked = undefined;
});

describe("useMapData (map editor layers)", () => {
  it("asks for the editor's layers of the realm it edits, at the mid bucket", () => {
    renderHook(() => useMapData(["background", "political"], "eurth"));
    expect(mockLayerCall).toMatchObject({ realm: "eurth", bucket: 1 });
    expect(mockLayerCall.layers).toEqual(expect.arrayContaining(["background", "political"]));
  });

  it("switching a layer on adds that layer to the request and keeps the others", () => {
    const { result } = renderHook(() => useMapData(["background", "political"], "eurth"));
    const before = [...mockLayerCall.layers];

    act(() => result.current.toggleLayer("climate"));

    expect(mockLayerCall.layers).toEqual([...before, "climate"]);
  });

  it("holds back the tiled layers' GeoJSON until the editor has painted, listing them for visibility", () => {
    const layers = ["background", "altitudes", "rivers", "lakes", "political"] as const;
    const { result, rerender } = renderHook(
      ({ defer }: { defer: boolean }) => useMapData([...layers], "eurth", { deferTiled: defer }),
      { initialProps: { defer: true } }
    );
    expect(mockLayerCall.layers).not.toContain("altitudes");
    expect(mockLayerCall.layers).not.toContain("rivers");
    expect(mockLayerCall.layers).toEqual(expect.arrayContaining(["political", "background"]));

    const altitudes = result.current.mapLayers.find((l) => l.type === "altitudes");
    expect(altitudes).toMatchObject({ visible: true, data: { features: [] } });

    rerender({ defer: false });
    expect(mockLayerCall.layers).toEqual(expect.arrayContaining(["altitudes", "rivers", "lakes"]));
  });

  it("decodes the layers that arrive", () => {
    mockPacked = { political: packedSquare("borders") };
    const { result } = renderHook(() => useMapData(["political"], "eurth"));

    const political = result.current.mapLayers.find((l) => l.type === "political");
    expect(political?.data.features[0]?.properties?._id).toBe("borders");
    expect((political?.data.features[0]?.geometry as GeoJSON.Polygon).coordinates[0]![2]).toEqual([
      1, 1,
    ]);
  });
});
