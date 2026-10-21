/**
 * The Studio's additions to the world preview: layer switches, a diagnostic image under the relief (pinned at the
 * Mercator corners like it), and the nations' seed points, all without touching the world.
 */
import { act, renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { useWorldPreview, type WorldOverlays } from "~/hooks/useWorldPreview";
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
  it("does not regenerate or redraw the world when an overlay changes", () => {
    const rig = mount();
    const adds = rig.fake.addSource.mock.calls.length;
    act(() => rig.set({ visible: { rivers: false } }));
    act(() => rig.set({ visible: { rivers: false }, diagnostic }));
    // Only the diagnostic's source is new
    expect(rig.fake.addSource.mock.calls.length).toBe(adds + 1);
  });

  describe("climate and ice caps", () => {
    const extras = ["worldgen-draft-climate", "worldgen-draft-icecaps"];

    it("are not drawn for a preview that asks for nothing (the founder's World tab)", () => {
      const rig = mount();
      for (const id of extras) {
        expect(rig.sources.has(id)).toBe(false);
        expect(rig.layers.has(id)).toBe(false);
      }
      // What was drawn before is still drawn
      expect(rig.draftIds()).toEqual(
        expect.arrayContaining([
          "worldgen-draft-background",
          "worldgen-draft-altitudes",
          "worldgen-draft-relief",
          "worldgen-draft-political",
        ])
      );
    });
    it("are drawn when switched on: climate by its biome colours, softly, and ice over the relief", () => {
      const rig = mount({ visible: { climate: true, icecaps: true } });
      const climate = rig.layers.get("worldgen-draft-climate")!.spec as unknown as {
        type: string;
        paint: Record<string, unknown>;
      };
      expect(climate.type).toBe("fill");
      expect(climate.paint["fill-color"]).toEqual(["coalesce", ["get", "_fillColor"], "#e8e5da"]);
      expect(climate.paint["fill-opacity"]).toBe(0.35);
      const ice = rig.layers.get("worldgen-draft-icecaps")!.spec as unknown as {
        paint: Record<string, unknown>;
      };
      expect(ice.paint["fill-color"]).toBe("#f0f4f8");

      const at = (id: string) => rig.order.indexOf(id);
      expect(at("worldgen-draft-altitudes")).toBeLessThan(at("worldgen-draft-climate"));
      expect(at("worldgen-draft-climate")).toBeLessThan(at("worldgen-draft-relief"));
      expect(at("worldgen-draft-relief")).toBeLessThan(at("worldgen-draft-icecaps"));
      expect(at("worldgen-draft-icecaps")).toBeLessThan(at("worldgen-draft-political"));
    });
  });
});
