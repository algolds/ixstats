/**
 * The world preview on the editor's map: a generated world as `worldgen-draft-` sources and layers under the live
 * ones, the live realm layers hidden and put back exactly as they were, blob URLs revoked, and the draft rebuilt
 * after a style reload. MapLibre is a strict fake (see fake-draft-map).
 */
import { act, renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { useWorldPreview } from "~/hooks/useWorldPreview";
import { MERCATOR_MAX_LAT } from "~/lib/maps/realm-map-settings";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";
import { fakeDraftMap } from "~/tests/helpers/fake-draft-map";
import { layerJson, worldResult } from "~/tests/helpers/fake-world-worker";

class StubImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number
  ) {}
}

/** Blob URLs created and revoked, in order. */
let created: { url: string; size: number; type: string }[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  Object.defineProperty(globalThis, "ImageData", { value: StubImageData, configurable: true });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      const url = `blob:draft-${created.length + 1}`;
      created.push({ url, size: blob.size, type: blob.type });
      return url;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: (url: string) => revoked.push(url),
  });
});

/** The live layers of a realm's map, as the world map names them, under a base style layer. */
const LIVE = [
  "fill-background",
  "fill-altitudes",
  "fill-political",
  "stroke-political",
  "sovereignty-border",
  "fill-lakes",
  "fill-rivers",
  "country-name-labels",
];
const BASE = ["background", "graticule-lines"];

function mount(live: (string | { id: string; visibility: string })[] = LIVE) {
  const rig = fakeDraftMap([BASE[0]!, ...live, BASE[1]!, "selected-country-fill"]);
  const hook = renderHook(
    ({ map, result }: { map: MapLibreMap | null; result: WorldGenResult | null }) =>
      useWorldPreview(map, result),
    { initialProps: { map: rig.map as MapLibreMap | null, result: null as WorldGenResult | null } }
  );
  const show = (result: WorldGenResult | null) => hook.rerender({ map: rig.map, result });
  return { ...rig, ...hook, show };
}

