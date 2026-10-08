/**
 * A realm's map display: the base-image and raster art layers on the map, a scale bar measured on the realm's
 * planet radius, the cursor coordinates and the default view. MapLibre is replaced by small fakes that record
 * what the code asks of it.
 */
import { act, render, renderHook, screen } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

jest.mock("~/trpc/react", () => ({ api: {} }));

import { RealmMapScale } from "~/components/maps/core/RealmMapScale";
import { useRealmDefaultView } from "~/components/maps/core/hooks/useRealmMapDisplay";
import {
  BASE_IMAGE_COORDINATES,
  BASE_IMAGE_LAYER_ID,
  BASE_IMAGE_SOURCE_ID,
  rasterStyleId,
  syncBaseImage,
  syncRasterLayers,
} from "~/components/maps/core/utils/realm-map-layers";
import {
  formatLngLat,
  measureScaleSpanKm,
  roundScaleDistance,
  scaleBarFor,
} from "~/components/maps/core/utils/realm-scale";
import { EARTH_RADIUS_KM } from "~/lib/maps/planet";
import type { RealmRasterLayer } from "~/lib/maps/realm-map-settings";

/** A fake map: records added sources and layers; knows the political layers exist. */
function fakeStyleMap(existing: string[] = ["fill-political", "stroke-political"]) {
  const layers = new Map<string, Record<string, unknown>>(existing.map((id) => [id, { id }]));
  const order = [...existing];
  const sources = new Map<string, Record<string, unknown>>([["source-political", {}]]);
  const calls = {
    addLayer: jest.fn((spec: { id: string }, before?: string) => {
      layers.set(spec.id, spec);
      order.splice(before ? order.indexOf(before) : order.length, 0, spec.id);
    }),
    removeLayer: jest.fn((id: string) => {
      layers.delete(id);
      order.splice(order.indexOf(id), 1);
    }),
    moveLayer: jest.fn((id: string, before?: string) => {
      order.splice(order.indexOf(id), 1);
      order.splice(before ? order.indexOf(before) : order.length, 0, id);
    }),
  };
  const map = {
    ...calls,
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: jest.fn((id: string, spec: Record<string, unknown>) => sources.set(id, spec)),
    removeSource: jest.fn((id: string) => sources.delete(id)),
    getStyle: () => ({ layers: order.map((id) => ({ id })) }),
  };
  return { map: map as unknown as MapLibreMap, fake: map, order, sources };
}

describe("base image", () => {
  it("is a full-globe image source under the map's data layers", () => {
    const { map, fake, order, sources } = fakeStyleMap([
      "background",
      "fill-climate",
      "fill-political",
    ]);
    syncBaseImage(map, "https://example.org/eurth.png");

    expect(sources.get(BASE_IMAGE_SOURCE_ID)).toEqual({
      type: "image",
      url: "https://example.org/eurth.png",
      coordinates: [
        [-180, 85],
        [180, 85],
        [180, -85],
        [-180, -85],
      ],
    });
    expect(BASE_IMAGE_COORDINATES[0]).toEqual([-180, 85]);
    expect(fake.addLayer.mock.calls[0]![0]).toMatchObject({
      type: "raster",
      source: BASE_IMAGE_SOURCE_ID,
    });
    expect(order).toEqual(["background", BASE_IMAGE_LAYER_ID, "fill-climate", "fill-political"]);
  });

  it("is removed when the realm has none", () => {
    const { map, fake, sources } = fakeStyleMap();
    syncBaseImage(map, "https://example.org/eurth.png");
    syncBaseImage(map, null);
    expect(fake.removeLayer).toHaveBeenCalledWith(BASE_IMAGE_LAYER_ID);
    expect(sources.has(BASE_IMAGE_SOURCE_ID)).toBe(false);
  });
});

describe("raster art layers", () => {
  const art = (over: Partial<RealmRasterLayer>): RealmRasterLayer => ({
    id: "geography",
    label: "Geography",
    kind: "base",
    version: "aaaaaaaa",
    maxZoom: 5,
    ...over,
  });
  const GEO = art({});
  const CLIMATE = art({ id: "climate", kind: "overlay", order: 1, maxZoom: 4 });
  const CURRENTS = art({ id: "currents", kind: "overlay", order: 3, maxZoom: 3 });
  const urlFor = (l: RealmRasterLayer) =>
    `https://x/api/map-rasters/r1/${l.id}/${l.version}/{z}/{x}/{y}`;

  it("draws the base under every data layer and overlays just under the political layer, in order", () => {
    const { map, order, sources } = fakeStyleMap([
      "background",
      "fill-altitudes",
      "fill-political",
      "stroke-political",
    ]);
    syncRasterLayers(map, [GEO, CLIMATE, CURRENTS], urlFor);
    expect(order).toEqual([
      "background",
      rasterStyleId("geography"),
      "fill-altitudes",
      rasterStyleId("climate"),
      rasterStyleId("currents"),
      "fill-political",
      "stroke-political",
    ]);
    expect(sources.get(rasterStyleId("geography"))).toEqual({
      type: "raster",
      tiles: [urlFor(GEO)],
      tileSize: 256,
      maxzoom: 5,
    });
  });

  it("removes layers switched off and re-adds a rebuilt version, keeping the rest", () => {
    const { map, fake, order, sources } = fakeStyleMap(["fill-political"]);
    syncRasterLayers(map, [GEO, CLIMATE], urlFor);
    fake.addSource.mockClear();
    const rebuilt = { ...CLIMATE, version: "bbbbbbbb" };
    syncRasterLayers(map, [rebuilt], urlFor);
    expect(order).toEqual([rasterStyleId("climate"), "fill-political"]);
    expect(sources.has(rasterStyleId("geography"))).toBe(false);
    expect(fake.addSource).toHaveBeenCalledTimes(1);
    expect(sources.get(rasterStyleId("climate"))).toMatchObject({ tiles: [urlFor(rebuilt)] });
  });

  it("puts overlays back under the political layer once it arrives", () => {
    const { map, fake, order } = fakeStyleMap([]);
    syncRasterLayers(map, [CLIMATE], urlFor);
    fake.addLayer({ id: "fill-political" });
    syncRasterLayers(map, [CLIMATE], urlFor);
    expect(order).toEqual([rasterStyleId("climate"), "fill-political"]);
    expect(fake.addLayer).toHaveBeenCalledTimes(2);
  });

  it("clears a realm's art when the map moves to a realm without any", () => {
    const { map, order } = fakeStyleMap(["fill-political"]);
    syncRasterLayers(map, [GEO, CLIMATE], urlFor);
    syncRasterLayers(map, [], urlFor);
    expect(order).toEqual(["fill-political"]);
  });
});

