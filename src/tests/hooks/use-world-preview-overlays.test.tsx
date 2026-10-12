/**
 * The Studio's additions to the world preview: layer switches, a diagnostic image under the relief (pinned at the
 * Mercator corners like it), and the nations' seed points, all without touching the world.
 */
import { act, renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { useWorldPreview, type WorldOverlays } from "~/hooks/useWorldPreview";
import { MERCATOR_MAX_LAT } from "~/lib/maps/realm-map-settings";
import { fakeDraftMap } from "~/tests/helpers/fake-draft-map";
import { worldResult } from "~/tests/helpers/fake-world-worker";

class StubImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number
  ) {}
}

beforeEach(() => {
  Object.defineProperty(globalThis, "ImageData", { value: StubImageData, configurable: true });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => `blob:draft-${Math.random()}`,
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
});

const LIVE = ["fill-background", "fill-political", "country-name-labels"];
const world = worldResult();
const diagnostic = { width: 2, height: 2, rgba: new Uint8ClampedArray(16).fill(9) };
const seeds = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [10, 20] },
      properties: { color: "#336699" },
    },
  ],
};

function mount(overlays: WorldOverlays = {}) {
  const rig = fakeDraftMap(["background", ...LIVE]);
  const hook = renderHook(
    (props: { overlays: WorldOverlays }) =>
      useWorldPreview(rig.map as MapLibreMap, world, props.overlays),
    { initialProps: { overlays } }
  );
  const set = (next: WorldOverlays) => hook.rerender({ overlays: next });
  return { ...rig, ...hook, set };
}

describe("useWorldPreview overlays", () => {
  it("puts a diagnostic image over the elevation and under the relief and the countries", () => {
    const rig = mount({ diagnostic });
    const source = rig.sources.get("worldgen-draft-diagnostic")!;
    expect(source.spec).toMatchObject({ type: "image" });
    expect(source.spec.coordinates).toEqual([
      [-180, MERCATOR_MAX_LAT],
      [180, MERCATOR_MAX_LAT],
      [180, -MERCATOR_MAX_LAT],
      [-180, -MERCATOR_MAX_LAT],
    ]);
    expect(source.updateImage.mock.calls[0]![0].image.data).toBe(diagnostic.rgba);
    const at = (id: string) => rig.order.indexOf(id);
    expect(at("worldgen-draft-altitudes")).toBeLessThan(at("worldgen-draft-diagnostic"));
    expect(at("worldgen-draft-diagnostic")).toBeLessThan(at("worldgen-draft-relief"));
    expect(at("worldgen-draft-relief")).toBeLessThan(at("worldgen-draft-political"));
  });

  it("swaps one diagnostic for another in place and removes it for null, leaving the world's layers", () => {
    const rig = mount({ diagnostic });
    const other = { width: 2, height: 2, rgba: new Uint8ClampedArray(16).fill(3) };
    act(() => rig.set({ diagnostic: other }));
    const source = rig.sources.get("worldgen-draft-diagnostic")!;
    expect(source.updateImage).toHaveBeenCalledTimes(2);
    expect(source.updateImage.mock.calls[1]![0].image.data).toBe(other.rgba);

    act(() => rig.set({}));
    expect(rig.sources.has("worldgen-draft-diagnostic")).toBe(false);
    expect(rig.layers.has("worldgen-draft-diagnostic")).toBe(false);
    expect(rig.sources.has("worldgen-draft-relief")).toBe(true);
    expect(rig.fake.addSource).toHaveBeenCalledWith("worldgen-draft-diagnostic", expect.anything());
  });

  it("draws the seeds as circles over the rivers", () => {
    const rig = mount({ seeds });
    const source = rig.sources.get("worldgen-draft-seeds")!;
    expect(source.spec).toMatchObject({ type: "geojson" });
    expect(rig.layers.get("worldgen-draft-seeds")!.spec).toMatchObject({ type: "circle" });
    const at = (id: string) => rig.order.indexOf(id);
    expect(at("worldgen-draft-rivers")).toBeLessThan(at("worldgen-draft-seeds"));
    expect(at("worldgen-draft-seeds")).toBeLessThan(at("fill-background"));

    act(() => rig.set({}));
    expect(rig.sources.has("worldgen-draft-seeds")).toBe(false);
  });

  it("switches a layer off and on without removing it or the world", () => {
    const rig = mount({ diagnostic });
    act(() => rig.set({ diagnostic, visible: { relief: false, political: false } }));
    expect(rig.visibility("worldgen-draft-relief")).toBe("none");
    expect(rig.visibility("worldgen-draft-political")).toBe("none");
    expect(rig.visibility("worldgen-draft-political-stroke")).toBe("none");
    expect(rig.visibility("worldgen-draft-rivers")).toBeUndefined();
    expect(rig.sources.has("worldgen-draft-relief")).toBe(true);

    act(() => rig.set({ diagnostic, visible: { relief: true } }));
    expect(rig.visibility("worldgen-draft-relief")).toBe("visible");
    // Not mentioned means shown again
    expect(rig.visibility("worldgen-draft-political")).toBe("visible");
  });

  it("hides the diagnostic and the seeds like any other draft layer", () => {
    const rig = mount({ diagnostic, seeds, visible: { diagnostic: false, seeds: false } });
    expect(rig.visibility("worldgen-draft-diagnostic")).toBe("none");
    expect(rig.visibility("worldgen-draft-seeds")).toBe("none");
  });

  it("keeps the switches, the diagnostic and the seeds through a style reload", () => {
    const rig = mount({ diagnostic, seeds, visible: { lakes: false } });
    rig.reload(["background", ...LIVE]);
    act(() => rig.emit("styledata"));
    expect(rig.sources.has("worldgen-draft-diagnostic")).toBe(true);
    expect(rig.sources.has("worldgen-draft-seeds")).toBe(true);
    expect(rig.visibility("worldgen-draft-lakes")).toBe("none");
  });

  it("does not regenerate or redraw the world when an overlay changes", () => {
    const rig = mount();
    const adds = rig.fake.addSource.mock.calls.length;
    act(() => rig.set({ visible: { rivers: false } }));
    act(() => rig.set({ visible: { rivers: false }, diagnostic }));
    // Only the diagnostic's source is new
    expect(rig.fake.addSource.mock.calls.length).toBe(adds + 1);
  });
});
