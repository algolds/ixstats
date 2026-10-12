import { renderHook } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  forgetLoadedLayers,
  useWorldMapLayers,
} from "~/components/maps/core/hooks/useWorldMapLayers";

const collection = (id: string): FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { _id: id }, geometry: { type: "Point", coordinates: [0, 0] } },
  ],
});

/** The world map: its style carries the political and country-label sources, and survives a remount of the hook. */
function warmMap() {
  const politicalSetData = jest.fn();
  const labelsSetData = jest.fn();
  const sources: Record<string, object> = {
    "source-political": { type: "geojson", setData: politicalSetData },
    "source-country-labels": { type: "geojson", setData: labelsSetData },
  };
  const map = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === "getSource") return (id: string) => sources[id];
        if (name === "getLayer") return (id: string) => ({ id });
        return jest.fn();
      },
    }
  ) as unknown as MapLibreMap;
  return { map, politicalSetData, labelsSetData };
}

const baseProps = {
  isLoaded: true,
  projectionMode: "globe" as const,
  updateDistanceFade: () => {},
};

/** One mount of the surface's hook: its own refs, as IxWorldMap makes them. */
function mount(
  map: MapLibreMap,
  layers: Array<{ type: "political" | "country_labels"; data: FeatureCollection }>,
  labelFeaturesRef = { current: null as FeatureCollection | null },
  theme?: "standard" | "dark"
) {
  return renderHook(
    (props: { theme?: "standard" | "dark" }) =>
      useWorldMapLayers({
        ...baseProps,
        map,
        labelFeaturesRef,
        theme: props.theme,
        layers: layers.map((layer) => ({ ...layer, visible: true })),
      }),
    { initialProps: { theme } }
  );
}

describe("useWorldMapLayers on a map that is borrowed again", () => {
  it("does not push a layer's data again when the same data is already in the map", () => {
    const { map, politicalSetData } = warmMap();
    const political = collection("a");

    mount(map, [{ type: "political", data: political }]).unmount();
    expect(politicalSetData).toHaveBeenCalledTimes(1);

    mount(map, [{ type: "political", data: political }]);
    expect(politicalSetData).toHaveBeenCalledTimes(1);
  });

  it("pushes the data when it changed since the map last had it", () => {
    const { map, politicalSetData } = warmMap();

    mount(map, [{ type: "political", data: collection("a") }]).unmount();
    const changed = collection("b");
    mount(map, [{ type: "political", data: changed }]);

    expect(politicalSetData).toHaveBeenCalledTimes(2);
    expect(politicalSetData).toHaveBeenLastCalledWith(changed);
  });

  it("pushes everything again once the map's style was put back (its sources are empty)", () => {
    const { map, politicalSetData } = warmMap();
    const political = collection("a");

    mount(map, [{ type: "political", data: political }]).unmount();
    forgetLoadedLayers(map);
    mount(map, [{ type: "political", data: political }]);

    expect(politicalSetData).toHaveBeenCalledTimes(2);
  });

  it("keeps one map's data apart from another's", () => {
    const first = warmMap();
    const second = warmMap();
    const political = collection("a");

    mount(first.map, [{ type: "political", data: political }]);
    mount(second.map, [{ type: "political", data: political }]);

    expect(first.politicalSetData).toHaveBeenCalledTimes(1);
    expect(second.politicalSetData).toHaveBeenCalledTimes(1);
  });

  it("pushes again after a theme change on the mounted map", () => {
    const { map, politicalSetData } = warmMap();
    const political = collection("a");
    const hook = mount(map, [{ type: "political", data: political }], undefined, "standard");

    hook.rerender({ theme: "dark" });

    expect(politicalSetData).toHaveBeenCalledTimes(2);
  });

  it("hands the country labels to the new mount without pushing them again", () => {
    const { map, labelsSetData } = warmMap();
    const labels = collection("labels");

    mount(map, [{ type: "country_labels", data: labels }]).unmount();
    expect(labelsSetData).toHaveBeenCalledTimes(1);

    const labelFeaturesRef = { current: null as FeatureCollection | null };
    mount(map, [{ type: "country_labels", data: labels }], labelFeaturesRef);

    expect(labelsSetData).toHaveBeenCalledTimes(1);
    expect(labelFeaturesRef.current).toBe(labels);
  });
});
