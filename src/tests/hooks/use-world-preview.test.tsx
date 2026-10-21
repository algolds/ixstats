/**
 * The world preview on the editor's map: a generated world as `worldgen-draft-` sources and layers under the live
 * ones, the live realm layers hidden and put back exactly as they were, blob URLs revoked, and the draft rebuilt
 * after a style reload. MapLibre is a strict fake (see fake-draft-map).
 */
import { act, renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { useWorldPreview } from "~/hooks/useWorldPreview";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";
import { fakeDraftMap } from "~/tests/helpers/fake-draft-map";
import { worldResult } from "~/tests/helpers/fake-world-worker";

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
/** The draft logs the map errors it listens to; the tests that emit one read it here. */
let errorLog: jest.SpyInstance;

beforeEach(() => {
  created = [];
  revoked = [];
  errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
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

afterEach(() => errorLog.mockRestore());

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

    it("leaves a border layer the user hid by hand alone when the world is cleared", () => {
      const rig = mount();
      act(() => rig.show(worldResult()));
      act(() => rig.show(keptBorders()));
      expect(rig.visibility("fill-political")).toBeUndefined();

      rig.fake.setLayoutProperty("fill-political", "visibility", "none");
      act(() => rig.show(null));

      expect(rig.visibility("fill-political")).toBe("none");
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

      for (const type of ["altitudes", "political", "political-outline", "lakes", "rivers"]) {
        act(() =>
          rig.emit("sourcedata", { sourceId: `worldgen-draft-${type}`, isSourceLoaded: true })
        );
      }
      expect(revoked).toHaveLength(6);
      expect(rig.listeners("sourcedata")).toBe(0);
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

      for (const type of ["background", "altitudes", "political", "political-outline", "rivers"]) {
        act(() => rig.emit("error", { sourceId: `worldgen-draft-${type}` }));
      }
      expect(revoked).toHaveLength(6);
      expect(rig.listeners("error")).toBe(0);
      expect(rig.listeners("sourcedata")).toBe(0);
    });
  });

  describe("the style changes underneath", () => {
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
  });
});
