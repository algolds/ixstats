/**
 * The layers a world is fitted to: nothing is asked while no realm is chosen, "ready" is every layer settled and the
 * realm having borders, and the mask key names the realm's map version.
 */
import { renderHook } from "@testing-library/react";
import type { FeatureCollection } from "geojson";

jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: jest.fn(),
  useRetryMapLayers: jest.fn(),
}));

import { useDecodedMapLayers, useRetryMapLayers } from "~/hooks/useMapLayerData";
import { useStudioFit } from "~/hooks/useStudioFit";

const load = jest.mocked(useDecodedMapLayers);
const retry = jest.fn();

const polygons = (n: number): FeatureCollection => ({
  type: "FeatureCollection",
  features: Array.from({ length: n }, () => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Point" as const, coordinates: [0, 0] },
  })),
});

const answer = (
  over: Partial<ReturnType<typeof useDecodedMapLayers>> = {}
): ReturnType<typeof useDecodedMapLayers> => ({
  layers: { background: polygons(1), political: polygons(2), altitudes: polygons(1) },
  packed: undefined,
  version: 5,
  error: null,
  isPending: false,
  ...over,
});

beforeEach(() => {
  load.mockReset();
  load.mockReturnValue(answer());
  jest.mocked(useRetryMapLayers).mockReturnValue(retry);
});

describe("useStudioFit", () => {
  it("is off, and requests nothing, while no realm is chosen", () => {
    const { result } = renderHook(() => useStudioFit(null));
    expect(result.current.state).toBe("off");
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("asks for the realm's background, political and altitudes layers by its slug", () => {
    renderHook(() => useStudioFit("eurth"));
    expect(load).toHaveBeenCalledWith({
      layers: ["background", "political", "altitudes"],
      realm: "eurth",
      enabled: true,
    });
  });

  it("is ready with the mask layers and a key of realm and map version", () => {
    const { result } = renderHook(() => useStudioFit("eurth"));
    expect(result.current).toMatchObject({ state: "ready", mapVersion: 5, maskKey: "eurth:5" });
    expect(result.current.landMaskLayers.political?.features).toHaveLength(2);
    expect(result.current.landMaskLayers).not.toHaveProperty("rivers");
  });

  it("is loading until every layer has settled, and fits nothing meanwhile", () => {
    load.mockReturnValue(answer({ isPending: true }));
    const { result } = renderHook(() => useStudioFit("eurth"));
    expect(result.current.state).toBe("loading");
    expect(result.current.landMaskLayers).toEqual({});
    expect(result.current.maskKey).toBeUndefined();
  });

  it("fails when a layer could not be loaded, and retries through the layer queries", () => {
    load.mockReturnValue(answer({ error: new Error("500"), isPending: true }));
    const { result } = renderHook(() => useStudioFit("eurth"));
    expect(result.current.state).toBe("failed");
    result.current.retry();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("is none for a realm with no borders to build on", () => {
    load.mockReturnValue(answer({ layers: { background: polygons(1), political: polygons(0) } }));
    const { result } = renderHook(() => useStudioFit("eurth"));
    expect(result.current.state).toBe("none");
    expect(result.current.maskKey).toBeUndefined();
  });

  it("keeps its result while the same map is read again", () => {
    const { result, rerender } = renderHook(() => useStudioFit("eurth"));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