/** A flat fake projection: 1 pixel is 0.1° of longitude on the equator. */
function fakeProjectionMap() {
  const handlers = new Map<string, (e?: unknown) => void>();
  const map = {
    getContainer: () => ({ clientWidth: 800, clientHeight: 600 }) as HTMLElement,
    unproject: ([x]: [number, number]) => ({ lng: x / 10, lat: 0 }),
    on: jest.fn((event: string, fn: (e?: unknown) => void) => handlers.set(event, fn)),
    off: jest.fn((event: string) => handlers.delete(event)),
  };
  return { map: map as unknown as MapLibreMap, handlers };
}

describe("scale bar on the realm's planet", () => {
  it("rounds to 1, 2, 3 or 5 times a power of ten", () => {
    expect([7, 45, 260, 0.4].map(roundScaleDistance)).toEqual([5, 30, 200, 0.3]);
  });

  it("measures the span with the realm's radius, not Earth's", () => {
    const { map } = fakeProjectionMap();
    const earth = measureScaleSpanKm(map as never, 100, EARTH_RADIUS_KM);
    const small = measureScaleSpanKm(map as never, 100, EARTH_RADIUS_KM / 2);
    // 100 px is 10° of the equator: 2πr × 10/360
    expect(earth).toBeCloseTo((2 * Math.PI * EARTH_RADIUS_KM * 10) / 360, 3);
    expect(small).toBeCloseTo(earth / 2, 6);
  });

  it("draws a round distance and a bar that fits it", () => {
    expect(scaleBarFor(1112, 100)).toEqual({ widthPx: 90, label: "1,000 km" });
    expect(scaleBarFor(0.45, 100)).toEqual({ widthPx: 67, label: "300 m" });
    expect(scaleBarFor(0, 100)).toBeNull();
  });

  it("renders the scale for the realm's radius and the cursor's coordinates", () => {
    const frames: FrameRequestCallback[] = [];
    const raf = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => frames.push(cb));
    const flush = () => frames.splice(0).forEach((cb) => cb(0));
    const { map, handlers } = fakeProjectionMap();
    const { rerender } = render(<RealmMapScale map={map} radiusKm={EARTH_RADIUS_KM} />);
    expect(screen.getByTestId("realm-map-scale-label")).toHaveTextContent("1,000 km");

    rerender(<RealmMapScale map={map} radiusKm={EARTH_RADIUS_KM / 2} />);
    expect(screen.getByTestId("realm-map-scale-label")).toHaveTextContent("500 km");

    act(() => handlers.get("mousemove")!({ lngLat: { lng: -12.5, lat: 41.25 } }));
    act(flush);
    expect(screen.getByTestId("realm-map-coordinates")).toHaveTextContent("41.25° N, 12.50° W");
    act(() => handlers.get("mouseout")!());
    act(flush);
    expect(screen.getByTestId("realm-map-coordinates")).toBeEmptyDOMElement();
    raf.mockRestore();
  });

  it("formats coordinates with hemispheres, wrapping longitude", () => {
    expect(formatLngLat(190, -10)).toBe("10.00° S, 170.00° W");
  });
});

describe("default view", () => {
  const display = (defaultView: { center: [number, number]; zoom: number } | null) =>
    ({ realmId: "r_eurth", defaultView }) as never;

  it("opens the realm's map at its default view once", () => {
    const jumpTo = jest.fn();
    const mapRef = { current: { getMap: () => ({ jumpTo }) } } as never;
    const { rerender } = renderHook(
      ({ ready }) =>
        useRealmDefaultView(mapRef, display({ center: [12, 34], zoom: 3 }), {
          mapReady: ready,
          explicitView: false,
        }),
      { initialProps: { ready: false } }
    );
    expect(jumpTo).not.toHaveBeenCalled();
    rerender({ ready: true });
    rerender({ ready: true });
    expect(jumpTo).toHaveBeenCalledTimes(1);
    expect(jumpTo).toHaveBeenCalledWith({ center: [12, 34], zoom: 3 });
  });

  it("keeps a place the page asked for", () => {
    const jumpTo = jest.fn();
    const mapRef = { current: { getMap: () => ({ jumpTo }) } } as never;
    renderHook(() =>
      useRealmDefaultView(mapRef, display({ center: [12, 34], zoom: 3 }), {
        mapReady: true,
        explicitView: true,
      })
    );
    expect(jumpTo).not.toHaveBeenCalled();
  });
});
