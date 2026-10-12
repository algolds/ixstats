import { act, renderHook } from "@testing-library/react";

let mockVersion: { realmId: string; version: number } | undefined;
const mockVersionRealm = jest.fn();

jest.mock("~/hooks/useRealmMapVersion", () => ({
  useRealmMapVersion: (realm?: string) => {
    mockVersionRealm(realm);
    return { mapVersion: mockVersion, error: null };
  },
}));
jest.mock("~/trpc/react", () => {
  const query = () => ({ invalidate: jest.fn() });
  const utils = {
    realms: { map: { version: query(), display: query() } },
    geoCore: {
      getMapBundleMarkers: query(),
      getMapBundleDetail: query(),
      getCountryFeatures: query(),
      getCountryGeometry: query(),
    },
    geoFeatures: { getAllStoryPins: query(), getAllMapLabels: query() },
    countryGeo: { getCountryGeoBundle: query() },
  };
  return { api: { useUtils: () => utils } };
});

import { api } from "~/trpc/react";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";

/** The invalidators live sync may call, by the query they refresh. */
const utils = api.useUtils();
const invalidators = {
  version: utils.realms.map.version.invalidate,
  display: utils.realms.map.display.invalidate,
  markers: utils.geoCore.getMapBundleMarkers.invalidate,
  detail: utils.geoCore.getMapBundleDetail.invalidate,
  storyPins: utils.geoFeatures.getAllStoryPins.invalidate,
  labels: utils.geoFeatures.getAllMapLabels.invalidate,
  countryFeatures: utils.geoCore.getCountryFeatures.invalidate,
  countryGeometry: utils.geoCore.getCountryGeometry.invalidate,
  countryBundle: utils.countryGeo.getCountryGeoBundle.invalidate,
};
const called = () =>
  Object.entries(invalidators)
    .filter(([, fn]) => jest.mocked(fn).mock.calls.length > 0)
    .map(([name]) => name)
    .sort();

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, (message: { data: string }) => void>();
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close = jest.fn();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (message: { data: string }) => void) {
    this.listeners.set(type, listener);
  }
  emit(payload: Record<string, unknown>) {
    this.listeners.get("map_data_changed")?.({ data: JSON.stringify(payload) });
  }
}

const stream = () => FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
/** Deliver a change event, then let the debounce window pass. */
function receive(payload: Record<string, unknown>) {
  act(() => stream().emit({ type: "map_data_changed", timestamp: 1, ...payload }));
  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  FakeEventSource.instances = [];
  Object.defineProperty(globalThis, "EventSource", { value: FakeEventSource, configurable: true });
  mockVersion = { realmId: "r_a", version: 2 };
  mockVersionRealm.mockClear();
  Object.values(invalidators).forEach((fn) => jest.mocked(fn).mockClear());
});

afterEach(() => jest.useRealTimers());

describe("useMapLiveSync", () => {
  it("ignores a change in another realm", () => {
    renderHook(() => useMapLiveSync("eurth"));

    receive({ changeType: "city", realmId: "r_b" });
    receive({ changeType: "version", realmId: "r_b" });
    receive({ changeType: "bulk", realmId: "r_b" });

    expect(called()).toEqual([]);
  });

  it("refetches the version, and the display with the raster layers it lists, when its realm's map version moved", () => {
    renderHook(() => useMapLiveSync("eurth"));

    receive({ changeType: "version", realmId: "r_a" });

    expect(called()).toEqual(["display", "version"]);
  });

  it("refetches only the queries a story pin change touches", () => {
    renderHook(() => useMapLiveSync("eurth"));

    receive({ changeType: "storyPin", realmId: "r_a", countryId: "c1" });

    expect(called()).toEqual(["countryBundle", "countryFeatures", "countryGeometry", "storyPins"]);
  });

  it("takes a change with no realm as its own", () => {
    renderHook(() => useMapLiveSync("eurth"));

    receive({ changeType: "mapLabel" });

    expect(called()).toContain("labels");
    expect(called()).not.toContain("storyPins");
  });

  it("refetches everything for a bulk change in its realm", () => {
    renderHook(() => useMapLiveSync("eurth"));

    receive({ changeType: "bulk", realmId: "r_a" });

    expect(called()).toEqual([
      "countryBundle",
      "countryFeatures",
      "countryGeometry",
      "detail",
      "display",
      "labels",
      "markers",
      "storyPins",
      "version",
    ]);
  });

  it("refetches once for a burst of changes, each query it needs and no other", () => {
    renderHook(() => useMapLiveSync("eurth"));

    act(() => {
      stream().emit({ changeType: "storyPin", realmId: "r_a" });
      stream().emit({ changeType: "storyPin", realmId: "r_a" });
      stream().emit({ changeType: "version", realmId: "r_a" });
      stream().emit({ changeType: "city", realmId: "r_b" });
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(invalidators.storyPins).toHaveBeenCalledTimes(1);
    expect(invalidators.version).toHaveBeenCalledTimes(1);
    expect(invalidators.markers).not.toHaveBeenCalled();
  });

  it("does not ignore a change while its own realm is not known yet", () => {
    mockVersion = undefined;
    renderHook(() => useMapLiveSync());

    receive({ changeType: "version", realmId: "r_b" });

    expect(called()).toEqual(["display", "version"]);
  });

  it("reads the version of the realm the map shows", () => {
    renderHook(() => useMapLiveSync("eurth"));
    expect(mockVersionRealm).toHaveBeenCalledWith("eurth");
  });

  it("stops listening and refetching once the map is gone", () => {
    const { unmount } = renderHook(() => useMapLiveSync("eurth"));
    const source = stream();

    act(() => source.emit({ changeType: "version", realmId: "r_a" }));
    unmount();
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(source.close).toHaveBeenCalled();
    expect(called()).toEqual([]);
  });
});
