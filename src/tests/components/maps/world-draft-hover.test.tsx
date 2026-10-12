/**
 * Hover hit-testing on the world map pauses while a generated world is drawn over it: the live features it would
 * hit are hidden, and a tooltip left from before the draft must go.
 */
import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

jest.mock("~/components/maps/core/utils/world-map-hit-testing", () => ({
  ...jest.requireActual("~/components/maps/core/utils/world-map-hit-testing"),
  updateHover: jest.fn(),
  clearAllHover: jest.fn(),
}));

import { useWorldMapInteractions } from "~/components/maps/core/hooks/useWorldMapInteractions";
import { clearAllHover, updateHover } from "~/components/maps/core/utils/world-map-hit-testing";
import { isWorldDraftShown } from "~/lib/maps/world-draft-layers";

const DRAFT_SOURCE = "worldgen-draft-relief";

/** Animation frames that run when the test says so (the hook coalesces moves to one per frame). */
const frames: FrameRequestCallback[] = [];
const runFrames = () => frames.splice(0).forEach((callback) => callback(0));

function fakeMap() {
  const handlers = new Map<string, (event: unknown) => void>();
  const sources = new Set<string>();
  const map = {
    on: (event: string, handler: (event: unknown) => void) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    getCanvas: () => document.createElement("canvas"),
    getCanvasContainer: () => document.createElement("div"),
    getLayer: () => ({}),
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    setPaintProperty: jest.fn(),
    getBounds: jest.fn(),
  };
  return {
    map: map as unknown as MapLibreMap,
    sources,
    move: () => {
      handlers.get("mousemove")?.({ point: { x: 1, y: 1 }, lngLat: { lng: 0, lat: 0 } });
      runFrames();
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  frames.length = 0;
  jest
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => frames.push(callback));
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function mount(map: MapLibreMap) {
  renderHook(() =>
    useWorldMapInteractions({
      map,
      isLoaded: true,
      layers: [],
      labelFeaturesRef: { current: null },
      tooltipPopupRef: { current: null },
    })
  );
}

describe("isWorldDraftShown", () => {
  it("is true while the draft's relief source is on the map", () => {
    const { map, sources } = fakeMap();
    expect(isWorldDraftShown(map)).toBe(false);
    sources.add(DRAFT_SOURCE);
    expect(isWorldDraftShown(map)).toBe(true);
  });
});

describe("hover over the world map", () => {
  it("hit-tests the live features as the pointer moves", () => {
    const { map, move } = fakeMap();
    mount(map);
    move();
    expect(updateHover).toHaveBeenCalledTimes(1);
    expect(clearAllHover).not.toHaveBeenCalled();
  });

  it("stops hit-testing while a draft world is shown, and clears what was hovered", () => {
    const { map, sources, move } = fakeMap();
    mount(map);
    sources.add(DRAFT_SOURCE);
    move();
    move();
    expect(updateHover).not.toHaveBeenCalled();
    expect(clearAllHover).toHaveBeenCalled();
  });

  it("hit-tests again once the draft is gone", () => {
    const { map, sources, move } = fakeMap();
    mount(map);
    sources.add(DRAFT_SOURCE);
    move();
    sources.delete(DRAFT_SOURCE);
    move();
    expect(updateHover).toHaveBeenCalledTimes(1);
  });
});
