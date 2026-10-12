import { act, renderHook } from "@testing-library/react";

jest.mock("~/lib/maps/load-maplibre", () => {
  const instances: unknown[] = [];
  class FakeMap {
    handlers = new Map<string, () => void>();
    remove = jest.fn();
    constructor() {
      instances.push(this);
    }
    on(event: string, handler: () => void) {
      this.handlers.set(event, handler);
    }
  }
  // MapLibre's loader answers when the test says so
  const gate = {
    release: () => {},
    promise: Promise.resolve({ Map: FakeMap }),
    reset() {
      this.promise = new Promise((resolve) => {
        this.release = () => resolve({ Map: FakeMap });
      });
    },
  };
  return { loadMaplibre: jest.fn(() => gate.promise), instances, gate };
});
jest.mock("~/lib/maps/map-config", () => ({ buildBaseStyle: () => ({}) }));
jest.mock("~/components/maps/widgets/embed-map-layers", () => ({ populateEmbedMap: jest.fn() }));

import { useCountryMapEmbedLayers } from "~/components/maps/widgets/hooks/useCountryMapEmbedLayers";
import { populateEmbedMap } from "~/components/maps/widgets/embed-map-layers";

type FakeInstance = { remove: jest.Mock; handlers: Map<string, () => void> };
const { instances, gate } = jest.requireMock("~/lib/maps/load-maplibre") as {
  instances: FakeInstance[];
  gate: { release: () => void; reset: () => void };
};

function embedState(displayName = "Urcea") {
  return {
    containerRef: { current: document.createElement("div") },
    mapRef: { current: null as FakeInstance | null },
    setMapReady: jest.fn(),
    geometry: { type: "Point", coordinates: [0, 0] },
    centroid: { lng: 1, lat: 2 },
    displayName,
  };
}
type State = ReturnType<typeof embedState>;

const mount = (state: State) =>
  renderHook(
    (props: { state: State }) =>
      useCountryMapEmbedLayers({ state: props.state as never, countryId: "c1" }),
    { initialProps: { state } }
  );

/** Let the hook's start-up delay pass and MapLibre's loader settle. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(60);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  instances.length = 0;
  gate.reset();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe("useCountryMapEmbedLayers", () => {
  it("leaves no map behind when the embed goes away while MapLibre is still loading", async () => {
    const state = embedState();
    const { unmount } = mount(state);
    await settle(); // init has started and waits for the loader

    unmount();
    gate.release();
    await settle();

    expect(instances).toHaveLength(0);
    expect(state.mapRef.current).toBeNull();
  });

  it("holds the map from its creation, and removes it when the embed goes away before it loaded", async () => {
    gate.release();
    const state = embedState();
    const { unmount } = mount(state);
    await settle();
    expect(instances).toHaveLength(1);
    expect(state.mapRef.current).toBe(instances[0]);

    unmount();

    expect(instances[0]!.remove).toHaveBeenCalledTimes(1);
    expect(state.mapRef.current).toBeNull();
    expect(state.setMapReady).toHaveBeenLastCalledWith(false);
  });

  it("draws nothing from a map whose embed went away before it loaded", async () => {
    gate.release();
    const { unmount } = mount(embedState());
    await settle();

    unmount();
    instances[0]!.handlers.get("load")?.();

    expect(populateEmbedMap).not.toHaveBeenCalled();
  });

  it("draws the layers and reports ready when the map loads", async () => {
    gate.release();
    const state = embedState();
    mount(state);
    await settle();

    instances[0]!.handlers.get("load")?.();

    expect(populateEmbedMap).toHaveBeenCalledTimes(1);
    expect(state.setMapReady).toHaveBeenLastCalledWith(true);
  });

  it("builds one map, not two, when the data changes while MapLibre is loading", async () => {
    const first = embedState("Urcea");
    const { rerender } = mount(first);
    await settle(); // first init waits for the loader

    const second = { ...first, displayName: "Urcea (renamed)" };
    rerender({ state: second });
    gate.release();
    await settle();

    expect(instances).toHaveLength(1);
    expect(instances[0]!.remove).not.toHaveBeenCalled();
    expect(second.mapRef.current).toBe(instances[0]);
  });
});
