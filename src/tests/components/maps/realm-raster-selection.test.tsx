/**
 * The raster art switches of a realm's map: every realm opens on the standard style (no base map) with its relief
 * shown, base maps as alternatives, overlays as switches, a fresh start on another realm, one choice shared by
 * everything that shows the realm's switches (the map's layer panel and the editor's Layers panel), and country
 * names hidden while a base map is shown.
 */
import { act, renderHook } from "@testing-library/react";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { RealmRasterLayer } from "~/lib/maps/realm-map-settings";

jest.mock("~/trpc/react", () => ({ api: {} }));

import {
  shownRasterLayers,
  useArtModeLabels,
  useRealmRasterSelection,
  useRealmRelief,
} from "~/components/maps/core/hooks/useRealmMapDisplay";

const art = (over: Partial<RealmRasterLayer>): RealmRasterLayer => ({
  id: "geography",
  label: "Geography",
  kind: "base",
  version: "aaaaaaaa",
  maxZoom: 5,
  ...over,
});
const LAYERS = [
  art({}),
  art({ id: "geography-grey", label: "Grey" }),
  art({ id: "climate", kind: "overlay", order: 1 }),
  art({ id: "currents", kind: "overlay", order: 3 }),
];
const display = (realmId: string, rasterLayers: RealmRasterLayer[]) =>
  ({ realmId, rasterLayers }) as never;
/** A realm id no earlier test has chosen switches for: the choices outlive a hook, as they do for the page. */
let realms = 0;
const freshRealm = () => `realm-${realms++}`;
const RELIEF = art({ id: "relief", label: "Relief", kind: "overlay", order: 9 });

describe("raster selection", () => {
  it("opens on the standard style: no base map, relief on, not in art mode", () => {
    const { result } = renderHook(() => useRealmRasterSelection(display(freshRealm(), LAYERS)));
    expect(result.current.selection).toEqual({ base: null, overlays: ["relief"] });
    // This realm has no relief layer, so there is nothing to show
    expect(result.current.shown).toEqual([]);
    expect(result.current.artMode).toBe(false);
  });

  it("shows the relief of a realm that has one, with no choice made", () => {
    const { result } = renderHook(() =>
      useRealmRasterSelection(display(freshRealm(), [...LAYERS, RELIEF]))
    );
    expect(result.current.shown.map((l) => l.id)).toEqual(["relief"]);
    expect(result.current.artMode).toBe(false);
  });

  it("shows the chosen base and overlays in drawing order", () => {
    const shown = shownRasterLayers(LAYERS, {
      base: "geography-grey",
      overlays: ["currents", "climate"],
    });
    expect(shown.map((l) => l.id)).toEqual(["geography-grey", "climate", "currents"]);
  });

  it("switches bases, toggles overlays, and is in art mode while a base is shown", () => {
    const realm = freshRealm();
    const { result } = renderHook(() => useRealmRasterSelection(display(realm, LAYERS)));
    act(() => result.current.setBase("geography-grey"));
    expect(result.current.artMode).toBe(true);
    act(() => result.current.toggleOverlay("currents"));
    act(() => result.current.toggleOverlay("climate"));
    act(() => result.current.toggleOverlay("currents"));
    expect(result.current.shown.map((l) => l.id)).toEqual(["geography-grey", "climate"]);
    act(() => result.current.setBase(null));
    expect(result.current.artMode).toBe(false);
    expect(result.current.shown.map((l) => l.id)).toEqual(["climate"]);
  });

  it("starts another realm afresh, and shows nothing for a realm without art", () => {
    const [first, second] = [freshRealm(), freshRealm()];
    const { result, rerender } = renderHook(({ d }) => useRealmRasterSelection(d), {
      initialProps: { d: display(first, LAYERS) },
    });
    act(() => result.current.setBase("geography"));
    rerender({ d: display(second, LAYERS) });
    expect(result.current.selection.base).toBeNull();
    rerender({ d: display("default", []) });
    expect(result.current.shown).toEqual([]);
    expect(result.current.artMode).toBe(false);
  });

  it("shares one choice among everything showing the realm's switches", () => {
    const realm = freshRealm();
    const withRelief = display(realm, [...LAYERS, RELIEF]);
    const map = renderHook(() => useRealmRasterSelection(withRelief));
    const layersPanel = renderHook(() => useRealmRasterSelection(withRelief));
    act(() => layersPanel.result.current.toggleOverlay("relief"));
    expect(map.result.current.shown).toEqual([]);
    expect(layersPanel.result.current.selection.overlays).toEqual([]);
    act(() => map.result.current.toggleOverlay("relief"));
    expect(layersPanel.result.current.shown.map((l) => l.id)).toEqual(["relief"]);
  });
});

describe("the relief switch", () => {
  it("is offered only on a realm with a relief layer, on by default, and toggles", () => {
    const realm = freshRealm();
    const none = renderHook(() => useRealmRelief(display(freshRealm(), LAYERS)));
    expect(none.result.current.available).toBe(false);

    const { result } = renderHook(() => useRealmRelief(display(realm, [...LAYERS, RELIEF])));
    expect(result.current).toMatchObject({ available: true, shown: true });
    act(() => result.current.toggle());
    expect(result.current.shown).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.shown).toBe(true);
  });

  it("is the same switch as the map's layer panel has for the overlay", () => {
    const realm = freshRealm();
    const withRelief = display(realm, [...LAYERS, RELIEF]);
    const relief = renderHook(() => useRealmRelief(withRelief));
    const raster = renderHook(() => useRealmRasterSelection(withRelief));
    act(() => raster.result.current.toggleOverlay("relief"));
    expect(relief.result.current.shown).toBe(false);
  });
});

describe("country names in art mode", () => {
  function setup(initial: MapLayerType[]) {
    let visible = new Set<MapLayerType>(initial);
    const toggle = jest.fn((layer: MapLayerType) => {
      visible = new Set(visible);
      if (visible.has(layer)) visible.delete(layer);
      else visible.add(layer);
    });
    const hook = renderHook(({ art }) => useArtModeLabels(art, visible, toggle), {
      initialProps: { art: false },
    });
    const set = (art: boolean) => hook.rerender({ art });
    return { set, toggle, visible: () => visible };
  }

  it("hides them while a base map is shown and brings them back after", () => {
    const { set, visible } = setup(["country_labels"]);
    set(true);
    set(true);
    expect(visible().has("country_labels")).toBe(false);
    set(false);
    set(false);
    expect(visible().has("country_labels")).toBe(true);
  });

  it("leaves names the viewer switched on in art mode alone", () => {
    const { set, toggle, visible } = setup(["country_labels"]);
    set(true);
    set(true);
    toggle("country_labels"); // the viewer turns them on again
    set(true);
    set(false);
    expect(visible().has("country_labels")).toBe(true);
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("does nothing when they were off already", () => {
    const { set, toggle } = setup([]);
    set(true);
    set(false);
    expect(toggle).not.toHaveBeenCalled();
  });
});