describe("useWorldPreview", () => {
  it("does nothing without a world: live layers untouched, not active", () => {
    const rig = mount();
    expect(rig.result.current.active).toBe(false);
    expect(rig.draftIds()).toEqual([]);
    expect(rig.visibility("fill-political")).toBeUndefined();
    expect(rig.fake.addSource).not.toHaveBeenCalled();
  });

  it("is not active without a map, and installs when the map arrives", () => {
    const rig = fakeDraftMap(LIVE);
    const hook = renderHook(
      ({ map }: { map: MapLibreMap | null }) => useWorldPreview(map, worldResult()),
      { initialProps: { map: null as MapLibreMap | null } }
    );
    expect(hook.result.current.active).toBe(false);
    hook.rerender({ map: rig.map });
    expect(hook.result.current.active).toBe(true);
    expect(rig.draftIds()).toContain("worldgen-draft-background");
  });

  it("adds one draft GeoJSON source per drawn layer, fed by a blob URL, with the preview's tiling options", () => {
    const rig = mount();
    act(() => rig.show(worldResult()));

    expect(rig.result.current.active).toBe(true);
    for (const type of ["background", "altitudes", "political", "lakes", "rivers"]) {
      const source = rig.sources.get(`worldgen-draft-${type}`);
      expect(source?.spec).toMatchObject({
        type: "geojson",
        tolerance: 0.5,
        buffer: 48,
        maxzoom: 8,
      });
      expect(String(source?.spec.data)).toMatch(/^blob:draft-\d+$/);
    }
    // Climate and ice caps are not drawn (the live map hides them by default)
    expect(rig.sources.has("worldgen-draft-climate")).toBe(false);
    expect(rig.sources.has("worldgen-draft-icecaps")).toBe(false);
    expect(created).toHaveLength(5);
    expect(created.every((c) => c.type === "application/geo+json" && c.size > 0)).toBe(true);
  });

  it("draws the draft in order, under the live stack, with no id of a live layer", () => {
    const rig = mount();
    act(() => rig.show(worldResult()));

    expect(rig.draftIds()).toEqual([
      "worldgen-draft-background",
      "worldgen-draft-altitudes",
      "worldgen-draft-relief",
      "worldgen-draft-political",
      "worldgen-draft-political-stroke",
      "worldgen-draft-lakes",
      "worldgen-draft-rivers",
    ]);
    // Straight after the base style layer, before the first live layer
    expect(rig.order.slice(0, 9)).toEqual([
      "background",
      "worldgen-draft-background",
      "worldgen-draft-altitudes",
      "worldgen-draft-relief",
      "worldgen-draft-political",
      "worldgen-draft-political-stroke",
      "worldgen-draft-lakes",
      "worldgen-draft-rivers",
      "fill-background",
    ]);
    expect(rig.draftIds().filter((id) => LIVE.includes(id))).toEqual([]);
  });

  it("puts the relief image over the elevation and under the countries, pinned to the Mercator limits", () => {
    const rig = mount();
    const relief = { width: 2, height: 2, rgba: new Uint8ClampedArray(16).fill(7) };
    act(() => rig.show(worldResult({ relief })));

    const source = rig.sources.get("worldgen-draft-relief")!;
    expect(source.spec).toMatchObject({ type: "image" });
    expect(source.spec.url).toBeUndefined();
    expect(source.spec.coordinates).toEqual([
      [-180, MERCATOR_MAX_LAT],
      [180, MERCATOR_MAX_LAT],
      [180, -MERCATOR_MAX_LAT],
      [-180, -MERCATOR_MAX_LAT],
    ]);
    const call = source.updateImage.mock.calls[0]![0];
    expect(call.image).toBeInstanceOf(StubImageData);
    expect(call.image.data).toBe(relief.rgba);
    expect(rig.layers.get("worldgen-draft-relief")!.spec).toMatchObject({ type: "raster" });
    const at = (id: string) => rig.order.indexOf(id);
    expect(at("worldgen-draft-altitudes")).toBeLessThan(at("worldgen-draft-relief"));
    expect(at("worldgen-draft-relief")).toBeLessThan(at("worldgen-draft-political"));
  });

  it("hides the live realm layers and leaves the rest of the style alone", () => {
    const rig = mount([...LIVE, "realm-base-image", "realm-raster-relief"]);
    act(() => rig.show(worldResult()));

    for (const id of [...LIVE, "realm-base-image", "realm-raster-relief"]) {
      expect(rig.visibility(id)).toBe("none");
    }
    expect(rig.visibility("background")).toBeUndefined();
    expect(rig.visibility("graticule-lines")).toBeUndefined();
    expect(rig.visibility("selected-country-fill")).toBeUndefined();
    expect(rig.draftIds().every((id) => rig.visibility(id) === undefined)).toBe(true);
  });

  it("restores every live layer's exact prior visibility, including ones that were already hidden", () => {
    const rig = mount([
      "fill-background",
      { id: "fill-altitudes", visibility: "visible" },
      { id: "fill-climate", visibility: "none" },
      "fill-political",
      { id: "realm-raster-relief", visibility: "none" },
    ]);
    act(() => rig.show(worldResult()));
    expect(rig.visibility("fill-climate")).toBe("none");
    expect(rig.visibility("fill-altitudes")).toBe("none");

    act(() => rig.show(null));

    // A layer with no visibility set gets none set again, not "visible"
    expect(rig.visibility("fill-background")).toBeUndefined();
    expect(rig.layers.get("fill-background")!.layout).not.toHaveProperty("visibility");
    expect(rig.visibility("fill-altitudes")).toBe("visible");
    expect(rig.visibility("fill-climate")).toBe("none");
    expect(rig.visibility("fill-political")).toBeUndefined();
    expect(rig.visibility("realm-raster-relief")).toBe("none");
    expect(rig.fake.setLayoutProperty).not.toHaveBeenCalledWith(
      "fill-climate",
      "visibility",
      "visible"
    );
  });

  it("removes every draft source and layer when the world is cleared", () => {
    const rig = mount();
    act(() => rig.show(worldResult()));
    act(() => rig.show(null));

    expect(rig.draftIds()).toEqual([]);
    expect([...rig.sources.keys()]).toEqual([]);
    expect(rig.result.current.active).toBe(false);
    expect(rig.order).toEqual([BASE[0], ...LIVE, BASE[1], "selected-country-fill"]);
  });

  it("clears the draft on unmount and takes its style listener off", () => {
    const rig = mount();
    act(() => rig.show(worldResult()));
    expect(rig.listeners("styledata")).toBe(1);
    rig.unmount();

    expect(rig.draftIds()).toEqual([]);
    expect(rig.visibility("fill-political")).toBeUndefined();
    expect(rig.listeners("styledata")).toBe(0);
    expect(rig.listeners("sourcedata")).toBe(0);
    expect(rig.listeners("error")).toBe(0);
  });

  it("updates a new world in place: setData on the same sources, nothing added or hidden twice", () => {
    const rig = mount();
    act(() => rig.show(worldResult()));
    const added = rig.fake.addSource.mock.calls.length;
    const layersAdded = rig.fake.addLayer.mock.calls.length;
    const hiddenCalls = rig.fake.setLayoutProperty.mock.calls.length;

    act(() =>
      rig.show(
        worldResult({
          layers: {
            background: layerJson("background"),
            altitudes: layerJson("altitudes 2"),
            political: layerJson("political 2"),
            lakes: layerJson("lakes"),
            rivers: layerJson("rivers"),
          },
          relief: { width: 2, height: 2, rgba: new Uint8ClampedArray(16).fill(1) },
        })
      )
    );

    expect(rig.fake.addSource.mock.calls).toHaveLength(added);
    expect(rig.fake.addLayer.mock.calls).toHaveLength(layersAdded);
    expect(rig.fake.setLayoutProperty.mock.calls).toHaveLength(hiddenCalls);
    // Only the two layers whose JSON changed are parsed again
    expect(rig.sources.get("worldgen-draft-altitudes")!.setData).toHaveBeenCalledTimes(1);
    expect(rig.sources.get("worldgen-draft-political")!.setData).toHaveBeenCalledTimes(1);
    expect(rig.sources.get("worldgen-draft-background")!.setData).not.toHaveBeenCalled();
    expect(rig.sources.get("worldgen-draft-lakes")!.setData).not.toHaveBeenCalled();
    // A new relief is a new image on the same source
    expect(rig.sources.get("worldgen-draft-relief")!.updateImage).toHaveBeenCalledTimes(2);
  });

  describe("a world that keeps the realm's borders (no political layer)", () => {
    const BORDERS = [
      "fill-political",
      "stroke-political",
      "sovereignty-border",
      "sovereignty-labels",
    ];
    const LIVE_WITH_BORDERS = [...LIVE, "sovereignty-labels"];
    const keptBorders = () => {
      const { political: _political, ...layers } = worldResult().layers;
      return worldResult({ layers });
    };

    it("drops the draft's own political layer", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      act(() => rig.show(keptBorders()));

      expect(rig.draftIds()).not.toContain("worldgen-draft-political");
      expect(rig.draftIds()).not.toContain("worldgen-draft-political-stroke");
      expect(rig.sources.has("worldgen-draft-political")).toBe(false);
      expect(rig.draftIds()).toContain("worldgen-draft-lakes");
    });

    it("leaves the live borders and country names visible, and hides the rest of the live map", () => {
      const rig = mount(LIVE_WITH_BORDERS);
      act(() => rig.show(keptBorders()));

      for (const id of [...BORDERS, "country-name-labels"]) {
        expect(rig.visibility(id)).toBeUndefined();
        expect(rig.fake.setLayoutProperty).not.toHaveBeenCalledWith(id, "visibility", "none");
      }
      for (const id of ["fill-background", "fill-altitudes", "fill-lakes", "fill-rivers"]) {
        expect(rig.visibility(id)).toBe("none");
      }
    });

    it("shows the borders again after a world that has its own, and hides them for it", () => {
      const rig = mount(LIVE_WITH_BORDERS);
      act(() => rig.show(worldResult()));
      expect(rig.visibility("fill-political")).toBe("none");
      expect(rig.visibility("country-name-labels")).toBe("none");

      act(() => rig.show(keptBorders()));
      for (const id of [...BORDERS, "country-name-labels"]) {
        expect(rig.visibility(id)).toBeUndefined();
      }

      act(() => rig.show(worldResult()));
      for (const id of [...BORDERS, "country-name-labels"]) expect(rig.visibility(id)).toBe("none");
    });

    it("restores a border layer to the visibility it had, when the world is cleared", () => {
      const rig = mount(
        LIVE.map((id) => (id === "stroke-political" ? { id, visibility: "none" } : id))
      );
      act(() => rig.show(worldResult()));
      act(() => rig.show(keptBorders()));
      expect(rig.visibility("stroke-political")).toBe("none");
      act(() => rig.show(null));
      expect(rig.visibility("stroke-political")).toBe("none");
      expect(rig.visibility("fill-political")).toBeUndefined();
    });
  });

  describe("blob URLs", () => {
    it("are revoked once their source reports loaded, and not before", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      const background = String(rig.sources.get("worldgen-draft-background")!.spec.data);

      act(() =>
        rig.emit("sourcedata", { sourceId: "worldgen-draft-background", isSourceLoaded: false })
      );
      expect(revoked).toEqual([]);
      act(() =>
        rig.emit("sourcedata", { sourceId: "worldgen-draft-background", isSourceLoaded: true })
      );
      expect(revoked).toEqual([background]);
      // Other sources are still loading
      expect(rig.listeners("sourcedata")).toBe(1);

      for (const type of ["altitudes", "political", "lakes", "rivers"]) {
        act(() =>
          rig.emit("sourcedata", { sourceId: `worldgen-draft-${type}`, isSourceLoaded: true })
        );
      }
      expect(revoked).toHaveLength(5);
      expect(rig.listeners("sourcedata")).toBe(0);
    });

    it("ignores the live map's sources", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      act(() => rig.emit("sourcedata", { sourceId: "source-political", isSourceLoaded: true }));
      expect(revoked).toEqual([]);
    });

    it("revokes the superseded URL of a source together with the new one once it loads", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      const first = String(rig.sources.get("worldgen-draft-altitudes")!.spec.data);
      act(() =>
        rig.show(worldResult({ layers: { ...worldResult().layers, altitudes: layerJson("2") } }))
      );
      const second = rig.sources.get("worldgen-draft-altitudes")!.setData.mock.calls[0]![0];
      expect(revoked).toEqual([]);

      act(() =>
        rig.emit("sourcedata", { sourceId: "worldgen-draft-altitudes", isSourceLoaded: true })
      );
      expect(revoked.sort()).toEqual([first, second].sort());
    });

    it("are revoked for a layer the new world drops", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      const political = String(rig.sources.get("worldgen-draft-political")!.spec.data);
      const { political: _political, ...layers } = worldResult().layers;
      act(() => rig.show(worldResult({ layers })));

      expect(revoked).toEqual([political]);
    });

    it("are revoked when their source fails to load, and only that source's", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      const lakes = String(rig.sources.get("worldgen-draft-lakes")!.spec.data);

      act(() => rig.emit("error", {}));
      act(() => rig.emit("error", { sourceId: "source-political" }));
      expect(revoked).toEqual([]);

      act(() => rig.emit("error", { sourceId: "worldgen-draft-lakes" }));
      expect(revoked).toEqual([lakes]);
      expect(rig.listeners("error")).toBe(1);

      for (const type of ["background", "altitudes", "political", "rivers"]) {
        act(() => rig.emit("error", { sourceId: `worldgen-draft-${type}` }));
      }
      expect(revoked).toHaveLength(5);
      expect(rig.listeners("error")).toBe(0);
      expect(rig.listeners("sourcedata")).toBe(0);
    });

    it("are all revoked when the draft is cleared before they load", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      act(() => rig.show(null));
      expect(revoked.sort()).toEqual(created.map((c) => c.url).sort());
      expect(rig.listeners("sourcedata")).toBe(0);
    });
  });

  describe("the style changes underneath", () => {
    it("builds the draft once the style has loaded", () => {
      const rig = mount();
      rig.setLoaded(false);
      act(() => rig.show(worldResult()));
      expect(rig.draftIds()).toEqual([]);

      rig.setLoaded(true);
      act(() => rig.emit("styledata"));
      expect(rig.draftIds()).toContain("worldgen-draft-background");
      expect(rig.visibility("fill-political")).toBe("none");
    });

    it("rebuilds the draft and hides the live layers again after a style reload", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      rig.reload([...LIVE, BASE[0]!]);
      expect(rig.draftIds()).toEqual([]);
      expect(rig.visibility("fill-political")).toBeUndefined();

      act(() => rig.emit("styledata"));

      expect(rig.draftIds()).toHaveLength(7);
      expect(String(rig.sources.get("worldgen-draft-background")!.spec.data)).toMatch(/^blob:/);
      expect(rig.sources.get("worldgen-draft-relief")!.updateImage).toHaveBeenCalledTimes(1);
      for (const id of LIVE) expect(rig.visibility(id)).toBe("none");

      // And a clear afterwards restores the layers that came back
      act(() => rig.show(null));
      for (const id of LIVE) expect(rig.visibility(id)).toBeUndefined();
    });

    it("hides a live layer added while previewing, and restores it", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      rig.addLive("realm-raster-hillshade");
      act(() => rig.emit("styledata"));
      expect(rig.visibility("realm-raster-hillshade")).toBe("none");

      act(() => rig.show(null));
      expect(rig.visibility("realm-raster-hillshade")).toBeUndefined();
    });

    it("hides a live layer again when it is shown while previewing", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      rig.fake.setLayoutProperty("fill-lakes", "visibility", "visible");
      act(() => rig.emit("styledata"));
      expect(rig.visibility("fill-lakes")).toBe("none");
    });

    it("does not touch the map again when nothing changed", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      const calls = [
        rig.fake.addSource,
        rig.fake.addLayer,
        rig.fake.removeLayer,
        rig.fake.removeSource,
        rig.fake.setLayoutProperty,
      ].map((fn) => fn.mock.calls.length);
      act(() => rig.emit("styledata"));
      act(() => rig.emit("styledata"));
      expect(
        [
          rig.fake.addSource,
          rig.fake.addLayer,
          rig.fake.removeLayer,
          rig.fake.removeSource,
          rig.fake.setLayoutProperty,
        ].map((fn) => fn.mock.calls.length)
      ).toEqual(calls);
      expect(created).toHaveLength(5);
    });

    it("ignores styledata when no world is shown", () => {
      const rig = mount();
      act(() => rig.emit("styledata"));
      expect(rig.fake.addSource).not.toHaveBeenCalled();
    });
  });
});
