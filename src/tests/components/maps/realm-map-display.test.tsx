/**
 * A realm's map display: the base-image and raster art layers on the map, a scale bar measured on the realm's
 * planet radius, the cursor coordinates and the default view. MapLibre is replaced by small fakes that record
 * what the code asks of it.
 */
import type { Map as MapLibreMap } from "maplibre-gl";

jest.mock("~/trpc/react", () => ({ api: {} }));
import { syncRasterLayers } from "~/components/maps/core/utils/realm-map-layers";
import { measureScaleSpanKm } from "~/components/maps/core/utils/realm-scale";
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
  const urlFor = (l: RealmRasterLayer) =>
    `https://x/api/map-rasters/r1/${l.id}/${l.version}/{z}/{x}/{y}`;
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
  it("measures the span with the realm's radius, not Earth's", () => {
    const { map } = fakeProjectionMap();
    const earth = measureScaleSpanKm(map as never, 100, EARTH_RADIUS_KM);
    const small = measureScaleSpanKm(map as never, 100, EARTH_RADIUS_KM / 2);
    // 100 px is 10° of the equator: 2πr × 10/360
    expect(earth).toBeCloseTo((2 * Math.PI * EARTH_RADIUS_KM * 10) / 360, 3);
    expect(small).toBeCloseTo(earth / 2, 6);
  });
});
